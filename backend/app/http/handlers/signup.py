"""Public signup and onboarding endpoints.

Handles access requests (unauthenticated) and magic-link onboarding
(set password + link to person).
"""

import logging
import secrets
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_db
from app.domain.models import OnboardToken, SignupCode, SignupRequest, User
from app.domain.enums import SignupStatus
from app.http.schemas.signup import (
    OnboardCompleteBody,
    OnboardValidateResponse,
    RequestAccessBody,
)
from app.http.schemas.auth import TokenResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/request-access", status_code=201)
async def request_access(
    body: RequestAccessBody,
    db: AsyncSession = Depends(get_db),
):
    """Submit a signup request. If a valid signup_code is provided, bypass approval."""
    from datetime import timedelta

    # Check if email already has a Cognito/User account
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        return {"detail": "An account with this email already exists. Please sign in."}

    # --- Signup code fast-path: bypass approval entirely ---
    if body.signup_code:
        result = await db.execute(
            select(SignupCode).where(SignupCode.code == body.signup_code)
        )
        code_obj = result.scalar_one_or_none()

        if not code_obj:
            raise HTTPException(status_code=400, detail="Invalid signup code.")
        if not code_obj.is_active:
            raise HTTPException(status_code=400, detail="This signup code is no longer active.")
        if code_obj.expires_at and code_obj.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="This signup code has expired.")
        if code_obj.max_uses and code_obj.use_count >= code_obj.max_uses:
            raise HTTPException(status_code=400, detail="This signup code has reached its maximum uses.")

        # Create Cognito user
        if settings.cognito_user_pool_id:
            client = boto3.client("cognito-idp", region_name=settings.cognito_region)
            try:
                temp_password = secrets.token_urlsafe(16) + "!A1"
                client.admin_create_user(
                    UserPoolId=settings.cognito_user_pool_id,
                    Username=body.email,
                    UserAttributes=[
                        {"Name": "email", "Value": body.email},
                        {"Name": "email_verified", "Value": "true"},
                        {"Name": "name", "Value": f"{body.first_name} {body.last_name}"},
                        {"Name": "custom:role", "Value": code_obj.role},
                    ],
                    TemporaryPassword=temp_password,
                    MessageAction="SUPPRESS",
                )
            except ClientError as exc:
                if exc.response["Error"]["Code"] != "UsernameExistsException":
                    logger.error("Failed to create Cognito user: %s", exc)
                    raise HTTPException(status_code=500, detail="Failed to create account.") from exc

        # Find or create signup request as already approved
        existing_req = await db.execute(
            select(SignupRequest).where(SignupRequest.email == body.email)
        )
        req = existing_req.scalar_one_or_none()
        if req:
            req.status = SignupStatus.APPROVED
            req.first_name = body.first_name
            req.last_name = body.last_name
            req.reviewed_at = datetime.now(timezone.utc)
        else:
            req = SignupRequest(
                email=body.email,
                first_name=body.first_name,
                last_name=body.last_name,
                status=SignupStatus.APPROVED,
                reviewed_at=datetime.now(timezone.utc),
            )
            db.add(req)
        await db.flush()

        # Generate onboard token
        token = secrets.token_urlsafe(48)
        onboard = OnboardToken(
            signup_request_id=req.id,
            email=body.email,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        db.add(onboard)

        # Increment use count
        code_obj.use_count += 1
        await db.flush()

        return {
            "detail": "Code accepted! Set up your password to complete registration.",
            "auto_approved": True,
            "onboard_token": token,
        }

    # --- Normal flow: submit for admin approval ---

    # Check for existing request
    result = await db.execute(
        select(SignupRequest).where(SignupRequest.email == body.email)
    )
    existing = result.scalar_one_or_none()

    if existing:
        if existing.status == SignupStatus.PENDING:
            return {"detail": "Your request is already pending review."}
        if existing.status == SignupStatus.APPROVED:
            return {"detail": "Your request has already been approved. Check your email for the setup link."}
        if existing.status == SignupStatus.REJECTED:
            existing.status = SignupStatus.PENDING
            existing.first_name = body.first_name
            existing.last_name = body.last_name
            existing.reviewed_by = None
            existing.reviewed_at = None
            existing.reject_reason = None
            await db.flush()
            return {"detail": "Your request has been resubmitted for review."}

    req = SignupRequest(
        email=body.email,
        first_name=body.first_name,
        last_name=body.last_name,
    )
    db.add(req)
    await db.flush()

    return {"detail": "Your request has been submitted. You'll receive an email when approved."}


@router.get("/onboard/validate", response_model=OnboardValidateResponse)
async def validate_onboard_token(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Validate an onboard token and return the signup request details."""
    result = await db.execute(
        select(OnboardToken).where(OnboardToken.token == token)
    )
    onboard = result.scalar_one_or_none()

    if not onboard:
        raise HTTPException(status_code=404, detail="Invalid or expired link.")

    now = datetime.now(timezone.utc)
    if onboard.used_at is not None:
        raise HTTPException(status_code=410, detail="This link has already been used.")
    if onboard.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=410, detail="This link has expired.")

    # Get signup request
    result = await db.execute(
        select(SignupRequest).where(SignupRequest.id == onboard.signup_request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Signup request not found.")

    return OnboardValidateResponse(
        email=req.email,
        first_name=req.first_name,
        last_name=req.last_name,
        valid=True,
    )


@router.post("/onboard/complete", response_model=TokenResponse)
async def complete_onboard(
    body: OnboardCompleteBody,
    db: AsyncSession = Depends(get_db),
):
    """Complete onboarding: set password in Cognito and optionally link to a person."""
    # Validate token
    result = await db.execute(
        select(OnboardToken).where(OnboardToken.token == body.token)
    )
    onboard = result.scalar_one_or_none()

    if not onboard:
        raise HTTPException(status_code=404, detail="Invalid or expired link.")

    now = datetime.now(timezone.utc)
    if onboard.used_at is not None:
        raise HTTPException(status_code=410, detail="This link has already been used.")
    if onboard.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=410, detail="This link has expired.")

    email = onboard.email

    # Get signup request for display name
    result = await db.execute(
        select(SignupRequest).where(SignupRequest.id == onboard.signup_request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Signup request not found.")

    # Set the password in Cognito
    if not settings.cognito_user_pool_id:
        logger.info("Dev mode: would set password for %s", email)
        cognito_sub = f"dev-sub-{secrets.token_hex(8)}"
    else:
        client = boto3.client("cognito-idp", region_name=settings.cognito_region)
        try:
            # Set the user's password (permanent)
            client.admin_set_user_password(
                UserPoolId=settings.cognito_user_pool_id,
                Username=email,
                Password=body.password,
                Permanent=True,
            )

            # Get the cognito sub
            user_resp = client.admin_get_user(
                UserPoolId=settings.cognito_user_pool_id,
                Username=email,
            )
            cognito_sub = None
            for attr in user_resp.get("UserAttributes", []):
                if attr["Name"] == "sub":
                    cognito_sub = attr["Value"]
                    break
            if not cognito_sub:
                raise HTTPException(status_code=500, detail="Could not retrieve user identity.")

        except ClientError as exc:
            logger.error("Cognito error during onboard: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to set password.") from exc

    # Create or update the User record in our database
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            cognito_sub=cognito_sub,
            display_name=f"{req.first_name} {req.last_name}",
            linked_person_id=body.linked_person_id,
        )
        db.add(user)
    else:
        user.cognito_sub = cognito_sub
        if body.linked_person_id:
            user.linked_person_id = body.linked_person_id

    # Mark token as used
    onboard.used_at = now
    await db.flush()

    # Log the user in by initiating auth
    if not settings.cognito_user_pool_id:
        return TokenResponse(
            access_token="dev-access-token",
            refresh_token="dev-refresh-token",
            id_token="dev-id-token",
            token_type="bearer",
            expires_in=3600,
        )

    try:
        client = boto3.client("cognito-idp", region_name=settings.cognito_region)
        auth_response = client.initiate_auth(
            ClientId=settings.cognito_client_id,
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={
                "USERNAME": email,
                "PASSWORD": body.password,
            },
        )
        auth_result = auth_response.get("AuthenticationResult", {})
        return TokenResponse(
            access_token=auth_result["AccessToken"],
            refresh_token=auth_result.get("RefreshToken", ""),
            id_token=auth_result.get("IdToken", ""),
            token_type="bearer",
            expires_in=auth_result.get("ExpiresIn", 3600),
        )
    except ClientError as exc:
        logger.error("Cognito login after onboard failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Account created but auto-login failed. Please sign in manually.",
        ) from exc
