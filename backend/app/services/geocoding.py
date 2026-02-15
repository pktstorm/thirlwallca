import httpx
import logging

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "ThirlwallCaAncestry/1.0"
TIMEOUT = 10.0


async def geocode(city: str, region: str | None = None, country: str | None = None) -> tuple[float, float] | None:
    """Geocode a place using OpenStreetMap Nominatim. Returns (lat, lon) or None."""
    parts = [p for p in [city, region, country] if p]
    if not parts:
        return None

    query = ", ".join(parts)

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={"q": query, "format": "json", "limit": 1},
                headers={"User-Agent": USER_AGENT},
            )
            resp.raise_for_status()
            results = resp.json()

        if results and len(results) > 0:
            lat = float(results[0]["lat"])
            lon = float(results[0]["lon"])
            logger.info("Geocoded '%s' -> (%f, %f)", query, lat, lon)
            return (lat, lon)

        logger.warning("No geocoding results for '%s'", query)
        return None
    except Exception as e:
        logger.error("Geocoding failed for '%s': %s", query, e)
        return None
