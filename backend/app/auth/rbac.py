"""Role-based access control dependencies for FastAPI.

Usage in route handlers:

    from app.auth.rbac import require_role
    from app.domain.enums import UserRole

    @router.get("/admin-only")
    async def admin_endpoint(
        current_user: User = Depends(require_role(UserRole.ADMIN)),
    ):
        ...

    @router.get("/editors-and-admins")
    async def editor_endpoint(
        current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.EDITOR)),
    ):
        ...
"""

from fastapi import Depends, HTTPException, status

from app.auth.cognito import get_current_user
from app.domain.enums import UserRole
from app.domain.models import User


def require_role(*roles: UserRole):
    """Return a FastAPI dependency that checks the current user has one of the given roles."""

    async def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return checker
