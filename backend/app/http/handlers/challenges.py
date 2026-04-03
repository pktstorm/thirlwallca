import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.cognito import get_current_user
from app.deps import get_db
from app.domain.models import ChallengeProgress, FamilyChallenge, User

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ChallengeCreate(BaseModel):
    title: str
    description: str
    challenge_type: str = "research"
    target_count: int = 1
    icon: Optional[str] = None


class ChallengeResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    challenge_type: str
    target_count: int
    icon: Optional[str] = None
    is_active: bool
    current_count: int = 0
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class LeaderboardEntry(BaseModel):
    user_id: uuid.UUID
    display_name: str
    completed_count: int

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    limit: int = Query(10, le=50),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            ChallengeProgress.user_id,
            func.count(ChallengeProgress.id).label("completed_count"),
        )
        .where(ChallengeProgress.completed_at.isnot(None))
        .group_by(ChallengeProgress.user_id)
        .order_by(func.count(ChallengeProgress.id).desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    if not rows:
        return []

    # Fetch user names
    user_ids = [row.user_id for row in rows]
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    user_map: dict[uuid.UUID, str] = {u.id: u.display_name for u in users_result.scalars().all()}

    return [
        {
            "user_id": row.user_id,
            "display_name": user_map.get(row.user_id, "Unknown"),
            "completed_count": row.completed_count,
        }
        for row in rows
    ]


@router.get("", response_model=list[ChallengeResponse])
async def list_challenges(
    user_id: uuid.UUID = Query(..., description="User to show progress for"),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(FamilyChallenge)
        .where(FamilyChallenge.is_active == True)  # noqa: E712
        .order_by(FamilyChallenge.created_at.desc())
    )
    result = await db.execute(stmt)
    challenges = result.scalars().all()

    if not challenges:
        return []

    # Fetch user progress for all challenges
    challenge_ids = [c.id for c in challenges]
    progress_result = await db.execute(
        select(ChallengeProgress)
        .where(
            ChallengeProgress.challenge_id.in_(challenge_ids),
            ChallengeProgress.user_id == user_id,
        )
    )
    progress_map: dict[uuid.UUID, ChallengeProgress] = {
        p.challenge_id: p for p in progress_result.scalars().all()
    }

    return [
        {
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "challenge_type": c.challenge_type,
            "target_count": c.target_count,
            "icon": c.icon,
            "is_active": c.is_active,
            "current_count": progress_map[c.id].current_count if c.id in progress_map else 0,
            "completed_at": progress_map[c.id].completed_at if c.id in progress_map else None,
            "created_at": c.created_at,
        }
        for c in challenges
    ]


@router.post("", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
async def create_challenge(
    data: ChallengeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can create challenges")

    challenge = FamilyChallenge(**data.model_dump())
    db.add(challenge)
    await db.flush()
    await db.refresh(challenge)

    return {
        "id": challenge.id,
        "title": challenge.title,
        "description": challenge.description,
        "challenge_type": challenge.challenge_type,
        "target_count": challenge.target_count,
        "icon": challenge.icon,
        "is_active": challenge.is_active,
        "current_count": 0,
        "completed_at": None,
        "created_at": challenge.created_at,
    }


@router.post("/{challenge_id}/progress", response_model=ChallengeResponse)
async def increment_progress(
    challenge_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify challenge exists
    challenge_result = await db.execute(
        select(FamilyChallenge).where(FamilyChallenge.id == challenge_id)
    )
    challenge = challenge_result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    # Get or create progress
    progress_result = await db.execute(
        select(ChallengeProgress).where(
            ChallengeProgress.challenge_id == challenge_id,
            ChallengeProgress.user_id == current_user.id,
        )
    )
    progress = progress_result.scalar_one_or_none()

    if not progress:
        progress = ChallengeProgress(
            challenge_id=challenge_id,
            user_id=current_user.id,
            current_count=0,
        )
        db.add(progress)
        await db.flush()
        await db.refresh(progress)

    # Only increment if not already completed
    if progress.completed_at is None:
        progress.current_count += 1
        if progress.current_count >= challenge.target_count:
            progress.completed_at = datetime.utcnow()
        await db.flush()
        await db.refresh(progress)

    return {
        "id": challenge.id,
        "title": challenge.title,
        "description": challenge.description,
        "challenge_type": challenge.challenge_type,
        "target_count": challenge.target_count,
        "icon": challenge.icon,
        "is_active": challenge.is_active,
        "current_count": progress.current_count,
        "completed_at": progress.completed_at,
        "created_at": challenge.created_at,
    }
