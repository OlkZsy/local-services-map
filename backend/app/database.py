
import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("The database is not initialized — call init_db()")
    return _db


async def init_db() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
    _db = _client[settings.MONGODB_DB_NAME]
    try:
        await _create_indexes(_db)
        logger.info("MongoDB подключена, индексы созданы")
    except Exception as exc:  
        logger.warning(
            "Couldn't connect to MongoDB (%s). "
            "Check MONGODB_URL in backend/.env — API won't work without DB.",
            exc,
        )


async def close_db() -> None:
    if _client is not None:
        _client.close()


async def _create_indexes(db: AsyncIOMotorDatabase) -> None:
    # users:  email
    await db.users.create_index("email", unique=True)

    
    await db.services_cache.create_index([("location", "2dsphere")])
    await db.services_cache.create_index("category")
    await db.services_cache.create_index("osm_id", unique=True)
    await db.services_cache.create_index("cache_expires_at", expireAfterSeconds=0)

    
    await db.cache_areas.create_index([("category", 1), ("geohash", 1)], unique=True)
    await db.cache_areas.create_index("expires_at", expireAfterSeconds=0)

   
    await db.search_history.create_index([("user_id", 1), ("searched_at", -1)])

   
    await db.favorites.create_index(
        [("user_id", 1), ("service_osm_id", 1)], unique=True
    )

   
    await db.reviews.create_index([("osm_id", 1), ("user_id", 1)], unique=True)
    await db.reviews.create_index([("osm_id", 1), ("created_at", -1)])
