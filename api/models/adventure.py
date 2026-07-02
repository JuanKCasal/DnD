from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator, model_validator

ADVENTURE_STATUSES = {"not_started", "active", "completed", "abandoned"}
ADVENTURE_SOURCES = {"official", "homebrew"}


def _validate_rec_levels(mn: Optional[int], mx: Optional[int]) -> None:
    for label, v in (("rec_level_min", mn), ("rec_level_max", mx)):
        if v is not None and not (1 <= v <= 20):
            raise ValueError(f"{label} debe estar entre 1 y 20")
    if mn is not None and mx is not None and mx < mn:
        raise ValueError("rec_level_max no puede ser menor que rec_level_min")


class AdventureCreate(BaseModel):
    title: str
    description: Optional[str] = None
    sort_order: int = 0
    source: str = "homebrew"
    module_name: Optional[str] = None
    status: str = "not_started"
    rec_level_min: Optional[int] = None
    rec_level_max: Optional[int] = None
    visible_to_players: bool = True
    dm_notes: Optional[str] = None

    @field_validator("source")
    @classmethod
    def _v_source(cls, v: str) -> str:
        if v not in ADVENTURE_SOURCES:
            raise ValueError(f"source debe ser uno de {sorted(ADVENTURE_SOURCES)}")
        return v

    @field_validator("status")
    @classmethod
    def _v_status(cls, v: str) -> str:
        if v not in ADVENTURE_STATUSES:
            raise ValueError(f"status debe ser uno de {sorted(ADVENTURE_STATUSES)}")
        return v

    @model_validator(mode="after")
    def _v_levels(self):
        _validate_rec_levels(self.rec_level_min, self.rec_level_max)
        return self


class AdventureUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    source: Optional[str] = None
    module_name: Optional[str] = None
    status: Optional[str] = None
    rec_level_min: Optional[int] = None
    rec_level_max: Optional[int] = None
    visible_to_players: Optional[bool] = None
    dm_notes: Optional[str] = None

    @field_validator("source")
    @classmethod
    def _v_source(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ADVENTURE_SOURCES:
            raise ValueError(f"source debe ser uno de {sorted(ADVENTURE_SOURCES)}")
        return v

    @field_validator("status")
    @classmethod
    def _v_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ADVENTURE_STATUSES:
            raise ValueError(f"status debe ser uno de {sorted(ADVENTURE_STATUSES)}")
        return v

    @model_validator(mode="after")
    def _v_levels(self):
        _validate_rec_levels(self.rec_level_min, self.rec_level_max)
        return self


class AdventureOut(BaseModel):
    id: UUID
    campaign_id: UUID
    title: str
    description: Optional[str] = None
    sort_order: int = 0
    source: str
    module_name: Optional[str] = None
    status: str
    rec_level_min: Optional[int] = None
    rec_level_max: Optional[int] = None
    visible_to_players: bool = True
    dm_notes: Optional[str] = None
    created_at: datetime
    session_count: Optional[int] = None
    quest_count: Optional[int] = None

    model_config = {"from_attributes": True}
