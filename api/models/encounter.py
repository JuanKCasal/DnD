from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator

ENCOUNTER_TYPES = {"combat", "social", "exploration", "puzzle", "trap", "hazard", "chase", "rest"}
ENCOUNTER_STATUSES = {"planned", "active", "completed", "skipped"}


class EncounterMonsterIn(BaseModel):
    stat_block_id: Optional[UUID] = None
    name_override: Optional[str] = None
    quantity: int = 1
    xp_each: Optional[int] = None  # si None, se toma del stat block en el router


class EncounterCreate(BaseModel):
    name: str
    encounter_type: str = "combat"
    description: Optional[str] = None
    session_id: Optional[UUID] = None
    location_id: Optional[UUID] = None
    party_size: int = 4
    party_level: int = 1
    terrain_features: Optional[str] = None
    status: str = "planned"
    dm_notes: Optional[str] = None
    visible_to_players: bool = False
    monsters: list[EncounterMonsterIn] = []

    @field_validator("encounter_type")
    @classmethod
    def _v_type(cls, v):
        if v not in ENCOUNTER_TYPES:
            raise ValueError(f"encounter_type debe ser uno de {sorted(ENCOUNTER_TYPES)}")
        return v

    @field_validator("status")
    @classmethod
    def _v_status(cls, v):
        if v not in ENCOUNTER_STATUSES:
            raise ValueError(f"status debe ser uno de {sorted(ENCOUNTER_STATUSES)}")
        return v


class EncounterUpdate(BaseModel):
    name: Optional[str] = None
    encounter_type: Optional[str] = None
    description: Optional[str] = None
    session_id: Optional[UUID] = None
    location_id: Optional[UUID] = None
    party_size: Optional[int] = None
    party_level: Optional[int] = None
    terrain_features: Optional[str] = None
    status: Optional[str] = None
    dm_notes: Optional[str] = None
    visible_to_players: Optional[bool] = None
    monsters: Optional[list[EncounterMonsterIn]] = None  # si viene, reemplaza el listado

    @field_validator("encounter_type")
    @classmethod
    def _v_type(cls, v):
        if v is not None and v not in ENCOUNTER_TYPES:
            raise ValueError(f"encounter_type debe ser uno de {sorted(ENCOUNTER_TYPES)}")
        return v

    @field_validator("status")
    @classmethod
    def _v_status(cls, v):
        if v is not None and v not in ENCOUNTER_STATUSES:
            raise ValueError(f"status debe ser uno de {sorted(ENCOUNTER_STATUSES)}")
        return v


class DifficultyPreview(BaseModel):
    """Cálculo de dificultad sin persistir (guía §12)."""
    monsters: list[EncounterMonsterIn] = []
    party_size: int = 4
    party_level: int = 1
