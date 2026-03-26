"""add audit_logs table

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-26

"""
from typing import Sequence, Union

from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id),
            user_name VARCHAR(128),
            action VARCHAR(32) NOT NULL,
            entity_type VARCHAR(64) NOT NULL,
            entity_id VARCHAR(64),
            entity_label VARCHAR(255),
            details JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs (entity_type)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS audit_logs")
