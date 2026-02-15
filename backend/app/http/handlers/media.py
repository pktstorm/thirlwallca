import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import boto3
from app.config import settings
from app.deps import get_db
from app.domain.models import Media, MediaPerson
from app.http.schemas.media import (
    MediaCreate,
    MediaUpdate,
    MediaResponse,
    UploadUrlRequest,
    UploadUrlResponse,
    MediaTagRequest,
)

router = APIRouter()


@router.get("", response_model=list[MediaResponse])
async def list_media(
    media_type: str | None = Query(None),
    person_id: uuid.UUID | None = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Media)
    if media_type:
        stmt = stmt.where(Media.media_type == media_type)
    if person_id:
        stmt = stmt.join(MediaPerson, MediaPerson.media_id == Media.id).where(
            MediaPerson.person_id == person_id
        )
    stmt = stmt.order_by(Media.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=MediaResponse, status_code=status.HTTP_201_CREATED)
async def create_media(
    data: MediaCreate,
    db: AsyncSession = Depends(get_db),
):
    media = Media(**data.model_dump())
    db.add(media)
    await db.flush()
    await db.refresh(media)
    return media


@router.get("/{media_id}", response_model=MediaResponse)
async def get_media(
    media_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Media).where(Media.id == media_id))
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    return media


@router.put("/{media_id}", response_model=MediaResponse)
async def update_media(
    media_id: uuid.UUID,
    data: MediaUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Media).where(Media.id == media_id))
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(media, key, value)
    await db.flush()
    await db.refresh(media)
    return media


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(
    media_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Media).where(Media.id == media_id))
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    await db.delete(media)


@router.post("/{media_id}/tag", status_code=status.HTTP_201_CREATED)
async def tag_person_in_media(
    media_id: uuid.UUID,
    data: MediaTagRequest,
    db: AsyncSession = Depends(get_db),
):
    """Tag a person in a media item."""
    # Verify media exists
    result = await db.execute(select(Media).where(Media.id == media_id))
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    # Check if tag already exists
    existing = await db.execute(
        select(MediaPerson).where(
            MediaPerson.media_id == media_id,
            MediaPerson.person_id == data.person_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Person already tagged in this media")

    tag = MediaPerson(media_id=media_id, person_id=data.person_id, label=data.label)
    db.add(tag)
    await db.flush()
    return {"media_id": str(media_id), "person_id": str(data.person_id), "label": data.label}


@router.delete("/{media_id}/tag/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
async def untag_person_from_media(
    media_id: uuid.UUID,
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Remove a person tag from a media item."""
    result = await db.execute(
        select(MediaPerson).where(
            MediaPerson.media_id == media_id,
            MediaPerson.person_id == person_id,
        )
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    await db.delete(tag)


@router.post("/upload-url", response_model=UploadUrlResponse)
async def generate_upload_url(
    data: UploadUrlRequest,
):
    """Generate a presigned S3 upload URL for media uploads."""
    s3_key = f"media/{uuid.uuid4()}/{data.filename}"
    s3_client = boto3.client("s3", region_name=settings.s3_region)
    upload_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.s3_media_bucket,
            "Key": s3_key,
            "ContentType": data.content_type,
        },
        ExpiresIn=3600,
    )
    return UploadUrlResponse(upload_url=upload_url, s3_key=s3_key)
