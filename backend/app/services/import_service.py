"""GEDCOM import orchestrator.

Takes parsed GedcomData and performs database operations to create/merge
persons, relationships, locations, residences, and alternate names.
"""

from __future__ import annotations

import logging
import re
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
# US state abbreviation map (Issue #17)
# ---------------------------------------------------------------------------

_US_STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming",
}


# ---------------------------------------------------------------------------
# Location normalization (Issues #15, #16, #17)
# ---------------------------------------------------------------------------

def _normalize_place(place: GedcomPlace) -> GedcomPlace:
    """Normalize a GedcomPlace for consistent matching."""
    city = place.city
    region = place.region

    # Expand US state abbreviations (Issue #17)
    if region and region.upper() in _US_STATES:
        region = _US_STATES[region.upper()]

    # Strip "(Urban Agglomeration)" suffixes (Issue #15)
    if city:
        city = re.sub(r"\s*\(Urban Agglomeration\)", "", city).strip()
    if region:
        region = re.sub(r"\s*\(Urban Agglomeration\)", "", region).strip()

    # Detect street addresses as city (Issue #16)
    if city and re.match(r"^\d+[\s-]", city):
        city = None

    return GedcomPlace(
        city=city,
        region=region,
        country=place.country,
        raw=place.raw,
        latitude=place.latitude,
        longitude=place.longitude,
    )


# ---------------------------------------------------------------------------
# Location helper
# ---------------------------------------------------------------------------

async def _resolve_location(
    db: AsyncSession,
    place: GedcomPlace,
    summary: ImportSummary,
) -> tuple[uuid.UUID | None, str]:
    """Resolve a GedcomPlace to a Location ID and place_text.

    First normalizes the place, then checks if the location already exists.
    If not, creates it with GEDCOM-provided coordinates.
    """
    # Normalize before lookup
    place = _normalize_place(place)

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
# Person matching (Issue #22: xref-based + name-based)
# ---------------------------------------------------------------------------

def _build_person_lookups(
    persons: list[Person],
) -> tuple[dict[tuple[str, str, int | None], Person], dict[str, Person]]:
    """Build lookup dicts: name-based and xref-based."""
    name_lookup: dict[tuple[str, str, int | None], Person] = {}
    xref_lookup: dict[str, Person] = {}
    for p in persons:
        birth_year = p.birth_date.year if p.birth_date else None
        key = (p.first_name.lower(), p.last_name.lower(), birth_year)
        name_lookup[key] = p
        if p.gedcom_xref:
            xref_lookup[p.gedcom_xref] = p
    return name_lookup, xref_lookup


def _match_person(
    name_lookup: dict[tuple[str, str, int | None], Person],
    xref_lookup: dict[str, Person],
    gedcom: GedcomPerson,
) -> Person | None:
    """Try to match a GEDCOM person to an existing DB person."""
    # Priority 1: Match by GEDCOM xref ID
    if gedcom.xref_id and gedcom.xref_id in xref_lookup:
        return xref_lookup[gedcom.xref_id]

    # Priority 2: Fallback to name + birth year match
    birth_year = gedcom.birth_date.value.year if gedcom.birth_date and gedcom.birth_date.value else None

    key = (gedcom.first_name.lower(), gedcom.last_name.lower(), birth_year)
    match = name_lookup.get(key)
    if match:
        return match

    # If GEDCOM has no birth year, try matching with None
    if birth_year is None:
        key_none = (gedcom.first_name.lower(), gedcom.last_name.lower(), None)
        return name_lookup.get(key_none)

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

    # Backfill gedcom_xref if missing
    if not existing.gedcom_xref and gedcom.xref_id:
        existing.gedcom_xref = gedcom.xref_id
        updated = True

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

    # New fields (Issues #2, #5, #25)
    if not existing.birth_notes and gedcom.birth_notes:
        existing.birth_notes = gedcom.birth_notes
        updated = True

    if not existing.cause_of_death and gedcom.cause_of_death:
        existing.cause_of_death = gedcom.cause_of_death
        updated = True

    if not existing.notes and gedcom.notes:
        existing.notes = gedcom.notes
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
        gedcom_xref=gedcom.xref_id,
        first_name=gedcom.first_name or "Unknown",
        middle_name=gedcom.middle_name,
        last_name=gedcom.last_name or "",
        gender=_GENDER_MAP.get(gedcom.gender, "unknown"),
        birth_date=gedcom.birth_date.value if gedcom.birth_date else None,
        birth_date_approx=gedcom.birth_date.is_approx if gedcom.birth_date else False,
        death_date=gedcom.death_date.value if gedcom.death_date else None,
        death_date_approx=gedcom.death_date.is_approx if gedcom.death_date else False,
        is_living=gedcom.is_living,
        burial_location=gedcom.burial_text,
        birth_notes=gedcom.birth_notes,
        cause_of_death=gedcom.cause_of_death,
        notes=gedcom.notes,
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
# Alternate name helpers (Issue #26)
# ---------------------------------------------------------------------------

