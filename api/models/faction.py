from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator

ALIGNMENTS = {"LG", "NG", "CG", "LN", "TN", "CN", "LE", "NE", "CE"}


class FactionCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    goals: Optional[str] = None
    alignment: Optional[str] = None
    emblem_url: Optional[str] = None
    leader_name: Optional[str] = None
    reputation_scale: Optional[dict] = None

    @field_validator("alignment")
    @classmethod
    def _v_align(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALIGNMENTS:
            raise ValueError(f"alignment debe ser uno de {sorted(ALIGNMENTS)}")
        return v


class FactionUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    goals: Optional[str] = None
    alignment: Optional[str] = None
    emblem_url: Optional[str] = None
    leader_name: Optional[str] = None
    reputation_scale: Optional[dict] = None

    @field_validator("alignment")
    @classmethod
    def _v_align(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALIGNMENTS:
            raise ValueError(f"alignment debe ser uno de {sorted(ALIGNMENTS)}")
        return v


class FactionOut(BaseModel):
    id: UUID
    campaign_id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    goals: Optional[str] = None
    alignment: Optional[str] = None
    emblem_url: Optional[str] = None
    leader_name: Optional[str] = None
    reputation_scale: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReputationSet(BaseModel):
    character_id: UUID
    reputation_pts: int = 0
    rank_title: Optional[str] = None
