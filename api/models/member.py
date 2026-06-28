from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel


class RankOut(BaseModel):
    id: UUID
    name: str
    slug: str
    color_hex: str
    icon_url: Optional[str] = None
    level: int
    xp_threshold: int


class MemberCreate(BaseModel):
    username: str
    email: str
    password: str
    display_name: Optional[str] = None


class MemberUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    timezone: Optional[str] = None
    discord_handle: Optional[str] = None


class MemberOut(BaseModel):
    id: UUID
    username: str
    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    rank_id: Optional[UUID] = None
    bio: Optional[str] = None
    timezone: Optional[str] = None
    discord_handle: Optional[str] = None
    active: bool
    last_seen_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberWithRank(MemberOut):
    rank: Optional[RankOut] = None
