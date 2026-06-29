from datetime import datetime
from uuid import UUID
from typing import Optional, Any
from pydantic import BaseModel


class CharacterCreate(BaseModel):
    name: str
    campaign_id: Optional[UUID] = None
    race: Optional[str] = None
    subrace: Optional[str] = None
    char_class: Optional[str] = None
    subclass: Optional[str] = None
    background: Optional[str] = None
    alignment: Optional[str] = None
    deity: Optional[str] = None
    level: int = 1
    # Base stats (column names match DB: str, dex, con, int, wis, cha)
    str_score: int = 10
    dex_score: int = 10
    con_score: int = 10
    int_score: int = 10
    wis_score: int = 10
    cha_score: int = 10
    hp: int = 8
    max_hp: int = 8
    temp_hp: int = 0
    ac: int = 10
    speed: int = 30
    initiative_bonus: int = 0
    prof_bonus: int = 2
    passive_perception: int = 10
    portrait_url: Optional[str] = None
    backstory: Optional[str] = None
    personality_traits: Optional[str] = None
    ideals: Optional[str] = None
    bonds: Optional[str] = None
    flaws: Optional[str] = None
    notes: Optional[str] = None


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    campaign_id: Optional[UUID] = None
    race: Optional[str] = None
    subrace: Optional[str] = None
    char_class: Optional[str] = None
    subclass: Optional[str] = None
    background: Optional[str] = None
    alignment: Optional[str] = None
    deity: Optional[str] = None
    level: Optional[int] = None
    str_score: Optional[int] = None
    dex_score: Optional[int] = None
    con_score: Optional[int] = None
    int_score: Optional[int] = None
    wis_score: Optional[int] = None
    cha_score: Optional[int] = None
    hp: Optional[int] = None
    max_hp: Optional[int] = None
    temp_hp: Optional[int] = None
    ac: Optional[int] = None
    speed: Optional[int] = None
    initiative_bonus: Optional[int] = None
    prof_bonus: Optional[int] = None
    passive_perception: Optional[int] = None
    spell_slots: Optional[dict] = None
    conditions: Optional[list[str]] = None
    feats: Optional[list[Any]] = None
    saving_throws: Optional[dict] = None
    skills: Optional[dict] = None
    portrait_url: Optional[str] = None
    backstory: Optional[str] = None
    personality_traits: Optional[str] = None
    ideals: Optional[str] = None
    bonds: Optional[str] = None
    flaws: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = None
    inspiration: Optional[bool] = None
    xp: Optional[int] = None


class HPUpdate(BaseModel):
    hp: int
    reason: Optional[str] = None


class ConditionsUpdate(BaseModel):
    conditions: list[str]


class SpellSlotsUpdate(BaseModel):
    spell_slots: dict


class CharacterOut(BaseModel):
    id: UUID
    member_id: UUID
    campaign_id: Optional[UUID] = None
    name: str
    race: Optional[str] = None
    subrace: Optional[str] = None
    char_class: Optional[str] = None
    subclass: Optional[str] = None
    background: Optional[str] = None
    alignment: Optional[str] = None
    deity: Optional[str] = None
    level: int
    str_score: int
    dex_score: int
    con_score: int
    int_score: int
    wis_score: int
    cha_score: int
    hp: int
    max_hp: int
    temp_hp: int
    ac: int
    speed: int
    initiative_bonus: int
    prof_bonus: int
    passive_perception: int
    spell_slots: Optional[Any] = None
    conditions: Optional[Any] = None
    feats: Optional[Any] = None
    saving_throws: Optional[Any] = None
    skills: Optional[Any] = None
    portrait_url: Optional[str] = None
    backstory: Optional[str] = None
    personality_traits: Optional[str] = None
    ideals: Optional[str] = None
    bonds: Optional[str] = None
    flaws: Optional[str] = None
    active: bool
    inspiration: bool
    xp: int
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
