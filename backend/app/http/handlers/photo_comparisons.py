import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.domain.models import PhotoComparison

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PhotoComparisonCreate(BaseModel):
    title: str
    location_id: Optional[uuid.UUID] = None
    old_s3_key: Optional[str] = None
    old_year: Optional[int] = None
    new_s3_key: Optional[str] = None
    new_year: Optional[int] = None
    description: Optional[str] = None


class PhotoComparisonResponse(BaseModel):
    id: uuid.UUID
    title: str
    location_id: Optional[uuid.UUID] = None
    old_media_id: Optional[uuid.UUID] = None
    old_s3_key: Optional[str] = None
    old_year: Optional[int] = None
    new_media_id: Optional[uuid.UUID] = None
    new_s3_key: Optional[str] = None
    new_year: Optional[int] = None
    description: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[PhotoComparisonResponse])
async def list_photo_comparisons(
    location_id: Optional[uuid.UUID] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PhotoComparison)
    if location_id is not None:
        stmt = stmt.where(PhotoComparison.location_id == location_id)
    stmt = stmt.order_by(PhotoComparison.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=PhotoComparisonResponse, status_code=status.HTTP_201_CREATED)
async def create_photo_comparison(
    data: PhotoComparisonCreate,
    db: AsyncSession = Depends(get_db),
):
    comparison = PhotoComparison(**data.model_dump())
    db.add(comparison)
    await db.flush()
    await db.refresh(comparison)
    return comparison


@router.delete("/{comparison_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo_comparison(
    comparison_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PhotoComparison).where(PhotoComparison.id == comparison_id))
    comparison = result.scalar_one_or_none()
    if not comparison:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo comparison not found")
    await db.delete(comparison)
