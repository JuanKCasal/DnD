from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator

BOARDS = {"events", "hall", "clan"}


class PostCreate(BaseModel):
    board: str
    clan_id: Optional[UUID] = None
    title: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    item_id: Optional[UUID] = None
    event_date: Optional[datetime] = None
    pinned: bool = False

    @field_validator("board")
    @classmethod
    def _v_board(cls, v):
        if v not in BOARDS:
            raise ValueError(f"board debe ser uno de {sorted(BOARDS)}")
        return v


class PostUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    item_id: Optional[UUID] = None
    event_date: Optional[datetime] = None
    pinned: Optional[bool] = None


class CommentCreate(BaseModel):
    body: str


class ReactionSet(BaseModel):
    emoji: str
