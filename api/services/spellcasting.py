"""
Servicio de conjuración D&D 5e (Fase H4).

Funciones puras, sin acceso a BD: reciben los datos del personaje y devuelven
el estado de conjuración derivado (característica mágica, tipo de lanzador, CD y
bonus de ataque, ranuras por nivel, límites de trucos/conocidos/preparados,
nivel máximo de hechizo y disponibilidad por clase).

Referencia: documento dnd5e_spells_guide.md, secciones §1–§3, §10, §12, §14.
Alcance: pragmático. Pact Magic se expone como pool separado; Mystic Arcanum,
puntos de hechicería y upcasting automático quedan para H6.
"""
import unicodedata

# ── Claves canónicas de clase (coinciden con spells.classes / spell_model) ──
CANONICAL_CLASSES = {
    "bard", "cleric", "druid", "paladin", "ranger",
    "sorcerer", "warlock", "wizard", "eldritch_knight", "arcane_trickster",
}

# Característica mágica por clase (documento §1)
SPELLCASTING_ABILITY = {
    "wizard": "INT", "eldritch_knight": "INT", "arcane_trickster": "INT",
    "cleric": "WIS", "druid": "WIS", "ranger": "WIS",
    "bard": "CHA", "sorcerer": "CHA", "warlock": "CHA", "paladin": "CHA",
}

# Tipo de lanzador (documento §2)
CASTER_TYPE = {
    "bard": "full", "cleric": "full", "druid": "full", "sorcerer": "full", "wizard": "full",
    "paladin": "half", "ranger": "half",
    "eldritch_knight": "third", "arcane_trickster": "third",
    "warlock": "pact",
}

# Modelo de repertorio (documento §12)
PREPARATION_MODEL = {
    "cleric": "prepared", "druid": "prepared", "paladin": "prepared", "wizard": "prepared",
    "bard": "known", "sorcerer": "known", "warlock": "known", "ranger": "known",
    "eldritch_knight": "known", "arcane_trickster": "known",
}

# ── Alias español/inglés → clave canónica (para el campo characters.class) ──
_CLASS_ALIASES = {
    "mago": "wizard", "wizard": "wizard",
    "clerigo": "cleric", "cleric": "cleric",
    "druida": "druid", "druid": "druid",
    "paladin": "paladin", "paladín": "paladin",
    "explorador": "ranger", "montaraz": "ranger", "guardabosques": "ranger", "ranger": "ranger",
    "bardo": "bard", "bard": "bard",
    "hechicero": "sorcerer", "sorcerer": "sorcerer",
    "brujo": "warlock", "warlock": "warlock",
}

# ── Tablas de ranuras (documento §3) ────────────────────────────────
# Lista por nivel de personaje (índice = nivel-1) de conteos por nivel de hechizo.
FULL_SLOTS = {
    1:  [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3],
    7:  [4, 3, 3, 1], 8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1], 10: [4, 3, 3, 3, 2],
    11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1],
    13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1],
    15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1],
    17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
    19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
}
HALF_SLOTS = {
    1: [], 2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2], 7: [4, 3], 8: [4, 3],
    9: [4, 3, 2], 10: [4, 3, 2], 11: [4, 3, 3], 12: [4, 3, 3],
    13: [4, 3, 3, 1], 14: [4, 3, 3, 1], 15: [4, 3, 3, 2], 16: [4, 3, 3, 2],
    17: [4, 3, 3, 3, 1], 18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2],
}
THIRD_SLOTS = {
    1: [], 2: [], 3: [2], 4: [3], 5: [3], 6: [3], 7: [4, 2], 8: [4, 2], 9: [4, 2],
    10: [4, 3], 11: [4, 3], 12: [4, 3], 13: [4, 3, 2], 14: [4, 3, 2], 15: [4, 3, 2],
    16: [4, 3, 3], 17: [4, 3, 3], 18: [4, 3, 3], 19: [4, 3, 3, 1], 20: [4, 3, 3, 1],
}
# Pact Magic: nivel → (nº ranuras, nivel de ranura)  (documento §3.4)
PACT_SLOTS = {
    1: (1, 1), 2: (2, 1), 3: (2, 2), 4: (2, 2), 5: (2, 3), 6: (2, 3),
    7: (2, 4), 8: (2, 4), 9: (2, 5), 10: (2, 5),
    11: (3, 5), 12: (3, 5), 13: (3, 5), 14: (3, 5), 15: (3, 5), 16: (3, 5),
    17: (4, 5), 18: (4, 5), 19: (4, 5), 20: (4, 5),
}

