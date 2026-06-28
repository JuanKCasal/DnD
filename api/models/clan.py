from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel


class ClanCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    motto: Optional[str] = None
    emblem_url: Optional[str] = None
    color_hex: str = "#C9A84C"
    alignment: Optional[str] = None
    is_public: bool = True
    requires_approval: bool = False
    max_members: Optional[int] = None
    lore: Optional[str] = None


class ClanUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    motto: Optional[str] = None
    emblem_url: Optional[str] = None
    color_hex: Optional[str] = None
    alignment: Optional[str] = None
    is_public: Optional[bool] = None
    requires_approval: Optional[bool] = None
    max_members: Optional[int] = None
    lore: Optional[str] = None


class ClanOut(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    motto: Optional[str] = None
    emblem_url: Optional[str] = None
    color_hex: str
    alignment: Optional[str] = None
    is_public: bool
    requires_approval: bool
    max_members: Optional[int] = None
    lore: Optional[str] = None
    leader_member_id: Optional[UUID] = None
    active: bool
    created_at: datetime
    member_count: Optional[int] = None

    model_config = {"from_attributes": True}


class ClanMemberOut(BaseModel):
    member_id: UUID
    clan_role: str
    title: Optional[str] = None
    contribution_pts: int
    joined_at: datetime

    model_config = {"from_attributes": True}


class ClanInvitationCreate(BaseModel):
    invited_member_id: UUID


class ClanInvitationOut(BaseModel):
    id: UUID
    clan_id: UUID
    invited_member_id: UUID
    invited_by: UUID
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
