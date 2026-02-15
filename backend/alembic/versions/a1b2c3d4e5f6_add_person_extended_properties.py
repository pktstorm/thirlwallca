"""add person extended properties

Revision ID: a1b2c3d4e5f6
Revises: ee2558490c6f
Create Date: 2026-02-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "ee2558490c6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

name_type_enum = sa.Enum(
    "maiden", "married", "nickname", "alias", "birth", "other",
    name="name_type",
)


def upgrade() -> None:
    # Add new columns to persons table
    op.add_column("persons", sa.Column("nicknames", sa.String(255), nullable=True))
    op.add_column("persons", sa.Column("birth_place_text", sa.String(255), nullable=True))
    op.add_column("persons", sa.Column("death_place_text", sa.String(255), nullable=True))
    op.add_column("persons", sa.Column("cause_of_death", sa.String(255), nullable=True))
    op.add_column("persons", sa.Column("ethnicity", sa.String(128), nullable=True))
    op.add_column("persons", sa.Column("religion", sa.String(128), nullable=True))
    op.add_column("persons", sa.Column("education", sa.String(255), nullable=True))
    op.add_column("persons", sa.Column("military_service", sa.String(255), nullable=True))
    op.add_column("persons", sa.Column("burial_location", sa.String(255), nullable=True))
    op.add_column("persons", sa.Column("notes", sa.Text(), nullable=True))

    # Create person_residences table
    op.create_table(
        "person_residences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("person_id", UUID(as_uuid=True), sa.ForeignKey("persons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=True),
        sa.Column("place_text", sa.String(255), nullable=True),
        sa.Column("from_date", sa.Date(), nullable=True),
        sa.Column("to_date", sa.Date(), nullable=True),
        sa.Column("is_current", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_person_residences_person_id", "person_residences", ["person_id"])

    # Create person_alternate_names table (enum is auto-created by create_table)
    op.create_table(
        "person_alternate_names",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("person_id", UUID(as_uuid=True), sa.ForeignKey("persons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name_type", name_type_enum, nullable=False),
        sa.Column("first_name", sa.String(128), nullable=True),
        sa.Column("last_name", sa.String(128), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_person_alternate_names_person_id", "person_alternate_names", ["person_id"])


def downgrade() -> None:
    op.drop_table("person_alternate_names")
    name_type_enum.drop(op.get_bind(), checkfirst=True)
    op.drop_table("person_residences")

    op.drop_column("persons", "notes")
    op.drop_column("persons", "burial_location")
    op.drop_column("persons", "military_service")
    op.drop_column("persons", "education")
    op.drop_column("persons", "religion")
    op.drop_column("persons", "ethnicity")
    op.drop_column("persons", "cause_of_death")
    op.drop_column("persons", "death_place_text")
    op.drop_column("persons", "birth_place_text")
    op.drop_column("persons", "nicknames")
