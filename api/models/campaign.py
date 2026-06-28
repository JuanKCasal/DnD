from datetime import date, datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel


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


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
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

    model_config = {"from_attributes": True}
