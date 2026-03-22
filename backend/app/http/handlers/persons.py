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
    db: AsyncSession = Depends(get_db),
):
    # Create person with non-place fields first
    dump = data.model_dump(exclude={"birth_place", "death_place"})
    person = Person(**dump)
    db.add(person)
    await db.flush()

    # Resolve structured places
    await _resolve_places(data, person, db)
    await db.flush()
    await db.refresh(person)
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
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    await _resolve_places(data, person, db)
    await db.flush()
    await db.refresh(person)
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
    await db.delete(person)
    await db.commit()


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
