import uuid
from datetime import datetime
from pydantic import BaseModel


class MigrationCreate(BaseModel):
    person_id: uuid.UUID
    from_location_id: uuid.UUID
    to_location_id: uuid.UUID
    year: int | None = None
    year_approx: bool = False
    reason: str | None = None
    notes: str | None = None


class MigrationUpdate(BaseModel):
    from_location_id: uuid.UUID | None = None
    to_location_id: uuid.UUID | None = None
    year: int | None = None
    year_approx: bool | None = None
    reason: str | None = None
    notes: str | None = None


class MigrationResponse(BaseModel):
    id: uuid.UUID
    person_id: uuid.UUID
    from_location_id: uuid.UUID
    to_location_id: uuid.UUID
    year: int | None
    year_approx: bool
    reason: str | None
    notes: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
