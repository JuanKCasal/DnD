from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator

NPC_RELATIONSHIPS = {"ally", "enemy", "neutral", "unknown"}
NPC_ATTITUDES = {"hostile", "unfriendly", "indifferent", "friendly", "helpful"}


class NpcCreate(BaseModel):
    name: str
    race: Optional[str] = None
    npc_class: Optional[str] = None  # → columna "class" en la BD
    role: Optional[str] = None
    relationship: str = "unknown"
    attitude: Optional[str] = None
    description: Optional[str] = None
    portrait_url: Optional[str] = None
    stat_block: Optional[dict] = None
    location_id: Optional[UUID] = None
    faction_id: Optional[UUID] = None
    alive: bool = True
    motivation: Optional[str] = None  # dm_only al serializar para jugadores
    secret: Optional[str] = None      # dm_only
    notes: Optional[str] = None       # dm_only
    dm_only: bool = False

    @field_validator("relationship")
    @classmethod
    def _v_rel(cls, v: str) -> str:
        if v not in NPC_RELATIONSHIPS:
            raise ValueError(f"relationship debe ser uno de {sorted(NPC_RELATIONSHIPS)}")
        return v

    @field_validator("attitude")
    @classmethod
    def _v_att(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in NPC_ATTITUDES:
            raise ValueError(f"attitude debe ser uno de {sorted(NPC_ATTITUDES)}")
        return v


class NpcUpdate(BaseModel):
    name: Optional[str] = None
    race: Optional[str] = None
    npc_class: Optional[str] = None
    role: Optional[str] = None
    relationship: Optional[str] = None
    attitude: Optional[str] = None
    description: Optional[str] = None
    portrait_url: Optional[str] = None
    stat_block: Optional[dict] = None
    location_id: Optional[UUID] = None
    faction_id: Optional[UUID] = None
    alive: Optional[bool] = None
    motivation: Optional[str] = None
    secret: Optional[str] = None
    notes: Optional[str] = None
    dm_only: Optional[bool] = None

    @field_validator("relationship")
    @classmethod
    def _v_rel(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in NPC_RELATIONSHIPS:
            raise ValueError(f"relationship debe ser uno de {sorted(NPC_RELATIONSHIPS)}")
        return v

    @field_validator("attitude")
    @classmethod
    def _v_att(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in NPC_ATTITUDES:
            raise ValueError(f"attitude debe ser uno de {sorted(NPC_ATTITUDES)}")
        return v


class NpcOut(BaseModel):
    id: UUID
    campaign_id: UUID
    name: str
    race: Optional[str] = None
    npc_class: Optional[str] = None
    role: Optional[str] = None
    relationship: str = "unknown"
    attitude: Optional[str] = None
    description: Optional[str] = None
    portrait_url: Optional[str] = None
    stat_block: Optional[dict] = None
    location_id: Optional[UUID] = None
    faction_id: Optional[UUID] = None
    alive: bool = True
    motivation: Optional[str] = None
    secret: Optional[str] = None
    notes: Optional[str] = None
    dm_only: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}
