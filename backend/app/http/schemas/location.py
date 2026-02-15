import uuid
from datetime import datetime
from pydantic import BaseModel


class LocationCreate(BaseModel):
    name: str
    latitude: float | None = None
    longitude: float | None = None
    country: str | None = None
    region: str | None = None


class LocationUpdate(BaseModel):
    name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    country: str | None = None
    region: str | None = None


class LocationResponse(BaseModel):
    id: uuid.UUID
    name: str
    latitude: float | None
    longitude: float | None
    country: str | None
    region: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
