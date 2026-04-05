"""CRUD for family stories — stories about places, events, heritage not tied to a single person."""

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.cognito import get_current_user
from app.deps import get_db
from app.domain.models import FamilyStory, FamilyStoryPerson, FamilyStoryImage, Person, User

router = APIRouter()


# --- Schemas ---

class FamilyStoryCreate(BaseModel):
    title: str
    subtitle: str | None = None
    content: str
    cover_image_url: str | None = None
    category: str = "history"
    external_url: str | None = None
    location_id: str | None = None
    published: bool = False
    person_ids: list[str] = []
    images: list[dict] = []  # [{image_url, caption, sort_order}]


class FamilyStoryUpdate(BaseModel):
    title: str | None = None
    subtitle: str | None = None
    content: str | None = None
    cover_image_url: str | None = None
    category: str | None = None
    external_url: str | None = None
    published: bool | None = None
    person_ids: list[str] | None = None
    images: list[dict] | None = None


class FamilyStoryResponse(BaseModel):
    id: str
    title: str
    subtitle: str | None
    slug: str
    content: str
    cover_image_url: str | None
    category: str
    external_url: str | None
    published: bool
    author_name: str
    person_ids: list[str]
    person_names: list[dict]  # [{id, name, profile_photo_url}]
    images: list[dict]  # [{id, image_url, s3_key, caption, sort_order}]
    created_at: str
    updated_at: str


class FamilyStoryListItem(BaseModel):
    id: str
    title: str
    subtitle: str | None
    slug: str
    cover_image_url: str | None
    category: str
    published: bool
    author_name: str
    person_count: int
    image_count: int
    created_at: str


# --- Helpers ---

def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug[:200]


async def _build_response(story: FamilyStory, db: AsyncSession) -> dict:
    # Get author name
    author_result = await db.execute(select(User.display_name).where(User.id == story.author_id))
    author_name = author_result.scalar() or "Unknown"

    # Get linked persons
    persons_result = await db.execute(
        select(FamilyStoryPerson.person_id).where(FamilyStoryPerson.story_id == story.id)
    )
    person_ids = [str(row[0]) for row in persons_result.all()]

    # Get person details
    person_names = []
    if person_ids:
        p_result = await db.execute(
            select(Person.id, Person.first_name, Person.last_name, Person.profile_photo_url)
            .where(Person.id.in_([uuid.UUID(pid) for pid in person_ids]))
        )
        for pid, fn, ln, photo in p_result.all():
            person_names.append({"id": str(pid), "name": f"{fn} {ln}", "profile_photo_url": photo})

    # Get images
    images_result = await db.execute(
        select(FamilyStoryImage)
        .where(FamilyStoryImage.story_id == story.id)
        .order_by(FamilyStoryImage.sort_order)
    )
    images = [
        {
            "id": str(img.id),
            "image_url": img.image_url,
            "s3_key": img.s3_key,
            "caption": img.caption,
            "sort_order": img.sort_order,
        }
        for img in images_result.scalars().all()
    ]

    return {
        "id": str(story.id),
        "title": story.title,
        "subtitle": story.subtitle,
        "slug": story.slug,
        "content": story.content,
        "cover_image_url": story.cover_image_url,
        "category": story.category,
        "external_url": story.external_url,
        "published": story.published,
        "author_name": author_name,
        "person_ids": person_ids,
        "person_names": person_names,
        "images": images,
        "created_at": str(story.created_at),
        "updated_at": str(story.updated_at),
    }


# --- Endpoints ---

