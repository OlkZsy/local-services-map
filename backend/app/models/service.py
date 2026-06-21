"""Pydantic schemas for services."""

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
    distance: float | None = None  # meters to the user
    is_open: bool | None = None  # None — no opening hours data


class SearchResponse(BaseModel):
    count: int
    results: list[ServiceOut]
