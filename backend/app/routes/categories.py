"""Категории заведений (раздел 7 спецификации) и эндпоинт /api/categories."""

from fastapi import APIRouter

router = APIRouter()

CATEGORIES: list[dict] = [
    {"key": "pharmacy",    "osm_key": "amenity", "osm_value": "pharmacy",    "icon": "💊", "names": {"pl": "Apteka",          "ru": "Аптека",            "en": "Pharmacy"}},
    {"key": "hospital",    "osm_key": "amenity", "osm_value": "hospital",    "icon": "🏥", "names": {"pl": "Szpital",         "ru": "Больница",          "en": "Hospital"}},
    {"key": "clinic",      "osm_key": "amenity", "osm_value": "clinic",      "icon": "🩺", "names": {"pl": "Przychodnia",     "ru": "Поликлиника",       "en": "Clinic"}},
    {"key": "supermarket", "osm_key": "shop",    "osm_value": "supermarket", "icon": "🛒", "names": {"pl": "Supermarket",     "ru": "Супермаркет",       "en": "Supermarket"}},
    {"key": "convenience", "osm_key": "shop",    "osm_value": "convenience", "icon": "🏪", "names": {"pl": "Sklep spożywczy", "ru": "Продуктовый магазин", "en": "Convenience store"}},
    {"key": "restaurant",  "osm_key": "amenity", "osm_value": "restaurant",  "icon": "🍽️", "names": {"pl": "Restauracja",     "ru": "Ресторан",          "en": "Restaurant"}},
    {"key": "cafe",        "osm_key": "amenity", "osm_value": "cafe",        "icon": "☕", "names": {"pl": "Kawiarnia",       "ru": "Кафе",              "en": "Cafe"}},
    {"key": "fast_food",   "osm_key": "amenity", "osm_value": "fast_food",   "icon": "🍔", "names": {"pl": "Fast food",       "ru": "Фастфуд",           "en": "Fast food"}},
    {"key": "bank",        "osm_key": "amenity", "osm_value": "bank",        "icon": "🏦", "names": {"pl": "Bank",            "ru": "Банк",              "en": "Bank"}},
    {"key": "atm",         "osm_key": "amenity", "osm_value": "atm",         "icon": "💳", "names": {"pl": "Bankomat",        "ru": "Банкомат",          "en": "ATM"}},
    {"key": "fuel",        "osm_key": "amenity", "osm_value": "fuel",        "icon": "⛽", "names": {"pl": "Stacja paliw",    "ru": "АЗС",               "en": "Fuel station"}},
    {"key": "dentist",     "osm_key": "amenity", "osm_value": "dentist",     "icon": "🦷", "names": {"pl": "Dentysta",        "ru": "Стоматолог",        "en": "Dentist"}},
    {"key": "post_office", "osm_key": "amenity", "osm_value": "post_office", "icon": "📮", "names": {"pl": "Poczta",          "ru": "Почта",             "en": "Post office"}},
]


def get_category(key: str) -> dict | None:
    return next((c for c in CATEGORIES if c["key"] == key), None)


@router.get("")
async def list_categories() -> dict:
    """Список категорий с иконками и названиями (PL/RU/EN)."""
    return {
        "categories": [
            {"key": c["key"], "icon": c["icon"], "names": c["names"]}
            for c in CATEGORIES
        ]
    }
