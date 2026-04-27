import pytest
from uuid import uuid4


# These tests use the same conftest plumbing as other backend tests (an async db fixture).
# If conftest.py doesn't provide a `db` fixture yet, the first test will surface that
# and we'll add it before proceeding (see Task 2 step 2 below).


@pytest.mark.anyio
async def test_build_orbit_ancestors_two_generations(db):
    """Focus has 2 parents and 4 grandparents — verify they come back grouped per generation."""
    from app.domain.models import Person, Relationship
    from app.domain.enums import RelationshipType, Gender
    from app.services.orbit_service import build_orbit

    # Build a 3-generation pedigree: focus, 2 parents, 4 grandparents
    focus = Person(id=uuid4(), first_name="Focus", last_name="Person", gender=Gender.MALE, is_living=True)
    father = Person(id=uuid4(), first_name="Dad", last_name="Person", gender=Gender.MALE, is_living=True)
    mother = Person(id=uuid4(), first_name="Mom", last_name="Person", gender=Gender.FEMALE, is_living=True)
    pgf = Person(id=uuid4(), first_name="PGF", last_name="Person", gender=Gender.MALE, is_living=False)
    pgm = Person(id=uuid4(), first_name="PGM", last_name="Person", gender=Gender.FEMALE, is_living=False)
    mgf = Person(id=uuid4(), first_name="MGF", last_name="Smith", gender=Gender.MALE, is_living=False)
    mgm = Person(id=uuid4(), first_name="MGM", last_name="Smith", gender=Gender.FEMALE, is_living=False)
    db.add_all([focus, father, mother, pgf, pgm, mgf, mgm])

    # parent_child convention: person_id=child, related_person_id=parent
    db.add_all([
        Relationship(person_id=focus.id, related_person_id=father.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=focus.id, related_person_id=mother.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=father.id, related_person_id=pgf.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=father.id, related_person_id=pgm.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=mother.id, related_person_id=mgf.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=mother.id, related_person_id=mgm.id, relationship=RelationshipType.PARENT_CHILD),
    ])
    await db.flush()

    result = await build_orbit(
        db,
        person_id=focus.id,
        ancestor_depth=2,
        descendant_depth=0,
        include_siblings=False,
        include_spouses=False,
    )

    assert result.focus.id == focus.id
    assert len(result.ancestors_by_generation) == 2
    gen1 = result.ancestors_by_generation[0]
    gen2 = result.ancestors_by_generation[1]

    assert len(gen1) == 2
    gen1_ids = {a.id for a in gen1}
    assert gen1_ids == {father.id, mother.id}
    # parent_slot is set based on sex
    by_id = {a.id: a for a in gen1}
    assert by_id[father.id].parent_slot == "father"
    assert by_id[mother.id].parent_slot == "mother"
    assert by_id[father.id].parent_id == focus.id
    assert by_id[mother.id].parent_id == focus.id

    assert len(gen2) == 4
    gen2_by_id = {a.id: a for a in gen2}
    assert gen2_by_id[pgf.id].parent_id == father.id
    assert gen2_by_id[pgm.id].parent_id == father.id
    assert gen2_by_id[mgf.id].parent_id == mother.id
    assert gen2_by_id[mgm.id].parent_id == mother.id

    assert result.descendants == []
    assert result.siblings == []
    assert result.spouses == []


