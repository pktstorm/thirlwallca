import uuid
from datetime import date, datetime
from pydantic import BaseModel


class RelationshipCreate(BaseModel):
    person_id: uuid.UUID
    related_person_id: uuid.UUID
    relationship: str
    marriage_date: date | None = None
    divorce_date: date | None = None
    marriage_place_text: str | None = None
    notes: str | None = None


class RelationshipUpdate(BaseModel):
    relationship: str | None = None
    marriage_date: date | None = None
    divorce_date: date | None = None
    marriage_place_text: str | None = None
    notes: str | None = None


class RelationshipResponse(BaseModel):
    id: uuid.UUID
    person_id: uuid.UUID
    related_person_id: uuid.UUID
    relationship: str
    marriage_date: date | None
    divorce_date: date | None
    marriage_place_text: str | None = None
    notes: str | None = None
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
