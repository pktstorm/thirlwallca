"""Cognito JWT validation utilities.

In production: validates JWT against Cognito JWKS, extracts user claims,
and looks up/creates the User in the database.

In dev mode (cognito_user_pool_id is empty): accepts any Bearer token
and returns a dev admin user, auto-creating it in the database if needed.
"""

import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_db
from app.domain.enums import UserRole
from app.domain.models import User

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# JWKS cache
# ---------------------------------------------------------------------------

_jwks_cache: dict[str, Any] | None = None


async def _get_jwks() -> dict[str, Any]:
    """Fetch and cache the JWKS from the Cognito user pool."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    jwks_url = (
        f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/"
        f"{settings.cognito_user_pool_id}/.well-known/jwks.json"
    )
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url, timeout=10.0)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


def _get_signing_key(token: str, jwks: dict[str, Any]) -> dict[str, Any]:
    """Find the signing key in the JWKS that matches the token's kid."""
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    if kid is None:
        raise JWTError("Token header missing 'kid'")

    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key

    raise JWTError(f"Unable to find matching key for kid: {kid}")


# ---------------------------------------------------------------------------
# Token decoding
# ---------------------------------------------------------------------------


def _decode_cognito_token(token: str, signing_key: dict[str, Any]) -> dict[str, Any]:
    """Decode and validate a Cognito JWT access token."""
    issuer = (
        f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/"
        f"{settings.cognito_user_pool_id}"
    )
    claims: dict[str, Any] = jwt.decode(
        token,
        signing_key,
        algorithms=["RS256"],
        audience=settings.cognito_client_id,
        issuer=issuer,
        options={
            "verify_aud": True,
            "verify_iss": True,
            "verify_exp": True,
        },
    )
    return claims


# ---------------------------------------------------------------------------
# User lookup / creation helpers
# ---------------------------------------------------------------------------

DEV_COGNITO_SUB = "dev-user"
DEV_EMAIL = "dev@thirlwall.ca"
DEV_DISPLAY_NAME = "Dev User"


async def _get_or_create_dev_user(db: AsyncSession) -> User:
    """Return the dev user, creating it if it does not exist."""
    result = await db.execute(
        select(User).where(User.cognito_sub == DEV_COGNITO_SUB)
    )
    user = result.scalars().first()
    if user is not None:
        return user

    user = User(
        cognito_sub=DEV_COGNITO_SUB,
        email=DEV_EMAIL,
        display_name=DEV_DISPLAY_NAME,
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


async def _get_or_create_user(
    db: AsyncSession,
    cognito_sub: str,
    email: str,
    role_claim: str | None,
    name_claim: str | None = None,
) -> User:
    """Look up a user by cognito_sub, or create one if it doesn't exist."""
    result = await db.execute(
        select(User).where(User.cognito_sub == cognito_sub)
    )
    user = result.scalars().first()

    # Determine role from claim
    try:
        role = UserRole(role_claim) if role_claim else UserRole.VIEWER
    except ValueError:
        role = UserRole.VIEWER

    if user is not None:
        # Update last login
        user.last_login_at = datetime.now(timezone.utc)
        # Sync role from Cognito claim if it changed
        if role_claim and user.role != role:
            user.role = role
        # Sync email from token claims
        if email and user.email != email:
            user.email = email
        await db.flush()
        return user

    # Auto-create user on first login
    display_name = name_claim if name_claim else email.split("@")[0]
    user = User(
        cognito_sub=cognito_sub,
        email=email,
        display_name=display_name,
        role=role,
        is_active=True,
        last_login_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()
    return user


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


def _is_dev_mode() -> bool:
    """Dev mode is active when no Cognito user pool is configured."""
    return not settings.cognito_user_pool_id


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency that validates the JWT and returns the current User.

    In dev mode (no cognito_user_pool_id configured), any Bearer token is
    accepted and a dev admin user is returned.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # ---- Dev mode: skip real JWT validation ----
    if _is_dev_mode():
        logger.debug("Dev mode: bypassing JWT validation")
        return await _get_or_create_dev_user(db)

    # ---- Production: validate against Cognito JWKS ----
    try:
        jwks = await _get_jwks()
        signing_key = _get_signing_key(token, jwks)
        claims = _decode_cognito_token(token, signing_key)
    except (JWTError, httpx.HTTPError, KeyError) as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    cognito_sub: str | None = claims.get("sub")
    email: str | None = claims.get("email")
    role_claim: str | None = claims.get("custom:role")
    name_claim: str | None = claims.get("name")

    if not cognito_sub or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required claims (sub, email)",
        )

    user = await _get_or_create_user(db, cognito_sub, email, role_claim, name_claim)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return user
