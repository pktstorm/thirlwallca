"""initial schema

Revision ID: ee2558490c6f
Revises:
Create Date: 2026-02-13 12:18:18.075167

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ee2558490c6f'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create locations (no dependencies)
    op.create_table('locations',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('latitude', sa.Float(), nullable=True),
    sa.Column('longitude', sa.Float(), nullable=True),
    sa.Column('country', sa.String(length=128), nullable=True),
    sa.Column('region', sa.String(length=128), nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )

    # 2. Create persons WITHOUT created_by FK (breaks circular dep with users)
    op.create_table('persons',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('first_name', sa.String(length=128), nullable=False),
    sa.Column('middle_name', sa.String(length=128), nullable=True),
    sa.Column('last_name', sa.String(length=128), nullable=False),
    sa.Column('maiden_name', sa.String(length=128), nullable=True),
    sa.Column('suffix', sa.String(length=32), nullable=True),
    sa.Column('gender', sa.Enum('MALE', 'FEMALE', 'OTHER', 'UNKNOWN', name='gender_type'), nullable=False),
    sa.Column('birth_date', sa.Date(), nullable=True),
    sa.Column('birth_date_approx', sa.Boolean(), nullable=False),
    sa.Column('death_date', sa.Date(), nullable=True),
    sa.Column('death_date_approx', sa.Boolean(), nullable=False),
    sa.Column('is_living', sa.Boolean(), nullable=False),
    sa.Column('bio', sa.Text(), nullable=True),
    sa.Column('occupation', sa.String(length=255), nullable=True),
    sa.Column('profile_photo_url', sa.Text(), nullable=True),
    sa.Column('birth_location_id', sa.UUID(), nullable=True),
    sa.Column('death_location_id', sa.UUID(), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['birth_location_id'], ['locations.id'], ),
    sa.ForeignKeyConstraint(['death_location_id'], ['locations.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # 3. Create users (can now reference persons)
    op.create_table('users',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('cognito_sub', sa.String(length=128), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('display_name', sa.String(length=128), nullable=False),
    sa.Column('role', sa.Enum('ADMIN', 'EDITOR', 'VIEWER', name='user_role'), nullable=False),
    sa.Column('linked_person_id', sa.UUID(), nullable=True),
    sa.Column('avatar_url', sa.Text(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('last_login_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['linked_person_id'], ['persons.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('cognito_sub'),
    sa.UniqueConstraint('email')
    )

    # 4. Add deferred FK: persons.created_by -> users.id
    op.create_foreign_key('fk_persons_created_by_users', 'persons', 'users', ['created_by'], ['id'])

    # 5. Create remaining tables (all depend on locations, persons, and/or users)
    op.create_table('media',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('media_type', sa.Enum('PHOTO', 'DOCUMENT', 'VIDEO', 'AUDIO', name='media_type'), nullable=False),
    sa.Column('s3_key', sa.String(length=512), nullable=False),
    sa.Column('s3_bucket', sa.String(length=128), nullable=False),
    sa.Column('thumbnail_s3_key', sa.String(length=512), nullable=True),
    sa.Column('file_size_bytes', sa.BigInteger(), nullable=True),
    sa.Column('mime_type', sa.String(length=128), nullable=True),
    sa.Column('width', sa.Integer(), nullable=True),
    sa.Column('height', sa.Integer(), nullable=True),
    sa.Column('duration_seconds', sa.Integer(), nullable=True),
    sa.Column('date_taken', sa.Date(), nullable=True),
    sa.Column('date_taken_approx', sa.Boolean(), nullable=False),
    sa.Column('location_id', sa.UUID(), nullable=True),
    sa.Column('status', sa.Enum('PROCESSING', 'READY', 'FAILED', name='media_status'), nullable=False),
    sa.Column('uploaded_by', sa.UUID(), nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('migrations',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('person_id', sa.UUID(), nullable=False),
    sa.Column('from_location_id', sa.UUID(), nullable=False),
    sa.Column('to_location_id', sa.UUID(), nullable=False),
    sa.Column('year', sa.Integer(), nullable=True),
    sa.Column('year_approx', sa.Boolean(), nullable=False),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['from_location_id'], ['locations.id'], ),
    sa.ForeignKeyConstraint(['person_id'], ['persons.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['to_location_id'], ['locations.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('relationships',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('person_id', sa.UUID(), nullable=False),
    sa.Column('related_person_id', sa.UUID(), nullable=False),
    sa.Column('relationship', sa.Enum('PARENT_CHILD', 'SPOUSE', name='relationship_type'), nullable=False),
    sa.Column('marriage_date', sa.Date(), nullable=True),
    sa.Column('divorce_date', sa.Date(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.CheckConstraint('person_id != related_person_id', name='ck_no_self_relation'),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['person_id'], ['persons.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['related_person_id'], ['persons.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('person_id', 'related_person_id', 'relationship', name='uq_relationship')
    )
    op.create_table('stories',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('subtitle', sa.String(length=255), nullable=True),
    sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('cover_image_url', sa.Text(), nullable=True),
    sa.Column('author_id', sa.UUID(), nullable=False),
    sa.Column('published', sa.Boolean(), nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('comments',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('author_id', sa.UUID(), nullable=False),
    sa.Column('person_id', sa.UUID(), nullable=True),
    sa.Column('story_id', sa.UUID(), nullable=True),
    sa.Column('media_id', sa.UUID(), nullable=True),
    sa.Column('parent_comment_id', sa.UUID(), nullable=True),
    sa.Column('likes_count', sa.Integer(), nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.CheckConstraint('(CASE WHEN person_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN story_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN media_id IS NOT NULL THEN 1 ELSE 0 END) = 1', name='ck_comment_target'),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['media_id'], ['media.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['parent_comment_id'], ['comments.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['person_id'], ['persons.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['story_id'], ['stories.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('media_persons',
    sa.Column('media_id', sa.UUID(), nullable=False),
    sa.Column('person_id', sa.UUID(), nullable=False),
    sa.Column('label', sa.String(length=128), nullable=True),
    sa.ForeignKeyConstraint(['media_id'], ['media.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['person_id'], ['persons.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('media_id', 'person_id')
    )
    op.create_table('story_persons',
    sa.Column('story_id', sa.UUID(), nullable=False),
    sa.Column('person_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['person_id'], ['persons.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['story_id'], ['stories.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('story_id', 'person_id')
    )
    op.create_table('timeline_events',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('person_id', sa.UUID(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('event_date', sa.Date(), nullable=True),
    sa.Column('event_date_approx', sa.Boolean(), nullable=False),
    sa.Column('event_type', sa.String(length=64), nullable=True),
    sa.Column('icon', sa.String(length=64), nullable=True),
    sa.Column('media_id', sa.UUID(), nullable=True),
    sa.Column('audio_s3_key', sa.String(length=512), nullable=True),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['media_id'], ['media.id'], ),
    sa.ForeignKeyConstraint(['person_id'], ['persons.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('comment_likes',
    sa.Column('comment_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['comment_id'], ['comments.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('comment_id', 'user_id')
    )


def downgrade() -> None:
    op.drop_table('comment_likes')
    op.drop_table('timeline_events')
    op.drop_table('story_persons')
    op.drop_table('media_persons')
    op.drop_table('comments')
    op.drop_table('stories')
    op.drop_table('relationships')
    op.drop_table('migrations')
    op.drop_table('media')
    # Drop deferred FK before dropping users
    op.drop_constraint('fk_persons_created_by_users', 'persons', type_='foreignkey')
    op.drop_table('users')
    op.drop_table('persons')
    op.drop_table('locations')
