import uuid
from datetime import datetime
from pydantic import BaseModel


class UserResponse(BaseModel):
    id: uuid.UUID
    cognito_sub: str
    email: str
    display_name: str
    role: str
    linked_person_id: uuid.UUID | None
    avatar_url: str | None
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SetRoleRequest(BaseModel):
    role: str
