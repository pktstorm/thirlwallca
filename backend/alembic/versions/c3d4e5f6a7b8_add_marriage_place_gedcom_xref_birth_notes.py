"""add marriage_place, gedcom_xref, birth_notes columns

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- relationships: marriage place --
    op.add_column(
        "relationships",
        sa.Column("marriage_place_text", sa.String(255), nullable=True),
    )
    op.add_column(
        "relationships",
        sa.Column(
            "marriage_location_id",
            UUID(as_uuid=True),
            sa.ForeignKey("locations.id"),
            nullable=True,
        ),
    )

    # -- persons: gedcom xref for deterministic re-import --
    op.add_column(
        "persons",
        sa.Column("gedcom_xref", sa.String(32), nullable=True),
    )
    op.create_unique_constraint("uq_persons_gedcom_xref", "persons", ["gedcom_xref"])

    # -- persons: birth notes (Adopted, hospital name, etc.) --
    op.add_column(
        "persons",
        sa.Column("birth_notes", sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("persons", "birth_notes")
    op.drop_constraint("uq_persons_gedcom_xref", "persons", type_="unique")
    op.drop_column("persons", "gedcom_xref")
    op.drop_column("relationships", "marriage_location_id")
    op.drop_column("relationships", "marriage_place_text")
