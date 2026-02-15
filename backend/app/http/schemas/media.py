import uuid
from datetime import date, datetime
from pydantic import BaseModel


class MediaCreate(BaseModel):
    title: str | None = None
    description: str | None = None
    media_type: str
    s3_key: str
    s3_bucket: str
    thumbnail_s3_key: str | None = None
    file_size_bytes: int | None = None
    mime_type: str | None = None
    width: int | None = None
    height: int | None = None
    duration_seconds: int | None = None
    date_taken: date | None = None
    date_taken_approx: bool = False
    location_id: uuid.UUID | None = None
    status: str = "ready"
    uploaded_by: uuid.UUID


class MediaUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    thumbnail_s3_key: str | None = None
    date_taken: date | None = None
    date_taken_approx: bool | None = None
    location_id: uuid.UUID | None = None
    status: str | None = None


class MediaResponse(BaseModel):
    id: uuid.UUID
    title: str | None
    description: str | None
    media_type: str
    s3_key: str
    s3_bucket: str
    thumbnail_s3_key: str | None
    file_size_bytes: int | None
    mime_type: str | None
    width: int | None
    height: int | None
    duration_seconds: int | None
    date_taken: date | None
    date_taken_approx: bool
    location_id: uuid.UUID | None
    status: str
    uploaded_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UploadUrlRequest(BaseModel):
    filename: str
    content_type: str


class UploadUrlResponse(BaseModel):
    upload_url: str
    s3_key: str


class MediaTagRequest(BaseModel):
    person_id: uuid.UUID
    label: str | None = None
