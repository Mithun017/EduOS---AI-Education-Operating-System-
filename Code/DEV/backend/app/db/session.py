import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
from app.db.models import Base

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    try:
        async with engine.begin() as conn:
            if engine.dialect.name == "postgresql":
                try:
                    from sqlalchemy import text
                    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                except Exception as e:
                    logger.warning(f"Vector extension notice: {e}")
            await conn.run_sync(Base.metadata.create_all)
        
        # Seed default institution/users/topics if database is empty
        from app.db.seed import seed_data
        await seed_data()
    except Exception as e:
        logger.error(f"Error during DB initialization: {e}")
