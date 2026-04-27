import uuid
import boto3
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.deps import get_db
from app.auth.cognito import get_current_user
from app.domain.models import Person, Location, Media, MediaPerson, User
from app.domain.enums import MediaType, MediaStatus
from app.http.schemas.person import (
    PersonCreate,
    PersonUpdate,
    PersonResponse,
    LocationSummary,
    ProfilePhotoUploadRequest,
    ProfilePhotoUploadResponse,
    ProfilePhotoConfirmRequest,
)
from app.auth.rbac import require_role
from app.domain.enums import UserRole
from app.services.location_service import find_or_create_location, format_place_text
from app.services.audit_service import log_audit

router = APIRouter()


def _location_summary(loc: Location) -> LocationSummary:
    return LocationSummary(
        id=loc.id,
        city=loc.name,
        region=loc.region,
        country=loc.country,
        latitude=loc.latitude,
        longitude=loc.longitude,
    )


async def _build_person_response(person: Person, db: AsyncSession) -> dict:
    """Build enriched person response dict with nested location objects."""
    data = {
        "id": person.id,
        "first_name": person.first_name,
        "preferred_name": person.preferred_name,
        "middle_name": person.middle_name,
        "last_name": person.last_name,
        "maiden_name": person.maiden_name,
        "suffix": person.suffix,
        "gender": person.gender.value if hasattr(person.gender, "value") else person.gender,
        "birth_date": person.birth_date,
        "birth_date_approx": person.birth_date_approx,
        "death_date": person.death_date,
        "death_date_approx": person.death_date_approx,
        "is_living": person.is_living,
        "bio": person.bio,
        "occupation": person.occupation,
        "profile_photo_url": person.profile_photo_url,
        "nicknames": person.nicknames,
        "birth_place_text": person.birth_place_text,
        "death_place_text": person.death_place_text,
        "birth_location": None,
        "death_location": None,
        "cause_of_death": person.cause_of_death,
        "ethnicity": person.ethnicity,
        "religion": person.religion,
        "education": person.education,
        "military_service": person.military_service,
        "burial_location": person.burial_location,
        "notes": person.notes,
        "created_at": person.created_at,
        "updated_at": person.updated_at,
    }

    if person.birth_location_id:
        result = await db.execute(select(Location).where(Location.id == person.birth_location_id))
        loc = result.scalar_one_or_none()
        if loc:
            data["birth_location"] = _location_summary(loc)

    if person.death_location_id:
        result = await db.execute(select(Location).where(Location.id == person.death_location_id))
        loc = result.scalar_one_or_none()
        if loc:
            data["death_location"] = _location_summary(loc)

    return data


async def _resolve_places(data, person: Person, db: AsyncSession):
    """Resolve PlaceInput fields to Location FKs and update text fields."""
    update_data = data.model_dump(exclude_unset=True)

    if "birth_place" in update_data and update_data["birth_place"]:
        bp = data.birth_place
        loc = await find_or_create_location(db, bp.city, bp.region, bp.country)
        person.birth_location_id = loc.id
        person.birth_place_text = format_place_text(bp.city, bp.region, bp.country)

    if "death_place" in update_data and update_data["death_place"]:
        dp = data.death_place
        loc = await find_or_create_location(db, dp.city, dp.region, dp.country)
        person.death_location_id = loc.id
        person.death_place_text = format_place_text(dp.city, dp.region, dp.country)

    # Apply remaining fields (exclude non-DB fields)
    exclude_fields = {"birth_place", "death_place"}
    for key, value in update_data.items():
        if key not in exclude_fields:
            setattr(person, key, value)


@router.get("", response_model=list[PersonResponse])
async def list_persons(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Person).order_by(Person.last_name, Person.first_name).offset(skip).limit(limit)
    )
    persons = result.scalars().all()
    return [await _build_person_response(p, db) for p in persons]

