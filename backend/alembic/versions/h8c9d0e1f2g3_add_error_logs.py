"""add error_logs table

Revision ID: h8c9d0e1f2g3
Revises: g7b8c9d0e1f2
Create Date: 2026-04-03

"""
from typing import Sequence, Union
from alembic import op

revision: str = "h8c9d0e1f2g3"
down_revision: Union[str, None] = "g7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS error_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            method VARCHAR(8) NOT NULL,
            path VARCHAR(512) NOT NULL,
            status_code INTEGER NOT NULL DEFAULT 500,
            error_type VARCHAR(255) NOT NULL,
            error_message TEXT NOT NULL,
            traceback TEXT,
            user_agent VARCHAR(512),
            ip_address VARCHAR(64),
            request_body TEXT,
            resolved BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs (created_at DESC)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS error_logs")
