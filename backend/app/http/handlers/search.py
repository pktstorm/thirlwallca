from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, select, or_, func
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

    Searches across first_name, last_name, maiden_name, bio, and nicknames.
    Multi-word queries also match against concatenated full name so that
    "Sam Thirlwall" finds "Samuel Thirlwall" via prefix matching, and
    "Sam Thirlwall" finds someone whose first name starts with "Sam".
    """
    stmt = select(Person)

    if q:
        search_term = f"%{q}%"
        # Split query into individual words for prefix matching
        words = q.strip().split()

        # Concatenated full name for multi-word queries like "Sam Thirlwall"
        full_name = func.concat_ws(' ', Person.first_name, Person.middle_name, Person.last_name)

        # Build word-level conditions: each word must prefix-match at least one
        # name field. All words must match (AND) so "Sam Thirlwall" requires both
        # "Sam%" on a name field AND "Thirlwall%" on a name field.
        word_conditions = []
        for word in words:
            word_pattern = f"{word}%"
            word_conditions.append(
                or_(
                    Person.first_name.ilike(word_pattern),
                    Person.middle_name.ilike(word_pattern),
                    Person.last_name.ilike(word_pattern),
                    Person.maiden_name.ilike(word_pattern),
                    Person.nicknames.ilike(f"%{word}%"),
                )
            )

        # Combine: all words must match (AND across words)
        all_words_match = and_(*word_conditions) if len(word_conditions) > 1 else word_conditions[0]

        stmt = stmt.where(
            or_(
                # Original single-field ILIKE
                Person.first_name.ilike(search_term),
                Person.last_name.ilike(search_term),
                Person.maiden_name.ilike(search_term),
                Person.bio.ilike(search_term),
                Person.nicknames.ilike(search_term),
                # Full name match (e.g., "Sam Thirlwall" matches "Samuel ... Thirlwall")
                full_name.ilike(search_term),
                # All words prefix-match name parts
                all_words_match,
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
