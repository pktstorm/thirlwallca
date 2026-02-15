"""Diagnostic script to check relationship integrity."""

import asyncio
from app.deps import async_session
from sqlalchemy import text


async def check():
    async with async_session() as db:
        # First check what enum values are actually in the DB
        enum_result = await db.execute(text(
            "SELECT DISTINCT relationship FROM relationships"
        ))
        print("Distinct relationship values in DB:", [r[0] for r in enum_result.fetchall()])

        # Check parent-child relationships using enum member name
        # Try both 'parent_child' and 'PARENT_CHILD'
        for val in ['parent_child', 'PARENT_CHILD']:
            try:
                result = await db.execute(text(
                    "SELECT COUNT(*) FROM relationships WHERE relationship = :val"
                ), {"val": val})
                count = result.scalar()
                print(f"  relationship = '{val}': {count} rows")
            except Exception as e:
                print(f"  relationship = '{val}': ERROR - {e}")
                await db.rollback()

        # Use cast to text to avoid enum issues
        result = await db.execute(text("""
            SELECT
                r.relationship::text as rel_type,
                p1.first_name || ' ' || p1.last_name as person_name,
                EXTRACT(YEAR FROM p1.birth_date)::int as person_birth_year,
                p2.first_name || ' ' || p2.last_name as related_name,
                EXTRACT(YEAR FROM p2.birth_date)::int as related_birth_year
            FROM relationships r
            JOIN persons p1 ON r.person_id = p1.id
            JOIN persons p2 ON r.related_person_id = p2.id
            WHERE r.relationship::text LIKE '%arent%' OR r.relationship::text LIKE '%ARENT%'
            ORDER BY p2.birth_date NULLS LAST
            LIMIT 50
        """))
        rows = result.fetchall()
        print(f"\nPARENT_CHILD relationships (convention: person_id=child, related_person_id=parent):")
        print(f"{'Child (person_id)':<30} {'Born':<8} {'Parent (related_person_id)':<30} {'Born':<8} {'Status'}")
        print("-" * 100)
        wrong = 0
        total = 0
        for row in rows:
            rel_type = row[0]
            child_name = row[1]
            child_year = row[2]
            parent_name = row[3]
            parent_year = row[4]
            status = ""
            if child_year and parent_year:
                if child_year < parent_year:
                    status = "WRONG - child older!"
                    wrong += 1
                elif child_year - parent_year < 12:
                    status = "SUSPICIOUS"
                else:
                    status = "ok"
            else:
                status = "no dates"
            total += 1
            print(f"{child_name:<30} {str(child_year or '?'):<8} {parent_name:<30} {str(parent_year or '?'):<8} {status}")

        print(f"\nWrong direction: {wrong} out of {total} shown")

        # Count all wrong-direction relationships
        wrong_total = await db.execute(text("""
            SELECT COUNT(*)
            FROM relationships r
            JOIN persons p1 ON r.person_id = p1.id
            JOIN persons p2 ON r.related_person_id = p2.id
            WHERE (r.relationship::text LIKE '%arent%' OR r.relationship::text LIKE '%ARENT%')
              AND p1.birth_date IS NOT NULL
              AND p2.birth_date IS NOT NULL
              AND EXTRACT(YEAR FROM p1.birth_date) < EXTRACT(YEAR FROM p2.birth_date)
        """))
        print(f"Total WRONG direction (child born before parent): {wrong_total.scalar()}")

        correct_total = await db.execute(text("""
            SELECT COUNT(*)
            FROM relationships r
            JOIN persons p1 ON r.person_id = p1.id
            JOIN persons p2 ON r.related_person_id = p2.id
            WHERE (r.relationship::text LIKE '%arent%' OR r.relationship::text LIKE '%ARENT%')
              AND p1.birth_date IS NOT NULL
              AND p2.birth_date IS NOT NULL
              AND EXTRACT(YEAR FROM p1.birth_date) >= EXTRACT(YEAR FROM p2.birth_date)
        """))
        print(f"Total CORRECT direction (child born after parent): {correct_total.scalar()}")

        # Also check spouse relationships
        spouse_result = await db.execute(text("""
            SELECT
                p1.first_name || ' ' || p1.last_name,
                EXTRACT(YEAR FROM p1.birth_date)::int,
                p2.first_name || ' ' || p2.last_name,
                EXTRACT(YEAR FROM p2.birth_date)::int,
                r.marriage_date
            FROM relationships r
            JOIN persons p1 ON r.person_id = p1.id
            JOIN persons p2 ON r.related_person_id = p2.id
            WHERE r.relationship::text LIKE '%pouse%' OR r.relationship::text LIKE '%POUSE%'
            ORDER BY r.marriage_date NULLS LAST
            LIMIT 15
        """))
        spouse_rows = spouse_result.fetchall()
        print(f"\nSPOUSE relationships (first 15):")
        print(f"{'Person 1':<30} {'Born':<8} {'Person 2':<30} {'Born':<8} {'Married'}")
        print("-" * 100)
        for row in spouse_rows:
            print(f"{row[0]:<30} {str(row[1] or '?'):<8} {row[2]:<30} {str(row[3] or '?'):<8} {str(row[4] or '?')}")


if __name__ == "__main__":
    asyncio.run(check())
