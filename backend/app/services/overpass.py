"""Запросы к Overpass API (OpenStreetMap) — источник данных о заведениях."""

import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "local-services-map/1.0 (educational diploma project)"


async def fetch_services(
    category: dict, lat: float, lng: float, radius_m: int
) -> list[dict]:
    """Загружает заведения категории в радиусе radius_m метров от точки."""
    osm_key, osm_value = category["osm_key"], category["osm_value"]
    query = f"""
[out:json][timeout:25];
(
  node["{osm_key}"="{osm_value}"](around:{radius_m},{lat},{lng});
  way["{osm_key}"="{osm_value}"](around:{radius_m},{lat},{lng});
);
out center tags;
"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            OVERPASS_URL, data={"data": query}, headers={"User-Agent": USER_AGENT}
        )
        response.raise_for_status()

    elements = response.json().get("elements", [])
    services = []
    for element in elements:
        service = _parse_element(element, category)
        if service is not None:
            services.append(service)
    return services


def _parse_element(element: dict, category: dict) -> dict | None:
    # node имеет lat/lon напрямую, way/relation — в поле center (out center)
    if "lat" in element:
        lat, lng = element["lat"], element["lon"]
    elif "center" in element:
        lat, lng = element["center"]["lat"], element["center"]["lon"]
    else:
        return None

    tags = element.get("tags", {})
    name = tags.get("name") or tags.get("brand") or tags.get("operator")
    if not name:
        return None  # безымянные объекты бесполезны в списке результатов

    street = tags.get("addr:street")
    housenumber = tags.get("addr:housenumber")
    if street and housenumber:
        street = f"{street} {housenumber}"

    return {
        "osm_id": f"{element['type']}-{element['id']}",
        "name": name,
        "category": category["key"],
        "address": {
            "street": street,
            "city": tags.get("addr:city"),
            "postcode": tags.get("addr:postcode"),
        },
        "location": {"type": "Point", "coordinates": [lng, lat]},
        "opening_hours": tags.get("opening_hours"),
        "phone": tags.get("phone") or tags.get("contact:phone"),
        "website": tags.get("website") or tags.get("contact:website"),
    }
