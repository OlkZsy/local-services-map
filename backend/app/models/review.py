"""Pydantic schemas for place reviews and ratings."""

from datetime import datetime

from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)


class ReviewOut(BaseModel):
    id: str
    username: str
    rating: int
    comment: str | None = None
    created_at: datetime
    is_mine: bool = False


class ReviewSummary(BaseModel):
    osm_id: str
    average: float | None
    count: int
    reviews: list[ReviewOut]
