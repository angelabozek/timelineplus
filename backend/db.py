import ssl
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from settings import settings

# 🚨 Temporary development SSL context (disables cert verification)
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

# Create async SQLAlchemy engine with asyncpg
engine = create_async_engine(
    str(settings.DATABASE_URL),      # postgresql+asyncpg://...
    echo=False,
    pool_pre_ping=True,
    connect_args={"ssl": ssl_ctx},   # 👈 pass the SSL context here
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
Base = declarative_base()

async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session