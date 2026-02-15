import uuid
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db
from app.domain.models import Person, Relationship
from app.http.schemas.tree import TreeNode, TreeEdge, TreeResponse, RelationshipPathStep, RelationshipPathResponse
from app.services.relationship_service import find_relationship_path, describe_relationship

router = APIRouter()


def _person_to_node(person: Person) -> TreeNode:
    """Convert a Person model instance to a TreeNode for React Flow."""
    return TreeNode(
        id=str(person.id),
        label=f"{person.first_name} {person.last_name}",
        data={
            "id": str(person.id),
            "first_name": person.first_name,
            "middle_name": person.middle_name,
            "last_name": person.last_name,
            "maiden_name": person.maiden_name,
            "gender": str(person.gender.value) if person.gender else None,
            "birth_date": str(person.birth_date) if person.birth_date else None,
            "death_date": str(person.death_date) if person.death_date else None,
            "is_living": person.is_living,
            "profile_photo_url": person.profile_photo_url,
            "occupation": person.occupation,
        },
    )


def _relationship_to_edge(rel: Relationship) -> TreeEdge:
    """Convert a Relationship model instance to a TreeEdge for React Flow.

    For parent_child relationships the DB convention is:
        person_id = child, related_person_id = parent
    But the frontend tree layout (ELK with direction=DOWN) expects:
        source = parent (top), target = child (bottom)
    So we swap source/target for parent_child edges.
    """
    rel_type = str(rel.relationship.value) if rel.relationship else "unknown"

    if rel_type == "parent_child":
        # Swap: source=parent (related_person_id), target=child (person_id)
        return TreeEdge(
            id=str(rel.id),
            source=str(rel.related_person_id),
            target=str(rel.person_id),
            type=rel_type,
        )

    return TreeEdge(
        id=str(rel.id),
        source=str(rel.person_id),
        target=str(rel.related_person_id),
        type=rel_type,
    )


@router.get("", response_model=TreeResponse)
async def get_full_tree(
    db: AsyncSession = Depends(get_db),
):
    """Get the full family tree as nodes and edges for React Flow."""
    persons_result = await db.execute(
        select(Person).order_by(Person.last_name, Person.first_name)
    )
    persons = persons_result.scalars().all()

    rels_result = await db.execute(select(Relationship))
    rels = rels_result.scalars().all()

    nodes = [_person_to_node(p) for p in persons]
    edges = [_relationship_to_edge(r) for r in rels]
    return TreeResponse(nodes=nodes, edges=edges)


