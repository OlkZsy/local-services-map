"""Caching of Overpass data in MongoDB.

A cache area is identified by the pair "category + cell geohash". On a miss,
data is fetched from Overpass within COVER_RADIUS_M around the cell center
(with headroom for the maximum search radius), upserted by osm_id and kept
until the TTL expires. If Overpass is unavailable, the existing cache is served.
"""

import logging
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..config import settings
from . import overpass
from .geohash import decode_center, encode

logger = logging.getLogger(__name__)

GEOHASH_PRECISION = 5
# half of the cell diagonal (~3.5 km) + the maximum search radius (5 km)
COVER_RADIUS_M = 8500


async def search_services(
    db: AsyncIOMotorDatabase, category: dict, lat: float, lng: float, radius: int
) -> list[dict]:
    """Returns services of the category within the radius, sorted by distance."""
    now = datetime.now(timezone.utc)
    geohash = encode(lat, lng, GEOHASH_PRECISION)

    area = await db.cache_areas.find_one(
        {"category": category["key"], "geohash": geohash, "expires_at": {"$gt": now}}
    )
    if area is None:
        await _refresh_area(db, category, geohash, now)

    pipeline = [
        {
            "$geoNear": {
                "near": {"type": "Point", "coordinates": [lng, lat]},
                "distanceField": "distance",
                "maxDistance": float(radius),
                "query": {"category": category["key"]},
                "spherical": True,
            }
        },
        {"$limit": 500},
        {"$project": {"_id": 0, "cached_at": 0, "cache_expires_at": 0}},
    ]
    return await db.services_cache.aggregate(pipeline).to_list(length=500)


async def _refresh_area(
    db: AsyncIOMotorDatabase, category: dict, geohash: str, now: datetime
) -> None:
    center_lat, center_lng = decode_center(geohash)
    try:
        services = await overpass.fetch_services(
            category, center_lat, center_lng, COVER_RADIUS_M
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Overpass API is unavailable (%s) — serving data from the existing cache", exc
        )
        return

    expires = now + timedelta(days=settings.CACHE_TTL_DAYS)
    for service in services:
        service["cached_at"] = now
        service["cache_expires_at"] = expires
        await db.services_cache.update_one(
            {"osm_id": service["osm_id"]}, {"$set": service}, upsert=True
        )

    await db.cache_areas.update_one(
        {"category": category["key"], "geohash": geohash},
        {"$set": {"fetched_at": now, "expires_at": expires, "count": len(services)}},
        upsert=True,
    )
    logger.info(
        "Cache refreshed: %s/%s — %d services", category["key"], geohash, len(services)
    )
