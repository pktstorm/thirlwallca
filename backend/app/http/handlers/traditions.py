import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.cognito import get_current_user
from app.deps import get_db
from app.domain.models import FamilyTradition, FamilyTraditionPerson, Person, User

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TraditionPersonOut(BaseModel):
    person_id: uuid.UUID
    first_name: str
    last_name: str

    model_config = {"from_attributes": True}


class TraditionResponse(BaseModel):
    id: uuid.UUID
    title: str
    category: str
    content: str
    cover_image_url: Optional[str] = None
    origin_person_id: Optional[uuid.UUID] = None
    author_id: uuid.UUID
    persons: list[TraditionPersonOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TraditionCreate(BaseModel):
    title: str
    category: str = "tradition"
    content: str
    cover_image_url: Optional[str] = None
    origin_person_id: Optional[uuid.UUID] = None
    person_ids: list[uuid.UUID] = []


class TraditionUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None
    cover_image_url: Optional[str] = None
    origin_person_id: Optional[uuid.UUID] = None
    person_ids: Optional[list[uuid.UUID]] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _enrich_tradition(
    tradition: FamilyTradition,
    db: AsyncSession,
) -> dict:
    """Load person tags for a tradition and return an enriched dict."""
    link_result = await db.execute(
        select(FamilyTraditionPerson).where(FamilyTraditionPerson.tradition_id == tradition.id)
    )
    links = link_result.scalars().all()

    persons_out: list[dict] = []
    if links:
        person_ids = [link.person_id for link in links]
        persons_result = await db.execute(select(Person).where(Person.id.in_(person_ids)))
        for p in persons_result.scalars().all():
            persons_out.append({
                "person_id": p.id,
                "first_name": p.first_name,
                "last_name": p.last_name,
            })

    return {
        "id": tradition.id,
        "title": tradition.title,
        "category": tradition.category,
        "content": tradition.content,
        "cover_image_url": tradition.cover_image_url,
        "origin_person_id": tradition.origin_person_id,
        "author_id": tradition.author_id,
        "persons": persons_out,
        "created_at": tradition.created_at,
        "updated_at": tradition.updated_at,
    }


async def _sync_person_links(
    tradition_id: uuid.UUID,
    person_ids: list[uuid.UUID],
    db: AsyncSession,
) -> None:
    """Replace the person links for a tradition."""
    await db.execute(
        delete(FamilyTraditionPerson).where(FamilyTraditionPerson.tradition_id == tradition_id)
    )
    for pid in person_ids:
        db.add(FamilyTraditionPerson(tradition_id=tradition_id, person_id=pid))
    await db.flush()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[TraditionResponse])
async def list_traditions(
    category: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(FamilyTradition)
    if category:
        stmt = stmt.where(FamilyTradition.category == category)
    stmt = stmt.order_by(FamilyTradition.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    traditions = result.scalars().all()

    return [await _enrich_tradition(t, db) for t in traditions]


@router.get("/{tradition_id}", response_model=TraditionResponse)
async def get_tradition(
    tradition_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FamilyTradition).where(FamilyTradition.id == tradition_id))
    tradition = result.scalar_one_or_none()
    if not tradition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tradition not found")
    return await _enrich_tradition(tradition, db)


@router.post("", response_model=TraditionResponse, status_code=status.HTTP_201_CREATED)
async def create_tradition(
    data: TraditionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tradition = FamilyTradition(
        title=data.title,
        category=data.category,
        content=data.content,
        cover_image_url=data.cover_image_url,
        origin_person_id=data.origin_person_id,
        author_id=current_user.id,
    )
    db.add(tradition)
    await db.flush()
    await db.refresh(tradition)

    if data.person_ids:
        await _sync_person_links(tradition.id, data.person_ids, db)

    return await _enrich_tradition(tradition, db)


@router.put("/{tradition_id}", response_model=TraditionResponse)
async def update_tradition(
    tradition_id: uuid.UUID,
    data: TraditionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FamilyTradition).where(FamilyTradition.id == tradition_id))
    tradition = result.scalar_one_or_none()
    if not tradition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tradition not found")

    update_data = data.model_dump(exclude_unset=True)
    person_ids = update_data.pop("person_ids", None)

    for key, value in update_data.items():
        setattr(tradition, key, value)
    await db.flush()
    await db.refresh(tradition)

    if person_ids is not None:
        await _sync_person_links(tradition.id, person_ids, db)

    return await _enrich_tradition(tradition, db)


@router.delete("/{tradition_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tradition(
    tradition_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FamilyTradition).where(FamilyTradition.id == tradition_id))
    tradition = result.scalar_one_or_none()
    if not tradition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tradition not found")

    # Only the author or an admin may delete
    if tradition.author_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this tradition")

    await db.delete(tradition)
