"""add family_stories tables

Revision ID: j0e1f2g3h4i5
Revises: i9d0e1f2g3h4
Create Date: 2026-04-04

"""
from typing import Sequence, Union
from alembic import op

revision: str = "j0e1f2g3h4i5"
down_revision: Union[str, None] = "i9d0e1f2g3h4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS family_stories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255) NOT NULL,
            subtitle VARCHAR(512),
            slug VARCHAR(255) NOT NULL UNIQUE,
            content TEXT NOT NULL,
            cover_image_url TEXT,
            category VARCHAR(64) NOT NULL DEFAULT 'history',
            external_url TEXT,
            location_id UUID REFERENCES locations(id),
            published BOOLEAN NOT NULL DEFAULT false,
            author_id UUID NOT NULL REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS family_story_persons (
            story_id UUID NOT NULL REFERENCES family_stories(id) ON DELETE CASCADE,
            person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
            PRIMARY KEY (story_id, person_id)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS family_story_images (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            story_id UUID NOT NULL REFERENCES family_stories(id) ON DELETE CASCADE,
            s3_key VARCHAR(512),
            image_url TEXT,
            caption VARCHAR(512),
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS family_story_images")
    op.execute("DROP TABLE IF EXISTS family_story_persons")
    op.execute("DROP TABLE IF EXISTS family_stories")
