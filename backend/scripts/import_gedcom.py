"""CLI script to import a GEDCOM file into the Thirlwall.ca database.

Usage:
    cd backend
    poetry run python -m scripts.import_gedcom /path/to/file.ged [--dry-run]
"""

import argparse
import asyncio
import logging
import sys

from app.deps import async_session
from app.services.gedcom_service import parse_gedcom_file
from app.services.import_service import import_gedcom

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


async def main(file_path: str, dry_run: bool = False) -> None:
    logger.info("Parsing GEDCOM file: %s", file_path)
    gedcom_data = parse_gedcom_file(file_path)
    logger.info(
        "Parsed %d individuals, %d families",
        len(gedcom_data.persons),
        len(gedcom_data.families),
    )

    if dry_run:
        logger.info("DRY RUN — no database changes will be made")
        for xref, person in sorted(gedcom_data.persons.items()):
            birth_str = person.birth_date.raw if person.birth_date else "?"
            aka_str = f" (aka {', '.join(person.aka_names)})" if person.aka_names else ""
            logger.info(
                "  %s: %s %s %s (b. %s)%s",
                xref, person.first_name, person.middle_name or "", person.last_name, birth_str, aka_str,
            )
        for xref, fam in sorted(gedcom_data.families.items()):
            husb = fam.husband_id or "?"
            wife = fam.wife_id or "?"
            marr = fam.marriage_date.raw if fam.marriage_date else "?"
            logger.info(
                "  %s: %s + %s, %d children, married %s",
                xref, husb, wife, len(fam.child_ids), marr,
            )
        return

    async with async_session() as session:
        try:
            summary = await import_gedcom(session, gedcom_data, user_id=None)
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("Import failed, all changes rolled back")
            sys.exit(1)

    logger.info("=== Import Complete ===")
    logger.info("  Persons created:       %d", summary.persons_created)
    logger.info("  Persons updated:       %d", summary.persons_updated)
    logger.info("  Persons skipped:       %d", summary.persons_skipped)
    logger.info("  Relationships created: %d", summary.relationships_created)
    logger.info("  Relationships skipped: %d", summary.relationships_skipped)
    logger.info("  Locations created:     %d", summary.locations_created)
    logger.info("  Locations reused:      %d", summary.locations_reused)
    logger.info("  Residences created:    %d", summary.residences_created)
    logger.info("  Alternate names:       %d", summary.alternate_names_created)
    if summary.errors:
        logger.warning("  Warnings: %d", len(summary.errors))
        for err in summary.errors:
            logger.warning("    - %s", err)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import a GEDCOM file into the database")
    parser.add_argument("file", help="Path to the .ged file")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, don't import")
    args = parser.parse_args()
    asyncio.run(main(args.file, args.dry_run))
