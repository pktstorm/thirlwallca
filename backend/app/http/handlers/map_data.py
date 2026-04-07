import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db
from app.domain.models import Person, PersonResidence, Location, Relationship, Story, StoryPerson, TimelineEvent


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
    generation: int = 0  # 0 = self, 1 = parent, 2 = grandparent, etc.
    profile_photo_url: str | None = None


class AncestorTrailResponse(BaseModel):
    places: list[MapPlace]
    person_name: str
    ancestor_count: int


class PersonMapContext(BaseModel):
    person_id: uuid.UUID
    person_name: str
    profile_photo_url: str | None
    birth_year: int | None
    death_year: int | None
    is_living: bool
    story_count: int
    timeline_event_count: int
    stories: list[dict]  # [{id, title}]
    timeline_events: list[dict]  # [{id, title, event_date, event_type}]


def _extract_person_places(person: Person, loc: Location, place_type: str, year: int | None, generation: int = 0) -> MapPlace:
    return MapPlace(
        person_id=person.id,
        person_name=f"{person.preferred_name or person.first_name} {person.last_name}",
        place_type=place_type,
        location_id=loc.id,
        city=loc.name,
        region=loc.region,
        country=loc.country,
        latitude=loc.latitude,
        longitude=loc.longitude,
        year=year,
        generation=generation,
        profile_photo_url=person.profile_photo_url,
    )


async def _get_places_for_person_ids(db: AsyncSession, person_ids: list[uuid.UUID], generation_map: dict[uuid.UUID, int] | None = None) -> list[MapPlace]:
    """Get all birth/death/residence places for a set of person IDs."""
    if not person_ids:
        return []

    gen_map = generation_map or {}
    places: list[MapPlace] = []

    # Birth locations
    result = await db.execute(
        select(Person, Location)
        .join(Location, Person.birth_location_id == Location.id)
        .where(
            Person.id.in_(person_ids),
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
        places.append(_extract_person_places(person, loc, "birth", birth_year, gen_map.get(person.id, 0)))

    # Death locations
    result = await db.execute(
        select(Person, Location)
        .join(Location, Person.death_location_id == Location.id)
        .where(
            Person.id.in_(person_ids),
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
        places.append(_extract_person_places(person, loc, "death", death_year, gen_map.get(person.id, 0)))

    # Residences
    result = await db.execute(
        select(PersonResidence, Location, Person)
        .join(Location, PersonResidence.location_id == Location.id)
        .join(Person, PersonResidence.person_id == Person.id)
        .where(
            PersonResidence.person_id.in_(person_ids),
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
        places.append(_extract_person_places(person, loc, "residence", res_year, gen_map.get(person.id, 0)))

    return places


@router.get("/places", response_model=list[MapPlace])
async def get_map_places(
    db: AsyncSession = Depends(get_db),
):
    """Return all person-place associations with coordinates for map rendering."""
    # Get all person IDs
    result = await db.execute(select(Person.id))
    all_ids = [row[0] for row in result.all()]
    return await _get_places_for_person_ids(db, all_ids)


@router.get("/ancestor-trail/{person_id}", response_model=AncestorTrailResponse)
async def get_ancestor_trail(
    person_id: uuid.UUID,
    max_generations: int = Query(10, ge=0, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Get places for a person and all their ancestors, with generation depth.

    Returns places tagged with generation number (0=self, 1=parent, 2=grandparent, etc.)
    so the frontend can render them with decreasing opacity/different colors.
    """
    # Verify person exists
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    # Walk up the ancestor tree using BFS with generation tracking
    generation_map: dict[uuid.UUID, int] = {person_id: 0}
    queue = [(person_id, 0)]
    visited = {person_id}

    while queue:
        current_id, current_gen = queue.pop(0)
        if current_gen >= max_generations:
            continue

        # Get parents: person_id=child, related_person_id=parent in parent_child
        result = await db.execute(
            select(Relationship.related_person_id).where(
                Relationship.person_id == current_id,
                Relationship.relationship == "PARENT_CHILD",
            )
        )
        for (parent_id,) in result.all():
            if parent_id not in visited:
                visited.add(parent_id)
                generation_map[parent_id] = current_gen + 1
                queue.append((parent_id, current_gen + 1))

    # Include spouses of ancestors for context (but NOT when max_generations=0,
    # which is used for "my journey" / life path where we only want one person)
    spouse_ids = set()
    if max_generations > 0:
        result = await db.execute(
            select(Relationship.person_id, Relationship.related_person_id).where(
                (Relationship.person_id.in_(list(visited)) | Relationship.related_person_id.in_(list(visited))),
                Relationship.relationship == "SPOUSE",
            )
        )
        for pid, rpid in result.all():
            if pid in visited and rpid not in visited:
                spouse_ids.add(rpid)
                generation_map[rpid] = generation_map.get(pid, 0)
            elif rpid in visited and pid not in visited:
                spouse_ids.add(pid)
                generation_map[pid] = generation_map.get(rpid, 0)

    all_ids = list(visited | spouse_ids)
    places = await _get_places_for_person_ids(db, all_ids, generation_map)

    return AncestorTrailResponse(
        places=places,
        person_name=f"{person.preferred_name or person.first_name} {person.last_name}",
        ancestor_count=len(all_ids) - 1,
    )


@router.get("/person-context/{person_id}", response_model=PersonMapContext)
async def get_person_map_context(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get rich context for a person to show in map popups: stories, timeline events, etc."""
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    # Get stories
    result = await db.execute(
        select(Story.id, Story.title)
        .join(StoryPerson, Story.id == StoryPerson.story_id)
        .where(StoryPerson.person_id == person_id, Story.published.is_(True))
        .order_by(Story.created_at.desc())
        .limit(5)
    )
    stories = [{"id": str(sid), "title": title} for sid, title in result.all()]

    # Get timeline events
    result = await db.execute(
        select(TimelineEvent.id, TimelineEvent.title, TimelineEvent.event_date, TimelineEvent.event_type)
        .where(TimelineEvent.person_id == person_id)
        .order_by(TimelineEvent.sort_order, TimelineEvent.event_date)
        .limit(10)
    )
    events = [
        {
            "id": str(eid),
            "title": title,
            "event_date": str(edate) if edate else None,
            "event_type": etype,
        }
        for eid, title, edate, etype in result.all()
    ]

    birth_year = None
    if person.birth_date:
        try:
            birth_year = person.birth_date.year
        except AttributeError:
            pass

    death_year = None
    if person.death_date:
        try:
            death_year = person.death_date.year
        except AttributeError:
            pass

    return PersonMapContext(
        person_id=person.id,
        person_name=f"{person.preferred_name or person.first_name} {person.last_name}",
        profile_photo_url=person.profile_photo_url,
        birth_year=birth_year,
        death_year=death_year,
        is_living=person.is_living,
        story_count=len(stories),
        timeline_event_count=len(events),
        stories=stories,
        timeline_events=events,
    )
