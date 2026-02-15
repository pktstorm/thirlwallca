from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db
from app.domain.models import Person
from app.http.schemas.person import PersonResponse

router = APIRouter()


@router.get("", response_model=list[PersonResponse])
async def search_persons(
    q: str = Query("", description="Search query string"),
    place: str | None = Query(None, description="Filter by place of birth/death"),
    occupation: str | None = Query(None, description="Filter by occupation"),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Search persons using ILIKE for simple text matching.

    Searches across first_name, last_name, maiden_name, and bio fields.
    Optionally filter by occupation.
    """
    stmt = select(Person)

    if q:
        search_term = f"%{q}%"
        stmt = stmt.where(
            or_(
                Person.first_name.ilike(search_term),
                Person.last_name.ilike(search_term),
                Person.maiden_name.ilike(search_term),
                Person.bio.ilike(search_term),
            )
        )

    if occupation:
        stmt = stmt.where(Person.occupation.ilike(f"%{occupation}%"))

    if place:
        # Place filtering requires joining with locations table through birth/death location
        # For now, use simple approach - will be enhanced when pg_trgm is added
        from app.domain.models import Location

        stmt = stmt.outerjoin(
            Location,
            or_(
                Person.birth_location_id == Location.id,
                Person.death_location_id == Location.id,
            ),
        ).where(
            or_(
                Location.name.ilike(f"%{place}%"),
                Location.country.ilike(f"%{place}%"),
                Location.region.ilike(f"%{place}%"),
            )
        )

    stmt = stmt.order_by(Person.last_name, Person.first_name).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()
