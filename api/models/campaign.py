from datetime import date, datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator, model_validator

# Conjuntos canónicos (guía §2–§3). Constantes de sistema, no editables por el usuario.
LEVELING_METHODS = {"xp", "milestone"}
RULESETS = {"dnd_5e_2014", "dnd_5e_2024", "dnd_5e_homebrew"}
SESSION_FREQUENCIES = {"weekly", "biweekly", "monthly", "irregular"}
CAMPAIGN_STATUSES = {"planning", "active", "paused", "on_hiatus", "completed", "archived"}


def _validate_levels(start: Optional[int], current: Optional[int], target: Optional[int]) -> None:
    """Reglas de nivel de la guía §17.3: 1..20 y start ≤ current ≤ target."""
    for label, v in (("start_level", start), ("current_level", current), ("target_end_level", target)):
        if v is not None and not (1 <= v <= 20):
            raise ValueError(f"{label} debe estar entre 1 y 20")
    if start is not None and current is not None and current < start:
        raise ValueError("current_level no puede ser menor que start_level")
    if current is not None and target is not None and target < current:
        raise ValueError("target_end_level no puede ser menor que current_level")


class CampaignCreate(BaseModel):
    name: str
    slug: str
    system: str = "D&D 5e"
    description: Optional[str] = None
    lore: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_public: bool = True
    world_name: Optional[str] = None
    setting: Optional[str] = None
    start_date: Optional[date] = None
    status: Optional[str] = None
    # ── Metadatos (guía §2) ──
    subtitle: Optional[str] = None
    tone: Optional[list[str]] = None
    themes: Optional[list[str]] = None
    start_level: int = 1
    current_level: int = 1
    target_end_level: Optional[int] = None
    session_frequency: Optional[str] = None
    banner_image_url: Optional[str] = None
    # ── Sistema y reglas de mesa (guía §3) ──
    leveling_method: str = "xp"
    ruleset: str = "dnd_5e_2014"
    house_rules: Optional[list[dict]] = None
    variant_rules: Optional[list[str]] = None

    @field_validator("leveling_method")
    @classmethod
    def _v_leveling(cls, v: str) -> str:
        if v not in LEVELING_METHODS:
            raise ValueError(f"leveling_method debe ser uno de {sorted(LEVELING_METHODS)}")
        return v

    @field_validator("ruleset")
    @classmethod
    def _v_ruleset(cls, v: str) -> str:
        if v not in RULESETS:
            raise ValueError(f"ruleset debe ser uno de {sorted(RULESETS)}")
        return v

    @field_validator("session_frequency")
    @classmethod
    def _v_freq(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in SESSION_FREQUENCIES:
            raise ValueError(f"session_frequency debe ser uno de {sorted(SESSION_FREQUENCIES)}")
        return v

    @field_validator("status")
    @classmethod
    def _v_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in CAMPAIGN_STATUSES:
            raise ValueError(f"status debe ser uno de {sorted(CAMPAIGN_STATUSES)}")
        return v

    @model_validator(mode="after")
    def _v_levels(self):
        _validate_levels(self.start_level, self.current_level, self.target_end_level)
        return self


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    dm_id: Optional[UUID] = None
    system: Optional[str] = None
    description: Optional[str] = None
    lore: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_public: Optional[bool] = None
    world_name: Optional[str] = None
    setting: Optional[str] = None
    start_date: Optional[date] = None
    status: Optional[str] = None
    end_date: Optional[date] = None
    # ── Metadatos ──
    subtitle: Optional[str] = None
    tone: Optional[list[str]] = None
    themes: Optional[list[str]] = None
    start_level: Optional[int] = None
    current_level: Optional[int] = None
    target_end_level: Optional[int] = None
    session_frequency: Optional[str] = None
    banner_image_url: Optional[str] = None
    # ── Sistema y reglas ──
    leveling_method: Optional[str] = None
    ruleset: Optional[str] = None
    house_rules: Optional[list[dict]] = None
    variant_rules: Optional[list[str]] = None

    @field_validator("leveling_method")
    @classmethod
    def _v_leveling(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in LEVELING_METHODS:
            raise ValueError(f"leveling_method debe ser uno de {sorted(LEVELING_METHODS)}")
        return v

    @field_validator("ruleset")
    @classmethod
    def _v_ruleset(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in RULESETS:
            raise ValueError(f"ruleset debe ser uno de {sorted(RULESETS)}")
        return v

    @field_validator("session_frequency")
    @classmethod
    def _v_freq(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in SESSION_FREQUENCIES:
            raise ValueError(f"session_frequency debe ser uno de {sorted(SESSION_FREQUENCIES)}")
        return v

    @field_validator("status")
    @classmethod
    def _v_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in CAMPAIGN_STATUSES:
            raise ValueError(f"status debe ser uno de {sorted(CAMPAIGN_STATUSES)}")
        return v

    @model_validator(mode="after")
    def _v_levels(self):
        _validate_levels(self.start_level, self.current_level, self.target_end_level)
        return self


class CampaignOut(BaseModel):
    id: UUID
    name: str
    slug: str
    dm_id: UUID
    system: str
    status: str
    description: Optional[str] = None
    lore: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_public: bool
    world_name: Optional[str] = None
    setting: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: datetime
    member_count: Optional[int] = None
    # ── Metadatos (Fase C1) ──
    subtitle: Optional[str] = None
    tone: Optional[list[str]] = None
    themes: Optional[list[str]] = None
    start_level: Optional[int] = None
    current_level: Optional[int] = None
    target_end_level: Optional[int] = None
    session_frequency: Optional[str] = None
    banner_image_url: Optional[str] = None
    leveling_method: Optional[str] = None
    ruleset: Optional[str] = None
    house_rules: Optional[list[dict]] = None
    variant_rules: Optional[list[str]] = None

    model_config = {"from_attributes": True}
