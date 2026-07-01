from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_validator

# ── Valores válidos (alineados con el schema 004_spells.sql y el documento) ──
SPELL_SCHOOLS = {
    "abjuration", "conjuration", "divination", "enchantment",
    "evocation", "illusion", "necromancy", "transmutation",
}
# Claves canónicas de clase lanzadora (documento §16)
SPELLCASTER_CLASSES = {
    "bard", "cleric", "druid", "paladin", "ranger",
    "sorcerer", "warlock", "wizard",
    "eldritch_knight", "arcane_trickster",
}
ABILITY_KEYS = {"STR", "DEX", "CON", "INT", "WIS", "CHA"}
CASTING_TIME_TYPES = {"action", "bonus_action", "reaction", "minutes", "hours"}
RANGE_TYPES = {"self", "touch", "ranged", "sight", "unlimited"}
SPELL_SOURCES = {"class", "subclass", "race", "feat", "item"}


# ── Campos compartidos por todos los modelos de hechizo ───────────────
class _SpellBase(BaseModel):
    name: Optional[str] = None
    name_en: Optional[str] = None
    level: Optional[int] = None
    school: Optional[str] = None

    # Ejecución
    casting_time: Optional[str] = None
    casting_time_type: Optional[str] = None
    range_text: Optional[str] = None
    range_type: Optional[str] = None
    range_feet: Optional[int] = None

    # Componentes
    comp_verbal: Optional[bool] = None
    comp_somatic: Optional[bool] = None
    comp_material: Optional[bool] = None
    material_description: Optional[str] = None
    material_cost_gp: Optional[float] = None
    material_consumed: Optional[bool] = None

    duration: Optional[str] = None
    concentration: Optional[bool] = None
    ritual: Optional[bool] = None

    # Contenido
    description: Optional[str] = None
    higher_levels: Optional[str] = None

    # Resolución
    requires_attack_roll: Optional[bool] = None
    saving_throw: Optional[str] = None
    damage_dice: Optional[str] = None
    damage_type: Optional[str] = None
    damage_scaling: Optional[str] = None

    # Disponibilidad
    classes: Optional[list[str]] = None

    # Referencia SRD
    source_book: Optional[str] = None
    source_page: Optional[int] = None
    dnd5eapi_index: Optional[str] = None
    open5e_key: Optional[str] = None

    @field_validator("level")
    @classmethod
    def _check_level(cls, v):
        if v is not None and not (0 <= v <= 9):
            raise ValueError("level debe estar entre 0 (truco) y 9")
        return v

    @field_validator("school")
    @classmethod
    def _check_school(cls, v):
        if v is not None and v not in SPELL_SCHOOLS:
            raise ValueError("school invalida: " + str(v))
        return v

    @field_validator("saving_throw")
    @classmethod
    def _check_saving_throw(cls, v):
        if v is not None and v != "" and v.upper() not in ABILITY_KEYS:
            raise ValueError("saving_throw invalido: " + str(v))
        return v.upper() if isinstance(v, str) and v else v

    @field_validator("casting_time_type")
    @classmethod
    def _check_casting_time_type(cls, v):
        if v is not None and v not in CASTING_TIME_TYPES:
            raise ValueError("casting_time_type invalido: " + str(v))
        return v

    @field_validator("range_type")
    @classmethod
    def _check_range_type(cls, v):
        if v is not None and v not in RANGE_TYPES:
            raise ValueError("range_type invalido: " + str(v))
        return v

    @field_validator("classes")
    @classmethod
    def _check_classes(cls, v):
        if v is not None:
            invalid = [c for c in v if c not in SPELLCASTER_CLASSES]
            if invalid:
                raise ValueError("clases invalidas: " + ", ".join(invalid))
        return v


class SpellCreate(_SpellBase):
    name: str  # obligatorio al crear
    level: int = 0
    school: str = "evocation"


class SpellUpdate(_SpellBase):
    """Todos los campos opcionales; solo se actualizan los enviados."""
    pass


class SpellOut(_SpellBase):
    id: UUID

    model_config = {"from_attributes": True}


# ── Repertorio del personaje (character_spells) ───────────────────────
class CharacterSpellAdd(BaseModel):
    spell_id: UUID
    is_prepared: bool = False
    is_always_known: bool = False
    source: str = "class"
    notes: Optional[str] = None

    @field_validator("source")
    @classmethod
    def _check_source(cls, v):
        if v is not None and v not in SPELL_SOURCES:
            raise ValueError("source invalido: " + str(v))
        return v


class CharacterSpellUpdate(BaseModel):
    is_prepared: Optional[bool] = None
    is_always_known: Optional[bool] = None
    source: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("source")
    @classmethod
    def _check_source(cls, v):
        if v is not None and v not in SPELL_SOURCES:
            raise ValueError("source invalido: " + str(v))
        return v
