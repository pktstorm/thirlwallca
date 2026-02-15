"""Authentication endpoints.

Handles login (email+password), magic link flow, token refresh, and
fetching the current user profile. All Cognito interactions are bypassed
in dev mode (when cognito_user_pool_id is empty).
"""

import logging

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.cognito import get_current_user
from app.config import settings
from app.deps import get_db
from app.domain.models import Person, User
from app.http.schemas.auth import (
    LinkPersonRequest,
    LoginRequest,
    MagicLinkRequest,
    MagicLinkVerifyRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Dev mode helpers
# ---------------------------------------------------------------------------

DEV_ACCESS_TOKEN = "dev-access-token"
DEV_REFRESH_TOKEN = "dev-refresh-token"
DEV_ID_TOKEN = "dev-id-token"


def _is_dev_mode() -> bool:
    return not settings.cognito_user_pool_id


def _dev_token_response() -> TokenResponse:
    return TokenResponse(
        access_token=DEV_ACCESS_TOKEN,
        refresh_token=DEV_REFRESH_TOKEN,
        id_token=DEV_ID_TOKEN,
        token_type="bearer",
        expires_in=3600,
    )


# ---------------------------------------------------------------------------
# Cognito client helper
# ---------------------------------------------------------------------------


def _get_cognito_client():
    """Return a boto3 Cognito Identity Provider client."""
    return boto3.client(
        "cognito-idp",
        region_name=settings.cognito_region,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    """Authenticate with email and password via Cognito USER_PASSWORD_AUTH flow.

    In dev mode, returns fake tokens without hitting Cognito.
    """
    if _is_dev_mode():
        logger.debug("Dev mode: returning mock tokens for login")
        return _dev_token_response()

    client = _get_cognito_client()
    try:
        response = client.initiate_auth(
            ClientId=settings.cognito_client_id,
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={
                "USERNAME": body.email,
                "PASSWORD": body.password,
            },
        )
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        if error_code in ("NotAuthorizedException", "UserNotFoundException"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            ) from exc
        if error_code == "UserNotConfirmedException":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is not confirmed",
            ) from exc
        logger.error("Cognito InitiateAuth error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error",
        ) from exc

    auth_result = response.get("AuthenticationResult", {})
    return TokenResponse(
        access_token=auth_result["AccessToken"],
        refresh_token=auth_result.get("RefreshToken", ""),
        id_token=auth_result.get("IdToken", ""),
        token_type="bearer",
        expires_in=auth_result.get("ExpiresIn", 3600),
    )


@router.post("/magic-link")
async def request_magic_link(body: MagicLinkRequest):
    """Trigger Cognito custom auth challenge to send a magic link email.

    In dev mode, returns success immediately without hitting Cognito.
    """
    if _is_dev_mode():
        logger.debug("Dev mode: returning mock magic link success")
        return {"detail": "Magic link sent (dev mode)", "email": body.email}

    client = _get_cognito_client()
    try:
        response = client.initiate_auth(
            ClientId=settings.cognito_client_id,
            AuthFlow="CUSTOM_AUTH",
            AuthParameters={
                "USERNAME": body.email,
            },
        )
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        if error_code == "UserNotFoundException":
            # Don't reveal whether the user exists
            return {"detail": "If an account exists, a magic link has been sent."}
        logger.error("Cognito CUSTOM_AUTH error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error",
        ) from exc

    # Store the session for the verify step
    session = response.get("Session", "")
    return {
        "detail": "Magic link sent",
        "session": session,
    }


@router.post("/magic-link/verify", response_model=TokenResponse)
async def verify_magic_link(body: MagicLinkVerifyRequest):
    """Complete Cognito custom auth challenge with the code from the magic link.

    In dev mode, returns fake tokens regardless of the code.
    """
    if _is_dev_mode():
        logger.debug("Dev mode: returning mock tokens for magic link verify")
        return _dev_token_response()

    client = _get_cognito_client()
    try:
        response = client.respond_to_auth_challenge(
            ClientId=settings.cognito_client_id,
            ChallengeName="CUSTOM_CHALLENGE",
            ChallengeResponses={
                "USERNAME": body.email,
                "ANSWER": body.code,
            },
        )
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        if error_code in ("CodeMismatchException", "ExpiredCodeException"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired code",
            ) from exc
        logger.error("Cognito RespondToAuthChallenge error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error",
        ) from exc

    auth_result = response.get("AuthenticationResult", {})
    if not auth_result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication challenge not completed",
        )

    return TokenResponse(
        access_token=auth_result["AccessToken"],
        refresh_token=auth_result.get("RefreshToken", ""),
        id_token=auth_result.get("IdToken", ""),
        token_type="bearer",
        expires_in=auth_result.get("ExpiresIn", 3600),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(body: RefreshRequest):
    """Use a refresh token to obtain new access and ID tokens.

    In dev mode, returns the same fake tokens.
    """
    if _is_dev_mode():
        logger.debug("Dev mode: returning mock tokens for refresh")
        return _dev_token_response()

    client = _get_cognito_client()
    try:
        response = client.initiate_auth(
            ClientId=settings.cognito_client_id,
            AuthFlow="REFRESH_TOKEN_AUTH",
            AuthParameters={
                "REFRESH_TOKEN": body.refresh_token,
            },
        )
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        if error_code == "NotAuthorizedException":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token is invalid or expired",
            ) from exc
        logger.error("Cognito REFRESH_TOKEN_AUTH error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error",
        ) from exc

    auth_result = response.get("AuthenticationResult", {})
    return TokenResponse(
        access_token=auth_result["AccessToken"],
        # Cognito does not return a new refresh token on refresh
        refresh_token=body.refresh_token,
        id_token=auth_result.get("IdToken", ""),
        token_type="bearer",
        expires_in=auth_result.get("ExpiresIn", 3600),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserResponse.model_validate(current_user)


@router.put("/me/linked-person", response_model=UserResponse)
async def link_person(
    body: LinkPersonRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link the current user to a person on the family tree."""
    # Verify the person exists
    result = await db.execute(select(Person).where(Person.id == body.person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found",
        )

    # Check no other user is already linked to this person
    result = await db.execute(
        select(User).where(
            User.linked_person_id == body.person_id,
            User.id != current_user.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another user is already linked to this person",
        )

    current_user.linked_person_id = body.person_id
    await db.flush()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.delete("/me/linked-person", response_model=UserResponse)
async def unlink_person(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unlink the current user from their linked person."""
    if current_user.linked_person_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No person linked",
        )

    current_user.linked_person_id = None
    await db.flush()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)
