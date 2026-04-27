from __future__ import annotations
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import Person, Relationship
from app.domain.enums import RelationshipType, Gender
from app.http.schemas.orbit import (
    OrbitResponse,
    OrbitPersonRef,
    OrbitAncestorNode,
    OrbitDescendantNode,
    OrbitSpouseRef,
)


MAX_DEPTH = 10


def _person_ref(p: Person) -> OrbitPersonRef:
    birth_year = p.birth_date.year if p.birth_date else None
    death_year = p.death_date.year if p.death_date else None
    sex = p.gender.value if p.gender else None
    return OrbitPersonRef(
        id=p.id,
        given_name=p.preferred_name or p.first_name or "",
        surname=p.last_name,
        birth_year=birth_year,
        death_year=death_year,
        is_living=p.is_living,
        photo_url=p.profile_photo_url,
        sex=sex,
    )


def _parent_slot_for(sex: str | None) -> str | None:
    if sex == Gender.MALE.value:
        return "father"
    if sex == Gender.FEMALE.value:
        return "mother"
    return None


async def _select_two_parents(
    db: AsyncSession, child_id: UUID
) -> list[tuple[Person, Relationship]]:
    """Return at most two parent (Person, Relationship) tuples for a child, deterministically.

    Selection order:
      1. Prefer one MALE + one FEMALE if both present.
      2. Otherwise take the two oldest by Relationship.created_at.
    """
    stmt = (
        select(Relationship, Person)
        .join(Person, Relationship.related_person_id == Person.id)
        .where(
            Relationship.person_id == child_id,
            Relationship.relationship == RelationshipType.PARENT_CHILD,
        )
        .order_by(Relationship.created_at.asc())
    )
    rows = (await db.execute(stmt)).all()
    if not rows:
        return []
    # Try father+mother pair first
    fathers = [(p, r) for r, p in rows if p.gender == Gender.MALE]
    mothers = [(p, r) for r, p in rows if p.gender == Gender.FEMALE]
    if fathers and mothers:
        return [(fathers[0][0], fathers[0][1]), (mothers[0][0], mothers[0][1])]
    # Fall back to first two by created_at
    return [(p, r) for r, p in rows[:2]]


async def _walk_ancestors(
    db: AsyncSession, focus_id: UUID, max_depth: int
) -> list[list[OrbitAncestorNode]]:
    """BFS up the ancestor tree, returning a list per generation.

    Each ancestor node records `parent_id` = the id of its child within the orbit (which is
    the focus for generation 0, or another already-visited ancestor for deeper generations).

    Loop detection: visited-set across generations. If a person reappears, raise ValueError.
    """
    if max_depth <= 0:
        return []

    visited: set[UUID] = {focus_id}
    generations: list[list[OrbitAncestorNode]] = []

    # current_layer maps child_id -> list of (Person, parent_slot)
    current_children: list[UUID] = [focus_id]

    for gen in range(max_depth):
        next_layer: list[OrbitAncestorNode] = []
        next_children: list[UUID] = []
        for child_id in current_children:
            parents = await _select_two_parents(db, child_id)
            for parent_person, _rel in parents:
                if parent_person.id in visited:
                    raise ValueError(f"Loop detected: person {parent_person.id} is its own ancestor")
                visited.add(parent_person.id)
                ref = _person_ref(parent_person)
                node = OrbitAncestorNode(
                    **ref.model_dump(),
                    parent_slot=_parent_slot_for(ref.sex),
                    parent_id=child_id,
                )
                next_layer.append(node)
                next_children.append(parent_person.id)
        if not next_layer:
            break
        generations.append(next_layer)
        current_children = next_children

    return generations


async def build_orbit(
    db: AsyncSession,
    person_id: UUID,
    ancestor_depth: int,
    descendant_depth: int,
    include_siblings: bool,
    include_spouses: bool,
) -> OrbitResponse:
    ancestor_depth = max(0, min(ancestor_depth, MAX_DEPTH))
    descendant_depth = max(0, min(descendant_depth, MAX_DEPTH))

    focus = await db.get(Person, person_id)
    if focus is None:
        raise LookupError(f"Person {person_id} not found")

    ancestors = await _walk_ancestors(db, person_id, ancestor_depth)
    descendants: list[OrbitDescendantNode] = []  # filled in next task
    siblings: list[OrbitPersonRef] = []  # filled in later task
    spouses: list[OrbitSpouseRef] = []  # filled in later task

    return OrbitResponse(
        focus=_person_ref(focus),
        ancestors_by_generation=ancestors,
        descendants=descendants,
        siblings=siblings,
        spouses=spouses,
    )
