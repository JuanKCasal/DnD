from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel


class RankBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    color_hex: str
    icon_url: Optional[str] = None
    level: int
    xp_threshold: int
    permissions: Optional[dict] = None


class RankCreate(RankBase):
    pass


class RankUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    color_hex: Optional[str] = None
    icon_url: Optional[str] = None
    level: Optional[int] = None
    xp_threshold: Optional[int] = None
    permissions: Optional[dict] = None


class RankOut(RankBase):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}
