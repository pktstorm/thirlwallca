import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from httpx import AsyncClient, ASGITransport
from app.domain.models import Base


# Use the same Postgres the project uses locally (Docker Compose).
# aiosqlite / SQLite cannot render Postgres-specific types (UUID, JSONB, TIMESTAMP).
TEST_DATABASE_URL = "postgresql+asyncpg://thirlwall:thirlwall_dev@localhost:5432/thirlwall"


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
    """FastAPI async test client with DB and auth dependency overrides."""
    from app.main import create_app
    from app.deps import get_db
    from app.auth.cognito import get_current_user
    from app.domain.models import User
    from app.domain.enums import UserRole
    from uuid import uuid4

    app = create_app()

    # Override get_db to yield the test session
    async def override_get_db():
        yield db

    # Override get_current_user to return a fake admin user
    fake_user = User(
        id=uuid4(),
        cognito_sub="test-cognito-sub",
        email="test@example.com",
        display_name="Test User",
        role=UserRole.ADMIN,
        is_active=True,
    )

    async def override_get_current_user():
        return fake_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers():
    """Empty headers — auth is bypassed via dependency_overrides in async_client."""
    return {}
