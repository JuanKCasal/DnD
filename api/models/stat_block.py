from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator

SIZES = {"tiny", "small", "medium", "large", "huge", "gargantuan"}
CREATURE_TYPES = {
    "aberration", "beast", "celestial", "construct", "dragon", "elemental",
    "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead",
}


class StatBlockCreate(BaseModel):
    name: str
    size: Optional[str] = None
    creature_type: Optional[str] = None
    subtype: Optional[str] = None
    alignment: Optional[str] = None
    armor_class: Optional[int] = None
    armor_class_note: Optional[str] = None
    hit_points: Optional[int] = None
    hit_dice: Optional[str] = None
    speed: Optional[dict] = None
    abilities: Optional[dict] = None
    saving_throws: Optional[dict] = None
    skills: Optional[dict] = None
    senses: Optional[dict] = None
    languages: Optional[str] = None
    damage_tags: Optional[dict] = None
    challenge_rating: float = 0
    xp_value: Optional[int] = None   # si None, se deriva del CR en el router
    proficiency_bonus: Optional[int] = None
    traits: Optional[list] = None
    actions: Optional[list] = None
    legendary_actions: Optional[list] = None
    reactions: Optional[list] = None
    description: Optional[str] = None
    source: Optional[str] = None
    is_homebrew: bool = True

    @field_validator("size")
    @classmethod
    def _v_size(cls, v):
        if v is not None and v not in SIZES:
            raise ValueError(f"size debe ser uno de {sorted(SIZES)}")
        return v

    @field_validator("creature_type")
    @classmethod
    def _v_type(cls, v):
        if v is not None and v not in CREATURE_TYPES:
            raise ValueError(f"creature_type debe ser uno de {sorted(CREATURE_TYPES)}")
        return v

    @field_validator("challenge_rating")
    @classmethod
    def _v_cr(cls, v):
        if v is None or v < 0 or v > 30:
            raise ValueError("challenge_rating debe estar entre 0 y 30")
        return v


class StatBlockUpdate(BaseModel):
    name: Optional[str] = None
    size: Optional[str] = None
    creature_type: Optional[str] = None
    subtype: Optional[str] = None
    alignment: Optional[str] = None
    armor_class: Optional[int] = None
    armor_class_note: Optional[str] = None
    hit_points: Optional[int] = None
    hit_dice: Optional[str] = None
    speed: Optional[dict] = None
    abilities: Optional[dict] = None
    saving_throws: Optional[dict] = None
    skills: Optional[dict] = None
    senses: Optional[dict] = None
    languages: Optional[str] = None
    damage_tags: Optional[dict] = None
    challenge_rating: Optional[float] = None
    xp_value: Optional[int] = None
    proficiency_bonus: Optional[int] = None
    traits: Optional[list] = None
    actions: Optional[list] = None
    legendary_actions: Optional[list] = None
    reactions: Optional[list] = None
    description: Optional[str] = None
    source: Optional[str] = None

    @field_validator("size")
    @classmethod
    def _v_size(cls, v):
        if v is not None and v not in SIZES:
            raise ValueError(f"size debe ser uno de {sorted(SIZES)}")
        return v

    @field_validator("creature_type")
    @classmethod
    def _v_type(cls, v):
        if v is not None and v not in CREATURE_TYPES:
            raise ValueError(f"creature_type debe ser uno de {sorted(CREATURE_TYPES)}")
        return v


class StatBlockOut(BaseModel):
    id: UUID
    campaign_id: Optional[UUID] = None
    name: str
    size: Optional[str] = None
    creature_type: Optional[str] = None
    subtype: Optional[str] = None
    alignment: Optional[str] = None
    armor_class: Optional[int] = None
    armor_class_note: Optional[str] = None
    hit_points: Optional[int] = None
    hit_dice: Optional[str] = None
    speed: Optional[dict] = None
    abilities: Optional[dict] = None
    saving_throws: Optional[dict] = None
    skills: Optional[dict] = None
    senses: Optional[dict] = None
    languages: Optional[str] = None
    damage_tags: Optional[dict] = None
    challenge_rating: float = 0
    xp_value: int = 0
    proficiency_bonus: Optional[int] = None
    traits: Optional[list] = None
    actions: Optional[list] = None
    legendary_actions: Optional[list] = None
    reactions: Optional[list] = None
    description: Optional[str] = None
    source: Optional[str] = None
    is_homebrew: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}
