"""Relationship path finder and descriptor.

Provides BFS-based pathfinding through the family tree and natural
language description of the relationship between two persons.
"""

from __future__ import annotations

import uuid
from collections import deque
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import Person, Relationship


@dataclass
class PathStep:
    person_id: uuid.UUID
    person_name: str
    relationship: str  # "parent_child" or "spouse"
    direction: str  # "up" (to parent), "down" (to child), "spouse"


async def find_relationship_path(
    db: AsyncSession,
    from_id: uuid.UUID,
    to_id: uuid.UUID,
) -> Optional[list[PathStep]]:
    """Find shortest relationship path between two persons using BFS.

    Returns a list of PathSteps from `from_id` to `to_id`, or None if
    no connection exists. The first element represents the starting person.
    """
    if from_id == to_id:
        return []

    # Load all persons (for names)
    persons_result = await db.execute(select(Person))
    persons = {p.id: p for p in persons_result.scalars().all()}

    # Load all relationships
    rels_result = await db.execute(select(Relationship))
    rels = rels_result.scalars().all()

    # Build adjacency list: person_id -> list of (neighbor_id, rel_type, direction)
    adj: dict[uuid.UUID, list[tuple[uuid.UUID, str, str]]] = {}
    for r in rels:
        rel_type = r.relationship.value if r.relationship else "unknown"

        if rel_type == "parent_child":
            # person_id is child, related_person_id is parent
            # From child -> parent = "up", from parent -> child = "down"
            adj.setdefault(r.person_id, []).append(
                (r.related_person_id, rel_type, "up")
            )
            adj.setdefault(r.related_person_id, []).append(
                (r.person_id, rel_type, "down")
            )
        elif rel_type == "spouse":
            adj.setdefault(r.person_id, []).append(
                (r.related_person_id, rel_type, "spouse")
            )
            adj.setdefault(r.related_person_id, []).append(
                (r.person_id, rel_type, "spouse")
            )

    # BFS
    visited: set[uuid.UUID] = {from_id}
    # Queue entries: (current_person_id, path_so_far)
    queue: deque[tuple[uuid.UUID, list[PathStep]]] = deque()

    from_person = persons.get(from_id)
    if not from_person:
        return None

    start_step = PathStep(
        person_id=from_id,
        person_name=f"{from_person.first_name} {from_person.last_name}",
        relationship="",
        direction="",
    )
    queue.append((from_id, [start_step]))

    while queue:
        current_id, path = queue.popleft()

        for neighbor_id, rel_type, direction in adj.get(current_id, []):
            if neighbor_id in visited:
                continue
            visited.add(neighbor_id)

            neighbor = persons.get(neighbor_id)
            if not neighbor:
                continue

            step = PathStep(
                person_id=neighbor_id,
                person_name=f"{neighbor.first_name} {neighbor.last_name}",
                relationship=rel_type,
                direction=direction,
            )
            new_path = path + [step]

            if neighbor_id == to_id:
                return new_path

            queue.append((neighbor_id, new_path))

    return None  # No path found


def describe_relationship(
    path: list[PathStep],
    gender_map: dict[uuid.UUID, str],
) -> tuple[str, str]:
    """Convert a path into a human-readable relationship label and description.

    Returns (label, description) where:
    - label: e.g. "2nd great-grandmother"
    - description: e.g. "Sarah is your 2nd great-grandmother"

    The path starts at "me" and ends at the target person.
    """
    if not path or len(path) < 2:
        return ("self", "This is you")

    target_name = path[-1].person_name
    target_id = path[-1].person_id
    target_gender = gender_map.get(target_id, "unknown")

    # Collect directions (skip the first step which is "me")
    directions = [step.direction for step in path[1:]]

    # Handle spouse links at the boundaries of the path.
    # - Spouse at START: your spouse's family → "in-law" (e.g., spouse → up = mother-in-law)
    # - Spouse at END after ups: a parent/ancestor's spouse → "step-" (e.g., up → spouse = step-mother)
    # - Spouse at END after downs: a child/descendant's spouse → "in-law" (e.g., down → spouse = daughter-in-law)
    is_in_law = False
    is_step = False

    # Handle trailing spouse
    if directions and directions[-1] == "spouse":
        remaining = directions[:-1]
        if not remaining:
            # Direct spouse connection
            label = "wife" if target_gender == "female" else "husband"
            return (label, f"{target_name} is your {label}")
        # Determine if step- or -in-law based on the last non-spouse direction
        last_non_spouse = remaining[-1]
        if last_non_spouse == "up":
            is_step = True
        else:
            is_in_law = True
        directions = remaining

    # Handle leading spouse (your spouse's family → in-law)
    if directions and directions[0] == "spouse":
        is_in_law = True
        directions = directions[1:]
        if not directions:
            label = "wife" if target_gender == "female" else "husband"
            return (label, f"{target_name} is your {label}")

    # Count ups and downs
    ups = sum(1 for d in directions if d == "up")
    downs = sum(1 for d in directions if d == "down")

    label = _compute_label(ups, downs, target_gender)

    if is_step:
        label = f"step-{label}"
    elif is_in_law:
        label = f"{label}-in-law"

    return (label, f"{target_name} is your {label}")


