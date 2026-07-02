from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator

# Las 14 condiciones (guía §10.4); el agotamiento se rastrea aparte (0–6, §10.5).
CONDITIONS = {
    "blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated",
    "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained",
    "stunned", "unconscious",
}
COMBATANT_TYPES = {"pc", "npc", "monster"}


def _v_conditions(v):
    if v is None:
        return v
    bad = set(v) - CONDITIONS
    if bad:
        raise ValueError(f"condiciones inválidas: {sorted(bad)}")
    return v


class CombatantAdd(BaseModel):
    name: str
    combatant_type: str = "monster"
    reference_id: Optional[UUID] = None
    initiative: int = 0
    initiative_tiebreak: int = 0
    max_hp: Optional[int] = None
    current_hp: Optional[int] = None
    armor_class: Optional[int] = None
    conditions: list[str] = []
    concentration: Optional[str] = None

    @field_validator("combatant_type")
    @classmethod
    def _v_type(cls, v):
        if v not in COMBATANT_TYPES:
            raise ValueError(f"combatant_type debe ser uno de {sorted(COMBATANT_TYPES)}")
        return v

    @field_validator("conditions")
    @classmethod
    def _v_cond(cls, v):
        return _v_conditions(v)


class CombatantUpdate(BaseModel):
    name: Optional[str] = None
    initiative: Optional[int] = None
    initiative_tiebreak: Optional[int] = None
    max_hp: Optional[int] = None
    current_hp: Optional[int] = None
    temp_hp: Optional[int] = None
    armor_class: Optional[int] = None
    conditions: Optional[list[str]] = None
    exhaustion: Optional[int] = None
    concentration: Optional[str] = None
    is_dead: Optional[bool] = None
    notes: Optional[str] = None

    @field_validator("conditions")
    @classmethod
    def _v_cond(cls, v):
        return _v_conditions(v)

    @field_validator("exhaustion")
    @classmethod
    def _v_exh(cls, v):
        if v is not None and not (0 <= v <= 6):
            raise ValueError("exhaustion debe estar entre 0 y 6")
        return v
