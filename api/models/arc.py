from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator

ARC_TYPES = {"main", "side", "character", "faction"}
ARC_STATUSES = {"not_started", "active", "resolved", "failed", "abandoned"}


class StoryBeat(BaseModel):
    title: str
    description: Optional[str] = None
    completed: bool = False


class StoryArcCreate(BaseModel):
    title: str
    description: Optional[str] = None
    arc_type: str = "main"
    status: str = "active"
    beats: list[StoryBeat] = []
    visible_to_players: bool = True
    notes: Optional[str] = None
    sort_order: int = 0

    @field_validator("arc_type")
    @classmethod
    def _v_type(cls, v):
        if v not in ARC_TYPES:
            raise ValueError(f"arc_type debe ser uno de {sorted(ARC_TYPES)}")
        return v

    @field_validator("status")
    @classmethod
    def _v_status(cls, v):
        if v not in ARC_STATUSES:
            raise ValueError(f"status debe ser uno de {sorted(ARC_STATUSES)}")
        return v


class StoryArcUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    arc_type: Optional[str] = None
    status: Optional[str] = None
    beats: Optional[list[StoryBeat]] = None
    visible_to_players: Optional[bool] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None

    @field_validator("arc_type")
    @classmethod
    def _v_type(cls, v):
        if v is not None and v not in ARC_TYPES:
            raise ValueError(f"arc_type debe ser uno de {sorted(ARC_TYPES)}")
        return v

    @field_validator("status")
    @classmethod
    def _v_status(cls, v):
        if v is not None and v not in ARC_STATUSES:
            raise ValueError(f"status debe ser uno de {sorted(ARC_STATUSES)}")
        return v


class StoryArcOut(BaseModel):
    id: UUID
    campaign_id: UUID
    title: str
    description: Optional[str] = None
    arc_type: str
    status: str
    beats: list = []
    visible_to_players: bool = True
    notes: Optional[str] = None
    sort_order: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class PlotTwistCreate(BaseModel):
    title: str
    description: Optional[str] = None
    arc_id: Optional[UUID] = None
    setup_clues: list[str] = []
    reveal_condition: Optional[str] = None
    impact: Optional[str] = None
    revealed: bool = False
    dm_only: bool = True


class PlotTwistUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    arc_id: Optional[UUID] = None
    setup_clues: Optional[list[str]] = None
    reveal_condition: Optional[str] = None
    impact: Optional[str] = None
    revealed: Optional[bool] = None
    dm_only: Optional[bool] = None


class PlotTwistOut(BaseModel):
    id: UUID
    campaign_id: UUID
    arc_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    setup_clues: list[str] = []
    reveal_condition: Optional[str] = None
    impact: Optional[str] = None
    revealed: bool = False
    dm_only: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}