@router.get("/relationship/{from_id}/to/{to_id}", response_model=RelationshipPathResponse)
async def get_relationship_path(
    from_id: uuid.UUID,
    to_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Find the relationship path between two persons and describe it in natural language."""
    path = await find_relationship_path(db, from_id, to_id)

    if path is None:
        return RelationshipPathResponse(
            path=[],
            label="",
            description="No connection found",
            found=False,
        )

    if len(path) < 2:
        return RelationshipPathResponse(
            path=[],
            label="self",
            description="This is you",
            found=True,
        )

    # Build gender map for the describe function
    persons_result = await db.execute(select(Person))
    gender_map = {
        p.id: p.gender.value if p.gender else "unknown"
        for p in persons_result.scalars().all()
    }

    label, description = describe_relationship(path, gender_map)

    return RelationshipPathResponse(
        path=[
            RelationshipPathStep(
                person_id=step.person_id,
                person_name=step.person_name,
                relationship=step.relationship,
                direction=step.direction,
            )
            for step in path
        ],
        label=label,
        description=description,
        found=True,
    )


@router.get("/{person_id}", response_model=TreeResponse)
async def get_subtree(
    person_id: uuid.UUID,
    depth: int = Query(3, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    """Get a subtree centered on a person with configurable depth using a recursive CTE."""
    # Verify the person exists
    person_result = await db.execute(select(Person).where(Person.id == person_id))
    person = person_result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    # Use recursive CTE to find all connected persons within depth
    cte_sql = text("""
        WITH RECURSIVE connected AS (
            SELECT :person_id::uuid AS pid, 0 AS depth
            UNION
            SELECT
                CASE
                    WHEN r.person_id = connected.pid THEN r.related_person_id
                    ELSE r.person_id
                END AS pid,
                connected.depth + 1
            FROM relationships r
            INNER JOIN connected ON (r.person_id = connected.pid OR r.related_person_id = connected.pid)
            WHERE connected.depth < :max_depth
        )
        SELECT DISTINCT pid FROM connected
    """)
    result = await db.execute(cte_sql, {"person_id": str(person_id), "max_depth": depth})
    person_ids = [row[0] for row in result.fetchall()]

    if not person_ids:
        return TreeResponse(nodes=[_person_to_node(person)], edges=[])

    # Fetch all persons in the subtree
    persons_result = await db.execute(select(Person).where(Person.id.in_(person_ids)))
    persons = persons_result.scalars().all()

    # Fetch all relationships between persons in the subtree
    rels_result = await db.execute(
        select(Relationship).where(
            Relationship.person_id.in_(person_ids),
            Relationship.related_person_id.in_(person_ids),
        )
    )
    rels = rels_result.scalars().all()

    nodes = [_person_to_node(p) for p in persons]
    edges = [_relationship_to_edge(r) for r in rels]
    return TreeResponse(nodes=nodes, edges=edges)


@router.get("/{person_id}/ancestors", response_model=TreeResponse)
async def get_ancestors(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all ancestors of a person using a recursive CTE (follows parent_child relationships upward)."""
    person_result = await db.execute(select(Person).where(Person.id == person_id))
    person = person_result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    # In parent_child relationships, person_id is the child, related_person_id is the parent.
    # To find ancestors, we go from child to parent: where person_id = current, get related_person_id.
    cte_sql = text("""
        WITH RECURSIVE ancestors AS (
            SELECT :person_id::uuid AS pid
            UNION
            SELECT r.related_person_id AS pid
            FROM relationships r
            INNER JOIN ancestors a ON r.person_id = a.pid
            WHERE r.relationship = 'PARENT_CHILD'
        )
        SELECT DISTINCT pid FROM ancestors
    """)
    result = await db.execute(cte_sql, {"person_id": str(person_id)})
    person_ids = [row[0] for row in result.fetchall()]

    persons_result = await db.execute(select(Person).where(Person.id.in_(person_ids)))
    persons = persons_result.scalars().all()

    rels_result = await db.execute(
        select(Relationship).where(
            Relationship.person_id.in_(person_ids),
            Relationship.related_person_id.in_(person_ids),
        )
    )
    rels = rels_result.scalars().all()

    nodes = [_person_to_node(p) for p in persons]
    edges = [_relationship_to_edge(r) for r in rels]
    return TreeResponse(nodes=nodes, edges=edges)


@router.get("/{person_id}/descendants", response_model=TreeResponse)
async def get_descendants(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all descendants of a person using a recursive CTE (follows parent_child relationships downward)."""
    person_result = await db.execute(select(Person).where(Person.id == person_id))
    person = person_result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    # In parent_child relationships, person_id is the child, related_person_id is the parent.
    # To find descendants, we go from parent to child: where related_person_id = current, get person_id.
    cte_sql = text("""
        WITH RECURSIVE descendants AS (
            SELECT :person_id::uuid AS pid
            UNION
            SELECT r.person_id AS pid
            FROM relationships r
            INNER JOIN descendants d ON r.related_person_id = d.pid
            WHERE r.relationship = 'PARENT_CHILD'
        )
        SELECT DISTINCT pid FROM descendants
    """)
    result = await db.execute(cte_sql, {"person_id": str(person_id)})
    person_ids = [row[0] for row in result.fetchall()]

    persons_result = await db.execute(select(Person).where(Person.id.in_(person_ids)))
    persons = persons_result.scalars().all()

    rels_result = await db.execute(
        select(Relationship).where(
            Relationship.person_id.in_(person_ids),
            Relationship.related_person_id.in_(person_ids),
        )
    )
    rels = rels_result.scalars().all()

    nodes = [_person_to_node(p) for p in persons]
    edges = [_relationship_to_edge(r) for r in rels]
    return TreeResponse(nodes=nodes, edges=edges)
