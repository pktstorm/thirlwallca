"""add unique constraint on linked_person_id

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-14

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Partial unique index: only one user can link to a given person,
    # but multiple users can have NULL (unlinked).
    op.execute(
        "CREATE UNIQUE INDEX uq_users_linked_person_id "
        "ON users (linked_person_id) "
        "WHERE linked_person_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_users_linked_person_id")
