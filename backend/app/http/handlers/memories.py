import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.cognito import get_current_user
from app.deps import get_db
from app.domain.models import Memory, User

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class MemoryCreate(BaseModel):
    body: str
    person_id: uuid.UUID
    author_id: uuid.UUID
    photo_s3_key: Optional[str] = None


class MemoryResponse(BaseModel):
    id: uuid.UUID
    body: str
    person_id: uuid.UUID
    author_id: uuid.UUID
    author_name: Optional[str] = None
    photo_s3_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[MemoryResponse])
async def list_memories(
    person_id: uuid.UUID = Query(..., description="Person to list memories for"),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Memory)
        .where(Memory.person_id == person_id)
        .order_by(Memory.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    memories = result.scalars().all()

    # Enrich with author names
    author_ids = {m.author_id for m in memories}
    author_map: dict[uuid.UUID, User] = {}
    if author_ids:
        users_result = await db.execute(select(User).where(User.id.in_(list(author_ids))))
        for u in users_result.scalars().all():
            author_map[u.id] = u

    enriched = []
    for m in memories:
        enriched.append({
            "id": m.id,
            "body": m.body,
            "person_id": m.person_id,
            "author_id": m.author_id,
            "author_name": author_map[m.author_id].display_name if m.author_id in author_map else None,
            "photo_s3_key": m.photo_s3_key,
            "created_at": m.created_at,
            "updated_at": m.updated_at,
        })

    return enriched


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory(
    data: MemoryCreate,
    db: AsyncSession = Depends(get_db),
):
    memory = Memory(**data.model_dump())
    db.add(memory)
    await db.flush()
    await db.refresh(memory)

    # Fetch author name
    author_result = await db.execute(select(User).where(User.id == memory.author_id))
    author = author_result.scalar_one_or_none()

    return {
        "id": memory.id,
        "body": memory.body,
        "person_id": memory.person_id,
        "author_id": memory.author_id,
        "author_name": author.display_name if author else None,
        "photo_s3_key": memory.photo_s3_key,
        "created_at": memory.created_at,
        "updated_at": memory.updated_at,
    }


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Memory).where(Memory.id == memory_id))
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")

    # Only the author or an admin may delete
    if memory.author_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this memory")

    await db.delete(memory)
