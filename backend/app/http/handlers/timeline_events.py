import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db
from app.domain.models import TimelineEvent
from app.http.schemas.timeline_event import (
    TimelineEventCreate,
    TimelineEventUpdate,
    TimelineEventResponse,
    TimelineEventReorder,
)

router = APIRouter()


@router.get("", response_model=list[TimelineEventResponse])
async def list_timeline_events(
    person_id: uuid.UUID | None = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(TimelineEvent)
    if person_id:
        stmt = stmt.where(TimelineEvent.person_id == person_id)
    stmt = stmt.order_by(TimelineEvent.sort_order.asc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=TimelineEventResponse, status_code=status.HTTP_201_CREATED)
async def create_timeline_event(
    data: TimelineEventCreate,
    db: AsyncSession = Depends(get_db),
):
    event = TimelineEvent(**data.model_dump())
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


@router.get("/{event_id}", response_model=TimelineEventResponse)
async def get_timeline_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TimelineEvent).where(TimelineEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline event not found")
    return event


@router.put("/{event_id}", response_model=TimelineEventResponse)
async def update_timeline_event(
    event_id: uuid.UUID,
    data: TimelineEventUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TimelineEvent).where(TimelineEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline event not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(event, key, value)
    await db.flush()
    await db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_timeline_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TimelineEvent).where(TimelineEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline event not found")
    await db.delete(event)


@router.post("/reorder", status_code=status.HTTP_200_OK)
async def reorder_timeline_events(
    data: TimelineEventReorder,
    db: AsyncSession = Depends(get_db),
):
    """Reorder timeline events by accepting a list of {id, sort_order} pairs."""
    for item in data.items:
        result = await db.execute(select(TimelineEvent).where(TimelineEvent.id == item.id))
        event = result.scalar_one_or_none()
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Timeline event {item.id} not found",
            )
        event.sort_order = item.sort_order
    await db.flush()
    return {"reordered": len(data.items)}