@router.get("", response_model=list[FamilyStoryListItem])
async def list_family_stories(
    category: str | None = Query(None),
    published_only: bool = Query(True),
    person_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List family stories, optionally filtered by category or linked person."""
    stmt = select(FamilyStory).order_by(FamilyStory.created_at.desc())

    if published_only:
        stmt = stmt.where(FamilyStory.published.is_(True))
    if category:
        stmt = stmt.where(FamilyStory.category == category)

    result = await db.execute(stmt)
    stories = result.scalars().all()

    # If filtering by person, narrow down
    if person_id:
        linked = await db.execute(
            select(FamilyStoryPerson.story_id).where(FamilyStoryPerson.person_id == person_id)
        )
        linked_ids = {row[0] for row in linked.all()}
        stories = [s for s in stories if s.id in linked_ids]

    items = []
    for s in stories:
        author_result = await db.execute(select(User.display_name).where(User.id == s.author_id))
        author_name = author_result.scalar() or "Unknown"

        person_count_result = await db.execute(
            select(FamilyStoryPerson.person_id).where(FamilyStoryPerson.story_id == s.id)
        )
        image_count_result = await db.execute(
            select(FamilyStoryImage.id).where(FamilyStoryImage.story_id == s.id)
        )

        items.append(FamilyStoryListItem(
            id=str(s.id), title=s.title, subtitle=s.subtitle, slug=s.slug,
            cover_image_url=s.cover_image_url, category=s.category,
            published=s.published, author_name=author_name,
            person_count=len(person_count_result.all()),
            image_count=len(image_count_result.all()),
            created_at=str(s.created_at),
        ))

    return items


@router.get("/{story_id}", response_model=FamilyStoryResponse)
async def get_family_story(
    story_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single family story with all details."""
    # Try by ID first, then by slug
    result = await db.execute(select(FamilyStory).where(FamilyStory.id == story_id))
    story = result.scalar_one_or_none()
    if not story:
        result = await db.execute(select(FamilyStory).where(FamilyStory.slug == story_id))
        story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found.")
    return await _build_response(story, db)


@router.post("", response_model=FamilyStoryResponse, status_code=201)
async def create_family_story(
    body: FamilyStoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new family story."""
    slug = _slugify(body.title)
    # Ensure unique slug
    existing = await db.execute(select(FamilyStory).where(FamilyStory.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    story = FamilyStory(
        title=body.title,
        subtitle=body.subtitle,
        slug=slug,
        content=body.content,
        cover_image_url=body.cover_image_url,
        category=body.category,
        external_url=body.external_url,
        location_id=uuid.UUID(body.location_id) if body.location_id else None,
        published=body.published,
        author_id=current_user.id,
    )
    db.add(story)
    await db.flush()

    # Link persons
    for pid in body.person_ids:
        db.add(FamilyStoryPerson(story_id=story.id, person_id=uuid.UUID(pid)))

    # Add images
    for i, img in enumerate(body.images):
        db.add(FamilyStoryImage(
            story_id=story.id,
            image_url=img.get("image_url"),
            s3_key=img.get("s3_key"),
            caption=img.get("caption"),
            sort_order=img.get("sort_order", i),
        ))

    await db.flush()
    await db.refresh(story)
    return await _build_response(story, db)


@router.put("/{story_id}", response_model=FamilyStoryResponse)
async def update_family_story(
    story_id: str,
    body: FamilyStoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a family story."""
    result = await db.execute(select(FamilyStory).where(FamilyStory.id == story_id))
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found.")

    if body.title is not None:
        story.title = body.title
    if body.subtitle is not None:
        story.subtitle = body.subtitle
    if body.content is not None:
        story.content = body.content
    if body.cover_image_url is not None:
        story.cover_image_url = body.cover_image_url
    if body.category is not None:
        story.category = body.category
    if body.external_url is not None:
        story.external_url = body.external_url
    if body.published is not None:
        story.published = body.published

    # Update person links
    if body.person_ids is not None:
        await db.execute(
            select(FamilyStoryPerson).where(FamilyStoryPerson.story_id == story.id)
        )
        # Delete existing
        from sqlalchemy import delete
        await db.execute(delete(FamilyStoryPerson).where(FamilyStoryPerson.story_id == story.id))
        for pid in body.person_ids:
            db.add(FamilyStoryPerson(story_id=story.id, person_id=uuid.UUID(pid)))

    # Update images
    if body.images is not None:
        from sqlalchemy import delete
        await db.execute(delete(FamilyStoryImage).where(FamilyStoryImage.story_id == story.id))
        for i, img in enumerate(body.images):
            db.add(FamilyStoryImage(
                story_id=story.id,
                image_url=img.get("image_url"),
                s3_key=img.get("s3_key"),
                caption=img.get("caption"),
                sort_order=img.get("sort_order", i),
            ))

    await db.flush()
    await db.refresh(story)
    return await _build_response(story, db)


@router.delete("/{story_id}", status_code=204)
async def delete_family_story(
    story_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a family story."""
    result = await db.execute(select(FamilyStory).where(FamilyStory.id == story_id))
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found.")
    await db.delete(story)


@router.get("/person/{person_id}/stories", response_model=list[FamilyStoryListItem])
async def get_stories_for_person(
    person_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all published family stories that mention a specific person."""
    linked = await db.execute(
        select(FamilyStoryPerson.story_id).where(FamilyStoryPerson.person_id == person_id)
    )
    story_ids = [row[0] for row in linked.all()]
    if not story_ids:
        return []

    result = await db.execute(
        select(FamilyStory)
        .where(FamilyStory.id.in_(story_ids), FamilyStory.published.is_(True))
        .order_by(FamilyStory.created_at.desc())
    )
    stories = result.scalars().all()

    items = []
    for s in stories:
        author_result = await db.execute(select(User.display_name).where(User.id == s.author_id))
        items.append(FamilyStoryListItem(
            id=str(s.id), title=s.title, subtitle=s.subtitle, slug=s.slug,
            cover_image_url=s.cover_image_url, category=s.category,
            published=s.published, author_name=author_result.scalar() or "Unknown",
            person_count=0, image_count=0, created_at=str(s.created_at),
        ))

    return items
