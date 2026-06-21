"""Pydantic schemas for search history and favorites."""

from datetime import datetime

from pydantic import BaseModel, Field


class HistoryItem(BaseModel):
    id: str
    query: str
    category: str
    lat: float
    lng: float
    radius: int
    results_count: int
    searched_at: datetime


class FavoriteCreate(BaseModel):
    osm_id: str
    note: str | None = Field(default=None, max_length=300)


class FavoriteOut(BaseModel):
    service_osm_id: str
    service_name: str
    service_category: str
    lat: float
    lng: float
    note: str | None = None
    saved_at: datetime
