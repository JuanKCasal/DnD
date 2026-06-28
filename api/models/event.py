from datetime import datetime
from uuid import UUID
from typing import Optional, Any
from pydantic import BaseModel


class EventLogOut(BaseModel):
    id: UUID
    occurred_at: datetime
    actor_member_id: Optional[UUID] = None
    actor_character_id: Optional[UUID] = None
    action: str
    target_type: str
    target_id: Optional[str] = None
    target_name: Optional[str] = None
    metadata: Optional[Any] = None
    is_public: bool

    model_config = {"from_attributes": True}
