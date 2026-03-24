"""Admin endpoints for managing signup requests."""

import logging
import secrets
from datetime import datetime, timedelta, timezone

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.cognito import get_current_user
from app.config import settings
from app.deps import get_db
from app.domain.enums import SignupStatus, UserRole
from app.domain.models import OnboardToken, SignupRequest, User
from app.http.schemas.signup import RejectBody, SignupRequestResponse
from app.services.email_service import send_onboard_email

logger = logging.getLogger(__name__)

router = APIRouter()

ONBOARD_TOKEN_EXPIRY_DAYS = 7


def _require_admin(user: User) -> None:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required.")


@router.get("/signup-requests", response_model=list[SignupRequestResponse])
async def list_signup_requests(
    status_filter: SignupStatus | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List signup requests. Optionally filter by status."""
    _require_admin(current_user)

    stmt = select(SignupRequest).order_by(SignupRequest.created_at.desc())
    if status_filter:
        stmt = stmt.where(SignupRequest.status == status_filter)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/signup-requests/{request_id}/approve", response_model=SignupRequestResponse)
async def approve_signup_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a signup request: create Cognito user, generate onboard token, send email."""
    _require_admin(current_user)

    result = await db.execute(
        select(SignupRequest).where(SignupRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Signup request not found.")

    if req.status != SignupStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Request is already {req.status.value}.")

    # Create user in Cognito (with suppressed invite email — we send our own)
    if settings.cognito_user_pool_id:
        client = boto3.client("cognito-idp", region_name=settings.cognito_region)
        try:
            # Create user with a temporary random password (they'll set their own via onboard)
            temp_password = secrets.token_urlsafe(16) + "!A1"
            client.admin_create_user(
                UserPoolId=settings.cognito_user_pool_id,
                Username=req.email,
                UserAttributes=[
                    {"Name": "email", "Value": req.email},
                    {"Name": "email_verified", "Value": "true"},
                    {"Name": "name", "Value": f"{req.first_name} {req.last_name}"},
                    {"Name": "custom:role", "Value": "viewer"},
                ],
                TemporaryPassword=temp_password,
                MessageAction="SUPPRESS",  # Don't send Cognito's default invite email
            )
            logger.info("Created Cognito user for %s", req.email)
        except ClientError as exc:
            error_code = exc.response["Error"]["Code"]
            if error_code == "UsernameExistsException":
                logger.info("Cognito user already exists for %s, proceeding", req.email)
            else:
                logger.error("Failed to create Cognito user: %s", exc)
                raise HTTPException(status_code=500, detail="Failed to create user account.") from exc
    else:
        logger.info("Dev mode: would create Cognito user for %s", req.email)

    # Generate onboard token
    token = secrets.token_urlsafe(48)
    now = datetime.now(timezone.utc)

    onboard = OnboardToken(
        signup_request_id=req.id,
        email=req.email,
        token=token,
        expires_at=now + timedelta(days=ONBOARD_TOKEN_EXPIRY_DAYS),
    )
    db.add(onboard)

    # Update request status
    req.status = SignupStatus.APPROVED
    req.reviewed_by = current_user.id
    req.reviewed_at = now
    await db.flush()

    # Send welcome email
    send_onboard_email(req.email, req.first_name, token)

    await db.refresh(req)
    return req


@router.post("/signup-requests/{request_id}/reject", response_model=SignupRequestResponse)
async def reject_signup_request(
    request_id: str,
    body: RejectBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a signup request."""
    _require_admin(current_user)

    result = await db.execute(
        select(SignupRequest).where(SignupRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Signup request not found.")

    if req.status != SignupStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Request is already {req.status.value}.")

    now = datetime.now(timezone.utc)
    req.status = SignupStatus.REJECTED
    req.reviewed_by = current_user.id
    req.reviewed_at = now
    req.reject_reason = body.reason
    await db.flush()

    await db.refresh(req)
    return req
