from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.domain.models import Location
from app.services.geocoding import geocode


async def find_or_create_location(
    db: AsyncSession,
    city: str,
    region: str | None = None,
    country: str | None = None,
) -> Location:
    """Find an existing Location by (city, region, country) or create a new one with geocoding."""
    # Case-insensitive match
    query = select(Location).where(
        func.lower(Location.name) == city.lower(),
    )
    if region:
        query = query.where(func.lower(Location.region) == region.lower())
    else:
        query = query.where(Location.region.is_(None))

    if country:
        query = query.where(func.lower(Location.country) == country.lower())
    else:
        query = query.where(Location.country.is_(None))

    result = await db.execute(query)
    location = result.scalar_one_or_none()

    if location:
        return location

    # Create new location
    coords = await geocode(city, region, country)

    location = Location(
        name=city,
        region=region,
        country=country,
        latitude=coords[0] if coords else None,
        longitude=coords[1] if coords else None,
    )
    db.add(location)
    await db.flush()
    await db.refresh(location)
    return location


def format_place_text(city: str, region: str | None, country: str | None) -> str:
    """Join city, region, country into a display string."""
    return ", ".join(p for p in [city, region, country] if p)