@router.post("", response_model=PersonResponse, status_code=status.HTTP_201_CREATED)
async def create_person(
    data: PersonCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dump = data.model_dump(exclude={"birth_place", "death_place"})
    person = Person(**dump)
    db.add(person)
    await db.flush()

    await _resolve_places(data, person, db)
    await db.flush()
    await db.refresh(person)

    await log_audit(db, user=current_user, action="create", entity_type="person",
                    entity_id=person.id, entity_label=f"{person.preferred_name or person.first_name} {person.last_name}")

    return await _build_person_response(person, db)

@router.get("/{person_id}", response_model=PersonResponse)
async def get_person(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    return await _build_person_response(person, db)

@router.put("/{person_id}", response_model=PersonResponse)
async def update_person(
    person_id: uuid.UUID,
    data: PersonUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    await _resolve_places(data, person, db)
    await db.flush()
    await db.refresh(person)

    await log_audit(db, user=current_user, action="update", entity_type="person",
                    entity_id=person.id, entity_label=f"{person.preferred_name or person.first_name} {person.last_name}")

    return await _build_person_response(person, db)

@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_person(
    person_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.EDITOR)),
    db: AsyncSession = Depends(get_db),
):
    if current_user.linked_person_id == person_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own linked person record",
        )
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    person_label = f"{person.preferred_name or person.first_name} {person.last_name}"
    await db.delete(person)

    await log_audit(db, user=current_user, action="delete", entity_type="person",
                    entity_id=person_id, entity_label=person_label)

    await db.commit()


