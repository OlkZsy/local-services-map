"""Pydantic-схемы заведений."""

from pydantic import BaseModel


class Address(BaseModel):
    street: str | None = None
    city: str | None = None
    postcode: str | None = None


class ServiceOut(BaseModel):
    osm_id: str
    name: str
    category: str
    address: Address = Address()
    lat: float
    lng: float
    opening_hours: str | None = None
    phone: str | None = None
    website: str | None = None
    distance: float | None = None  # метры до пользователя
    is_open: bool | None = None  # None — нет данных о часах работы


class SearchResponse(BaseModel):
    count: int
    results: list[ServiceOut]
