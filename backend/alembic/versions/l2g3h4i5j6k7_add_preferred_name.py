"""add preferred_name to persons

Revision ID: l2g3h4i5j6k7
Revises: k1f2g3h4i5j6
Create Date: 2026-04-07

"""
from typing import Sequence, Union
from alembic import op

revision: str = "l2g3h4i5j6k7"
down_revision: Union[str, None] = "k1f2g3h4i5j6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE persons ADD COLUMN IF NOT EXISTS preferred_name VARCHAR(128)")


def downgrade() -> None:
    op.execute("ALTER TABLE persons DROP COLUMN IF EXISTS preferred_name")
