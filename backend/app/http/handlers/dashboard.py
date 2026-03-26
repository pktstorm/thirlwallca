from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.domain.models import (
    Person,
    Relationship,
    Story,
    Media,
    Location,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class OnThisDayItem(BaseModel):
    type: str  # "birth", "death", "marriage"
    person_id: str | None = None
    person_name: str
    year: int | None = None
    detail: str | None = None


class RecentActivityItem(BaseModel):
    type: str  # "person", "story", "media"
    id: str
    label: str
    created_at: datetime


class FamilyStats(BaseModel):
    total_persons: int
    total_locations: int
    total_stories: int
    total_media: int
    total_generations: int
    countries_lived_in: int


class DashboardResponse(BaseModel):
    on_this_day: list[OnThisDayItem]
    recent_activity: list[RecentActivityItem]
    family_stats: FamilyStats
    fun_facts: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _compute_generations(db: AsyncSession) -> int:
    """Compute the number of distinct generation levels using parent-child relationships."""
    # Build generation map: walk from roots (people with no parents) downward
    rel_result = await db.execute(
        select(Relationship.person_id, Relationship.related_person_id).where(
            Relationship.relationship == "parent_child"
        )
    )
    rows = rel_result.all()

    # person_id is parent, related_person_id is child
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

    if not all_people:
        return 0

    roots = all_people - has_parent
    if not roots:
        # Cycle or data issue – count 1
        return 1

    # BFS to find max depth
    max_gen = 0
    queue: list[tuple[str, int]] = [(r, 0) for r in roots]
    visited: set[str] = set()

    while queue:
        person, gen = queue.pop(0)
        if person in visited:
            continue
        visited.add(person)
        if gen > max_gen:
            max_gen = gen
        for child in children_of.get(person, []):
            queue.append((child, gen + 1))

    return max_gen + 1  # number of levels, not zero-indexed


async def _generate_fun_facts(db: AsyncSession) -> list[str]:
    """Generate a handful of interesting auto-generated facts."""
    facts: list[str] = []

    # Oldest person
    oldest = await db.execute(
        select(Person.first_name, Person.last_name, Person.birth_date)
        .where(Person.birth_date.isnot(None))
        .order_by(Person.birth_date.asc())
        .limit(1)
    )
    row = oldest.first()
    if row:
        facts.append(f"The earliest recorded birth is {row.first_name} {row.last_name} ({row.birth_date.year}).")

    # Most common last name
    common_name = await db.execute(
        select(Person.last_name, func.count().label("cnt"))
        .group_by(Person.last_name)
        .order_by(func.count().desc())
        .limit(1)
    )
    name_row = common_name.first()
    if name_row and name_row.cnt > 1:
        facts.append(f"The most common surname is {name_row.last_name} with {name_row.cnt} people.")

    # Total marriages
    marriages_count = await db.execute(
        select(func.count()).select_from(Relationship).where(Relationship.relationship == "spouse")
    )
    mc = marriages_count.scalar() or 0
    if mc > 0:
        facts.append(f"There are {mc} recorded marriages in the family.")

    # Total photos
    photo_count = await db.execute(
        select(func.count()).select_from(Media).where(Media.media_type == "photo")
    )
    pc = photo_count.scalar() or 0
    if pc > 0:
        facts.append(f"The family archive contains {pc} photos.")

    return facts


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
):
    today = datetime.now(timezone.utc)
    month = today.month
    day = today.day
    thirty_days_ago = today - timedelta(days=30)

    # --- On This Day ---
    on_this_day: list[dict[str, Any]] = []

    # Births
    births = await db.execute(
        select(Person).where(
            extract("month", Person.birth_date) == month,
            extract("day", Person.birth_date) == day,
        )
    )
    for p in births.scalars().all():
        on_this_day.append({
            "type": "birth",
            "person_id": str(p.id),
            "person_name": f"{p.first_name} {p.last_name}",
            "year": p.birth_date.year if p.birth_date else None,
            "detail": f"Born on this day in {p.birth_date.year}" if p.birth_date else "Born on this day",
        })

    # Deaths
    deaths = await db.execute(
        select(Person).where(
            extract("month", Person.death_date) == month,
            extract("day", Person.death_date) == day,
        )
    )
    for p in deaths.scalars().all():
        on_this_day.append({
            "type": "death",
            "person_id": str(p.id),
            "person_name": f"{p.first_name} {p.last_name}",
            "year": p.death_date.year if p.death_date else None,
            "detail": f"Passed away on this day in {p.death_date.year}" if p.death_date else "Passed away on this day",
        })

    # Marriages
    marriages = await db.execute(
        select(Relationship).where(
            Relationship.relationship == "spouse",
            extract("month", Relationship.marriage_date) == month,
            extract("day", Relationship.marriage_date) == day,
        )
    )
    for rel in marriages.scalars().all():
        # Fetch both persons
        p1_result = await db.execute(select(Person).where(Person.id == rel.person_id))
        p2_result = await db.execute(select(Person).where(Person.id == rel.related_person_id))
        p1 = p1_result.scalar_one_or_none()
        p2 = p2_result.scalar_one_or_none()
        if p1 and p2:
            on_this_day.append({
                "type": "marriage",
                "person_id": str(p1.id),
                "person_name": f"{p1.first_name} {p1.last_name} & {p2.first_name} {p2.last_name}",
                "year": rel.marriage_date.year if rel.marriage_date else None,
                "detail": f"Married on this day in {rel.marriage_date.year}" if rel.marriage_date else "Married on this day",
            })

    # --- Recent Activity (from audit logs if available, else from entity tables) ---
    from app.domain.models import AuditLog

    recent_activity: list[dict[str, Any]] = []

    audit_result = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.created_at >= thirty_days_ago,
            AuditLog.entity_type != "user",
        )
        .order_by(AuditLog.created_at.desc())
        .limit(20)
    )
    audit_logs = audit_result.scalars().all()

    if audit_logs:
        for log in audit_logs:
            label = ""
            if log.user_name and log.entity_label:
                label = f"{log.user_name} {log.action}d {log.entity_label}"
            elif log.entity_label:
                label = f"{log.entity_label} was {log.action}d"
            else:
                label = f"{log.action.capitalize()} {log.entity_type}"

            recent_activity.append({
                "type": log.entity_type,
                "id": log.entity_id or str(log.id),
                "label": label,
                "created_at": log.created_at,
            })
    else:
        # Fallback: use entity tables if no audit logs yet
        recent_persons = await db.execute(
            select(Person)
            .where(Person.created_at >= thirty_days_ago)
            .order_by(Person.created_at.desc())
            .limit(10)
        )
        for p in recent_persons.scalars().all():
            recent_activity.append({
                "type": "person",
                "id": str(p.id),
                "label": f"{p.first_name} {p.last_name} was added",
                "created_at": p.created_at,
            })

        recent_stories = await db.execute(
            select(Story)
            .where(Story.created_at >= thirty_days_ago)
            .order_by(Story.created_at.desc())
            .limit(10)
        )
        for s in recent_stories.scalars().all():
            recent_activity.append({
                "type": "story",
                "id": str(s.id),
                "label": f"Story published: {s.title}",
                "created_at": s.created_at,
            })

        recent_activity.sort(key=lambda x: x["created_at"], reverse=True)

    # --- Family Stats ---
    total_persons = (await db.execute(select(func.count()).select_from(Person))).scalar() or 0
    total_locations = (await db.execute(select(func.count()).select_from(Location))).scalar() or 0
    total_stories = (await db.execute(select(func.count()).select_from(Story))).scalar() or 0
    total_media = (await db.execute(select(func.count()).select_from(Media))).scalar() or 0

    # Countries lived in (distinct countries from locations)
    countries_result = await db.execute(
        select(func.count(func.distinct(Location.country))).where(Location.country.isnot(None))
    )
    countries_lived_in = countries_result.scalar() or 0

    total_generations = await _compute_generations(db)

    family_stats = {
        "total_persons": total_persons,
        "total_locations": total_locations,
        "total_stories": total_stories,
        "total_media": total_media,
        "total_generations": total_generations,
        "countries_lived_in": countries_lived_in,
    }

    # --- Fun Facts ---
    fun_facts = await _generate_fun_facts(db)

    return {
        "on_this_day": on_this_day,
        "recent_activity": recent_activity,
        "family_stats": family_stats,
        "fun_facts": fun_facts,
    }
