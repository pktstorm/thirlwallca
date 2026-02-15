import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db
from app.domain.models import Story, StoryPerson, Person
from app.http.schemas.story import StoryCreate, StoryUpdate, StoryResponse

router = APIRouter()


@router.get("", response_model=list[StoryResponse])
async def list_stories(
    published: bool | None = Query(None),
    author_id: uuid.UUID | None = Query(None),
    person_id: uuid.UUID | None = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Story)
    if published is not None:
        stmt = stmt.where(Story.published == published)
    if author_id:
        stmt = stmt.where(Story.author_id == author_id)
    if person_id:
        stmt = stmt.join(StoryPerson, StoryPerson.story_id == Story.id).where(
            StoryPerson.person_id == person_id
        )
    stmt = stmt.order_by(Story.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=StoryResponse, status_code=status.HTTP_201_CREATED)
async def create_story(
    data: StoryCreate,
    db: AsyncSession = Depends(get_db),
):
    story = Story(**data.model_dump())
    db.add(story)
    await db.flush()
    await db.refresh(story)
    return story


@router.get("/{story_id}", response_model=StoryResponse)
async def get_story(
    story_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")
    return story


@router.put("/{story_id}", response_model=StoryResponse)
async def update_story(
    story_id: uuid.UUID,
    data: StoryUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(story, key, value)
    await db.flush()
    await db.refresh(story)
    return story


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_story(
    story_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")
    await db.delete(story)


@router.post("/{story_id}/persons/{person_id}", status_code=status.HTTP_201_CREATED)
async def link_person_to_story(
    story_id: uuid.UUID,
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Link a person to a story."""
    # Verify story exists
    result = await db.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")

    # Verify person exists
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    # Check if link already exists
    existing = await db.execute(
        select(StoryPerson).where(
            StoryPerson.story_id == story_id,
            StoryPerson.person_id == person_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Person already linked to this story")

    link = StoryPerson(story_id=story_id, person_id=person_id)
    db.add(link)
    await db.flush()
    return {"story_id": str(story_id), "person_id": str(person_id)}


@router.delete("/{story_id}/persons/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_person_from_story(
    story_id: uuid.UUID,
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Unlink a person from a story."""
    result = await db.execute(
        select(StoryPerson).where(
            StoryPerson.story_id == story_id,
            StoryPerson.person_id == person_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    await db.delete(link)
