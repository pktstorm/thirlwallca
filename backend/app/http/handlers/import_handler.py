import logging
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import require_role
from app.deps import get_db
from app.domain.enums import UserRole
from app.domain.models import User
from app.http.schemas.import_schema import ImportSummaryResponse
from app.services.gedcom_service import parse_gedcom
from app.services.import_service import import_gedcom

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/gedcom",
    response_model=ImportSummaryResponse,
    status_code=status.HTTP_200_OK,
)
async def import_gedcom_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Import a GEDCOM (.ged) file. Admin-only."""
    if file.filename and not file.filename.lower().endswith(".ged"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a .ged (GEDCOM) file",
        )

    content_bytes = await file.read()
    try:
        content = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content = content_bytes.decode("utf-8-sig")

    try:
        gedcom_data = parse_gedcom(content)
    except Exception as e:
        logger.exception("GEDCOM parsing failed")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse GEDCOM file: {e}",
        )

    summary = await import_gedcom(db, gedcom_data, user_id=current_user.id)

    return ImportSummaryResponse(
        persons_created=summary.persons_created,
        persons_updated=summary.persons_updated,
        persons_skipped=summary.persons_skipped,
        relationships_created=summary.relationships_created,
        relationships_skipped=summary.relationships_skipped,
        locations_created=summary.locations_created,
        locations_reused=summary.locations_reused,
        residences_created=summary.residences_created,
        alternate_names_created=summary.alternate_names_created,
        errors=summary.errors,
    )