def _parse_aka_first(full_name: str) -> str | None:
    """Extract first name from an AKA full name."""
    parts = full_name.split(None, 1)
    return parts[0] if parts else None


def _parse_aka_last(full_name: str) -> str | None:
    """Extract last name from an AKA full name (only if multi-word)."""
    parts = full_name.split(None, 1)
    return parts[1] if len(parts) > 1 else None


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
    marriage_place_text: str | None = None,
    marriage_location_id: uuid.UUID | None = None,
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
        # Optionally update fields if they were null
        changed = False
        if marriage_date and not existing.marriage_date:
            existing.marriage_date = marriage_date
            changed = True
        if divorce_date and not existing.divorce_date:
            existing.divorce_date = divorce_date
            changed = True
        if marriage_place_text and not existing.marriage_place_text:
            existing.marriage_place_text = marriage_place_text
            changed = True
        if marriage_location_id and not existing.marriage_location_id:
            existing.marriage_location_id = marriage_location_id
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
        marriage_place_text=marriage_place_text,
        marriage_location_id=marriage_location_id,
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

    # --- Phase 1: Build existing person lookups ---
    result = await db.execute(select(Person))
    existing_persons = list(result.scalars().all())
    name_lookup, xref_lookup = _build_person_lookups(existing_persons)

    # --- Phase 2: Create/merge persons ---
    xref_to_uuid: dict[str, uuid.UUID] = {}

    for xref_id, gedcom_person in data.persons.items():
        try:
            match = _match_person(name_lookup, xref_lookup, gedcom_person)

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

                # Add to lookups so subsequent GEDCOM persons can match
                birth_year = person.birth_date.year if person.birth_date else None
                key = (person.first_name.lower(), person.last_name.lower(), birth_year)
                name_lookup[key] = person
                if person.gedcom_xref:
                    xref_lookup[person.gedcom_xref] = person

            # Create alternate names (nicknames) with dedup (Issue #11)
            person_uuid = xref_to_uuid[xref_id]
            for aka in gedcom_person.aka_names:
                # Check for existing to prevent duplicates on re-import
                existing_aka = await db.execute(
                    text(
                        "SELECT id FROM person_alternate_names "
                        "WHERE person_id = :person_id AND full_name = :full_name AND name_type = 'nickname'"
                    ),
                    {"person_id": str(person_uuid), "full_name": aka},
                )
                if existing_aka.scalar_one_or_none() is None:
                    await db.execute(
                        text(
                            "INSERT INTO person_alternate_names "
                            "(id, person_id, name_type, first_name, last_name, full_name, created_at) "
                            "VALUES (gen_random_uuid(), :person_id, :name_type, :first_name, :last_name, :full_name, now())"
                        ),
                        {
                            "person_id": str(person_uuid),
                            "name_type": "nickname",
                            "first_name": _parse_aka_first(aka),
                            "last_name": _parse_aka_last(aka),
                            "full_name": aka,
                        },
                    )
                    summary.alternate_names_created += 1

            # Create residences with dedup (Issue #11 pattern)
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

                # Check for existing residence to prevent duplicates on re-import
                existing_res = await db.execute(
                    select(PersonResidence).where(
                        PersonResidence.person_id == person_uuid,
                        PersonResidence.place_text == residence.place_text,
                    )
                )
                if existing_res.scalar_one_or_none() is None:
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

            # Resolve marriage place (Issues #1, #20, #23)
            marriage_place_text = None
            marriage_location_id = None
            if family.marriage_place:
                loc_id, place_text = await _resolve_location(db, family.marriage_place, summary)
                marriage_place_text = place_text
                marriage_location_id = loc_id
            # Prepend venue text if present (Issue #20)
            if family.marriage_venue_text:
                if marriage_place_text:
                    marriage_place_text = f"{family.marriage_venue_text}, {marriage_place_text}"
                else:
                    marriage_place_text = family.marriage_venue_text

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
                    marriage_place_text=marriage_place_text,
                    marriage_location_id=marriage_location_id,
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
