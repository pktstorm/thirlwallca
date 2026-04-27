import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
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
