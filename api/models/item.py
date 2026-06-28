from uuid import UUID
from typing import Optional
from pydantic import BaseModel


class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    item_type: str = "other"
    rarity: str = "common"
    weight: Optional[float] = None
    value_gp: Optional[float] = None
    is_magical: bool = False
    is_consumable: bool = False
    requires_attunement: bool = False
    attunement_restriction: Optional[str] = None
    charges_max: Optional[int] = None
    weapon_category: Optional[str] = None
    damage_dice: Optional[str] = None
    damage_type: Optional[str] = None
    weapon_properties: Optional[list[str]] = None
    armor_category: Optional[str] = None
    ac_base: Optional[int] = None
    icon_url: Optional[str] = None


class ItemOut(ItemCreate):
    id: UUID

    model_config = {"from_attributes": True}


class InventoryAdd(BaseModel):
    item_id: UUID
    quantity: int = 1
    equipped: bool = False
    notes: Optional[str] = None
