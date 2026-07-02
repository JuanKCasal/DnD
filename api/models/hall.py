from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator


class AwardCreate(BaseModel):
    character_id: UUID
    campaign_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    icon: Optional[str] = "🏅"
    rarity: Optional[str] = "rare"


class RatingCreate(BaseModel):
    campaign_id: UUID
    stars: int
    comment: Optional[str] = None

    @field_validator("stars")
    @classmethod
    def _v_stars(cls, v):
        if not (1 <= v <= 5):
            raise ValueError("stars debe estar entre 1 y 5")
        return v
