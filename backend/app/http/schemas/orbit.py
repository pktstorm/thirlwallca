from __future__ import annotations
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field


class OrbitPersonRef(BaseModel):
    id: UUID
    given_name: str
    surname: str | None = None
    birth_year: int | None = None
    death_year: int | None = None
    is_living: bool
    photo_url: str | None = None
    sex: str | None = None  # "male" | "female" | None — used for father/mother slot disambiguation


class OrbitAncestorNode(OrbitPersonRef):
    parent_slot: Literal["father", "mother"] | None = None
    # The id of THIS ancestor's child within the orbit graph. For parents of focus, this is focus.id.
    # For grandparents, this is the parent that's already in the response. Frontend uses this to route wedges.
    parent_id: UUID | None = None


class OrbitDescendantNode(OrbitPersonRef):
    parent_id: UUID  # whose child this is — focus.id for first-level descendants, otherwise another descendant's id
    children: list["OrbitDescendantNode"] = Field(default_factory=list)


class OrbitSpouseRef(OrbitPersonRef):
    spouse_of: UUID  # the person this spouse is bonded to (focus, an ancestor, or a descendant)


class OrbitResponse(BaseModel):
    focus: OrbitPersonRef
    # ancestors_by_generation[0] = parents of focus, [1] = grandparents, etc.
    ancestors_by_generation: list[list[OrbitAncestorNode]]
    descendants: list[OrbitDescendantNode]
    siblings: list[OrbitPersonRef] = Field(default_factory=list)
    spouses: list[OrbitSpouseRef] = Field(default_factory=list)


OrbitDescendantNode.model_rebuild()
