import asyncio, asyncpg, ssl
from settings import settings

async def main():
    # Build a DSN WITHOUT query params; we pass SSL via ssl=...
    dsn = str(settings.DATABASE_URL).replace("postgresql+asyncpg://", "postgres://")
    ctx = ssl.create_default_context()
    conn = await asyncpg.connect(dsn, ssl=ctx)
    print("✅ Connected OK")
    await conn.close()

asyncio.run(main())
