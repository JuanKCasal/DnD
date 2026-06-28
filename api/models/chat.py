from datetime import datetime
from uuid import UUID
from typing import Optional, Any
from pydantic import BaseModel


class ChatRoomCreate(BaseModel):
    name: str
    slug: str
    room_type: str = "general"
    clan_id: Optional[UUID] = None
    campaign_id: Optional[UUID] = None
    rank_required_id: Optional[UUID] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_readonly: bool = False
    is_ic: bool = False
    sort_order: int = 0


class ChatRoomOut(BaseModel):
    id: UUID
    name: str
    slug: str
    room_type: str
    clan_id: Optional[UUID] = None
    campaign_id: Optional[UUID] = None
    rank_required_id: Optional[UUID] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_readonly: bool
    is_ic: bool
    sort_order: int
    created_at: datetime
    unread_count: Optional[int] = None

    model_config = {"from_attributes": True}


class ChatMessageCreate(BaseModel):
    content: str
    message_type: str = "ooc"
    reply_to_id: Optional[UUID] = None
    dice_result: Optional[Any] = None


class ChatMessageOut(BaseModel):
    id: UUID
    room_id: UUID
    member_id: UUID
    character_id: Optional[UUID] = None
    character_name: Optional[str] = None
    character_portrait: Optional[str] = None
    message_type: str
    content: str
    dice_result: Optional[Any] = None
    created_at: datetime
    edited_at: Optional[datetime] = None
    is_pinned: bool

    model_config = {"from_attributes": True}


class DirectMessageCreate(BaseModel):
    content: str
    message_type: str = "ic"


class DirectMessageOut(BaseModel):
    id: UUID
    from_character_id: UUID
    from_character_name: str
    to_character_id: UUID
    to_character_name: str
    content: str
    message_type: str
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
