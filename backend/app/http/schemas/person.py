import uuid
from datetime import date, datetime
from pydantic import BaseModel


class PlaceInput(BaseModel):
    city: str
    region: str | None = None
    country: str | None = None


class LocationSummary(BaseModel):
    id: uuid.UUID
    city: str
    region: str | None
    country: str | None
    latitude: float | None
    longitude: float | None

    model_config = {"from_attributes": True}


class PersonCreate(BaseModel):
    first_name: str
    middle_name: str | None = None
    last_name: str
    maiden_name: str | None = None
    suffix: str | None = None
    gender: str = "unknown"
    birth_date: date | None = None
    birth_date_approx: bool = False
    death_date: date | None = None
    death_date_approx: bool = False
    is_living: bool = False
    bio: str | None = None
    occupation: str | None = None
    nicknames: str | None = None
    birth_place: PlaceInput | None = None
    birth_place_text: str | None = None
    death_place: PlaceInput | None = None
    death_place_text: str | None = None
    cause_of_death: str | None = None
    ethnicity: str | None = None
    religion: str | None = None
    education: str | None = None
    military_service: str | None = None
    burial_location: str | None = None
    notes: str | None = None
    birth_notes: str | None = None

class PersonUpdate(BaseModel):
    first_name: str | None = None
    middle_name: str | None = None
    last_name: str | None = None
    maiden_name: str | None = None
    suffix: str | None = None
    gender: str | None = None
    birth_date: date | None = None
    birth_date_approx: bool | None = None
    death_date: date | None = None
    death_date_approx: bool | None = None
    is_living: bool | None = None
    bio: str | None = None
    occupation: str | None = None
    nicknames: str | None = None
    birth_place: PlaceInput | None = None
    birth_place_text: str | None = None
    death_place: PlaceInput | None = None
    death_place_text: str | None = None
    cause_of_death: str | None = None
    ethnicity: str | None = None
    religion: str | None = None
    education: str | None = None
    military_service: str | None = None
    burial_location: str | None = None
    notes: str | None = None
    birth_notes: str | None = None

class PersonResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    middle_name: str | None
    last_name: str
    maiden_name: str | None
    suffix: str | None
    gender: str
    birth_date: date | None
    birth_date_approx: bool
    death_date: date | None
    death_date_approx: bool
    is_living: bool
    bio: str | None
    occupation: str | None
    profile_photo_url: str | None
    nicknames: str | None
    birth_place_text: str | None
    death_place_text: str | None
    birth_location: LocationSummary | None = None
    death_location: LocationSummary | None = None
    cause_of_death: str | None
    ethnicity: str | None
    religion: str | None
    education: str | None
    military_service: str | None
    burial_location: str | None
    notes: str | None
    birth_notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PersonResidenceCreate(BaseModel):
    place: PlaceInput | None = None
    location_id: uuid.UUID | None = None
    place_text: str | None = None
    from_date: date | None = None
    to_date: date | None = None
    is_current: bool = False
    notes: str | None = None

class PersonResidenceUpdate(BaseModel):
    place: PlaceInput | None = None
    location_id: uuid.UUID | None = None
    place_text: str | None = None
    from_date: date | None = None
    to_date: date | None = None
    is_current: bool | None = None
    notes: str | None = None

class PersonResidenceResponse(BaseModel):
    id: uuid.UUID
    person_id: uuid.UUID
    location_id: uuid.UUID | None
    place_text: str | None
    location: LocationSummary | None = None
    from_date: date | None
    to_date: date | None
    is_current: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfilePhotoUploadRequest(BaseModel):
    filename: str
    content_type: str


class ProfilePhotoUploadResponse(BaseModel):
    upload_url: str
    s3_key: str
    cdn_url: str


class ProfilePhotoConfirmRequest(BaseModel):
    s3_key: str
    s3_bucket: str
    file_size_bytes: int | None = None
    mime_type: str | None = None


class PersonAlternateNameCreate(BaseModel):
    name_type: str
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None
    notes: str | None = None

class PersonAlternateNameResponse(BaseModel):
    id: uuid.UUID
    person_id: uuid.UUID
    name_type: str
    first_name: str | None
    last_name: str | None
    full_name: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
