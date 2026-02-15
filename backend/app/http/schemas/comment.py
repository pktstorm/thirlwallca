import uuid
from datetime import datetime
from pydantic import BaseModel


class CommentCreate(BaseModel):
    body: str
    author_id: uuid.UUID
    person_id: uuid.UUID | None = None
    story_id: uuid.UUID | None = None
    media_id: uuid.UUID | None = None
    parent_comment_id: uuid.UUID | None = None


class CommentUpdate(BaseModel):
    body: str


class CommentResponse(BaseModel):
    id: uuid.UUID
    body: str
    author_id: uuid.UUID
    person_id: uuid.UUID | None
    story_id: uuid.UUID | None
    media_id: uuid.UUID | None
    parent_comment_id: uuid.UUID | None
    likes_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
