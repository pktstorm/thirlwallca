"""add memories, person_photo_tags, family_traditions tables

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-24

"""
from typing import Sequence, Union

from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
            author_id UUID NOT NULL REFERENCES users(id),
            body TEXT NOT NULL,
            photo_s3_key VARCHAR(512),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS person_photo_tags (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
            person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
            x_pct FLOAT NOT NULL,
            y_pct FLOAT NOT NULL,
            width_pct FLOAT NOT NULL DEFAULT 0,
            height_pct FLOAT NOT NULL DEFAULT 0,
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS family_traditions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255) NOT NULL,
            category VARCHAR(32) NOT NULL DEFAULT 'tradition',
            content TEXT NOT NULL,
            cover_image_url TEXT,
            origin_person_id UUID REFERENCES persons(id),
            author_id UUID NOT NULL REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS family_tradition_persons (
            tradition_id UUID NOT NULL REFERENCES family_traditions(id) ON DELETE CASCADE,
            person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
            PRIMARY KEY (tradition_id, person_id)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS family_tradition_persons")
    op.execute("DROP TABLE IF EXISTS family_traditions")
    op.execute("DROP TABLE IF EXISTS person_photo_tags")
    op.execute("DROP TABLE IF EXISTS memories")
