import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db
from app.domain.models import Migration
from app.http.schemas.migration import MigrationCreate, MigrationUpdate, MigrationResponse

router = APIRouter()


@router.get("", response_model=list[MigrationResponse])
async def list_migrations(
    person_id: uuid.UUID | None = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Migration)
    if person_id:
        stmt = stmt.where(Migration.person_id == person_id)
    stmt = stmt.order_by(Migration.year.asc().nullslast()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=MigrationResponse, status_code=status.HTTP_201_CREATED)
async def create_migration(
    data: MigrationCreate,
    db: AsyncSession = Depends(get_db),
):
    migration = Migration(**data.model_dump())
    db.add(migration)
    await db.flush()
    await db.refresh(migration)
    return migration


@router.get("/{migration_id}", response_model=MigrationResponse)
async def get_migration(
    migration_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Migration).where(Migration.id == migration_id))
    migration = result.scalar_one_or_none()
    if not migration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Migration not found")
    return migration


@router.put("/{migration_id}", response_model=MigrationResponse)
async def update_migration(
    migration_id: uuid.UUID,
    data: MigrationUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Migration).where(Migration.id == migration_id))
    migration = result.scalar_one_or_none()
    if not migration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Migration not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(migration, key, value)
    await db.flush()
    await db.refresh(migration)
    return migration


@router.delete("/{migration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_migration(
    migration_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Migration).where(Migration.id == migration_id))
    migration = result.scalar_one_or_none()
    if not migration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Migration not found")
    await db.delete(migration)
