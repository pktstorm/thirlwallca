from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.domain.models import Person, Location, PersonResidence, Relationship

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class NameCount(BaseModel):
    name: str
    count: int


class LifespanByGeneration(BaseModel):
    generation: int
    average_years: float
    count: int


class LifespanStats(BaseModel):
    average_years: float | None
    min_years: float | None
    max_years: float | None
    by_generation: list[LifespanByGeneration]


class CountryCount(BaseModel):
    country: str
    count: int


class GenerationCount(BaseModel):
    generation: int
    count: int


class MigrationRoute(BaseModel):
    origin: str
    destination: str
    count: int


class FamilyStatsResponse(BaseModel):
    name_frequencies: dict[str, list[NameCount]]
    lifespan_stats: LifespanStats
    geographic_distribution: list[CountryCount]
    generation_counts: list[GenerationCount]
    migration_stats: list[MigrationRoute]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _years_between(birth: date, death: date) -> float:
    """Calculate approximate years between two dates."""
    delta = death - birth
    return round(delta.days / 365.25, 1)


async def _build_generation_map(db: AsyncSession) -> dict[str, int]:
    """Assign a generation level to each person using parent-child relationships.

    Roots (no parents) are generation 0.
    """
    rel_result = await db.execute(
        select(Relationship.person_id, Relationship.related_person_id).where(
            Relationship.relationship == "parent_child"
        )
    )
    rows = rel_result.all()

    children_of: dict[str, set[str]] = {}
    has_parent: set[str] = set()
    all_people: set[str] = set()

    for parent_id, child_id in rows:
        pid = str(parent_id)
        cid = str(child_id)
        children_of.setdefault(pid, set()).add(cid)
        has_parent.add(cid)
        all_people.add(pid)
        all_people.add(cid)

    roots = all_people - has_parent
    generation_map: dict[str, int] = {}

    # BFS from roots
    queue: list[tuple[str, int]] = [(r, 0) for r in roots]
    while queue:
        person, gen = queue.pop(0)
        if person in generation_map:
            continue
        generation_map[person] = gen
        for child in children_of.get(person, []):
            queue.append((child, gen + 1))

    return generation_map


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("", response_model=FamilyStatsResponse)
async def get_family_stats(
    db: AsyncSession = Depends(get_db),
):
    # --- Name Frequencies ---
    first_names_result = await db.execute(
        select(Person.first_name, func.count().label("cnt"))
        .group_by(Person.first_name)
        .order_by(func.count().desc())
        .limit(10)
    )
    top_first_names = [{"name": r.first_name, "count": r.cnt} for r in first_names_result.all()]

    last_names_result = await db.execute(
        select(Person.last_name, func.count().label("cnt"))
        .group_by(Person.last_name)
        .order_by(func.count().desc())
        .limit(10)
    )
    top_last_names = [{"name": r.last_name, "count": r.cnt} for r in last_names_result.all()]

    name_frequencies = {
        "first_names": top_first_names,
        "last_names": top_last_names,
    }

    # --- Lifespan Stats ---
    # Fetch deceased persons with both birth and death dates
    deceased_result = await db.execute(
        select(Person.id, Person.birth_date, Person.death_date).where(
            Person.birth_date.isnot(None),
            Person.death_date.isnot(None),
            Person.is_living == False,  # noqa: E712
        )
    )
    deceased_rows = deceased_result.all()

    lifespans: list[tuple[str, float]] = []  # (person_id_str, years)
    for row in deceased_rows:
        years = _years_between(row.birth_date, row.death_date)
        if years >= 0:
            lifespans.append((str(row.id), years))

    avg_years: float | None = None
    min_years: float | None = None
    max_years: float | None = None
    if lifespans:
        years_list = [y for _, y in lifespans]
        avg_years = round(sum(years_list) / len(years_list), 1)
        min_years = min(years_list)
        max_years = max(years_list)

    # Lifespan by generation
    generation_map = await _build_generation_map(db)
    gen_lifespans: dict[int, list[float]] = {}
    for pid_str, years in lifespans:
        gen = generation_map.get(pid_str)
        if gen is not None:
            gen_lifespans.setdefault(gen, []).append(years)

    by_generation = []
    for gen in sorted(gen_lifespans.keys()):
        vals = gen_lifespans[gen]
        by_generation.append({
            "generation": gen,
            "average_years": round(sum(vals) / len(vals), 1),
            "count": len(vals),
        })

    lifespan_stats = {
        "average_years": avg_years,
        "min_years": min_years,
        "max_years": max_years,
        "by_generation": by_generation,
    }

    # --- Geographic Distribution ---
    # Collect countries from birth/death locations and residences
    country_counts: dict[str, int] = {}

    # Birth locations
    birth_loc_result = await db.execute(
        select(Location.country, func.count().label("cnt"))
        .join(Person, Person.birth_location_id == Location.id)
        .where(Location.country.isnot(None))
        .group_by(Location.country)
    )
    for row in birth_loc_result.all():
        country_counts[row.country] = country_counts.get(row.country, 0) + row.cnt

    # Death locations
    death_loc_result = await db.execute(
        select(Location.country, func.count().label("cnt"))
        .join(Person, Person.death_location_id == Location.id)
        .where(Location.country.isnot(None))
        .group_by(Location.country)
    )
    for row in death_loc_result.all():
        country_counts[row.country] = country_counts.get(row.country, 0) + row.cnt

    # Residences
    res_loc_result = await db.execute(
        select(Location.country, func.count().label("cnt"))
        .join(PersonResidence, PersonResidence.location_id == Location.id)
        .where(Location.country.isnot(None))
        .group_by(Location.country)
    )
    for row in res_loc_result.all():
        country_counts[row.country] = country_counts.get(row.country, 0) + row.cnt

    geographic_distribution = sorted(
        [{"country": k, "count": v} for k, v in country_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )

    # --- Generation Counts ---
    # Count persons per generation (include all persons with a generation assignment)
    gen_count_map: dict[int, int] = {}
    for gen in generation_map.values():
        gen_count_map[gen] = gen_count_map.get(gen, 0) + 1

    generation_counts = [
        {"generation": g, "count": c}
        for g, c in sorted(gen_count_map.items())
    ]

    # --- Migration Stats ---
    # Top origin/destination country pairs from birth->residence or birth->death locations
    # Simple approach: pair birth country with each residence/death country
    migration_pairs: dict[tuple[str, str], int] = {}

    # Fetch persons with birth location country
    person_birth_country = await db.execute(
        select(Person.id, Location.country)
        .join(Location, Person.birth_location_id == Location.id)
        .where(Location.country.isnot(None))
    )
    birth_country_map: dict[str, str] = {}
    for row in person_birth_country.all():
        birth_country_map[str(row.id)] = row.country

    # Pair birth country with death country
    person_death_country = await db.execute(
        select(Person.id, Location.country)
        .join(Location, Person.death_location_id == Location.id)
        .where(Location.country.isnot(None))
    )
    for row in person_death_country.all():
        pid_str = str(row.id)
        origin = birth_country_map.get(pid_str)
        if origin and origin != row.country:
            pair = (origin, row.country)
            migration_pairs[pair] = migration_pairs.get(pair, 0) + 1

    # Pair birth country with residence countries
    person_res_country = await db.execute(
        select(PersonResidence.person_id, Location.country)
        .join(Location, PersonResidence.location_id == Location.id)
        .where(Location.country.isnot(None))
    )
    for row in person_res_country.all():
        pid_str = str(row.person_id)
        origin = birth_country_map.get(pid_str)
        if origin and origin != row.country:
            pair = (origin, row.country)
            migration_pairs[pair] = migration_pairs.get(pair, 0) + 1

    migration_stats = sorted(
        [{"origin": k[0], "destination": k[1], "count": v} for k, v in migration_pairs.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:20]  # top 20

    return {
        "name_frequencies": name_frequencies,
        "lifespan_stats": lifespan_stats,
        "geographic_distribution": geographic_distribution,
        "generation_counts": generation_counts,
        "migration_stats": migration_stats,
    }