@pytest.mark.anyio
async def test_build_orbit_descendants_two_generations(db):
    """Focus has 2 children, each with 2 children — verify nested descendant tree."""
    from app.domain.models import Person, Relationship
    from app.domain.enums import RelationshipType, Gender
    from app.services.orbit_service import build_orbit

    focus = Person(id=uuid4(), first_name="Focus", last_name="P", gender=Gender.MALE, is_living=True)
    c1 = Person(id=uuid4(), first_name="Child1", last_name="P", gender=Gender.FEMALE, is_living=True)
    c2 = Person(id=uuid4(), first_name="Child2", last_name="P", gender=Gender.MALE, is_living=True)
    gc1a = Person(id=uuid4(), first_name="GC1a", last_name="P", gender=Gender.MALE, is_living=True)
    gc1b = Person(id=uuid4(), first_name="GC1b", last_name="P", gender=Gender.FEMALE, is_living=True)
    gc2a = Person(id=uuid4(), first_name="GC2a", last_name="P", gender=Gender.MALE, is_living=True)
    gc2b = Person(id=uuid4(), first_name="GC2b", last_name="P", gender=Gender.FEMALE, is_living=True)
    db.add_all([focus, c1, c2, gc1a, gc1b, gc2a, gc2b])

    # parent_child: person_id=child, related_person_id=parent
    db.add_all([
        Relationship(person_id=c1.id, related_person_id=focus.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=c2.id, related_person_id=focus.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=gc1a.id, related_person_id=c1.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=gc1b.id, related_person_id=c1.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=gc2a.id, related_person_id=c2.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=gc2b.id, related_person_id=c2.id, relationship=RelationshipType.PARENT_CHILD),
    ])
    await db.flush()

    result = await build_orbit(
        db, person_id=focus.id,
        ancestor_depth=0, descendant_depth=2,
        include_siblings=False, include_spouses=False,
    )

    assert result.ancestors_by_generation == []
    assert len(result.descendants) == 2
    by_id = {d.id: d for d in result.descendants}
    assert by_id[c1.id].parent_id == focus.id
    assert by_id[c2.id].parent_id == focus.id
    assert len(by_id[c1.id].children) == 2
    assert {gc.id for gc in by_id[c1.id].children} == {gc1a.id, gc1b.id}
    for gc in by_id[c1.id].children:
        assert gc.parent_id == c1.id
        assert gc.children == []  # depth limit reached


@pytest.mark.anyio
async def test_build_orbit_descendant_depth_limit(db):
    """descendant_depth=1 — only direct children, no grandchildren."""
    from app.domain.models import Person, Relationship
    from app.domain.enums import RelationshipType, Gender
    from app.services.orbit_service import build_orbit

    focus = Person(id=uuid4(), first_name="F", last_name="P", gender=Gender.MALE, is_living=True)
    c = Person(id=uuid4(), first_name="C", last_name="P", gender=Gender.FEMALE, is_living=True)
    gc = Person(id=uuid4(), first_name="GC", last_name="P", gender=Gender.MALE, is_living=True)
    db.add_all([focus, c, gc])
    db.add_all([
        Relationship(person_id=c.id, related_person_id=focus.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=gc.id, related_person_id=c.id, relationship=RelationshipType.PARENT_CHILD),
    ])
    await db.flush()

    result = await build_orbit(
        db, person_id=focus.id, ancestor_depth=0, descendant_depth=1,
        include_siblings=False, include_spouses=False,
    )
    assert len(result.descendants) == 1
    assert result.descendants[0].children == []


@pytest.mark.anyio
async def test_build_orbit_siblings(db):
    from app.domain.models import Person, Relationship
    from app.domain.enums import RelationshipType, Gender
    from app.services.orbit_service import build_orbit

    parent = Person(id=uuid4(), first_name="P", last_name="X", gender=Gender.MALE, is_living=True)
    focus = Person(id=uuid4(), first_name="F", last_name="X", gender=Gender.MALE, is_living=True)
    sib1 = Person(id=uuid4(), first_name="S1", last_name="X", gender=Gender.FEMALE, is_living=True)
    sib2 = Person(id=uuid4(), first_name="S2", last_name="X", gender=Gender.MALE, is_living=True)
    db.add_all([parent, focus, sib1, sib2])
    db.add_all([
        Relationship(person_id=focus.id, related_person_id=parent.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=sib1.id, related_person_id=parent.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=sib2.id, related_person_id=parent.id, relationship=RelationshipType.PARENT_CHILD),
    ])
    await db.flush()

    result = await build_orbit(
        db, person_id=focus.id, ancestor_depth=1, descendant_depth=0,
        include_siblings=True, include_spouses=False,
    )
    sib_ids = {s.id for s in result.siblings}
    assert sib_ids == {sib1.id, sib2.id}
    assert focus.id not in sib_ids


