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
