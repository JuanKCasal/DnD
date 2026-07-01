from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator

# ── Valores válidos (alineados con los enums del schema v2.0) ──────────
ITEM_TYPES = {
    "weapon", "armor", "potion", "spell_scroll", "ring", "rod", "staff",
    "wand", "wondrous", "tool", "ammunition", "gear", "treasure",
    "vehicle", "other",
}
ITEM_RARITIES = {
    "common", "uncommon", "rare", "very_rare", "legendary", "artifact",
}
WEAPON_CATEGORIES = {"Simple", "Martial"}
WEAPON_RANGE_TYPES = {"Melee", "Ranged"}
ARMOR_CATEGORIES = {"Light", "Medium", "Heavy", "Shield"}
CHARGES_RECHARGE = {"dawn", "dusk", "short_rest", "long_rest"}
EQUIP_SLOTS = {
    "head", "neck", "body", "cloak", "hands", "ring_left", "ring_right",
    "waist", "feet", "main_hand", "off_hand", "back",
}


# ── Campos compartidos por todos los modelos de item ──────────────────
class _ItemBase(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    rarity: Optional[str] = None
    weight: Optional[float] = None
    value_gp: Optional[float] = None

    # Propiedades magicas / consumibles
    is_magical: Optional[bool] = None
    is_consumable: Optional[bool] = None
    requires_attunement: Optional[bool] = None
    attunement_restriction: Optional[str] = None
    charges_max: Optional[int] = None
    charges_recharge: Optional[str] = None
    sentient: Optional[bool] = None
    cursed: Optional[bool] = None

    # Arma
    weapon_category: Optional[str] = None
    weapon_range_type: Optional[str] = None
    damage_dice: Optional[str] = None
    damage_type: Optional[str] = None
    damage_dice_versatile: Optional[str] = None
    range_normal: Optional[int] = None
    range_long: Optional[int] = None
    throw_range_normal: Optional[int] = None
    throw_range_long: Optional[int] = None
    weapon_properties: Optional[list[str]] = None
    bonus_attack: Optional[int] = None

    # Armadura
    armor_category: Optional[str] = None
    ac_base: Optional[int] = None
    ac_dex_bonus: Optional[bool] = None
    ac_max_dex_bonus: Optional[int] = None
    str_minimum: Optional[int] = None
    stealth_disadvantage: Optional[bool] = None
    bonus_ac: Optional[int] = None

    # Propiedades magicas extendidas (bag JSONB)
    magical_properties: Optional[dict] = None

    # Referencia SRD
    source_book: Optional[str] = None
    source_page: Optional[int] = None
    dnd5eapi_index: Optional[str] = None
    open5e_key: Optional[str] = None

    @field_validator("type")
    @classmethod
    def _check_type(cls, v):
        if v is not None and v not in ITEM_TYPES:
            raise ValueError("type invalido: " + str(v))
        return v

    @field_validator("rarity")
    @classmethod
    def _check_rarity(cls, v):
        if v is not None and v not in ITEM_RARITIES:
            raise ValueError("rarity invalida: " + str(v))
        return v

    @field_validator("weapon_category")
    @classmethod
    def _check_weapon_category(cls, v):
        if v is not None and v not in WEAPON_CATEGORIES:
            raise ValueError("weapon_category invalida: " + str(v))
        return v

    @field_validator("weapon_range_type")
    @classmethod
    def _check_weapon_range_type(cls, v):
        if v is not None and v not in WEAPON_RANGE_TYPES:
            raise ValueError("weapon_range_type invalido: " + str(v))
        return v

    @field_validator("armor_category")
    @classmethod
    def _check_armor_category(cls, v):
        if v is not None and v not in ARMOR_CATEGORIES:
            raise ValueError("armor_category invalida: " + str(v))
        return v

    @field_validator("charges_recharge")
    @classmethod
    def _check_charges_recharge(cls, v):
        if v is not None and v not in CHARGES_RECHARGE:
            raise ValueError("charges_recharge invalido: " + str(v))
        return v


class ItemCreate(_ItemBase):
    name: str  # obligatorio al crear
    type: str = "other"
    rarity: str = "common"


class ItemUpdate(_ItemBase):
    """Todos los campos opcionales; solo se actualizan los enviados."""
    pass


class ItemOut(_ItemBase):
    id: UUID

    model_config = {"from_attributes": True}


# ── Inventario de personaje / tesoro / moneda ─────────────────────────
class InventoryAdd(BaseModel):
    item_id: UUID
    quantity: int = 1
    equipped: bool = False
    notes: Optional[str] = None


class InventoryUpdate(BaseModel):
    quantity: Optional[int] = None
    equipped: Optional[bool] = None
    slot: Optional[str] = None
    attuned: Optional[bool] = None
    charges_current: Optional[int] = None
    custom_name: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("slot")
    @classmethod
    def _check_slot(cls, v):
        if v is not None and v not in EQUIP_SLOTS:
            raise ValueError("slot invalido: " + str(v))
        return v


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
