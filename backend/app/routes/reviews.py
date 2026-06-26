""" /api/reviews/*"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..database import get_db
from ..models.review import ReviewCreate, ReviewOut, ReviewSummary
from ..services.auth_service import get_current_user, get_current_user_optional

router = APIRouter()


def _to_review_out(doc: dict, current_user_id: ObjectId | None) -> ReviewOut:
    return ReviewOut(
        id=str(doc["_id"]),
        username=doc["username"],
        rating=doc["rating"],
        comment=doc.get("comment"),
        created_at=doc["created_at"],
        is_mine=current_user_id is not None and doc["user_id"] == current_user_id,
    )


@router.get("/{osm_id}", response_model=ReviewSummary)
async def list_reviews(osm_id: str, user: dict | None = Depends(get_current_user_optional)):
    cursor = get_db().reviews.find({"osm_id": osm_id}).sort("created_at", -1).limit(200)
    docs = await cursor.to_list(length=200)
    current_id = user["_id"] if user else None
    reviews = [_to_review_out(doc, current_id) for doc in docs]
    average = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else None
    return ReviewSummary(osm_id=osm_id, average=average, count=len(reviews), reviews=reviews)


@router.post("/{osm_id}", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def add_review(osm_id: str, data: ReviewCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    await db.reviews.update_one(
        {"osm_id": osm_id, "user_id": user["_id"]},
        {
            "$set": {
                "osm_id": osm_id,
                "user_id": user["_id"],
                "username": user["username"],
                "rating": data.rating,
                "comment": data.comment,
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    stored = await db.reviews.find_one({"osm_id": osm_id, "user_id": user["_id"]})
    return _to_review_out(stored, user["_id"])


@router.delete("/{osm_id}")
async def delete_review(osm_id: str, user: dict = Depends(get_current_user)):
    result = await get_db().reviews.delete_one({"osm_id": osm_id, "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Review not found"
        )
    return {"message": "Review deleted"}
