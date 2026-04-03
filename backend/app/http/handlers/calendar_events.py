import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.domain.models import Person, Relationship

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CalendarEvent(BaseModel):
    date: str  # MM-DD format for recurring events
    type: str  # birthday, death_anniversary, wedding_anniversary
    person_name: str
    person_id: uuid.UUID
    year_of_event: Optional[int] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_date(d: date) -> str:
    """Return MM-DD string from a date."""
    return f"{d.month:02d}-{d.day:02d}"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[CalendarEvent])
async def list_calendar_events(
    month: int = Query(..., ge=1, le=12),
    year: Optional[int] = Query(None, description="Year for context; filtering uses month only"),
    db: AsyncSession = Depends(get_db),
):
    events: list[dict] = []

    # --- Births ---
    birth_stmt = (
        select(Person)
        .where(
            Person.birth_date.isnot(None),
            extract("month", Person.birth_date) == month,
        )
    )
    birth_result = await db.execute(birth_stmt)
    for p in birth_result.scalars().all():
        events.append({
            "date": _format_date(p.birth_date),
            "type": "birthday",
            "person_name": f"{p.first_name} {p.last_name}",
            "person_id": p.id,
            "year_of_event": p.birth_date.year,
        })

    # --- Deaths ---
    death_stmt = (
        select(Person)
        .where(
            Person.death_date.isnot(None),
            extract("month", Person.death_date) == month,
        )
    )
    death_result = await db.execute(death_stmt)
    for p in death_result.scalars().all():
        events.append({
            "date": _format_date(p.death_date),
            "type": "death_anniversary",
            "person_name": f"{p.first_name} {p.last_name}",
            "person_id": p.id,
            "year_of_event": p.death_date.year,
        })

    # --- Marriages ---
    marriage_stmt = (
        select(Relationship)
        .where(
            Relationship.marriage_date.isnot(None),
            extract("month", Relationship.marriage_date) == month,
        )
    )
    marriage_result = await db.execute(marriage_stmt)
    marriages = marriage_result.scalars().all()

    if marriages:
        # Gather person names for both sides of each marriage
        person_ids = set()
        for m in marriages:
            person_ids.add(m.person_id)
            person_ids.add(m.related_person_id)
        persons_result = await db.execute(select(Person).where(Person.id.in_(list(person_ids))))
        person_map: dict[uuid.UUID, Person] = {p.id: p for p in persons_result.scalars().all()}

        for m in marriages:
            p1 = person_map.get(m.person_id)
            p2 = person_map.get(m.related_person_id)
            name1 = f"{p1.first_name} {p1.last_name}" if p1 else "Unknown"
            name2 = f"{p2.first_name} {p2.last_name}" if p2 else "Unknown"
            events.append({
                "date": _format_date(m.marriage_date),
                "type": "wedding_anniversary",
                "person_name": f"{name1} & {name2}",
                "person_id": m.person_id,
                "year_of_event": m.marriage_date.year,
            })

    # Sort by day within the month
    events.sort(key=lambda e: e["date"])
    return events


@router.get("/ical", response_class=PlainTextResponse)
async def get_ical(
    db: AsyncSession = Depends(get_db),
):
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Thirlwall.ca//Family Calendar//EN",
        "X-WR-CALNAME:Thirlwall Family Calendar",
    ]

    # --- Births ---
    birth_result = await db.execute(select(Person).where(Person.birth_date.isnot(None)))
    for p in birth_result.scalars().all():
        d = p.birth_date
        name = f"{p.first_name} {p.last_name}"
        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:birthday-{p.id}@thirlwall.ca")
        lines.append(f"DTSTART;VALUE=DATE:{d.year:04d}{d.month:02d}{d.day:02d}")
        lines.append("RRULE:FREQ=YEARLY")
        lines.append(f"SUMMARY:Birthday: {name}")
        lines.append("END:VEVENT")

    # --- Deaths ---
    death_result = await db.execute(select(Person).where(Person.death_date.isnot(None)))
    for p in death_result.scalars().all():
        d = p.death_date
        name = f"{p.first_name} {p.last_name}"
        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:death-{p.id}@thirlwall.ca")
        lines.append(f"DTSTART;VALUE=DATE:{d.year:04d}{d.month:02d}{d.day:02d}")
        lines.append("RRULE:FREQ=YEARLY")
        lines.append(f"SUMMARY:Anniversary of {name}'s passing")
        lines.append("END:VEVENT")

    # --- Marriages ---
    marriage_result = await db.execute(
        select(Relationship).where(Relationship.marriage_date.isnot(None))
    )
    marriages = marriage_result.scalars().all()
    if marriages:
        person_ids = set()
        for m in marriages:
            person_ids.add(m.person_id)
            person_ids.add(m.related_person_id)
        persons_result = await db.execute(select(Person).where(Person.id.in_(list(person_ids))))
        person_map: dict[uuid.UUID, Person] = {p.id: p for p in persons_result.scalars().all()}

        for m in marriages:
            d = m.marriage_date
            p1 = person_map.get(m.person_id)
            p2 = person_map.get(m.related_person_id)
            name1 = f"{p1.first_name} {p1.last_name}" if p1 else "Unknown"
            name2 = f"{p2.first_name} {p2.last_name}" if p2 else "Unknown"
            lines.append("BEGIN:VEVENT")
            lines.append(f"UID:wedding-{m.id}@thirlwall.ca")
            lines.append(f"DTSTART;VALUE=DATE:{d.year:04d}{d.month:02d}{d.day:02d}")
            lines.append("RRULE:FREQ=YEARLY")
            lines.append(f"SUMMARY:Wedding Anniversary: {name1} & {name2}")
            lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")

    return PlainTextResponse(
        content="\r\n".join(lines),
        media_type="text/calendar",
    )
