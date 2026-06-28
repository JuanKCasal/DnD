import asyncpg
import ssl
import logging
from api.config import Settings

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def init_pool(settings: Settings) -> None:
    global _pool
    try:
        ssl_ctx = ssl.create_default_context(cafile=settings.AIVEN_CA_CERT)
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_REQUIRED
        _pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL,
            ssl=ssl_ctx,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        logger.info("PostgreSQL pool initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize PostgreSQL pool: {e}")
        _pool = None


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL pool closed")


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise ConnectionError("PostgreSQL pool not initialized")
    return _pool
