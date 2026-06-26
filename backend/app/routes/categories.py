""" /api/categories."""

from fastapi import APIRouter

router = APIRouter()

CATEGORIES: list[dict] = [
    {"key": "pharmacy",    "osm_key": "amenity", "osm_value": "pharmacy",    "icon": "💊", "names": {"pl": "Apteka",          "en": "Pharmacy"}},
    {"key": "hospital",    "osm_key": "amenity", "osm_value": "hospital",    "icon": "🏥", "names": {"pl": "Szpital",         "en": "Hospital"}},
    {"key": "clinic",      "osm_key": "amenity", "osm_value": "clinic",      "icon": "🩺", "names": {"pl": "Przychodnia",     "en": "Clinic"}},
    {"key": "supermarket", "osm_key": "shop",    "osm_value": "supermarket", "icon": "🛒", "names": {"pl": "Supermarket",     "en": "Supermarket"}},
    {"key": "convenience", "osm_key": "shop",    "osm_value": "convenience", "icon": "🏪", "names": {"pl": "Sklep spożywczy", "en": "Convenience store"}},
    {"key": "restaurant",  "osm_key": "amenity", "osm_value": "restaurant",  "icon": "🍽️", "names": {"pl": "Restauracja",     "en": "Restaurant"}},
    {"key": "cafe",        "osm_key": "amenity", "osm_value": "cafe",        "icon": "☕", "names": {"pl": "Kawiarnia",       "en": "Cafe"}},
    {"key": "fast_food",   "osm_key": "amenity", "osm_value": "fast_food",   "icon": "🍔", "names": {"pl": "Fast food",       "en": "Fast food"}},
    {"key": "bank",        "osm_key": "amenity", "osm_value": "bank",        "icon": "🏦", "names": {"pl": "Bank",            "en": "Bank"}},
    {"key": "atm",         "osm_key": "amenity", "osm_value": "atm",         "icon": "💳", "names": {"pl": "Bankomat",        "en": "ATM"}},
    {"key": "fuel",        "osm_key": "amenity", "osm_value": "fuel",        "icon": "⛽", "names": {"pl": "Stacja paliw",    "en": "Fuel station"}},
    {"key": "dentist",     "osm_key": "amenity", "osm_value": "dentist",     "icon": "🦷", "names": {"pl": "Dentysta",        "en": "Dentist"}},
    {"key": "post_office", "osm_key": "amenity", "osm_value": "post_office", "icon": "📮", "names": {"pl": "Poczta",          "en": "Post office"}},
]


def get_category(key: str) -> dict | None:
    return next((c for c in CATEGORIES if c["key"] == key), None)


@router.get("")
async def list_categories() -> dict:
    return {
        "categories": [
            {"key": c["key"], "icon": c["icon"], "names": c["names"]}
            for c in CATEGORIES
        ]
    }
