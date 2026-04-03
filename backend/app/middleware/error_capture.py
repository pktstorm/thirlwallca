"""Middleware that captures unhandled exceptions and logs them to the error_logs table."""

import logging
import traceback as tb_module
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.deps import async_session_factory
from app.domain.models import ErrorLog

logger = logging.getLogger(__name__)


class ErrorCaptureMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            # Capture the error details
            error_type = type(exc).__name__
            error_message = str(exc)
            traceback_str = tb_module.format_exc()

            # Extract request info
            method = request.method
            path = str(request.url.path)
            query = str(request.url.query)
            if query:
                path = f"{path}?{query}"
            user_agent = request.headers.get("user-agent", "")[:512]
            ip_address = request.client.host if request.client else None

            # Try to read request body (may already be consumed)
            request_body = None
            try:
                body = await request.body()
                if body:
                    request_body = body.decode("utf-8", errors="replace")[:2000]
            except Exception:
                pass

            # Log to database
            try:
                async with async_session_factory() as db:
                    error_log = ErrorLog(
                        method=method[:8],
                        path=path[:512],
                        status_code=500,
                        error_type=error_type[:255],
                        error_message=error_message[:5000],
                        traceback=traceback_str[:10000] if traceback_str else None,
                        user_agent=user_agent,
                        ip_address=ip_address,
                        request_body=request_body,
                    )
                    db.add(error_log)
                    await db.commit()
            except Exception as db_exc:
                logger.error("Failed to log error to database: %s", db_exc)

            # Also log to stdout for journalctl
            logger.error("Unhandled %s on %s %s: %s", error_type, method, path, error_message)

            # Return 500 response
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )
