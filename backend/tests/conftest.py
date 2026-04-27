import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from httpx import AsyncClient, ASGITransport
from app.domain.models import Base
from uuid import UUID

# Use the same Postgres the project uses locally (Docker Compose).
# aiosqlite / SQLite cannot render Postgres-specific types (UUID, JSONB, TIMESTAMP).
TEST_DATABASE_URL = "postgresql+asyncpg://thirlwall:thirlwall_dev@localhost:5432/thirlwall"

# Fixed UUID so async_client and tests can both reference the same user
TEST_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def db():
    """Per-test async session against the local Docker Compose Postgres DB.

    The engine is created inside the async fixture so it binds to the correct
    event loop. Each test's changes are rolled back at teardown for isolation.
    """
    engine = create_async_engine(TEST_DATABASE_URL, future=True)

    # Ensure all tables exist (idempotent).
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
        await session.rollback()

    await engine.dispose()


@pytest_asyncio.fixture
async def async_client(db):
    """FastAPI async test client with DB and auth dependency overrides.

    Creates the fake_user in the DB using its own engine/session (runs in
    pytest-asyncio's event loop, separate from the anyio-backed db fixture)
    so that audit_log FK constraints are satisfied.
    """
    from app.main import create_app
    from app.deps import get_db
    from app.auth.cognito import get_current_user
    from app.domain.models import User
    from app.domain.enums import UserRole

    app = create_app()

    fake_user = User(
        id=TEST_USER_ID,
        cognito_sub="test-cognito-sub",
        email="test@example.com",
        display_name="Test User",
        role=UserRole.ADMIN,
        is_active=True,
    )

    # Use a separate engine/session in THIS event loop to persist the fake user
    # so that audit_logs FK constraint (user_id -> users.id) is satisfied.
    own_engine = create_async_engine(TEST_DATABASE_URL, future=True)
    OwnSession = async_sessionmaker(own_engine, class_=AsyncSession, expire_on_commit=False)
    async with OwnSession() as own_session:
        from sqlalchemy import select as sa_select
        existing = (await own_session.execute(
            sa_select(User).where(User.id == TEST_USER_ID)
        )).scalar_one_or_none()
        if not existing:
            own_session.add(fake_user)
            await own_session.commit()
        else:
            fake_user = existing
    await own_engine.dispose()

    # Override get_db to yield the test session
    async def override_get_db():
        yield db

    async def override_get_current_user():
        return fake_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    # Clean up the test user row after each test
    cleanup_engine = create_async_engine(TEST_DATABASE_URL, future=True)
    CleanupSession = async_sessionmaker(cleanup_engine, class_=AsyncSession, expire_on_commit=False)
    async with CleanupSession() as cleanup_session:
        from sqlalchemy import delete as sa_delete
        from app.domain.models import AuditLog
        await cleanup_session.execute(sa_delete(AuditLog).where(AuditLog.user_id == TEST_USER_ID))
        existing = (await cleanup_session.execute(
            sa_select(User).where(User.id == TEST_USER_ID)
        )).scalar_one_or_none()
        if existing:
            await cleanup_session.delete(existing)
        await cleanup_session.commit()
    await cleanup_engine.dispose()

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers():
    """Empty headers — auth is bypassed via dependency_overrides in async_client."""
    return {}
