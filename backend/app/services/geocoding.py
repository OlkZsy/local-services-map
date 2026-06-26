
import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "local-services-map/1.0 (educational diploma project)"


async def geocode(query: str, limit: int = 5) -> list[dict]:
    params = {
        "q": query,
        "format": "json",
        "limit": limit,
        "countrycodes": "pl",
        "accept-language": "pl",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            NOMINATIM_URL, params=params, headers={"User-Agent": USER_AGENT}
        )
        response.raise_for_status()

    return [
        {
            "name": item["display_name"],
            "lat": float(item["lat"]),
            "lng": float(item["lon"]),
        }
        for item in response.json()
    ]
