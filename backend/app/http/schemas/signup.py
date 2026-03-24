import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.domain.enums import SignupStatus


class RequestAccessBody(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str


class SignupRequestResponse(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    status: SignupStatus
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    reject_reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RejectBody(BaseModel):
    reason: str | None = None


class OnboardValidateResponse(BaseModel):
    email: str
    first_name: str
    last_name: str
    valid: bool


class OnboardCompleteBody(BaseModel):
    token: str
    password: str
    linked_person_id: uuid.UUID | None = None
