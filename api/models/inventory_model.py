from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel


class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: str = "other"
    rarity: str = "common"
    weight: Optional[float] = None
    value_gp: Optional[float] = None
    is_magical: bool = False
    is_consumable: bool = False
    requires_attunement: bool = False
    attunement_restriction: Optional[str] = None
    source_book: Optional[str] = None
    source_page: Optional[int] = None


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    rarity: Optional[str] = None
    weight: Optional[float] = None
    value_gp: Optional[float] = None
    is_magical: Optional[bool] = None
    is_consumable: Optional[bool] = None
    requires_attunement: Optional[bool] = None
    attunement_restriction: Optional[str] = None
    source_book: Optional[str] = None
    source_page: Optional[int] = None


class InventoryAdd(BaseModel):
    item_id: UUID
    quantity: int = 1
    equipped: bool = False
    notes: Optional[str] = None


class InventoryUpdate(BaseModel):
    quantity: Optional[int] = None
    equipped: Optional[bool] = None
    attuned: Optional[bool] = None
    charges_current: Optional[int] = None
    custom_name: Optional[str] = None
    notes: Optional[str] = None


class TreasuryAdd(BaseModel):
    item_id: UUID
    quantity: int = 1
    notes: Optional[str] = None


class TreasuryUpdate(BaseModel):
    quantity: Optional[int] = None
    notes: Optional[str] = None


class CurrencyUpdate(BaseModel):
    copper: int = 0
    silver: int = 0
    electrum: int = 0
    gold: int = 0
    platinum: int = 0
