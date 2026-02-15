"""Merge two duplicate person records, keeping one and consolidating all references.

Usage:
    cd backend
    poetry run python -m scripts.merge_persons <keeper_id> <duplicate_id> [--dry-run]

The keeper's fields are preserved; only NULL/empty fields are filled from the duplicate.
All relationships, residences, alternate names, etc. are moved to the keeper.
The duplicate is then deleted.
"""

import argparse
import asyncio
import logging
import sys
import uuid

from sqlalchemy import text

from app.deps import async_session

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# All tables with person_id foreign keys (besides relationships which needs special handling)
PERSON_FK_TABLES = [
    ("person_residences", "person_id"),
    ("person_alternate_names", "person_id"),
    ("migrations", "person_id"),
    ("timeline_events", "person_id"),
    ("media_persons", "person_id"),
    ("story_persons", "person_id"),
    ("comments", "person_id"),
]


async def main(keeper_id: str, duplicate_id: str, dry_run: bool = False) -> None:
    keeper_uuid = uuid.UUID(keeper_id)
    dup_uuid = uuid.UUID(duplicate_id)

    async with async_session() as db:
        # Verify both persons exist
        for label, pid in [("Keeper", keeper_uuid), ("Duplicate", dup_uuid)]:
            row = await db.execute(
                text("SELECT id, first_name, last_name, birth_date FROM persons WHERE id = :id"),
                {"id": pid},
            )
            person = row.mappings().first()
            if not person:
                logger.error("%s person %s not found", label, pid)
                sys.exit(1)
            logger.info(
                "%s: %s %s (born %s) [%s]",
                label, person["first_name"], person["last_name"],
                person["birth_date"], person["id"],
            )

        # --- Fill empty fields on keeper from duplicate ---
        fill_cols = [
            "middle_name", "maiden_name", "suffix", "gender",
            "birth_date", "birth_date_approx", "birth_location_id",
            "death_date", "death_date_approx", "death_location_id",
            "burial_location", "is_living",
        ]
        row = await db.execute(
            text(f"SELECT {', '.join(fill_cols)} FROM persons WHERE id = :id"),
            {"id": keeper_uuid},
        )
        keeper_data = row.mappings().first()
        row = await db.execute(
            text(f"SELECT {', '.join(fill_cols)} FROM persons WHERE id = :id"),
            {"id": dup_uuid},
        )
        dup_data = row.mappings().first()

        updates = []
        for col in fill_cols:
            keeper_val = keeper_data[col]
            dup_val = dup_data[col]
            if (keeper_val is None or keeper_val == "") and dup_val is not None and dup_val != "":
                updates.append(col)
                logger.info("  Fill %s: %s (from duplicate)", col, dup_val)

        if updates:
            set_clause = ", ".join(f"{col} = :{col}" for col in updates)
            params = {col: dup_data[col] for col in updates}
            params["id"] = keeper_uuid
            if not dry_run:
                await db.execute(
                    text(f"UPDATE persons SET {set_clause} WHERE id = :id"),
                    params,
                )
            logger.info("Updated %d fields on keeper", len(updates))

        # --- Move relationships ---
        # Handle person_id column (duplicate is the child/person)
        row = await db.execute(
            text("""
                SELECT id, person_id, related_person_id, relationship
                FROM relationships
                WHERE person_id = :dup_id
            """),
            {"dup_id": dup_uuid},
        )
        dup_as_person = row.mappings().all()

        moved_rels = 0
        skipped_rels = 0

        async def _relationship_exists(a: uuid.UUID, b: uuid.UUID, rel_type: str) -> bool:
            """Check if a relationship exists between a and b (in either direction for spouse)."""
            r = await db.execute(
                text("""
                    SELECT id FROM relationships
                    WHERE person_id = :a AND related_person_id = :b AND relationship = :t
                """),
                {"a": a, "b": b, "t": rel_type},
            )
            if r.first():
                return True
            if rel_type == "SPOUSE":
                r = await db.execute(
                    text("""
                        SELECT id FROM relationships
                        WHERE person_id = :b AND related_person_id = :a AND relationship = :t
                    """),
                    {"a": a, "b": b, "t": rel_type},
                )
                if r.first():
                    return True
            return False

        for rel in dup_as_person:
            other_id = rel["related_person_id"]
            if await _relationship_exists(keeper_uuid, other_id, rel["relationship"]):
                logger.info("  Skip relationship (exists): keeper <-> %s (%s)", other_id, rel["relationship"])
                if not dry_run:
                    await db.execute(text("DELETE FROM relationships WHERE id = :id"), {"id": rel["id"]})
                skipped_rels += 1
            else:
                logger.info("  Move relationship: person_id %s -> %s (related: %s, type: %s)",
                            dup_uuid, keeper_uuid, other_id, rel["relationship"])
                if not dry_run:
                    await db.execute(
                        text("UPDATE relationships SET person_id = :keeper_id WHERE id = :id"),
                        {"keeper_id": keeper_uuid, "id": rel["id"]},
                    )
                moved_rels += 1

        # Handle related_person_id column (duplicate is the parent/spouse)
        row = await db.execute(
            text("""
                SELECT id, person_id, related_person_id, relationship
                FROM relationships
                WHERE related_person_id = :dup_id
            """),
            {"dup_id": dup_uuid},
        )
        dup_as_related = row.mappings().all()

        for rel in dup_as_related:
            other_id = rel["person_id"]
            if await _relationship_exists(other_id, keeper_uuid, rel["relationship"]):
                logger.info("  Skip relationship (exists): %s <-> keeper (%s)", other_id, rel["relationship"])
                if not dry_run:
                    await db.execute(text("DELETE FROM relationships WHERE id = :id"), {"id": rel["id"]})
                skipped_rels += 1
            else:
                logger.info("  Move relationship: related_person_id %s -> %s (person: %s, type: %s)",
                            dup_uuid, keeper_uuid, other_id, rel["relationship"])
                if not dry_run:
                    await db.execute(
                        text("UPDATE relationships SET related_person_id = :keeper_id WHERE id = :id"),
                        {"keeper_id": keeper_uuid, "id": rel["id"]},
                    )
                moved_rels += 1

        logger.info("Relationships: %d moved, %d skipped (already existed)", moved_rels, skipped_rels)

        # --- Move user links ---
        row = await db.execute(
            text("SELECT id FROM users WHERE linked_person_id = :dup_id"),
            {"dup_id": dup_uuid},
        )
        linked_users = row.all()
        if linked_users:
            logger.info("  Moving %d user link(s) to keeper", len(linked_users))
            if not dry_run:
                await db.execute(
                    text("UPDATE users SET linked_person_id = :keeper_id WHERE linked_person_id = :dup_id"),
                    {"keeper_id": keeper_uuid, "dup_id": dup_uuid},
                )

        # --- Move other FK references ---
        for table, col in PERSON_FK_TABLES:
            row = await db.execute(
                text(f"SELECT COUNT(*) as cnt FROM {table} WHERE {col} = :dup_id"),
                {"dup_id": dup_uuid},
            )
            count = row.scalar()
            if count and count > 0:
                logger.info("  Moving %d row(s) in %s", count, table)
                if not dry_run:
                    try:
                        await db.execute(
                            text(f"UPDATE {table} SET {col} = :keeper_id WHERE {col} = :dup_id"),
                            {"keeper_id": keeper_uuid, "dup_id": dup_uuid},
                        )
                    except Exception as e:
                        # Handle unique constraint violations on junction tables
                        logger.warning("  Conflict updating %s, deleting duplicates: %s", table, e)
                        await db.execute(
                            text(f"DELETE FROM {table} WHERE {col} = :dup_id"),
                            {"dup_id": dup_uuid},
                        )

        # --- Add "Sam" as alternate name on keeper if not already present ---
        row = await db.execute(
            text("SELECT first_name FROM persons WHERE id = :dup_id"),
            {"dup_id": dup_uuid},
        )
        dup_first = row.scalar()
        row = await db.execute(
            text("SELECT first_name FROM persons WHERE id = :keeper_id"),
            {"keeper_id": keeper_uuid},
        )
        keeper_first = row.scalar()

        if dup_first and keeper_first and dup_first.lower() != keeper_first.lower():
            # Check if this alternate name already exists
            row = await db.execute(
                text("""
                    SELECT id FROM person_alternate_names
                    WHERE person_id = :keeper_id AND first_name = :first_name
                """),
                {"keeper_id": keeper_uuid, "first_name": dup_first},
            )
            if not row.first():
                logger.info("  Adding alternate name '%s' to keeper (keeper is '%s')", dup_first, keeper_first)
                if not dry_run:
                    await db.execute(
                        text("""
                            INSERT INTO person_alternate_names (id, person_id, first_name, name_type)
                            VALUES (:id, :person_id, :first_name, 'nickname')
                        """),
                        {"id": uuid.uuid4(), "person_id": keeper_uuid, "first_name": dup_first},
                    )

        # --- Delete duplicate person ---
        if not dry_run:
            await db.execute(
                text("DELETE FROM persons WHERE id = :dup_id"),
                {"dup_id": dup_uuid},
            )
            logger.info("Deleted duplicate person %s", dup_uuid)
            await db.commit()
            logger.info("Merge complete.")
        else:
            logger.info("[DRY RUN] No changes made.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge two duplicate person records")
    parser.add_argument("keeper_id", help="UUID of the person to keep")
    parser.add_argument("duplicate_id", help="UUID of the duplicate to merge and delete")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen without making changes")
    args = parser.parse_args()

    asyncio.run(main(args.keeper_id, args.duplicate_id, args.dry_run))
