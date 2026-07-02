from datetime import date as Date, datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel


class SessionCreate(BaseModel):
    campaign_id: UUID
    adventure_id: Optional[UUID] = None
    title: Optional[str] = None
    date: Optional[Date] = None
    duration_min: Optional[int] = None
    summary: Optional[str] = None
    highlights: Optional[list[str]] = None
    xp_awarded: int = 0
    milestone_level: Optional[int] = None
    next_session_date: Optional[datetime] = None
    # ── Bitácora (Fase C4) ──
    prep_notes: Optional[str] = None
    cliffhanger: Optional[str] = None
    npcs_introduced: Optional[list[UUID]] = None
    locations_visited: Optional[list[UUID]] = None
    quests_advanced: Optional[list[UUID]] = None


class SessionUpdate(BaseModel):
    adventure_id: Optional[UUID] = None
    title: Optional[str] = None
    date: Optional[Date] = None
    duration_min: Optional[int] = None
    summary: Optional[str] = None
    highlights: Optional[list[str]] = None
    xp_awarded: Optional[int] = None
    milestone_level: Optional[int] = None
    next_session_date: Optional[datetime] = None
    prep_notes: Optional[str] = None
    cliffhanger: Optional[str] = None
    npcs_introduced: Optional[list[UUID]] = None
    locations_visited: Optional[list[UUID]] = None
    quests_advanced: Optional[list[UUID]] = None


class SessionOut(BaseModel):
    id: UUID
    campaign_id: UUID
    adventure_id: Optional[UUID] = None
    session_number: int
    title: Optional[str] = None
    date: Optional[Date] = None
    duration_min: Optional[int] = None
    summary: Optional[str] = None
    highlights: Optional[list[str]] = None
    xp_awarded: int
    milestone_level: Optional[int] = None
    next_session_date: Optional[datetime] = None
    prep_notes: Optional[str] = None
    cliffhanger: Optional[str] = None
    npcs_introduced: Optional[list[UUID]] = None
    locations_visited: Optional[list[UUID]] = None
    quests_advanced: Optional[list[UUID]] = None
    created_by: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class AttendanceCreate(BaseModel):
    member_id: UUID
    character_id: Optional[UUID] = None
    present: bool = True
    xp_received: int = 0
