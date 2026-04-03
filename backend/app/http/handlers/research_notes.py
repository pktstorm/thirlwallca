import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.domain.models import ResearchNote, User

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ResearchNoteCreate(BaseModel):
    title: str
    body: str
    status: str = "open"
    person_id: Optional[uuid.UUID] = None
    author_id: uuid.UUID


class ResearchNoteUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    status: Optional[str] = None


class ResearchNoteResponse(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    status: str
    person_id: Optional[uuid.UUID] = None
    author_id: uuid.UUID
    author_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ResearchNoteResponse])
async def list_research_notes(
    status_filter: Optional[str] = Query(None, alias="status"),
    person_id: Optional[uuid.UUID] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ResearchNote)
    if status_filter is not None:
        stmt = stmt.where(ResearchNote.status == status_filter)
    if person_id is not None:
        stmt = stmt.where(ResearchNote.person_id == person_id)
    stmt = stmt.order_by(ResearchNote.updated_at.desc()).offset(skip).limit(limit)

    result = await db.execute(stmt)
    notes = result.scalars().all()

    # Enrich with author names
    author_ids = {n.author_id for n in notes}
    author_map: dict[uuid.UUID, str] = {}
    if author_ids:
        users_result = await db.execute(select(User).where(User.id.in_(list(author_ids))))
        for u in users_result.scalars().all():
            author_map[u.id] = u.display_name

    return [
        {
            "id": n.id,
            "title": n.title,
            "body": n.body,
            "status": n.status,
            "person_id": n.person_id,
            "author_id": n.author_id,
            "author_name": author_map.get(n.author_id),
            "created_at": n.created_at,
            "updated_at": n.updated_at,
        }
        for n in notes
    ]


@router.post("", response_model=ResearchNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_research_note(
    data: ResearchNoteCreate,
    db: AsyncSession = Depends(get_db),
):
    note = ResearchNote(**data.model_dump())
    db.add(note)
    await db.flush()
    await db.refresh(note)

    # Fetch author name
    author_result = await db.execute(select(User).where(User.id == note.author_id))
    author = author_result.scalar_one_or_none()

    return {
        "id": note.id,
        "title": note.title,
        "body": note.body,
        "status": note.status,
        "person_id": note.person_id,
        "author_id": note.author_id,
        "author_name": author.display_name if author else None,
        "created_at": note.created_at,
        "updated_at": note.updated_at,
    }


@router.put("/{note_id}", response_model=ResearchNoteResponse)
async def update_research_note(
    note_id: uuid.UUID,
    data: ResearchNoteUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ResearchNote).where(ResearchNote.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research note not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(note, key, value)
    await db.flush()
    await db.refresh(note)

    # Fetch author name
    author_result = await db.execute(select(User).where(User.id == note.author_id))
    author = author_result.scalar_one_or_none()

    return {
        "id": note.id,
        "title": note.title,
        "body": note.body,
        "status": note.status,
        "person_id": note.person_id,
        "author_id": note.author_id,
        "author_name": author.display_name if author else None,
        "created_at": note.created_at,
        "updated_at": note.updated_at,
    }


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_research_note(
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ResearchNote).where(ResearchNote.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research note not found")
    await db.delete(note)