def _compute_label(ups: int, downs: int, gender: str) -> str:
    """Compute relationship label from up/down counts and gender."""
    is_female = gender == "female"

    # Direct line up (ancestor)
    if downs == 0 and ups > 0:
        if ups == 1:
            return "mother" if is_female else "father"
        if ups == 2:
            return "grandmother" if is_female else "grandfather"
        if ups == 3:
            return "great-grandmother" if is_female else "great-grandfather"
        # 4+ = 2nd great-grandmother, etc.
        n = ups - 2
        ordinal = _ordinal(n)
        return f"{ordinal} great-grandmother" if is_female else f"{ordinal} great-grandfather"

    # Direct line down (descendant)
    if ups == 0 and downs > 0:
        if downs == 1:
            return "daughter" if is_female else "son"
        if downs == 2:
            return "granddaughter" if is_female else "grandson"
        if downs == 3:
            return "great-granddaughter" if is_female else "great-grandson"
        n = downs - 2
        ordinal = _ordinal(n)
        return f"{ordinal} great-granddaughter" if is_female else f"{ordinal} great-grandson"

    # Sibling (1 up, 1 down)
    if ups == 1 and downs == 1:
        return "sister" if is_female else "brother"

    # Uncle/aunt (2 up, 1 down)
    if ups == 2 and downs == 1:
        return "aunt" if is_female else "uncle"

    # Niece/nephew (1 up, 2 down)
    if ups == 1 and downs == 2:
        return "niece" if is_female else "nephew"

    # Great-uncle/aunt (3 up, 1 down)
    if ups == 3 and downs == 1:
        return "great-aunt" if is_female else "great-uncle"

    # Great-niece/nephew (1 up, 3 down)
    if ups == 1 and downs == 3:
        return "great-niece" if is_female else "great-nephew"

    # Grand-uncle/aunt (ups > 3, downs == 1)
    if ups > 3 and downs == 1:
        n = ups - 2
        ordinal = _ordinal(n)
        return f"{ordinal} great-aunt" if is_female else f"{ordinal} great-uncle"

    # Grand-niece/nephew (ups == 1, downs > 3)
    if ups == 1 and downs > 3:
        n = downs - 2
        ordinal = _ordinal(n)
        return f"{ordinal} great-niece" if is_female else f"{ordinal} great-nephew"

    # Cousins: both ups > 1 and downs > 1
    # Cousin degree = min(ups, downs) - 1
    # Times removed = abs(ups - downs)
    if ups >= 2 and downs >= 2:
        degree = min(ups, downs) - 1
        removed = abs(ups - downs)
        ordinal = _ordinal(degree)
        label = f"{ordinal} cousin"
        if removed > 0:
            label += f" {removed}x removed"
        return label

    # Fallback
    return "relative"


def _ordinal(n: int) -> str:
    """Convert integer to ordinal string: 1st, 2nd, 3rd, 4th, etc."""
    if n <= 0:
        return str(n)
    if n % 100 in (11, 12, 13):
        return f"{n}th"
    last_digit = n % 10
    if last_digit == 1:
        return f"{n}st"
    if last_digit == 2:
        return f"{n}nd"
    if last_digit == 3:
        return f"{n}rd"
    return f"{n}th"