# ── Hechizos conocidos por nivel (modelo "conocido", documento §14) ──
KNOWN_TABLE = {
    "bard":     [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
    "sorcerer": [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
    "warlock":  [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
    "ranger":   [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
    # EK/AT (tercio): aproximación PHB (conocidos por nivel de personaje)
    "eldritch_knight": [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
    "arcane_trickster": [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
}


def ability_mod(score) -> int:
    """Modificador de característica: floor((score - 10) / 2)."""
    if score is None:
        score = 10
    return (int(score) - 10) // 2


def _strip(s: str) -> str:
    """minúsculas sin acentos ni espacios extra."""
    s = (s or "").strip().lower()
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def class_key(char_class: str, subclass: str | None = None) -> str | None:
    """Normaliza el campo `class` (español/inglés) a la clave canónica.
    Detecta subclases lanzadoras de Guerrero/Pícaro por su subclase."""
    base = _strip(char_class)
    sub = _strip(subclass or "")
    if base in ("guerrero", "fighter"):
        if any(w in sub for w in ("arcano", "eldritch", "caballero")):
            return "eldritch_knight"
        return None
    if base in ("picaro", "rogue", "ladron"):
        if any(w in sub for w in ("arcano", "trickster", "embaucador")):
            return "arcane_trickster"
        return None
    return _CLASS_ALIASES.get(base)


def spell_save_dc(prof_bonus: int, abil_mod: int) -> int:
    return 8 + prof_bonus + abil_mod


def spell_attack_bonus(prof_bonus: int, abil_mod: int) -> int:
    return prof_bonus + abil_mod


def _slots_list(key: str, level: int) -> list[int]:
    ct = CASTER_TYPE.get(key)
    level = max(1, min(20, int(level or 1)))
    if ct == "full":
        return FULL_SLOTS.get(level, [])
    if ct == "half":
        return HALF_SLOTS.get(level, [])
    if ct == "third":
        return THIRD_SLOTS.get(level, [])
    return []


def spell_slots_for(key: str, level: int) -> dict:
    """Ranuras normales por nivel de hechizo: {"1": n, "2": n, ...} (solo > 0)."""
    return {str(i + 1): n for i, n in enumerate(_slots_list(key, level)) if n > 0}


def pact_slots_for(level: int) -> dict | None:
    num, slot_level = PACT_SLOTS.get(max(1, min(20, int(level or 1))), (0, 0))
    if num == 0:
        return None
    return {"slots": num, "slot_level": slot_level}


def max_spell_level(key: str, level: int) -> int:
    ct = CASTER_TYPE.get(key)
    if ct == "pact":
        pact = pact_slots_for(level)
        return pact["slot_level"] if pact else 0
    lst = _slots_list(key, level)
    # nivel más alto con al menos 1 ranura
    return max((i + 1 for i, n in enumerate(lst) if n > 0), default=0)


def max_cantrips(key: str, level: int) -> int:
    level = int(level or 1)
    base = {
        "bard": 2, "cleric": 3, "druid": 2, "sorcerer": 4, "warlock": 2, "wizard": 3,
    }
    if key in base:
        c = base[key]
        if level >= 10:
            c += 2
        elif level >= 4:
            c += 1
        return c
    if key == "eldritch_knight":
        return 0 if level < 3 else (3 if level >= 10 else 2)
    if key == "arcane_trickster":
        return 0 if level < 3 else (4 if level >= 10 else 3)
    return 0  # paladin, ranger: sin trucos


def max_spells_known(key: str, level: int) -> int | None:
    tbl = KNOWN_TABLE.get(key)
    if not tbl:
        return None
    return tbl[max(1, min(20, int(level or 1))) - 1]


def max_spells_prepared(key: str, level: int, abil_mod: int) -> int | None:
    if PREPARATION_MODEL.get(key) != "prepared":
        return None
    if key == "paladin":
        return max(1, abil_mod + level // 2)
    return max(1, abil_mod + level)  # cleric, druid, wizard


def cantrip_dice_count(character_level: int) -> int:
    """Escalado de daño de trucos por nivel de personaje (documento §4)."""
    lvl = int(character_level or 1)
    if lvl >= 17:
        return 4
    if lvl >= 11:
        return 3
    if lvl >= 5:
        return 2
    return 1


_ABILITY_SCORE_KEY = {"STR": "str_score", "DEX": "dex_score", "CON": "con_score",
                      "INT": "int_score", "WIS": "wis_score", "CHA": "cha_score"}


def compute_spellcasting(char: dict) -> dict:
    """
    char: {char_class, subclass, level, prof_bonus,
           str_score..cha_score}
    Devuelve el estado de conjuración derivado (no persiste).
    """
    level = int(char.get("level") or 1)
    prof = char.get("prof_bonus") or (2 + (level - 1) // 4)
    key = class_key(char.get("char_class"), char.get("subclass"))

    if not key or CASTER_TYPE.get(key) is None:
        return {
            "class_key": key,
            "is_caster": False,
            "caster_type": "none",
            "spellcasting_ability": None,
            "notes": ["Esta clase no lanza hechizos (o es una subclase no lanzadora)."],
        }

    ability = SPELLCASTING_ABILITY[key]
    abil_mod = ability_mod(char.get(_ABILITY_SCORE_KEY[ability]))
    ct = CASTER_TYPE[key]
    model = PREPARATION_MODEL[key]

    result = {
        "class_key": key,
        "is_caster": True,
        "caster_type": ct,
        "preparation_model": model,
        "spellcasting_ability": ability,
        "ability_modifier": abil_mod,
        "proficiency_bonus": prof,
        "spell_save_dc": spell_save_dc(prof, abil_mod),
        "spell_attack_bonus": spell_attack_bonus(prof, abil_mod),
        "max_cantrips": max_cantrips(key, level),
        "max_spell_level": max_spell_level(key, level),
        "cantrip_scaling_dice": cantrip_dice_count(level),
        "notes": [],
    }

    if ct == "pact":
        result["pact_magic"] = pact_slots_for(level)
        result["spell_slots"] = {}
        result["notes"].append("Pact Magic: las ranuras se recuperan en descanso corto.")
    else:
        result["spell_slots"] = spell_slots_for(key, level)
        result["pact_magic"] = None

    if model == "prepared":
        result["max_spells_prepared"] = max_spells_prepared(key, level, abil_mod)
        result["max_spells_known"] = None
        if key == "wizard":
            result["notes"].append("El mago solo puede preparar hechizos de su grimorio.")
    else:
        result["max_spells_known"] = max_spells_known(key, level)
        result["max_spells_prepared"] = None

    if level < 2 and ct == "half":
        result["notes"].append("Los medio-lanzadores empiezan a lanzar en el nivel 2.")

    return result


def can_learn(spell: dict, key: str, level: int) -> tuple[bool, str | None]:
    """¿El personaje (clave de clase, nivel) puede aprender este hechizo?
    Valida disponibilidad por lista de clase y nivel máximo. (documento §17)"""
    if not key or CASTER_TYPE.get(key) is None:
        return False, "La clase del personaje no lanza hechizos."
    classes = spell.get("classes") or []
    if key not in classes:
        return False, "Este hechizo no está en la lista de tu clase."
    sp_level = int(spell.get("level") or 0)
    if sp_level == 0:
        return True, None  # los trucos se validan por límite de trucos aparte
    if sp_level > max_spell_level(key, level):
        return False, "Aún no puedes lanzar hechizos de ese nivel."
    return True, None
