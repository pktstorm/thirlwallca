import uuid
from datetime import datetime

from pydantic import BaseModel

from app.domain.enums import UserRole


class LoginRequest(BaseModel):
    email: str
    password: str


class MagicLinkRequest(BaseModel):
    email: str


class MagicLinkVerifyRequest(BaseModel):
    email: str
    code: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LinkPersonRequest(BaseModel):
    person_id: uuid.UUID


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    id_token: str
    token_type: str = "bearer"
    expires_in: int = 3600


class UserResponse(BaseModel):
    id: uuid.UUID
    cognito_sub: str
    email: str
    display_name: str
    role: UserRole
    linked_person_id: uuid.UUID | None
    avatar_url: str | None
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