@pytest.mark.anyio
async def test_build_orbit_spouses(db):
    from app.domain.models import Person, Relationship
    from app.domain.enums import RelationshipType, Gender
    from app.services.orbit_service import build_orbit

    focus = Person(id=uuid4(), first_name="F", last_name="X", gender=Gender.MALE, is_living=True)
    spouse = Person(id=uuid4(), first_name="S", last_name="Y", gender=Gender.FEMALE, is_living=True)
    child = Person(id=uuid4(), first_name="C", last_name="X", gender=Gender.MALE, is_living=True)
    cspouse = Person(id=uuid4(), first_name="CS", last_name="Z", gender=Gender.FEMALE, is_living=True)
    db.add_all([focus, spouse, child, cspouse])
    db.add_all([
        Relationship(person_id=focus.id, related_person_id=spouse.id, relationship=RelationshipType.SPOUSE),
        Relationship(person_id=child.id, related_person_id=focus.id, relationship=RelationshipType.PARENT_CHILD),
        Relationship(person_id=child.id, related_person_id=cspouse.id, relationship=RelationshipType.SPOUSE),
    ])
    await db.flush()

    result = await build_orbit(
        db, person_id=focus.id, ancestor_depth=0, descendant_depth=1,
        include_siblings=False, include_spouses=True,
    )
    by_spouse = {(s.id, s.spouse_of) for s in result.spouses}
    assert (spouse.id, focus.id) in by_spouse
    assert (cspouse.id, child.id) in by_spouse
    # When include_spouses=False the result should be empty:
    result2 = await build_orbit(
        db, person_id=focus.id, ancestor_depth=0, descendant_depth=1,
        include_siblings=False, include_spouses=False,
    )
    assert result2.spouses == []


# ---------------------------------------------------------------------------
# Endpoint tests (Task 5)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_orbit_endpoint_returns_focus_and_ancestors(db, async_client, auth_headers):
    """End-to-end: hit GET /api/v1/persons/{id}/orbit and verify shape."""
    from app.domain.models import Person, Relationship
    from app.domain.enums import RelationshipType, Gender

    focus = Person(id=uuid4(), first_name="F", last_name="X", gender=Gender.MALE, is_living=True)
    dad = Person(id=uuid4(), first_name="D", last_name="X", gender=Gender.MALE, is_living=True)
    db.add_all([focus, dad])
    db.add_all([
        Relationship(person_id=focus.id, related_person_id=dad.id, relationship=RelationshipType.PARENT_CHILD),
    ])
    await db.commit()

    resp = await async_client.get(
        f"/api/v1/persons/{focus.id}/orbit",
        params={"ancestor_depth": 1, "descendant_depth": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["focus"]["id"] == str(focus.id)
    assert len(body["ancestors_by_generation"]) == 1
    assert len(body["ancestors_by_generation"][0]) == 1
    assert body["ancestors_by_generation"][0][0]["id"] == str(dad.id)
    assert body["ancestors_by_generation"][0][0]["parent_slot"] == "father"


@pytest.mark.anyio
async def test_orbit_endpoint_404_on_unknown_person(async_client, auth_headers):
    resp = await async_client.get(
        f"/api/v1/persons/{uuid4()}/orbit",
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_orbit_endpoint_clamps_depth(db, async_client, auth_headers):
    from app.domain.models import Person
    from app.domain.enums import Gender
    p = Person(id=uuid4(), first_name="X", last_name="Y", gender=Gender.MALE, is_living=True)
    db.add(p)
    await db.commit()
    # Request depth 99 — service clamps to 10. We just verify it doesn't crash and returns 200.
    resp = await async_client.get(
        f"/api/v1/persons/{p.id}/orbit",
        params={"ancestor_depth": 99, "descendant_depth": 99},
        headers=auth_headers,
    )
    assert resp.status_code == 200
