import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db
from app.domain.models import Person, PersonResidence, Location

router = APIRouter()


class MapPlace(BaseModel):
    person_id: uuid.UUID
    person_name: str
    place_type: str  # "birth" | "death" | "residence"
    location_id: uuid.UUID
    city: str
    region: str | None
    country: str | None
    latitude: float
    longitude: float
    year: int | None = None


@router.get("/places", response_model=list[MapPlace])
async def get_map_places(
    db: AsyncSession = Depends(get_db),
):
    """Return all person-place associations with coordinates for map rendering."""
    places: list[MapPlace] = []

    # Birth locations
    result = await db.execute(
        select(Person, Location)
        .join(Location, Person.birth_location_id == Location.id)
        .where(
            Person.birth_location_id.isnot(None),
            Location.latitude.isnot(None),
            Location.longitude.isnot(None),
        )
    )
    for person, loc in result.all():
        birth_year = None
        if person.birth_date:
            try:
                birth_year = person.birth_date.year
            except AttributeError:
                pass
        places.append(MapPlace(
            person_id=person.id,
            person_name=f"{person.first_name} {person.last_name}",
            place_type="birth",
            location_id=loc.id,
            city=loc.name,
            region=loc.region,
            country=loc.country,
            latitude=loc.latitude,
            longitude=loc.longitude,
            year=birth_year,
        ))

    # Death locations
    result = await db.execute(
        select(Person, Location)
        .join(Location, Person.death_location_id == Location.id)
        .where(
            Person.death_location_id.isnot(None),
            Location.latitude.isnot(None),
            Location.longitude.isnot(None),
        )
    )
    for person, loc in result.all():
        death_year = None
        if person.death_date:
            try:
                death_year = person.death_date.year
            except AttributeError:
                pass
        places.append(MapPlace(
            person_id=person.id,
            person_name=f"{person.first_name} {person.last_name}",
            place_type="death",
            location_id=loc.id,
            city=loc.name,
            region=loc.region,
            country=loc.country,
            latitude=loc.latitude,
            longitude=loc.longitude,
            year=death_year,
        ))

    # Residences
    result = await db.execute(
        select(PersonResidence, Location, Person)
        .join(Location, PersonResidence.location_id == Location.id)
        .join(Person, PersonResidence.person_id == Person.id)
        .where(
            PersonResidence.location_id.isnot(None),
            Location.latitude.isnot(None),
            Location.longitude.isnot(None),
        )
    )
    for residence, loc, person in result.all():
        res_year = None
        if residence.from_date:
            try:
                res_year = residence.from_date.year
            except AttributeError:
                pass
        places.append(MapPlace(
            person_id=person.id,
            person_name=f"{person.first_name} {person.last_name}",
            place_type="residence",
            location_id=loc.id,
            city=loc.name,
            region=loc.region,
            country=loc.country,
            latitude=loc.latitude,
            longitude=loc.longitude,
            year=res_year,
        ))

    return places
