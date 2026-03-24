import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.domain.models import PersonPhotoTag, Person, Media

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PhotoTagCreate(BaseModel):
    media_id: uuid.UUID
    person_id: uuid.UUID
    x_pct: float
    y_pct: float
    width_pct: float = 0.0
    height_pct: float = 0.0


class PhotoTagResponse(BaseModel):
    id: uuid.UUID
    media_id: uuid.UUID
    person_id: uuid.UUID
    person_name: Optional[str] = None
    x_pct: float
    y_pct: float
    width_pct: float
    height_pct: float
    created_by: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PersonPhotoResponse(BaseModel):
    id: uuid.UUID
    media_id: uuid.UUID
    x_pct: float
    y_pct: float
    width_pct: float
    height_pct: float
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[PhotoTagResponse])
async def list_photo_tags(
    media_id: uuid.UUID = Query(..., description="Media item to list tags for"),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PersonPhotoTag).where(PersonPhotoTag.media_id == media_id)
    result = await db.execute(stmt)
    tags = result.scalars().all()

    # Enrich with person names
    person_ids = {t.person_id for t in tags}
    person_map: dict[uuid.UUID, Person] = {}
    if person_ids:
        persons_result = await db.execute(select(Person).where(Person.id.in_(list(person_ids))))
        for p in persons_result.scalars().all():
            person_map[p.id] = p

    enriched = []
    for t in tags:
        person = person_map.get(t.person_id)
        enriched.append({
            "id": t.id,
            "media_id": t.media_id,
            "person_id": t.person_id,
            "person_name": f"{person.first_name} {person.last_name}" if person else None,
            "x_pct": t.x_pct,
            "y_pct": t.y_pct,
            "width_pct": t.width_pct,
            "height_pct": t.height_pct,
            "created_by": t.created_by,
            "created_at": t.created_at,
        })

    return enriched


@router.get("/person/{person_id}", response_model=list[PersonPhotoResponse])
async def list_photos_for_person(
    person_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(PersonPhotoTag)
        .where(PersonPhotoTag.person_id == person_id)
        .order_by(PersonPhotoTag.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    tags = result.scalars().all()

    return [
        {
            "id": t.id,
            "media_id": t.media_id,
            "x_pct": t.x_pct,
            "y_pct": t.y_pct,
            "width_pct": t.width_pct,
            "height_pct": t.height_pct,
            "created_at": t.created_at,
        }
        for t in tags
    ]


@router.post("", response_model=PhotoTagResponse, status_code=status.HTTP_201_CREATED)
async def create_photo_tag(
    data: PhotoTagCreate,
    db: AsyncSession = Depends(get_db),
):
    # Verify media exists
    media_result = await db.execute(select(Media).where(Media.id == data.media_id))
    if not media_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    # Verify person exists
    person_result = await db.execute(select(Person).where(Person.id == data.person_id))
    person = person_result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    tag = PersonPhotoTag(**data.model_dump())
    db.add(tag)
    await db.flush()
    await db.refresh(tag)

    return {
        "id": tag.id,
        "media_id": tag.media_id,
        "person_id": tag.person_id,
        "person_name": f"{person.first_name} {person.last_name}",
        "x_pct": tag.x_pct,
        "y_pct": tag.y_pct,
        "width_pct": tag.width_pct,
        "height_pct": tag.height_pct,
        "created_by": tag.created_by,
        "created_at": tag.created_at,
    }


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo_tag(
    tag_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PersonPhotoTag).where(PersonPhotoTag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo tag not found")
    await db.delete(tag)
