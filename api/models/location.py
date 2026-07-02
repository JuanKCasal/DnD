from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator

LOCATION_TYPES = {"city", "dungeon", "wilderness", "plane", "region", "poi"}


class LocationCreate(BaseModel):
    name: str
    type: str = "poi"
    parent_location_id: Optional[UUID] = None
    description: Optional[str] = None
    map_url: Optional[str] = None
    is_discovered: bool = True
    notes: Optional[str] = None  # tratado como DM-only al serializar para jugadores

    @field_validator("type")
    @classmethod
    def _v_type(cls, v: str) -> str:
        if v not in LOCATION_TYPES:
            raise ValueError(f"type debe ser uno de {sorted(LOCATION_TYPES)}")
        return v


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    parent_location_id: Optional[UUID] = None
    description: Optional[str] = None
    map_url: Optional[str] = None
    is_discovered: Optional[bool] = None
    notes: Optional[str] = None

    @field_validator("type")
    @classmethod
    def _v_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in LOCATION_TYPES:
            raise ValueError(f"type debe ser uno de {sorted(LOCATION_TYPES)}")
        return v


class LocationOut(BaseModel):
    id: UUID
    campaign_id: UUID
    parent_location_id: Optional[UUID] = None
    name: str
    type: str
    description: Optional[str] = None
    map_url: Optional[str] = None
    is_discovered: bool = True
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
