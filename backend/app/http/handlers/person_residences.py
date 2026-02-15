import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db
from app.domain.models import Person, PersonResidence, Location
from app.http.schemas.person import (
    PersonResidenceCreate, PersonResidenceUpdate, PersonResidenceResponse, LocationSummary,
)
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


async def _build_residence_response(res: PersonResidence, db: AsyncSession) -> dict:
    data = {
        "id": res.id,
        "person_id": res.person_id,
        "location_id": res.location_id,
        "place_text": res.place_text,
        "location": None,
        "from_date": res.from_date,
        "to_date": res.to_date,
        "is_current": res.is_current,
        "notes": res.notes,
        "created_at": res.created_at,
        "updated_at": res.updated_at,
    }

    if res.location_id:
        result = await db.execute(select(Location).where(Location.id == res.location_id))
        loc = result.scalar_one_or_none()
        if loc:
            data["location"] = _location_summary(loc)

    return data


@router.get("/{person_id}/residences", response_model=list[PersonResidenceResponse])
async def list_residences(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Person).where(Person.id == person_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    result = await db.execute(
        select(PersonResidence)
        .where(PersonResidence.person_id == person_id)
        .order_by(PersonResidence.from_date.asc().nulls_last())
    )
    residences = result.scalars().all()
    return [await _build_residence_response(r, db) for r in residences]


@router.post("/{person_id}/residences", response_model=PersonResidenceResponse, status_code=status.HTTP_201_CREATED)
async def create_residence(
    person_id: uuid.UUID,
    data: PersonResidenceCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Person).where(Person.id == person_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    dump = data.model_dump(exclude={"place"})
    residence = PersonResidence(person_id=person_id, **dump)
    db.add(residence)

    # Resolve structured place
    if data.place:
        loc = await find_or_create_location(db, data.place.city, data.place.region, data.place.country)
        residence.location_id = loc.id
        residence.place_text = format_place_text(data.place.city, data.place.region, data.place.country)

    await db.flush()
    await db.refresh(residence)
    return await _build_residence_response(residence, db)


@router.put("/{person_id}/residences/{residence_id}", response_model=PersonResidenceResponse)
async def update_residence(
    person_id: uuid.UUID,
    residence_id: uuid.UUID,
    data: PersonResidenceUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PersonResidence).where(
            PersonResidence.id == residence_id,
            PersonResidence.person_id == person_id,
        )
    )
    residence = result.scalar_one_or_none()
    if not residence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Residence not found")

    update_data = data.model_dump(exclude_unset=True)

    # Resolve structured place
    if "place" in update_data and update_data["place"]:
        loc = await find_or_create_location(db, data.place.city, data.place.region, data.place.country)
        residence.location_id = loc.id
        residence.place_text = format_place_text(data.place.city, data.place.region, data.place.country)

    # Apply remaining fields
    for key, value in update_data.items():
        if key != "place":
            setattr(residence, key, value)

    await db.flush()
    await db.refresh(residence)
    return await _build_residence_response(residence, db)


@router.delete("/{person_id}/residences/{residence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_residence(
    person_id: uuid.UUID,
    residence_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PersonResidence).where(
            PersonResidence.id == residence_id,
            PersonResidence.person_id == person_id,
        )
    )
    residence = result.scalar_one_or_none()
    if not residence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Residence not found")
    await db.delete(residence)