@router.get("/{person_id}/summary")
async def get_person_summary(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate an auto-summary of a person's life from their data."""
    from app.domain.models import PersonResidence, Relationship, Story, StoryPerson, TimelineEvent, Media, MediaPerson

    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    # Build life summary parts
    parts = []

    # Born
    if person.birth_place_text and person.birth_date:
        parts.append(f"Born {person.birth_date.year} in {person.birth_place_text}")
    elif person.birth_date:
        parts.append(f"Born {person.birth_date.year}")
    elif person.birth_place_text:
        parts.append(f"Born in {person.birth_place_text}")

    # Spouses
    spouse_result = await db.execute(
        select(Relationship, Person).join(
            Person,
            ((Relationship.person_id == person_id) & (Person.id == Relationship.related_person_id)) |
            ((Relationship.related_person_id == person_id) & (Person.id == Relationship.person_id))
        ).where(
            (Relationship.person_id == person_id) | (Relationship.related_person_id == person_id),
            Relationship.relationship == "SPOUSE",
        )
    )
    spouses = []
    seen_spouse_ids = set()
    for rel, spouse in spouse_result.all():
        if spouse.id != person_id and spouse.id not in seen_spouse_ids:
            seen_spouse_ids.add(spouse.id)
            name = spouse.preferred_name or spouse.first_name
            if rel.marriage_date:
                name += f" in {rel.marriage_date.year}"
            spouses.append(name)
    if spouses:
        parts.append("Married " + ", ".join(spouses))

    # Children count
    child_result = await db.execute(
        select(Relationship).where(
            Relationship.related_person_id == person_id,
            Relationship.relationship == "PARENT_CHILD",
        )
    )
    child_count = len(child_result.all())
    if child_count:
        parts.append(f"{child_count} {'child' if child_count == 1 else 'children'}")

    # Residences
    res_result = await db.execute(
        select(PersonResidence, Location)
        .join(Location, PersonResidence.location_id == Location.id)
        .where(PersonResidence.person_id == person_id, PersonResidence.location_id.isnot(None))
        .order_by(PersonResidence.from_date)
    )
    residence_places = []
    for _res, loc in res_result.all():
        if loc.name and loc.name not in residence_places:
            residence_places.append(loc.name)
    if residence_places:
        parts.append("Lived in " + ", ".join(residence_places[:3]))

    # Death
    if not person.is_living and person.death_place_text and person.death_date:
        parts.append(f"Died {person.death_date.year} in {person.death_place_text}")
    elif not person.is_living and person.death_date:
        parts.append(f"Died {person.death_date.year}")

    # Counts for quick stats
    story_result = await db.execute(
        select(Story.id).join(StoryPerson, Story.id == StoryPerson.story_id)
        .where(StoryPerson.person_id == person_id, Story.published.is_(True))
    )
    story_count = len(story_result.all())

    event_result = await db.execute(
        select(TimelineEvent.id).where(TimelineEvent.person_id == person_id)
    )
    event_count = len(event_result.all())

    media_result = await db.execute(
        select(Media.id).join(MediaPerson, Media.id == MediaPerson.media_id)
        .where(MediaPerson.person_id == person_id)
    )
    media_count = len(media_result.all())

    return {
        "summary": ". ".join(parts) + "." if parts else "",
        "story_count": story_count,
        "timeline_event_count": event_count,
        "media_count": media_count,
        "child_count": child_count,
        "spouse_names": spouses,
    }


@router.post(
    "/{person_id}/profile-photo/upload-url",
    response_model=ProfilePhotoUploadResponse,
)
async def profile_photo_upload_url(
    person_id: uuid.UUID,
    data: ProfilePhotoUploadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a presigned S3 PUT URL for profile photo upload."""
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    ext = data.filename.rsplit(".", 1)[-1].lower() if "." in data.filename else "jpg"
    s3_key = f"profiles/{person_id}/{uuid.uuid4()}.{ext}"

    s3_client = boto3.client("s3", region_name=settings.s3_region)
    upload_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.s3_media_bucket,
            "Key": s3_key,
            "ContentType": data.content_type,
        },
        ExpiresIn=3600,
    )

    cdn_url = f"/media/{s3_key}"
    return ProfilePhotoUploadResponse(upload_url=upload_url, s3_key=s3_key, cdn_url=cdn_url)


@router.post(
    "/{person_id}/profile-photo/confirm",
    response_model=PersonResponse,
)
async def profile_photo_confirm(
    person_id: uuid.UUID,
    data: ProfilePhotoConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm profile photo upload: create Media record, tag person, set profile URL."""
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    # Create media record
    media = Media(
        title="Profile photo",
        media_type=MediaType.PHOTO,
        s3_key=data.s3_key,
        s3_bucket=data.s3_bucket,
        file_size_bytes=data.file_size_bytes,
        mime_type=data.mime_type,
        status=MediaStatus.READY,
        uploaded_by=current_user.id,
    )
    db.add(media)
    await db.flush()

    # Tag person in media
    tag = MediaPerson(media_id=media.id, person_id=person_id, label="Profile photo")
    db.add(tag)

    # Set profile photo URL
    person.profile_photo_url = f"/media/{data.s3_key}"
    await db.flush()
    await db.refresh(person)

    return await _build_person_response(person, db)


from app.http.schemas.orbit import OrbitResponse
from app.services.orbit_service import build_orbit


@router.get("/{person_id}/orbit", response_model=OrbitResponse)
async def get_person_orbit(
    person_id: uuid.UUID,
    ancestor_depth: int = 4,
    descendant_depth: int = 3,
    include_siblings: bool = False,
    include_spouses: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrbitResponse:
    try:
        result = await build_orbit(
            db,
            person_id=person_id,
            ancestor_depth=ancestor_depth,
            descendant_depth=descendant_depth,
            include_siblings=include_siblings,
            include_spouses=include_spouses,
        )
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await log_audit(
        db,
        user=current_user,
        action="view_orbit",
        entity_type="person",
        entity_id=person_id,
        details={
            "ancestor_depth": ancestor_depth,
            "descendant_depth": descendant_depth,
            "include_siblings": include_siblings,
            "include_spouses": include_spouses,
        },
    )
    await db.commit()
    return result
