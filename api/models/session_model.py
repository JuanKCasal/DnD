from datetime import date as Date, datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel


class SessionCreate(BaseModel):
    campaign_id: UUID
    title: Optional[str] = None
    date: Optional[Date] = None
    duration_min: Optional[int] = None
    summary: Optional[str] = None
    highlights: Optional[list[str]] = None
    xp_awarded: int = 0
    milestone_level: Optional[int] = None
    next_session_date: Optional[datetime] = None


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[Date] = None
    duration_min: Optional[int] = None
    summary: Optional[str] = None
    highlights: Optional[list[str]] = None
    xp_awarded: Optional[int] = None
    milestone_level: Optional[int] = None
    next_session_date: Optional[datetime] = None


class SessionOut(BaseModel):
    id: UUID
    campaign_id: UUID
    session_number: int
    title: Optional[str] = None
    date: Optional[Date] = None
    duration_min: Optional[int] = None
    summary: Optional[str] = None
    highlights: Optional[list[str]] = None
    xp_awarded: int
    milestone_level: Optional[int] = None
    next_session_date: Optional[datetime] = None
    created_by: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class AttendanceCreate(BaseModel):
    member_id: UUID
    character_id: Optional[UUID] = None
    present: bool = True
    xp_received: int = 0
