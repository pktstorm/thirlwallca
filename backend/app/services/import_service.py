"""GEDCOM import orchestrator.

Takes parsed GedcomData and performs database operations to create/merge
persons, relationships, locations, residences, and alternate names.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import (
    Location,
    Person,
    PersonResidence,
    Relationship,
)
from app.services.gedcom_service import GedcomData, GedcomPerson, GedcomPlace
from app.services.location_service import format_place_text

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Import summary
# ---------------------------------------------------------------------------

@dataclass
class ImportSummary:
    persons_created: int = 0
    persons_updated: int = 0
    persons_skipped: int = 0
    relationships_created: int = 0
    relationships_skipped: int = 0
    locations_created: int = 0
    locations_reused: int = 0
    residences_created: int = 0
    alternate_names_created: int = 0
    errors: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Gender mapping
# ---------------------------------------------------------------------------

_GENDER_MAP = {
    "male": "male",
    "female": "female",
    "unknown": "unknown",
}


# ---------------------------------------------------------------------------
# Location helper
# ---------------------------------------------------------------------------

async def _resolve_location(
    db: AsyncSession,
    place: GedcomPlace,
    summary: ImportSummary,
) -> tuple[uuid.UUID | None, str]:
    """Resolve a GedcomPlace to a Location ID and place_text.

    First checks if the location already exists. If not, creates it directly
    with GEDCOM-provided coordinates (bypassing geocoding API to avoid rate limits).
    """
    if not place.city:
        return None, place.raw

    from sqlalchemy import func

    # Case-insensitive match on (city, region, country)
    query = select(Location).where(func.lower(Location.name) == place.city.lower())
    if place.region:
        query = query.where(func.lower(Location.region) == place.region.lower())
    else:
        query = query.where(Location.region.is_(None))
    if place.country:
        query = query.where(func.lower(Location.country) == place.country.lower())
    else:
        query = query.where(Location.country.is_(None))

    result = await db.execute(query)
    location = result.scalar_one_or_none()

    if location:
        summary.locations_reused += 1
        # Update coords if the existing location has none and GEDCOM provides them
        if place.latitude is not None and place.longitude is not None:
            if location.latitude is None or location.longitude is None:
                location.latitude = place.latitude
                location.longitude = place.longitude
    else:
        # Create new location with GEDCOM coords (skip geocoding)
        location = Location(
            name=place.city,
            region=place.region,
            country=place.country,
            latitude=place.latitude,
            longitude=place.longitude,
        )
        db.add(location)
        await db.flush()
        summary.locations_created += 1

    place_text = format_place_text(place.city, place.region, place.country)
    return location.id, place_text


# ---------------------------------------------------------------------------
# Person matching
# ---------------------------------------------------------------------------

def _build_person_lookup(
    persons: list[Person],
) -> dict[tuple[str, str, int | None], Person]:
    """Build a lookup dict for matching: (lower_first, lower_last, birth_year) -> Person."""
    lookup: dict[tuple[str, str, int | None], Person] = {}
    for p in persons:
        birth_year = p.birth_date.year if p.birth_date else None
        key = (p.first_name.lower(), p.last_name.lower(), birth_year)
        lookup[key] = p
    return lookup


def _match_person(
    lookup: dict[tuple[str, str, int | None], Person],
    gedcom: GedcomPerson,
) -> Person | None:
    """Try to match a GEDCOM person to an existing DB person."""
    birth_year = gedcom.birth_date.value.year if gedcom.birth_date and gedcom.birth_date.value else None

    # Try exact match with birth year
    key = (gedcom.first_name.lower(), gedcom.last_name.lower(), birth_year)
    match = lookup.get(key)
    if match:
        return match

    # If GEDCOM has no birth year, try matching with None
    if birth_year is None:
        key_none = (gedcom.first_name.lower(), gedcom.last_name.lower(), None)
        return lookup.get(key_none)

    return None


# ---------------------------------------------------------------------------
# Person merge
# ---------------------------------------------------------------------------

async def _merge_person(
    existing: Person,
    gedcom: GedcomPerson,
    db: AsyncSession,
    summary: ImportSummary,
) -> bool:
    """Merge GEDCOM data into existing Person, only filling empty fields.
    Returns True if any field was updated.
    """
    updated = False

    if not existing.middle_name and gedcom.middle_name:
        existing.middle_name = gedcom.middle_name
        updated = True

    existing_gender = existing.gender.value if hasattr(existing.gender, "value") else str(existing.gender)
    if existing_gender == "unknown" and gedcom.gender != "unknown":
        existing.gender = _GENDER_MAP.get(gedcom.gender, "unknown")
        updated = True

    if not existing.birth_date and gedcom.birth_date and gedcom.birth_date.value:
        existing.birth_date = gedcom.birth_date.value
        existing.birth_date_approx = gedcom.birth_date.is_approx
        updated = True

    if not existing.death_date and gedcom.death_date and gedcom.death_date.value:
        existing.death_date = gedcom.death_date.value
        existing.death_date_approx = gedcom.death_date.is_approx
        updated = True

    if existing.is_living and not gedcom.is_living:
        existing.is_living = False
        updated = True

    if not existing.birth_place_text and gedcom.birth_place and gedcom.birth_place.city:
        loc_id, place_text = await _resolve_location(db, gedcom.birth_place, summary)
        if loc_id:
            existing.birth_location_id = loc_id
        existing.birth_place_text = place_text
        updated = True

    if not existing.death_place_text and gedcom.death_place and gedcom.death_place.city:
        loc_id, place_text = await _resolve_location(db, gedcom.death_place, summary)
        if loc_id:
            existing.death_location_id = loc_id
        existing.death_place_text = place_text
        updated = True

    if not existing.burial_location and gedcom.burial_text:
        existing.burial_location = gedcom.burial_text
        updated = True

    return updated


# ---------------------------------------------------------------------------
# Person creation
# ---------------------------------------------------------------------------

async def _create_person(
    gedcom: GedcomPerson,
    db: AsyncSession,
    summary: ImportSummary,
    user_id: uuid.UUID | None,
) -> Person:
    """Create a new Person from GEDCOM data."""
    person = Person(
        first_name=gedcom.first_name or "Unknown",
        middle_name=gedcom.middle_name,
        last_name=gedcom.last_name or "Unknown",
        gender=_GENDER_MAP.get(gedcom.gender, "unknown"),
        birth_date=gedcom.birth_date.value if gedcom.birth_date else None,
        birth_date_approx=gedcom.birth_date.is_approx if gedcom.birth_date else False,
        death_date=gedcom.death_date.value if gedcom.death_date else None,
        death_date_approx=gedcom.death_date.is_approx if gedcom.death_date else False,
        is_living=gedcom.is_living,
        burial_location=gedcom.burial_text,
        created_by=user_id,
    )

    # Resolve birth place
    if gedcom.birth_place and gedcom.birth_place.city:
        loc_id, place_text = await _resolve_location(db, gedcom.birth_place, summary)
        if loc_id:
            person.birth_location_id = loc_id
        person.birth_place_text = place_text

    # Resolve death place
    if gedcom.death_place and gedcom.death_place.city:
        loc_id, place_text = await _resolve_location(db, gedcom.death_place, summary)
        if loc_id:
            person.death_location_id = loc_id
        person.death_place_text = place_text

    db.add(person)
    await db.flush()
    return person


# ---------------------------------------------------------------------------
# Relationship creation
# ---------------------------------------------------------------------------

async def _create_relationship_safe(
    db: AsyncSession,
    person_id: uuid.UUID,
    related_person_id: uuid.UUID,
    rel_type: str,
    summary: ImportSummary,
    marriage_date: date | None = None,
    divorce_date: date | None = None,
) -> None:
    """Create a relationship if it doesn't already exist."""
    if person_id == related_person_id:
        return

    # Check for existing
    result = await db.execute(
        select(Relationship).where(
            Relationship.person_id == person_id,
            Relationship.related_person_id == related_person_id,
            Relationship.relationship == rel_type,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Optionally update dates if they were null
        changed = False
        if marriage_date and not existing.marriage_date:
            existing.marriage_date = marriage_date
            changed = True
        if divorce_date and not existing.divorce_date:
            existing.divorce_date = divorce_date
            changed = True
        if not changed:
            summary.relationships_skipped += 1
        return

    rel = Relationship(
        person_id=person_id,
        related_person_id=related_person_id,
        relationship=rel_type,
        marriage_date=marriage_date,
        divorce_date=divorce_date,
    )
    db.add(rel)
    summary.relationships_created += 1


# ---------------------------------------------------------------------------
# Main import function
# ---------------------------------------------------------------------------

async def import_gedcom(
    db: AsyncSession,
    data: GedcomData,
    user_id: uuid.UUID | None = None,
) -> ImportSummary:
    """Import parsed GEDCOM data into the database.

    Runs within the caller's transaction context. Does NOT commit.
    """
    summary = ImportSummary()

    # --- Phase 1: Build existing person lookup ---
    result = await db.execute(select(Person))
    existing_persons = list(result.scalars().all())
    lookup = _build_person_lookup(existing_persons)

    # --- Phase 2: Create/merge persons ---
    xref_to_uuid: dict[str, uuid.UUID] = {}

    for xref_id, gedcom_person in data.persons.items():
        try:
            match = _match_person(lookup, gedcom_person)

            if match:
                updated = await _merge_person(match, gedcom_person, db, summary)
                if updated:
                    summary.persons_updated += 1
                else:
                    summary.persons_skipped += 1
                xref_to_uuid[xref_id] = match.id
            else:
                person = await _create_person(gedcom_person, db, summary, user_id)
                xref_to_uuid[xref_id] = person.id
                summary.persons_created += 1

                # Add to lookup so subsequent GEDCOM persons can match
                birth_year = person.birth_date.year if person.birth_date else None
                key = (person.first_name.lower(), person.last_name.lower(), birth_year)
                lookup[key] = person

            # Create alternate names (nicknames) — use raw SQL to bypass
            # SQLAlchemy Enum type mapping (model uses member names, DB has values)
            person_uuid = xref_to_uuid[xref_id]
            for aka in gedcom_person.aka_names:
                await db.execute(
                    text(
                        "INSERT INTO person_alternate_names "
                        "(id, person_id, name_type, full_name, created_at) "
                        "VALUES (gen_random_uuid(), :person_id, :name_type, :full_name, now())"
                    ),
                    {"person_id": str(person_uuid), "name_type": "nickname", "full_name": aka},
                )
                summary.alternate_names_created += 1

            # Create residences
            for place, res_date in gedcom_person.residences:
                if not place:
                    continue

                residence = PersonResidence(
                    person_id=person_uuid,
                    is_current=True,
                )

                if place.city:
                    loc_id, place_text = await _resolve_location(db, place, summary)
                    if loc_id:
                        residence.location_id = loc_id
                    residence.place_text = place_text
                else:
                    residence.place_text = place.raw

                if res_date and res_date.value:
                    residence.from_date = res_date.value

                db.add(residence)
                summary.residences_created += 1

        except Exception as e:
            error_msg = f"Error processing {xref_id} ({gedcom_person.first_name} {gedcom_person.last_name}): {e}"
            logger.warning(error_msg)
            summary.errors.append(error_msg)

    await db.flush()

    # --- Phase 3: Create relationships from families ---
    for xref_id, family in data.families.items():
        try:
            husb_uuid = xref_to_uuid.get(family.husband_id) if family.husband_id else None
            wife_uuid = xref_to_uuid.get(family.wife_id) if family.wife_id else None

            marriage_dt = family.marriage_date.value if family.marriage_date else None
            divorce_dt = family.divorce_date.value if family.divorce_date else None

            # Spouse relationship
            if husb_uuid and wife_uuid:
                await _create_relationship_safe(
                    db,
                    person_id=husb_uuid,
                    related_person_id=wife_uuid,
                    rel_type="spouse",
                    summary=summary,
                    marriage_date=marriage_dt,
                    divorce_date=divorce_dt,
                )

            # Parent-child relationships
            # Convention: person_id = child, related_person_id = parent
            for child_xref in family.child_ids:
                child_uuid = xref_to_uuid.get(child_xref)
                if not child_uuid:
                    continue

                if husb_uuid:
                    await _create_relationship_safe(
                        db,
                        person_id=child_uuid,
                        related_person_id=husb_uuid,
                        rel_type="parent_child",
                        summary=summary,
                    )

                if wife_uuid:
                    await _create_relationship_safe(
                        db,
                        person_id=child_uuid,
                        related_person_id=wife_uuid,
                        rel_type="parent_child",
                        summary=summary,
                    )

        except Exception as e:
            error_msg = f"Error processing family {xref_id}: {e}"
            logger.warning(error_msg)
            summary.errors.append(error_msg)

    await db.flush()

    logger.info(
        "GEDCOM import complete: %d created, %d updated, %d skipped, %d rels, %d errors",
        summary.persons_created,
        summary.persons_updated,
        summary.persons_skipped,
        summary.relationships_created,
        len(summary.errors),
    )

    return summary
