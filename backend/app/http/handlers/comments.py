import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db
from app.domain.models import Comment, CommentLike
from app.http.schemas.comment import CommentCreate, CommentUpdate, CommentResponse

router = APIRouter()


@router.get("", response_model=list[CommentResponse])
async def list_comments(
    person_id: uuid.UUID | None = Query(None),
    story_id: uuid.UUID | None = Query(None),
    media_id: uuid.UUID | None = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Comment)
    if person_id:
        stmt = stmt.where(Comment.person_id == person_id)
    if story_id:
        stmt = stmt.where(Comment.story_id == story_id)
    if media_id:
        stmt = stmt.where(Comment.media_id == media_id)
    stmt = stmt.order_by(Comment.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
):
    # Validate that exactly one target is provided
    targets = [data.person_id, data.story_id, data.media_id]
    non_null_targets = [t for t in targets if t is not None]
    if len(non_null_targets) != 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Exactly one of person_id, story_id, or media_id must be provided",
        )
    comment = Comment(**data.model_dump())
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return comment


@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: uuid.UUID,
    data: CommentUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    comment.body = data.body
    await db.flush()
    await db.refresh(comment)
    return comment


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    await db.delete(comment)


@router.post("/{comment_id}/like", status_code=status.HTTP_200_OK)
async def toggle_like(
    comment_id: uuid.UUID,
    user_id: uuid.UUID = Query(..., description="The user toggling the like"),
    db: AsyncSession = Depends(get_db),
):
    """Toggle a like on a comment. If the like exists, remove it; otherwise, create it."""
    # Verify comment exists
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    # Check if like already exists
    existing = await db.execute(
        select(CommentLike).where(
            CommentLike.comment_id == comment_id,
            CommentLike.user_id == user_id,
        )
    )
    like = existing.scalar_one_or_none()

    if like:
        # Unlike
        await db.delete(like)
        comment.likes_count = max(0, comment.likes_count - 1)
        action = "unliked"
    else:
        # Like
        new_like = CommentLike(comment_id=comment_id, user_id=user_id)
        db.add(new_like)
        comment.likes_count = comment.likes_count + 1
        action = "liked"

    await db.flush()
    await db.refresh(comment)
    return {"action": action, "likes_count": comment.likes_count}
