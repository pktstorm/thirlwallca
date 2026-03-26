"""Audit logging service for tracking user actions."""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import AuditLog, User

logger = logging.getLogger(__name__)


async def log_audit(
    db: AsyncSession,
    *,
    user: User | None = None,
    user_id: Any = None,
    user_name: str | None = None,
    action: str,
    entity_type: str,
    entity_id: Any = None,
    entity_label: str | None = None,
    details: dict | None = None,
) -> None:
    """Record an audit log entry.

    Args:
        db: Database session
        user: The User object performing the action (preferred)
        user_id: User ID if User object not available
        user_name: Display name if User object not available
        action: "create", "update", "delete", "login", "approve", "reject"
        entity_type: "person", "relationship", "story", "media", "user", etc.
        entity_id: ID of the affected entity
        entity_label: Human-readable label (e.g., person's full name)
        details: Optional dict with before/after data or extra context
    """
    resolved_user_id = None
    resolved_user_name = None

    if user:
        resolved_user_id = user.id
        resolved_user_name = user.display_name
    else:
        resolved_user_id = user_id
        resolved_user_name = user_name

    entry = AuditLog(
        user_id=resolved_user_id,
        user_name=resolved_user_name or "System",
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        entity_label=entity_label,
        details=details,
    )
    db.add(entry)
    # Don't flush here — let the caller's transaction handle it
