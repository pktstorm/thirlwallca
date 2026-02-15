import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel


class StoryCreate(BaseModel):
    title: str
    subtitle: str | None = None
    content: dict[str, Any]
    cover_image_url: str | None = None
    author_id: uuid.UUID
    published: bool = False


class StoryUpdate(BaseModel):
    title: str | None = None
    subtitle: str | None = None
    content: dict[str, Any] | None = None
    cover_image_url: str | None = None
    published: bool | None = None


class StoryResponse(BaseModel):
    id: uuid.UUID
    title: str
    subtitle: str | None
    content: dict[str, Any]
    cover_image_url: str | None
    author_id: uuid.UUID
    published: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
