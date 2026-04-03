import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.domain.models import FamilyAnswer, FamilyQuestion, User

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class QuestionCreate(BaseModel):
    title: str
    body: Optional[str] = None
    person_id: Optional[uuid.UUID] = None
    author_id: uuid.UUID


class AnswerCreate(BaseModel):
    body: str
    author_id: uuid.UUID


class AnswerResponse(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    body: str
    author_id: uuid.UUID
    author_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class QuestionListResponse(BaseModel):
    id: uuid.UUID
    title: str
    body: Optional[str] = None
    person_id: Optional[uuid.UUID] = None
    author_id: uuid.UUID
    author_name: Optional[str] = None
    is_resolved: bool
    answer_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class QuestionDetailResponse(BaseModel):
    id: uuid.UUID
    title: str
    body: Optional[str] = None
    person_id: Optional[uuid.UUID] = None
    author_id: uuid.UUID
    author_name: Optional[str] = None
    is_resolved: bool
    answers: list[AnswerResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[QuestionListResponse])
async def list_questions(
    person_id: Optional[uuid.UUID] = Query(None),
    is_resolved: Optional[bool] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(FamilyQuestion)
    if person_id is not None:
        stmt = stmt.where(FamilyQuestion.person_id == person_id)
    if is_resolved is not None:
        stmt = stmt.where(FamilyQuestion.is_resolved == is_resolved)
    stmt = stmt.order_by(FamilyQuestion.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(stmt)
    questions = result.scalars().all()

    if not questions:
        return []

    # Gather answer counts
    q_ids = [q.id for q in questions]
    count_stmt = (
        select(FamilyAnswer.question_id, func.count(FamilyAnswer.id).label("cnt"))
        .where(FamilyAnswer.question_id.in_(q_ids))
        .group_by(FamilyAnswer.question_id)
    )
    count_result = await db.execute(count_stmt)
    answer_counts: dict[uuid.UUID, int] = {row.question_id: row.cnt for row in count_result}

    # Gather author names
    author_ids = {q.author_id for q in questions}
    author_map: dict[uuid.UUID, str] = {}
    if author_ids:
        users_result = await db.execute(select(User).where(User.id.in_(list(author_ids))))
        for u in users_result.scalars().all():
            author_map[u.id] = u.display_name

    return [
        {
            "id": q.id,
            "title": q.title,
            "body": q.body,
            "person_id": q.person_id,
            "author_id": q.author_id,
            "author_name": author_map.get(q.author_id),
            "is_resolved": q.is_resolved,
            "answer_count": answer_counts.get(q.id, 0),
            "created_at": q.created_at,
            "updated_at": q.updated_at,
        }
        for q in questions
    ]


@router.get("/{question_id}", response_model=QuestionDetailResponse)
async def get_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FamilyQuestion).where(FamilyQuestion.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    # Fetch answers
    answers_result = await db.execute(
        select(FamilyAnswer)
        .where(FamilyAnswer.question_id == question_id)
        .order_by(FamilyAnswer.created_at.asc())
    )
    answers = answers_result.scalars().all()

    # Gather all author names (question + answers)
    all_author_ids = {question.author_id} | {a.author_id for a in answers}
    author_map: dict[uuid.UUID, str] = {}
    if all_author_ids:
        users_result = await db.execute(select(User).where(User.id.in_(list(all_author_ids))))
        for u in users_result.scalars().all():
            author_map[u.id] = u.display_name

    return {
        "id": question.id,
        "title": question.title,
        "body": question.body,
        "person_id": question.person_id,
        "author_id": question.author_id,
        "author_name": author_map.get(question.author_id),
        "is_resolved": question.is_resolved,
        "answers": [
            {
                "id": a.id,
                "question_id": a.question_id,
                "body": a.body,
                "author_id": a.author_id,
                "author_name": author_map.get(a.author_id),
                "created_at": a.created_at,
            }
            for a in answers
        ],
        "created_at": question.created_at,
        "updated_at": question.updated_at,
    }


@router.post("", response_model=QuestionListResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
):
    question = FamilyQuestion(**data.model_dump())
    db.add(question)
    await db.flush()
    await db.refresh(question)

    # Fetch author name
    author_result = await db.execute(select(User).where(User.id == question.author_id))
    author = author_result.scalar_one_or_none()

    return {
        "id": question.id,
        "title": question.title,
        "body": question.body,
        "person_id": question.person_id,
        "author_id": question.author_id,
        "author_name": author.display_name if author else None,
        "is_resolved": question.is_resolved,
        "answer_count": 0,
        "created_at": question.created_at,
        "updated_at": question.updated_at,
    }


@router.post("/{question_id}/answers", response_model=AnswerResponse, status_code=status.HTTP_201_CREATED)
async def create_answer(
    question_id: uuid.UUID,
    data: AnswerCreate,
    db: AsyncSession = Depends(get_db),
):
    # Verify question exists
    q_result = await db.execute(select(FamilyQuestion).where(FamilyQuestion.id == question_id))
    if not q_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    answer = FamilyAnswer(question_id=question_id, body=data.body, author_id=data.author_id)
    db.add(answer)
    await db.flush()
    await db.refresh(answer)

    # Fetch author name
    author_result = await db.execute(select(User).where(User.id == answer.author_id))
    author = author_result.scalar_one_or_none()

    return {
        "id": answer.id,
        "question_id": answer.question_id,
        "body": answer.body,
        "author_id": answer.author_id,
        "author_name": author.display_name if author else None,
        "created_at": answer.created_at,
    }


@router.put("/{question_id}/resolve", response_model=QuestionListResponse)
async def toggle_resolved(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FamilyQuestion).where(FamilyQuestion.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    question.is_resolved = not question.is_resolved
    await db.flush()
    await db.refresh(question)

    # Answer count
    count_result = await db.execute(
        select(func.count(FamilyAnswer.id)).where(FamilyAnswer.question_id == question_id)
    )
    answer_count = count_result.scalar() or 0

    # Author name
    author_result = await db.execute(select(User).where(User.id == question.author_id))
    author = author_result.scalar_one_or_none()

    return {
        "id": question.id,
        "title": question.title,
        "body": question.body,
        "person_id": question.person_id,
        "author_id": question.author_id,
        "author_name": author.display_name if author else None,
        "is_resolved": question.is_resolved,
        "answer_count": answer_count,
        "created_at": question.created_at,
        "updated_at": question.updated_at,
    }


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FamilyQuestion).where(FamilyQuestion.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    await db.delete(question)
