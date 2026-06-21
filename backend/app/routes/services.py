"""Service search routes: /api/services/*"""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..database import get_db
from ..models.service import SearchResponse, ServiceOut
from ..services import cache, geocoding
from ..services.auth_service import get_current_user_optional
from ..services.opening_hours import is_open_now
from .categories import get_category

router = APIRouter()

# status ranking for the "by opening hours" sort: open -> no data -> closed
_STATUS_RANK = {True: 0, None: 1, False: 2}


def _to_service_out(doc: dict) -> ServiceOut:
    lng, lat = doc["location"]["coordinates"]
    return ServiceOut(
        osm_id=doc["osm_id"],
        name=doc["name"],
        category=doc["category"],
        address=doc.get("address") or {},
        lat=lat,
        lng=lng,
        opening_hours=doc.get("opening_hours"),
        phone=doc.get("phone"),
        website=doc.get("website"),
        distance=round(doc["distance"], 1) if doc.get("distance") is not None else None,
        is_open=is_open_now(doc.get("opening_hours")),
    )


@router.get("/search", response_model=SearchResponse)
async def search_services(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius: int = Query(1000, ge=500, le=5000, description="Search radius, meters"),
    category: str = Query(..., description="Category key, e.g. pharmacy"),
    sort: Literal["distance", "opening_hours"] = "distance",
    user: dict | None = Depends(get_current_user_optional),
):
    category_def = get_category(category)
    if category_def is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown category: {category}",
        )

    db = get_db()
    docs = await cache.search_services(db, category_def, lat, lng, radius)
    results = [_to_service_out(doc) for doc in docs]

    if sort == "opening_hours":
        results.sort(key=lambda s: (_STATUS_RANK[s.is_open], s.distance or 0))
    # sort == "distance": $geoNear already returned results in ascending distance order

    if user is not None:
        await db.search_history.insert_one(
            {
                "user_id": user["_id"],
                "query": category_def["names"]["pl"],
                "category": category,
                "location": {"type": "Point", "coordinates": [lng, lat]},
                "radius": radius,
                "results_count": len(results),
                "searched_at": datetime.now(timezone.utc),
            }
        )

    return SearchResponse(count=len(results), results=results)


@router.get("/geocode")
async def geocode_address(q: str = Query(..., min_length=2, max_length=200)):
    """Geocode an address via Nominatim (address -> coordinates)."""
    try:
        return {"results": await geocoding.geocode(q)}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Geocoding service is unavailable",
        ) from exc


@router.get("/{osm_id}", response_model=ServiceOut)
async def get_service(osm_id: str):
    doc = await get_db().services_cache.find_one({"osm_id": osm_id})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Service not found"
        )
    return _to_service_out(doc)
