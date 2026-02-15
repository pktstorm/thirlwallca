import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db
from app.domain.models import Person, PersonAlternateName
from app.http.schemas.person import PersonAlternateNameCreate, PersonAlternateNameResponse

router = APIRouter()


@router.get("/{person_id}/alternate-names", response_model=list[PersonAlternateNameResponse])
async def list_alternate_names(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Person).where(Person.id == person_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    result = await db.execute(
        select(PersonAlternateName)
        .where(PersonAlternateName.person_id == person_id)
        .order_by(PersonAlternateName.created_at.asc())
    )
    return result.scalars().all()


@router.post("/{person_id}/alternate-names", response_model=PersonAlternateNameResponse, status_code=status.HTTP_201_CREATED)
async def create_alternate_name(
    person_id: uuid.UUID,
    data: PersonAlternateNameCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Person).where(Person.id == person_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    alt_name = PersonAlternateName(person_id=person_id, **data.model_dump())
    db.add(alt_name)
    await db.flush()
    await db.refresh(alt_name)
    return alt_name


@router.delete("/{person_id}/alternate-names/{name_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alternate_name(
    person_id: uuid.UUID,
    name_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PersonAlternateName).where(
            PersonAlternateName.id == name_id,
            PersonAlternateName.person_id == person_id,
        )
    )
    alt_name = result.scalar_one_or_none()
    if not alt_name:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alternate name not found")
    await db.delete(alt_name)
