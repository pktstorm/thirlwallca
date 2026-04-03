import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.domain.models import HistoricalRecord

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class HistoricalRecordCreate(BaseModel):
    source_name: str
    record_type: str = "other"
    url: Optional[str] = None
    year: Optional[int] = None
    transcription: Optional[str] = None
    notes: Optional[str] = None
    person_id: uuid.UUID


class HistoricalRecordUpdate(BaseModel):
    source_name: Optional[str] = None
    record_type: Optional[str] = None
    url: Optional[str] = None
    year: Optional[int] = None
    transcription: Optional[str] = None
    notes: Optional[str] = None


class HistoricalRecordResponse(BaseModel):
    id: uuid.UUID
    person_id: uuid.UUID
    source_name: str
    record_type: str
    url: Optional[str] = None
    year: Optional[int] = None
    transcription: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[HistoricalRecordResponse])
async def list_historical_records(
    person_id: uuid.UUID = Query(..., description="Person to list records for"),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(HistoricalRecord)
        .where(HistoricalRecord.person_id == person_id)
        .order_by(HistoricalRecord.year.desc().nullslast(), HistoricalRecord.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=HistoricalRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_historical_record(
    data: HistoricalRecordCreate,
    db: AsyncSession = Depends(get_db),
):
    record = HistoricalRecord(**data.model_dump())
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.put("/{record_id}", response_model=HistoricalRecordResponse)
async def update_historical_record(
    record_id: uuid.UUID,
    data: HistoricalRecordUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(HistoricalRecord).where(HistoricalRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Historical record not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)
    await db.flush()
    await db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_historical_record(
    record_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(HistoricalRecord).where(HistoricalRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Historical record not found")
    await db.delete(record)
