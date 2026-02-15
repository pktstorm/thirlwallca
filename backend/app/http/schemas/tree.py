import uuid
from typing import Any
from pydantic import BaseModel


class TreeNode(BaseModel):
    id: str
    label: str
    data: dict[str, Any]


class TreeEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str


class TreeResponse(BaseModel):
    nodes: list[TreeNode]
    edges: list[TreeEdge]


class RelationshipPathStep(BaseModel):
    person_id: uuid.UUID
    person_name: str
    relationship: str
    direction: str


class RelationshipPathResponse(BaseModel):
    path: list[RelationshipPathStep]
    label: str
    description: str
    found: bool
