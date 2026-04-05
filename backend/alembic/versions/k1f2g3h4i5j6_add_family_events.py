"""add family events tables

Revision ID: k1f2g3h4i5j6
Revises: j0e1f2g3h4i5
Create Date: 2026-04-05

"""
from typing import Sequence, Union
from alembic import op

revision: str = "k1f2g3h4i5j6"
down_revision: Union[str, None] = "j0e1f2g3h4i5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS family_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            event_date DATE,
            end_date DATE,
            location_text VARCHAR(255),
            location_id UUID REFERENCES locations(id),
            cover_image_url TEXT,
            category VARCHAR(32) NOT NULL DEFAULT 'reunion',
            is_recurring BOOLEAN NOT NULL DEFAULT false,
            recurrence_note VARCHAR(128),
            organizer_id UUID NOT NULL REFERENCES users(id),
            published BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS family_event_rsvps (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id UUID NOT NULL REFERENCES family_events(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(16) NOT NULL DEFAULT 'attending',
            note VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(event_id, user_id)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS family_event_photos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id UUID NOT NULL REFERENCES family_events(id) ON DELETE CASCADE,
            image_url TEXT,
            s3_key VARCHAR(512),
            caption VARCHAR(255),
            uploaded_by UUID REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS family_event_comments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id UUID NOT NULL REFERENCES family_events(id) ON DELETE CASCADE,
            author_id UUID NOT NULL REFERENCES users(id),
            body TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS family_event_comments")
    op.execute("DROP TABLE IF EXISTS family_event_photos")
    op.execute("DROP TABLE IF EXISTS family_event_rsvps")
    op.execute("DROP TABLE IF EXISTS family_events")
