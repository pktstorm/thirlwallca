"""add heritage features: historical records, questions, research notes, challenges, photo comparisons, ethnicity, migration stories

Revision ID: i9d0e1f2g3h4
Revises: h8c9d0e1f2g3
Create Date: 2026-04-03

"""
from typing import Sequence, Union
from alembic import op

revision: str = "i9d0e1f2g3h4"
down_revision: Union[str, None] = "h8c9d0e1f2g3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to existing tables
    op.execute("ALTER TABLE persons ADD COLUMN IF NOT EXISTS ethnicity_data JSONB")
    op.execute("ALTER TABLE migrations ADD COLUMN IF NOT EXISTS migration_story TEXT")

    # Historical records
    op.execute("""
        CREATE TABLE IF NOT EXISTS historical_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
            source_name VARCHAR(255) NOT NULL,
            record_type VARCHAR(64) NOT NULL DEFAULT 'other',
            url TEXT,
            year INTEGER,
            transcription TEXT,
            notes TEXT,
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # Family questions
    op.execute("""
        CREATE TABLE IF NOT EXISTS family_questions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255) NOT NULL,
            body TEXT,
            person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
            author_id UUID NOT NULL REFERENCES users(id),
            is_resolved BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # Family answers
    op.execute("""
        CREATE TABLE IF NOT EXISTS family_answers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            question_id UUID NOT NULL REFERENCES family_questions(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            author_id UUID NOT NULL REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # Research notes
    op.execute("""
        CREATE TABLE IF NOT EXISTS research_notes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'open',
            person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
            author_id UUID NOT NULL REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # Photo comparisons (then and now)
    op.execute("""
        CREATE TABLE IF NOT EXISTS photo_comparisons (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            location_id UUID REFERENCES locations(id),
            title VARCHAR(255) NOT NULL,
            old_media_id UUID REFERENCES media(id),
            old_s3_key VARCHAR(512),
            old_year INTEGER,
            new_media_id UUID REFERENCES media(id),
            new_s3_key VARCHAR(512),
            new_year INTEGER,
            description TEXT,
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # Family challenges
    op.execute("""
        CREATE TABLE IF NOT EXISTS family_challenges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            challenge_type VARCHAR(32) NOT NULL DEFAULT 'research',
            target_count INTEGER NOT NULL DEFAULT 1,
            icon VARCHAR(32),
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # Challenge progress
    op.execute("""
        CREATE TABLE IF NOT EXISTS challenge_progress (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            challenge_id UUID NOT NULL REFERENCES family_challenges(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            current_count INTEGER NOT NULL DEFAULT 0,
            completed_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS challenge_progress")
    op.execute("DROP TABLE IF EXISTS family_challenges")
    op.execute("DROP TABLE IF EXISTS photo_comparisons")
    op.execute("DROP TABLE IF EXISTS research_notes")
    op.execute("DROP TABLE IF EXISTS family_answers")
    op.execute("DROP TABLE IF EXISTS family_questions")
    op.execute("DROP TABLE IF EXISTS historical_records")
    op.execute("ALTER TABLE persons DROP COLUMN IF EXISTS ethnicity_data")
    op.execute("ALTER TABLE migrations DROP COLUMN IF EXISTS migration_story")
