"""Deep diagnostic: trace GEDCOM families through parser to DB relationships."""

import asyncio
from app.deps import async_session
from app.services.gedcom_service import parse_gedcom_file
from sqlalchemy import text


async def main():
    # ---- Step 1: Parse the GEDCOM and verify family structures ----
    print("=" * 80)
    print("STEP 1: GEDCOM PARSER OUTPUT")
    print("=" * 80)

    data = parse_gedcom_file("/Users/sthirlwall/code/thirlwallca/Thirlwall.ged")

    # Pick a known multi-generation family to trace: @F5@ should be a core family
    # Let's trace a few families and verify the parent/child structure
    trace_families = ["@F5@", "@F7@", "@F42@", "@F6@", "@F1@", "@F62@"]

    for fam_id in trace_families:
        fam = data.families.get(fam_id)
        if not fam:
            print(f"\n{fam_id}: NOT FOUND in parser output")
            continue

        print(f"\n{fam_id}:")
        if fam.husband_id:
            husb = data.persons.get(fam.husband_id)
            husb_name = f"{husb.first_name} {husb.last_name}" if husb else "MISSING"
            husb_birth = husb.birth_date.raw if husb and husb.birth_date else "?"
            print(f"  HUSB: {fam.husband_id} = {husb_name} (b. {husb_birth})")
        else:
            print("  HUSB: None")

        if fam.wife_id:
            wife = data.persons.get(fam.wife_id)
            wife_name = f"{wife.first_name} {wife.last_name}" if wife else "MISSING"
            wife_birth = wife.birth_date.raw if wife and wife.birth_date else "?"
            print(f"  WIFE: {fam.wife_id} = {wife_name} (b. {wife_birth})")
        else:
            print("  WIFE: None")

        for child_xref in fam.child_ids:
            child = data.persons.get(child_xref)
            child_name = f"{child.first_name} {child.last_name}" if child else "MISSING"
            child_birth = child.birth_date.raw if child and child.birth_date else "?"
            print(f"  CHIL: {child_xref} = {child_name} (b. {child_birth})")

        if fam.marriage_date:
            print(f"  MARR: {fam.marriage_date.raw}")

    # ---- Step 2: Check for xref mapping integrity ----
    print("\n" + "=" * 80)
    print("STEP 2: CROSS-REFERENCE INTEGRITY")
    print("=" * 80)

    # Verify all HUSB/WIFE/CHIL xrefs in families point to existing persons
    missing = []
    for fam_id, fam in data.families.items():
        for xref in [fam.husband_id, fam.wife_id] + fam.child_ids:
            if xref and xref not in data.persons:
                missing.append((fam_id, xref))

    if missing:
        print(f"PROBLEM: {len(missing)} missing person cross-references!")
        for fam_id, xref in missing[:20]:
            print(f"  Family {fam_id} references {xref} which doesn't exist")
    else:
        print("OK: All family cross-references point to existing persons")

    # Check for duplicate persons (same name might cause merge issues)
    name_counts: dict[tuple[str, str], list[str]] = {}
    for xref, person in data.persons.items():
        key = (person.first_name.lower(), person.last_name.lower())
        name_counts.setdefault(key, []).append(xref)

    dupes = {k: v for k, v in name_counts.items() if len(v) > 1}
    if dupes:
        print(f"\nDUPLICATE NAMES in GEDCOM ({len(dupes)} groups):")
        for (first, last), xrefs in dupes.items():
            for xref in xrefs:
                p = data.persons[xref]
                birth = p.birth_date.raw if p.birth_date else "?"
                famc = p.family_child_ids
                print(f"  {first} {last}: {xref} (b. {birth}) child_of={famc}")
    else:
        print("No duplicate names found")

    # ---- Step 3: Check person matching would produce ----
    print("\n" + "=" * 80)
    print("STEP 3: PERSON MATCHING ANALYSIS")
    print("=" * 80)

    # Simulate the matching logic used during import
    match_key_to_xrefs: dict[tuple[str, str, int | None], list[str]] = {}
    for xref, person in data.persons.items():
        birth_year = person.birth_date.value.year if person.birth_date and person.birth_date.value else None
        key = (person.first_name.lower(), person.last_name.lower(), birth_year)
        match_key_to_xrefs.setdefault(key, []).append(xref)

    collisions = {k: v for k, v in match_key_to_xrefs.items() if len(v) > 1}
    if collisions:
        print(f"MATCH KEY COLLISIONS ({len(collisions)} groups):")
        print("These GEDCOM persons would map to the SAME DB person during import!")
        for (first, last, year), xrefs in collisions.items():
            print(f"\n  Key: ({first}, {last}, {year})")
            for xref in xrefs:
                p = data.persons[xref]
                famc = p.family_child_ids
                fams = p.family_spouse_ids
                print(f"    {xref}: child_of_families={famc}, spouse_in_families={fams}")
                # Show what families they're children in
                for fc in famc:
                    fam = data.families.get(fc)
                    if fam:
                        husb = data.persons.get(fam.husband_id) if fam.husband_id else None
                        wife = data.persons.get(fam.wife_id) if fam.wife_id else None
                        h_name = f"{husb.first_name} {husb.last_name}" if husb else "?"
                        w_name = f"{wife.first_name} {wife.last_name}" if wife else "?"
                        print(f"      -> child of {fc}: {h_name} + {w_name}")
    else:
        print("No match key collisions - all GEDCOM persons have unique (first, last, birth_year) keys")

    # ---- Step 4: Check DB relationships ----
    print("\n" + "=" * 80)
    print("STEP 4: DATABASE RELATIONSHIP ANALYSIS")
    print("=" * 80)

    async with async_session() as db:
        # Check total counts
        result = await db.execute(text("SELECT COUNT(*) FROM persons"))
        print(f"Total persons in DB: {result.scalar()}")

        result = await db.execute(text("SELECT COUNT(*) FROM relationships"))
        print(f"Total relationships in DB: {result.scalar()}")

        result = await db.execute(text(
            "SELECT relationship::text, COUNT(*) FROM relationships GROUP BY relationship::text"
        ))
        for row in result.fetchall():
            print(f"  {row[0]}: {row[1]}")

        # Check for persons with too many parents (should be max 2)
        result = await db.execute(text("""
            SELECT p.first_name || ' ' || p.last_name as name,
                   EXTRACT(YEAR FROM p.birth_date)::int as birth_year,
                   COUNT(*) as parent_count
            FROM relationships r
            JOIN persons p ON r.person_id = p.id
            WHERE r.relationship::text LIKE '%ARENT%'
            GROUP BY p.id, p.first_name, p.last_name, p.birth_date
            HAVING COUNT(*) > 2
            ORDER BY COUNT(*) DESC
            LIMIT 20
        """))
        rows = result.fetchall()
        if rows:
            print(f"\nPERSONS WITH MORE THAN 2 PARENTS ({len(rows)} found):")
            for row in rows:
                print(f"  {row[0]} (b. {row[1]}): {row[2]} parents!")
        else:
            print("\nOK: No person has more than 2 parents")

        # Check for persons with zero parents who should have some
        # (this would indicate broken xref mapping)

        # Check specific family: what does the DB show for a known person
        # Find "William Thirlwall" to trace through
        result = await db.execute(text("""
            SELECT p.id, p.first_name, p.last_name,
                   EXTRACT(YEAR FROM p.birth_date)::int as birth_year
            FROM persons p
            WHERE p.last_name = 'Thirlwall'
            ORDER BY p.birth_date NULLS LAST
        """))
        thirlwalls = result.fetchall()
        print(f"\nAll Thirlwall persons in DB ({len(thirlwalls)}):")
        for row in thirlwalls:
            # Get their parents
            parents_result = await db.execute(text("""
                SELECT p.first_name || ' ' || p.last_name,
                       EXTRACT(YEAR FROM p.birth_date)::int
                FROM relationships r
                JOIN persons p ON r.related_person_id = p.id
                WHERE r.person_id = :pid
                  AND r.relationship::text LIKE '%ARENT%'
            """), {"pid": str(row[0])})
            parents = parents_result.fetchall()

            # Get their children
            children_result = await db.execute(text("""
                SELECT p.first_name || ' ' || p.last_name,
                       EXTRACT(YEAR FROM p.birth_date)::int
                FROM relationships r
                JOIN persons p ON r.person_id = p.id
                WHERE r.related_person_id = :pid
                  AND r.relationship::text LIKE '%ARENT%'
            """), {"pid": str(row[0])})
            children = children_result.fetchall()

            # Get spouses
            spouses_result = await db.execute(text("""
                SELECT p.first_name || ' ' || p.last_name,
                       EXTRACT(YEAR FROM p.birth_date)::int
                FROM relationships r
                JOIN persons p ON (
                    CASE WHEN r.person_id = :pid THEN r.related_person_id
                         ELSE r.person_id END
                ) = p.id
                WHERE (r.person_id = :pid OR r.related_person_id = :pid)
                  AND r.relationship::text LIKE '%POUSE%'
            """), {"pid": str(row[0])})
            spouses = spouses_result.fetchall()

            parents_str = ", ".join(f"{p[0]} (b.{p[1]})" for p in parents) or "none"
            children_str = ", ".join(f"{c[0]} (b.{c[1]})" for c in children) or "none"
            spouses_str = ", ".join(f"{s[0]} (b.{s[1]})" for s in spouses) or "none"
            print(f"  {row[1]} {row[2]} (b.{row[3]})")
            print(f"    Parents:  {parents_str}")
            print(f"    Spouses:  {spouses_str}")
            print(f"    Children: {children_str}")


if __name__ == "__main__":
    asyncio.run(main())
