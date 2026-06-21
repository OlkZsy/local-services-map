"""MongoDB connection (Motor) and index creation."""

import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database is not initialized — call init_db()")
    return _db


async def init_db() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
    _db = _client[settings.MONGODB_DB_NAME]
    try:
        await _create_indexes(_db)
        logger.info("MongoDB connected, indexes created")
    except Exception as exc:  # noqa: BLE001 — the server should start even without a DB
        logger.warning(
            "Could not connect to MongoDB (%s). "
            "Check MONGODB_URL in backend/.env — the API won't work without a database.",
            exc,
        )


async def close_db() -> None:
    if _client is not None:
        _client.close()


async def _create_indexes(db: AsyncIOMotorDatabase) -> None:
    # users: unique email
    await db.users.create_index("email", unique=True)

    # services_cache: geo search, filtering by category, TTL auto-removal
    await db.services_cache.create_index([("location", "2dsphere")])
    await db.services_cache.create_index("category")
    await db.services_cache.create_index("osm_id", unique=True)
    await db.services_cache.create_index("cache_expires_at", expireAfterSeconds=0)

    # cache_areas: which areas (category + geohash) have already been fetched from Overpass
    await db.cache_areas.create_index([("category", 1), ("geohash", 1)], unique=True)
    await db.cache_areas.create_index("expires_at", expireAfterSeconds=0)

    # search_history: ordering of a user's history
    await db.search_history.create_index([("user_id", 1), ("searched_at", -1)])

    # favorites: no duplicates
    await db.favorites.create_index(
        [("user_id", 1), ("service_osm_id", 1)], unique=True
    )

    # reviews: one review per user and place, lookups by place
    await db.reviews.create_index([("osm_id", 1), ("user_id", 1)], unique=True)
    await db.reviews.create_index([("osm_id", 1), ("created_at", -1)])
