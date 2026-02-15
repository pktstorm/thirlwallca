"""Find duplicate Sam/Samuel Thirlwall and show their relationships."""
import asyncio
from sqlalchemy import text
from app.deps import async_session


async def main():
    async with async_session() as db:
        r = await db.execute(text(
            "SELECT id::text, first_name, last_name, birth_date::text "
            "FROM persons WHERE last_name = 'Thirlwall' AND first_name ILIKE 'sam%' "
            "ORDER BY first_name"
        ))
        print("=== Sam/Samuel Thirlwall records ===")
        for row in r.all():
            print(f"  {row[0]} | {row[1]} {row[2]} | born {row[3]}")

            # Show relationships for this person
            r2 = await db.execute(text(
                "SELECT r.relationship::text, "
                "  CASE WHEN r.person_id::text = :pid THEN 'is person_id (child)' ELSE 'is related_person_id (parent/spouse)' END as role, "
                "  p2.first_name, p2.last_name, p2.birth_date::text "
                "FROM relationships r "
                "JOIN persons p2 ON p2.id = CASE WHEN r.person_id::text = :pid THEN r.related_person_id ELSE r.person_id END "
                "WHERE r.person_id::text = :pid OR r.related_person_id::text = :pid"
            ), {"pid": row[0]})
            for rel in r2.all():
                print(f"    {rel[0]} | {rel[1]} | {rel[2]} {rel[3]} (born {rel[4]})")
            print()

asyncio.run(main())
