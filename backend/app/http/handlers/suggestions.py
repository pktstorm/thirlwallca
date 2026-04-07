"""Smart person suggestions for duplicate detection when adding new family members."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.domain.models import Person

router = APIRouter()


class PersonSuggestion(BaseModel):
    id: str
    first_name: str
    last_name: str
    birth_date: str | None
    death_date: str | None
    is_living: bool
    gender: str
    profile_photo_url: str | None
    match_reason: str  # e.g., "Same last name, similar birth year"

    model_config = {"from_attributes": True}


@router.get("/suggestions", response_model=list[PersonSuggestion])
async def get_person_suggestions(
    first_name: str = Query("", min_length=0),
    last_name: str = Query("", min_length=0),
    birth_year: int | None = Query(None),
    exclude_id: str | None = Query(None),
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Find existing persons that might match a new person being added.

    Uses fuzzy matching on names and optional birth year proximity.
    Returns potential duplicates with match reasons.
    """
    if not first_name.strip() and not last_name.strip():
        return []

    conditions = []
    first = first_name.strip()
    last = last_name.strip()

    # Name matching: prefix match on first and/or last name
    if first and last:
        conditions.append(
            (Person.first_name.ilike(f"{first}%")) & (Person.last_name.ilike(f"{last}%"))
        )
        conditions.append(
            (Person.preferred_name.ilike(f"{first}%")) & (Person.last_name.ilike(f"{last}%"))
        )
        conditions.append(
            (Person.first_name.ilike(f"{first}%")) & (Person.maiden_name.ilike(f"{last}%"))
        )
    elif last:
        conditions.append(Person.last_name.ilike(f"{last}%"))
        conditions.append(Person.maiden_name.ilike(f"{last}%"))
    elif first:
        conditions.append(Person.first_name.ilike(f"{first}%"))
        conditions.append(Person.preferred_name.ilike(f"{first}%"))

    if not conditions:
        return []

    stmt = select(Person).where(or_(*conditions))

    if exclude_id:
        stmt = stmt.where(Person.id != exclude_id)

    # If birth year provided, prioritize matches within +/- 10 years
    # but don't exclude others
    stmt = stmt.limit(limit * 3)  # overfetch to allow scoring

    result = await db.execute(stmt)
    candidates = result.scalars().all()

    # Score and rank candidates
    suggestions = []
    for p in candidates:
        reasons = []
        score = 0

        # Name matching
        p_first = (p.first_name or "").lower()
        p_last = (p.last_name or "").lower()
        p_maiden = (p.maiden_name or "").lower()

        if first and p_first.startswith(first.lower()):
            if p_first == first.lower():
                score += 10
                reasons.append("Exact first name match")
            else:
                score += 5
                reasons.append("Similar first name")

        if last and p_last.startswith(last.lower()):
            if p_last == last.lower():
                score += 10
                reasons.append("Same last name")
            else:
                score += 5
                reasons.append("Similar last name")
        elif last and p_maiden and p_maiden.startswith(last.lower()):
            score += 8
            reasons.append("Matches maiden name")

        # Birth year proximity
        if birth_year and p.birth_date:
            try:
                p_year = p.birth_date.year
                diff = abs(p_year - birth_year)
                if diff == 0:
                    score += 15
                    reasons.append("Same birth year")
                elif diff <= 2:
                    score += 10
                    reasons.append(f"Birth year within {diff} year{'s' if diff > 1 else ''}")
                elif diff <= 5:
                    score += 5
                    reasons.append(f"Birth year within {diff} years")
                elif diff <= 10:
                    score += 2
            except AttributeError:
                pass

        if score > 0:
            suggestions.append({
                "person": p,
                "score": score,
                "reason": ". ".join(reasons) if reasons else "Possible match",
            })

    # Sort by score descending
    suggestions.sort(key=lambda x: x["score"], reverse=True)

    return [
        PersonSuggestion(
            id=str(s["person"].id),
            first_name=s["person"].first_name,
            last_name=s["person"].last_name,
            birth_date=str(s["person"].birth_date) if s["person"].birth_date else None,
            death_date=str(s["person"].death_date) if s["person"].death_date else None,
            is_living=s["person"].is_living,
            gender=s["person"].gender.value if hasattr(s["person"].gender, "value") else str(s["person"].gender),
            profile_photo_url=s["person"].profile_photo_url,
            match_reason=s["reason"],
        )
        for s in suggestions[:limit]
    ]
