import uuid
from datetime import date, datetime
from pydantic import BaseModel


class TimelineEventCreate(BaseModel):
    person_id: uuid.UUID
    title: str
    description: str | None = None
    event_date: date | None = None
    event_date_approx: bool = False
    event_type: str | None = None
    icon: str | None = None
    media_id: uuid.UUID | None = None
    audio_s3_key: str | None = None
    sort_order: int = 0


class TimelineEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    event_date: date | None = None
    event_date_approx: bool | None = None
    event_type: str | None = None
    icon: str | None = None
    media_id: uuid.UUID | None = None
    audio_s3_key: str | None = None
    sort_order: int | None = None


class TimelineEventResponse(BaseModel):
    id: uuid.UUID
    person_id: uuid.UUID
    title: str
    description: str | None
    event_date: date | None
    event_date_approx: bool
    event_type: str | None
    icon: str | None
    media_id: uuid.UUID | None
    audio_s3_key: str | None
    sort_order: int
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TimelineEventReorderItem(BaseModel):
    id: uuid.UUID
    sort_order: int


class TimelineEventReorder(BaseModel):
    items: list[TimelineEventReorderItem]
