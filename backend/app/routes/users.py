"""User routes: /api/users/* (all require JWT)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from ..database import get_db
from ..models.search import FavoriteCreate, FavoriteOut, HistoryItem
from ..models.user import UserSettings, UserSettingsUpdate
from ..services.auth_service import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/history")
async def get_history(user: dict = Depends(get_current_user)):
    cursor = (
        get_db()
        .search_history.find({"user_id": user["_id"]})
        .sort("searched_at", -1)
        .limit(50)
    )
    items = []
    async for doc in cursor:
        lng, lat = doc["location"]["coordinates"]
        items.append(
            HistoryItem(
                id=str(doc["_id"]),
                query=doc["query"],
                category=doc["category"],
                lat=lat,
                lng=lng,
                radius=doc["radius"],
                results_count=doc["results_count"],
                searched_at=doc["searched_at"],
            )
        )
    return {"history": items}


@router.delete("/history")
async def clear_history(user: dict = Depends(get_current_user)):
    result = await get_db().search_history.delete_many({"user_id": user["_id"]})
    return {"deleted": result.deleted_count}


def _to_favorite_out(doc: dict) -> FavoriteOut:
    lng, lat = doc["service_location"]["coordinates"]
    return FavoriteOut(
        service_osm_id=doc["service_osm_id"],
        service_name=doc["service_name"],
        service_category=doc["service_category"],
        lat=lat,
        lng=lng,
        note=doc.get("note"),
        saved_at=doc["saved_at"],
    )


@router.get("/favorites")
async def get_favorites(user: dict = Depends(get_current_user)):
    cursor = get_db().favorites.find({"user_id": user["_id"]}).sort("saved_at", -1)
    return {"favorites": [_to_favorite_out(doc) async for doc in cursor]}


@router.post("/favorites", response_model=FavoriteOut, status_code=status.HTTP_201_CREATED)
async def add_favorite(data: FavoriteCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    service = await db.services_cache.find_one({"osm_id": data.osm_id})
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found in the cache — run a search first",
        )

    favorite = {
        "user_id": user["_id"],
        "service_osm_id": service["osm_id"],
        "service_name": service["name"],
        "service_category": service["category"],
        "service_location": service["location"],
        "note": data.note,
        "saved_at": datetime.now(timezone.utc),
    }
    # upsert: re-adding does not create a duplicate (unique index on user_id+osm_id)
    await db.favorites.update_one(
        {"user_id": user["_id"], "service_osm_id": service["osm_id"]},
        {"$set": favorite},
        upsert=True,
    )
    return _to_favorite_out(favorite)


@router.delete("/favorites/{osm_id}")
async def remove_favorite(osm_id: str, user: dict = Depends(get_current_user)):
    result = await get_db().favorites.delete_one(
        {"user_id": user["_id"], "service_osm_id": osm_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No such favorite"
        )
    return {"message": "Removed from favorites"}


@router.patch("/settings", response_model=UserSettings)
async def update_settings(
    data: UserSettingsUpdate, user: dict = Depends(get_current_user)
):
    updates = {
        f"settings.{field}": value
        for field, value in data.model_dump(exclude_none=True).items()
    }
    if updates:
        await get_db().users.update_one({"_id": user["_id"]}, {"$set": updates})

    merged = {**user.get("settings", {}), **data.model_dump(exclude_none=True)}
    return UserSettings(**merged)
