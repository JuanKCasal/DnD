from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator

# quest_status es un ENUM en la BD (001): active|completed|failed|abandoned
QUEST_STATUSES = {"active", "completed", "failed", "abandoned"}
QUEST_TYPES = {"main", "side", "personal", "faction", "fetch", "escort", "bounty"}


class QuestObjective(BaseModel):
    text: str
    completed: bool = False
    optional: bool = False


class QuestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "active"
    quest_type: str = "side"
    adventure_id: Optional[UUID] = None
    quest_giver_npc_id: Optional[UUID] = None
    reward_description: Optional[str] = None
    reward_xp: int = 0
    reward_gp: float = 0
    objectives: list[QuestObjective] = []
    notes: Optional[str] = None
    visible_to_players: bool = True

    @field_validator("status")
    @classmethod
    def _v_status(cls, v: str) -> str:
        if v not in QUEST_STATUSES:
            raise ValueError(f"status debe ser uno de {sorted(QUEST_STATUSES)}")
        return v

    @field_validator("quest_type")
    @classmethod
    def _v_type(cls, v: str) -> str:
        if v not in QUEST_TYPES:
            raise ValueError(f"quest_type debe ser uno de {sorted(QUEST_TYPES)}")
        return v


class QuestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    quest_type: Optional[str] = None
    adventure_id: Optional[UUID] = None
    quest_giver_npc_id: Optional[UUID] = None
    reward_description: Optional[str] = None
    reward_xp: Optional[int] = None
    reward_gp: Optional[float] = None
    objectives: Optional[list[QuestObjective]] = None
    notes: Optional[str] = None
    visible_to_players: Optional[bool] = None

    @field_validator("status")
    @classmethod
    def _v_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in QUEST_STATUSES:
            raise ValueError(f"status debe ser uno de {sorted(QUEST_STATUSES)}")
        return v

    @field_validator("quest_type")
    @classmethod
    def _v_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in QUEST_TYPES:
            raise ValueError(f"quest_type debe ser uno de {sorted(QUEST_TYPES)}")
        return v


class QuestOut(BaseModel):
    id: UUID
    campaign_id: UUID
    title: str
    description: Optional[str] = None
    status: str
    quest_type: str = "side"
    adventure_id: Optional[UUID] = None
    quest_giver_npc_id: Optional[UUID] = None
    reward_description: Optional[str] = None
    reward_xp: int = 0
    reward_gp: float = 0
    objectives: list = []
    notes: Optional[str] = None
    visible_to_players: bool = True
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
