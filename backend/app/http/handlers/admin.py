"""Admin endpoints for managing signup requests, users, and audit logs."""

import logging
import secrets
from datetime import datetime, timedelta, timezone

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.cognito import get_current_user
from app.config import settings
from app.deps import get_db
from app.domain.enums import SignupStatus, UserRole
from app.domain.models import AuditLog, OnboardToken, SignupCode, SignupRequest, User
from app.http.schemas.signup import RejectBody, SignupRequestResponse
from app.services.audit_service import log_audit
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


# ---------------------------------------------------------------------------
# Audit Logs
# ---------------------------------------------------------------------------


class AuditLogResponse(BaseModel):
    id: str
    user_id: str | None
    user_name: str | None
    action: str
    entity_type: str
    entity_id: str | None
    entity_label: str | None
    details: dict | None
    created_at: datetime


class AuditStatsResponse(BaseModel):
    total_entries: int
    actions: dict[str, int]
    entity_types: dict[str, int]
    top_users: list[dict]


@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def list_audit_logs(
    user_id: str | None = Query(None),
    action: str | None = Query(None),
    entity_type: str | None = Query(None),
    date_from: str | None = Query(None, description="ISO date: YYYY-MM-DD"),
    date_to: str | None = Query(None, description="ISO date: YYYY-MM-DD"),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List audit log entries with optional filters."""
    _require_admin(current_user)

    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())

    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if date_from:
        stmt = stmt.where(AuditLog.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        dt_to = datetime.fromisoformat(date_to) + timedelta(days=1)
        stmt = stmt.where(AuditLog.created_at < dt_to)

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return [
        AuditLogResponse(
            id=str(log.id),
            user_id=str(log.user_id) if log.user_id else None,
            user_name=log.user_name,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            entity_label=log.entity_label,
            details=log.details,
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.get("/audit-stats", response_model=AuditStatsResponse)
async def get_audit_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregate stats for the audit log."""
    _require_admin(current_user)

    total = await db.execute(select(func.count(AuditLog.id)))
    total_count = total.scalar() or 0

    actions_result = await db.execute(
        select(AuditLog.action, func.count(AuditLog.id)).group_by(AuditLog.action)
    )
    actions = {row[0]: row[1] for row in actions_result.all()}

    entities_result = await db.execute(
        select(AuditLog.entity_type, func.count(AuditLog.id)).group_by(AuditLog.entity_type)
    )
    entity_types = {row[0]: row[1] for row in entities_result.all()}

    users_result = await db.execute(
        select(AuditLog.user_name, func.count(AuditLog.id))
        .where(AuditLog.user_name.isnot(None))
        .group_by(AuditLog.user_name)
        .order_by(func.count(AuditLog.id).desc())
        .limit(10)
    )
    top_users = [{"name": row[0], "count": row[1]} for row in users_result.all()]

    return AuditStatsResponse(
        total_entries=total_count, actions=actions,
        entity_types=entity_types, top_users=top_users,
    )


# ---------------------------------------------------------------------------
# User Management
# ---------------------------------------------------------------------------


class AdminUserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    role: str
    is_active: bool
    last_login_at: datetime | None
    linked_person_id: str | None
    created_at: datetime


@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users."""
    _require_admin(current_user)
    result = await db.execute(select(User).order_by(User.display_name))
    users = result.scalars().all()
    return [
        AdminUserResponse(
            id=str(u.id), email=u.email, display_name=u.display_name,
            role=u.role.value if hasattr(u.role, "value") else str(u.role),
            is_active=u.is_active, last_login_at=u.last_login_at,
            linked_person_id=str(u.linked_person_id) if u.linked_person_id else None,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str = Query(..., description="admin, editor, or viewer"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change a user's role."""
    _require_admin(current_user)
    if role not in ("admin", "editor", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role.")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    old_role = user.role.value if hasattr(user.role, "value") else str(user.role)
    user.role = UserRole(role)
    await db.flush()
    await log_audit(db, user=current_user, action="update", entity_type="user",
                    entity_id=user_id, entity_label=user.display_name,
                    details={"field": "role", "from": old_role, "to": role})
    return {"detail": f"Role updated to {role}.", "role": role}


@router.put("/users/{user_id}/deactivate")
async def toggle_user_active(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle a user's active status."""
    _require_admin(current_user)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_active = not user.is_active
    await db.flush()
    await log_audit(db, user=current_user, action="update", entity_type="user",
                    entity_id=user_id, entity_label=user.display_name,
                    details={"field": "is_active", "value": user.is_active})
    return {"detail": f"User {'activated' if user.is_active else 'deactivated'}.", "is_active": user.is_active}


# ---------------------------------------------------------------------------
# Signup Codes
# ---------------------------------------------------------------------------


class SignupCodeResponse(BaseModel):
    id: str
    code: str
    label: str | None
    role: str
    max_uses: int | None
    use_count: int
    is_active: bool
    expires_at: datetime | None
    created_at: datetime


class CreateSignupCodeBody(BaseModel):
    code: str
    label: str | None = None
    role: str = "editor"
    max_uses: int | None = None
    expires_at: str | None = None  # ISO datetime


@router.get("/signup-codes", response_model=list[SignupCodeResponse])
async def list_signup_codes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all signup codes."""
    _require_admin(current_user)
    result = await db.execute(select(SignupCode).order_by(SignupCode.created_at.desc()))
    codes = result.scalars().all()
    return [
        SignupCodeResponse(
            id=str(c.id), code=c.code, label=c.label,
            role=c.role, max_uses=c.max_uses, use_count=c.use_count,
            is_active=c.is_active, expires_at=c.expires_at, created_at=c.created_at,
        )
        for c in codes
    ]


@router.post("/signup-codes", response_model=SignupCodeResponse, status_code=201)
async def create_signup_code(
    body: CreateSignupCodeBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new signup code."""
    _require_admin(current_user)
    if body.role not in ("admin", "editor", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role.")

    # Check for duplicate code
    existing = await db.execute(select(SignupCode).where(SignupCode.code == body.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Code already exists.")

    expires = datetime.fromisoformat(body.expires_at) if body.expires_at else None

    code = SignupCode(
        code=body.code, label=body.label, role=body.role,
        max_uses=body.max_uses, expires_at=expires,
        created_by=current_user.id,
    )
    db.add(code)
    await db.flush()
    await db.refresh(code)

    return SignupCodeResponse(
        id=str(code.id), code=code.code, label=code.label,
        role=code.role, max_uses=code.max_uses, use_count=code.use_count,
        is_active=code.is_active, expires_at=code.expires_at, created_at=code.created_at,
    )


@router.put("/signup-codes/{code_id}/toggle")
async def toggle_signup_code(
    code_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle a signup code active/inactive."""
    _require_admin(current_user)
    result = await db.execute(select(SignupCode).where(SignupCode.id == code_id))
    code = result.scalar_one_or_none()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found.")
    code.is_active = not code.is_active
    await db.flush()
    return {"is_active": code.is_active}


@router.delete("/signup-codes/{code_id}", status_code=204)
async def delete_signup_code(
    code_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a signup code."""
    _require_admin(current_user)
    result = await db.execute(select(SignupCode).where(SignupCode.id == code_id))
    code = result.scalar_one_or_none()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found.")
    await db.delete(code)


# ---------------------------------------------------------------------------
# Delete User + Reset Password
# ---------------------------------------------------------------------------


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a user: remove from Cognito and database."""
    _require_admin(current_user)

    if str(current_user.id) == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user_label = user.display_name

    # Delete from Cognito
    if settings.cognito_user_pool_id and user.cognito_sub:
        client = boto3.client("cognito-idp", region_name=settings.cognito_region)
        try:
            client.admin_delete_user(
                UserPoolId=settings.cognito_user_pool_id,
                Username=user.email,
            )
            logger.info("Deleted Cognito user for %s", user.email)
        except ClientError as exc:
            error_code = exc.response["Error"]["Code"]
            if error_code == "UserNotFoundException":
                logger.info("Cognito user not found for %s, proceeding with DB delete", user.email)
            else:
                logger.error("Failed to delete Cognito user: %s", exc)
                raise HTTPException(status_code=500, detail="Failed to delete user from auth provider.") from exc

    # Delete from database
    await db.delete(user)

    await log_audit(db, user=current_user, action="delete", entity_type="user",
                    entity_id=user_id, entity_label=user_label)

    await db.commit()


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reset a user's password: generate a new onboard token and send them an email."""
    _require_admin(current_user)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Create a signup request record if one doesn't exist (needed for onboard token FK)
    from app.domain.models import SignupRequest as SR
    sr_result = await db.execute(select(SR).where(SR.email == user.email))
    signup_req = sr_result.scalar_one_or_none()

    if not signup_req:
        signup_req = SR(
            email=user.email,
            first_name=user.display_name.split(" ")[0] if user.display_name else "User",
            last_name=user.display_name.split(" ")[-1] if user.display_name and " " in user.display_name else "",
            status=SignupStatus.APPROVED,
            reviewed_at=datetime.now(timezone.utc),
        )
        db.add(signup_req)
        await db.flush()

    # Generate onboard token
    token = secrets.token_urlsafe(48)
    now = datetime.now(timezone.utc)

    onboard = OnboardToken(
        signup_request_id=signup_req.id,
        email=user.email,
        token=token,
        expires_at=now + timedelta(days=7),
    )
    db.add(onboard)
    await db.flush()

    # Send reset email
    first_name = user.display_name.split(" ")[0] if user.display_name else "there"
    send_onboard_email(user.email, first_name, token)

    await log_audit(db, user=current_user, action="update", entity_type="user",
                    entity_id=user_id, entity_label=user.display_name,
                    details={"action": "password_reset"})

    return {"detail": f"Password reset email sent to {user.email}."}
