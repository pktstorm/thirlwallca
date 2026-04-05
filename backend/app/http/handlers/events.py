"""CRUD for family events with RSVPs, photos, and comments."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.cognito import get_current_user
from app.deps import get_db
from app.domain.models import FamilyEvent, FamilyEventRsvp, FamilyEventPhoto, FamilyEventComment, User

router = APIRouter()


# --- Schemas ---

class EventCreate(BaseModel):
    title: str
    description: str | None = None
    event_date: str | None = None
    end_date: str | None = None
    location_text: str | None = None
    cover_image_url: str | None = None
    category: str = "reunion"
    is_recurring: bool = False
    recurrence_note: str | None = None
    published: bool = True


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    event_date: str | None = None
    end_date: str | None = None
    location_text: str | None = None
    cover_image_url: str | None = None
    category: str | None = None
    is_recurring: bool | None = None
    recurrence_note: str | None = None
    published: bool | None = None


class RsvpBody(BaseModel):
    status: str  # attending, maybe, not_attending
    note: str | None = None


class CommentBody(BaseModel):
    body: str


class PhotoBody(BaseModel):
    image_url: str | None = None
    s3_key: str | None = None
    caption: str | None = None


# --- Helpers ---

async def _build_event_response(event: FamilyEvent, db: AsyncSession, user_id: uuid.UUID | None = None) -> dict:
    # Organizer name
    org = await db.execute(select(User.display_name).where(User.id == event.organizer_id))
    organizer_name = org.scalar() or "Unknown"

    # RSVP counts
    rsvps = await db.execute(
        select(FamilyEventRsvp.status, func.count(FamilyEventRsvp.id))
        .where(FamilyEventRsvp.event_id == event.id)
        .group_by(FamilyEventRsvp.status)
    )
    rsvp_counts = {row[0]: row[1] for row in rsvps.all()}

    # RSVP list
    rsvp_list_result = await db.execute(
        select(FamilyEventRsvp, User.display_name)
        .join(User, FamilyEventRsvp.user_id == User.id)
        .where(FamilyEventRsvp.event_id == event.id)
    )
    rsvp_list = [
        {"user_id": str(r.user_id), "user_name": name, "status": r.status, "note": r.note}
        for r, name in rsvp_list_result.all()
    ]

    # Current user's RSVP
    my_rsvp = None
    if user_id:
        my = await db.execute(
            select(FamilyEventRsvp).where(
                FamilyEventRsvp.event_id == event.id,
                FamilyEventRsvp.user_id == user_id,
            )
        )
        r = my.scalar_one_or_none()
        if r:
            my_rsvp = {"status": r.status, "note": r.note}

    # Photo count
    photo_count = await db.execute(
        select(func.count(FamilyEventPhoto.id)).where(FamilyEventPhoto.event_id == event.id)
    )

    # Comment count
    comment_count = await db.execute(
        select(func.count(FamilyEventComment.id)).where(FamilyEventComment.event_id == event.id)
    )

    is_past = event.event_date and event.event_date < date.today()

    return {
        "id": str(event.id),
        "title": event.title,
        "description": event.description,
        "event_date": str(event.event_date) if event.event_date else None,
        "end_date": str(event.end_date) if event.end_date else None,
        "location_text": event.location_text,
        "cover_image_url": event.cover_image_url,
        "category": event.category,
        "is_recurring": event.is_recurring,
        "recurrence_note": event.recurrence_note,
        "organizer_name": organizer_name,
        "published": event.published,
        "is_past": is_past,
        "rsvp_counts": rsvp_counts,
        "rsvp_list": rsvp_list,
        "my_rsvp": my_rsvp,
        "photo_count": photo_count.scalar() or 0,
        "comment_count": comment_count.scalar() or 0,
        "created_at": str(event.created_at),
        "updated_at": str(event.updated_at),
    }


# --- Endpoints ---

@router.get("")
async def list_events(
    upcoming_only: bool = Query(False),
    past_only: bool = Query(False),
    category: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(FamilyEvent).where(FamilyEvent.published.is_(True))
    if upcoming_only:
        stmt = stmt.where(FamilyEvent.event_date >= date.today())
    if past_only:
        stmt = stmt.where(FamilyEvent.event_date < date.today())
    if category:
        stmt = stmt.where(FamilyEvent.category == category)
    stmt = stmt.order_by(FamilyEvent.event_date.desc())

    result = await db.execute(stmt)
    events = result.scalars().all()

    items = []
    for e in events:
        data = await _build_event_response(e, db, current_user.id)
        items.append(data)
    return items


@router.get("/upcoming")
async def get_upcoming_events(
    limit: int = Query(3),
    db: AsyncSession = Depends(get_db),
):
    """Get next N upcoming events (for dashboard widget)."""
    result = await db.execute(
        select(FamilyEvent)
        .where(FamilyEvent.published.is_(True), FamilyEvent.event_date >= date.today())
        .order_by(FamilyEvent.event_date.asc())
        .limit(limit)
    )
    events = result.scalars().all()
    items = []
    for e in events:
        org = await db.execute(select(User.display_name).where(User.id == e.organizer_id))
        rsvp_count = await db.execute(
            select(func.count(FamilyEventRsvp.id))
            .where(FamilyEventRsvp.event_id == e.id, FamilyEventRsvp.status == "attending")
        )
        items.append({
            "id": str(e.id), "title": e.title,
            "event_date": str(e.event_date) if e.event_date else None,
            "location_text": e.location_text, "category": e.category,
            "organizer_name": org.scalar() or "Unknown",
            "attending_count": rsvp_count.scalar() or 0,
        })
    return items


@router.get("/{event_id}")
async def get_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FamilyEvent).where(FamilyEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")

    data = await _build_event_response(event, db, current_user.id)

    # Include photos and comments for detail view
    photos_result = await db.execute(
        select(FamilyEventPhoto).where(FamilyEventPhoto.event_id == event.id)
        .order_by(FamilyEventPhoto.created_at)
    )
    data["photos"] = [
        {"id": str(p.id), "image_url": p.image_url, "s3_key": p.s3_key, "caption": p.caption}
        for p in photos_result.scalars().all()
    ]

    comments_result = await db.execute(
        select(FamilyEventComment, User.display_name)
        .join(User, FamilyEventComment.author_id == User.id)
        .where(FamilyEventComment.event_id == event.id)
        .order_by(FamilyEventComment.created_at)
    )
    data["comments"] = [
        {"id": str(c.id), "body": c.body, "author_name": name, "created_at": str(c.created_at)}
        for c, name in comments_result.all()
    ]

    return data


@router.post("", status_code=201)
async def create_event(
    body: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = FamilyEvent(
        title=body.title, description=body.description,
        event_date=date.fromisoformat(body.event_date) if body.event_date else None,
        end_date=date.fromisoformat(body.end_date) if body.end_date else None,
        location_text=body.location_text, cover_image_url=body.cover_image_url,
        category=body.category, is_recurring=body.is_recurring,
        recurrence_note=body.recurrence_note, organizer_id=current_user.id,
        published=body.published,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return await _build_event_response(event, db, current_user.id)


@router.put("/{event_id}")
async def update_event(
    event_id: str,
    body: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FamilyEvent).where(FamilyEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")

    if body.title is not None:
        event.title = body.title
    if body.description is not None:
        event.description = body.description
    if body.event_date is not None:
        event.event_date = date.fromisoformat(body.event_date) if body.event_date else None
    if body.end_date is not None:
        event.end_date = date.fromisoformat(body.end_date) if body.end_date else None
    if body.location_text is not None:
        event.location_text = body.location_text
    if body.cover_image_url is not None:
        event.cover_image_url = body.cover_image_url
    if body.category is not None:
        event.category = body.category
    if body.is_recurring is not None:
        event.is_recurring = body.is_recurring
    if body.recurrence_note is not None:
        event.recurrence_note = body.recurrence_note
    if body.published is not None:
        event.published = body.published

    await db.flush()
    await db.refresh(event)
    return await _build_event_response(event, db, current_user.id)


@router.delete("/{event_id}", status_code=204)
async def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FamilyEvent).where(FamilyEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    await db.delete(event)


@router.post("/{event_id}/rsvp")
async def rsvp_event(
    event_id: str,
    body: RsvpBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.status not in ("attending", "maybe", "not_attending"):
        raise HTTPException(status_code=400, detail="Invalid status.")

    existing = await db.execute(
        select(FamilyEventRsvp).where(
            FamilyEventRsvp.event_id == event_id,
            FamilyEventRsvp.user_id == current_user.id,
        )
    )
    rsvp = existing.scalar_one_or_none()

    if rsvp:
        rsvp.status = body.status
        rsvp.note = body.note
    else:
        rsvp = FamilyEventRsvp(
            event_id=uuid.UUID(event_id), user_id=current_user.id,
            status=body.status, note=body.note,
        )
        db.add(rsvp)

    await db.flush()
    return {"status": body.status, "note": body.note}


@router.post("/{event_id}/photos")
async def add_event_photo(
    event_id: str,
    body: PhotoBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    photo = FamilyEventPhoto(
        event_id=uuid.UUID(event_id), image_url=body.image_url,
        s3_key=body.s3_key, caption=body.caption,
        uploaded_by=current_user.id,
    )
    db.add(photo)
    await db.flush()
    return {"id": str(photo.id), "image_url": photo.image_url, "caption": photo.caption}


@router.post("/{event_id}/comments")
async def add_event_comment(
    event_id: str,
    body: CommentBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comment = FamilyEventComment(
        event_id=uuid.UUID(event_id), author_id=current_user.id, body=body.body,
    )
    db.add(comment)
    await db.flush()
    return {"id": str(comment.id), "body": comment.body, "author_name": current_user.display_name}
