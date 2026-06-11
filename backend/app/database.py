"""Подключение к MongoDB (Motor) и создание индексов."""

import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("База данных не инициализирована — вызовите init_db()")
    return _db


async def init_db() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
    _db = _client[settings.MONGODB_DB_NAME]
    try:
        await _create_indexes(_db)
        logger.info("MongoDB подключена, индексы созданы")
    except Exception as exc:  # noqa: BLE001 — сервер должен подняться и без БД
        logger.warning(
            "Не удалось подключиться к MongoDB (%s). "
            "Проверьте MONGODB_URL в backend/.env — без БД API работать не будет.",
            exc,
        )


async def close_db() -> None:
    if _client is not None:
        _client.close()


async def _create_indexes(db: AsyncIOMotorDatabase) -> None:
    # users: уникальный email
    await db.users.create_index("email", unique=True)

    # services_cache: геопоиск, фильтрация по категории, TTL-автоудаление
    await db.services_cache.create_index([("location", "2dsphere")])
    await db.services_cache.create_index("category")
    await db.services_cache.create_index("osm_id", unique=True)
    await db.services_cache.create_index("cache_expires_at", expireAfterSeconds=0)

    # cache_areas: какие области (category + geohash) уже загружены из Overpass
    await db.cache_areas.create_index([("category", 1), ("geohash", 1)], unique=True)
    await db.cache_areas.create_index("expires_at", expireAfterSeconds=0)

    # search_history: сортировка истории пользователя
    await db.search_history.create_index([("user_id", 1), ("searched_at", -1)])

    # favorites: без дублей
    await db.favorites.create_index(
        [("user_id", 1), ("service_osm_id", 1)], unique=True
    )
