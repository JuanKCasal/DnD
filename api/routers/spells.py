import json
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response, list_response, log_event, paginate, records_to_list
from api.models.spell_model import (
    SpellCreate, SpellUpdate, CharacterSpellAdd, CharacterSpellUpdate,
    SpellCastRequest, RestRequest, ConcentrationSet,
)
from api.services.spellcasting import (
    class_key, can_learn, ability_mod, max_cantrips, max_spells_known,
    max_spells_prepared, spell_slots_for, pact_slots_for, max_spell_level,
    PREPARATION_MODEL, SPELLCASTING_ABILITY, CASTER_TYPE,
)

router = APIRouter(prefix="/api/v1", tags=["spells"])

# ── Columnas del catálogo de hechizos ─────────────────────────────────
# Proyección ligera para listados (sin textos largos para aligerar el payload)
SPELL_LIST_COLUMNS = """
    id, name, name_en, level, school,
    casting_time, casting_time_type, range_text, range_type, range_feet,
    comp_verbal, comp_somatic, comp_material,
    duration, concentration, ritual,
    requires_attack_roll, saving_throw, damage_dice, damage_type, damage_scaling,
    classes, source_book
"""

# Proyección completa (incluye descripción y upcasting) para detalle/escritura
SPELL_FULL_COLUMNS = """
    id, name, name_en, level, school,
    casting_time, casting_time_type, range_text, range_type, range_feet,
    comp_verbal, comp_somatic, comp_material, material_description,
    material_cost_gp, material_consumed, material_item_id,
    duration, concentration, ritual,
    description, higher_levels,
    requires_attack_roll, saving_throw, damage_dice, damage_type, damage_scaling,
    classes, source_book, source_page, dnd5eapi_index, open5e_key
"""

# Campos que requieren cast explícito en INSERT/UPDATE
SPELL_FIELD_CASTS = {
    "school": "::spell_school",
}


# ═══════════════════════════════════════════════════════
#  SPELLS CATALOGUE
# ═══════════════════════════════════════════════════════

@router.get("/spells", response_model=dict)
async def list_spells(
    search: str | None = Query(None),
    level: int | None = Query(None, ge=0, le=9),
    school: str | None = Query(None),
    char_class: str | None = Query(None, alias="class"),
    ritual: bool | None = Query(None),
    concentration: bool | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    conditions: list[str] = []
    params: list = []
    idx = 1

    if search:
        conditions.append(f"(name ILIKE ${idx} OR name_en ILIKE ${idx})")
        params.append(f"%{search}%")
        idx += 1
    if level is not None:
        conditions.append(f"level = ${idx}")
        params.append(level)
        idx += 1
    if school:
        conditions.append(f"school = ${idx}::spell_school")
        params.append(school)
        idx += 1
    if char_class:
        conditions.append(f"${idx} = ANY(classes)")
        params.append(char_class)
        idx += 1
    if ritual is not None:
        conditions.append(f"ritual = ${idx}")
        params.append(ritual)
        idx += 1
    if concentration is not None:
        conditions.append(f"concentration = ${idx}")
        params.append(concentration)
        idx += 1

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    offset, limit = paginate(page, per_page)
    total = await conn.fetchval(f"SELECT COUNT(*) FROM spells {where}", *params)

    rows = await conn.fetch(
        f"""
        SELECT {SPELL_LIST_COLUMNS}
        FROM spells {where}
        ORDER BY level ASC, name ASC
        LIMIT ${idx} OFFSET ${idx + 1}
        """,
        *(params + [limit, offset]),
    )
    return list_response(records_to_list(rows), total, page, per_page)


@router.post("/spells", response_model=dict, status_code=201)
async def create_spell(
    body: SpellCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create spells")

    data = body.model_dump(exclude_unset=True)

    cols: list[str] = []
    placeholders: list[str] = []
    params: list = []
    idx = 1
    for field, value in data.items():
        cast = SPELL_FIELD_CASTS.get(field, "")
        cols.append(field)
        placeholders.append(f"${idx}{cast}")
        params.append(value)
        idx += 1

    row = await conn.fetchrow(
        f"""
        INSERT INTO spells ({', '.join(cols)})
        VALUES ({', '.join(placeholders)})
        RETURNING {SPELL_FULL_COLUMNS}
        """,
        *params,
    )
    result = dict(row)
    await log_event(conn, "spell_created", "spell", str(result["id"]), result["name"],
                    actor_member_id=str(current_user["id"]))
    return item_response(result)


@router.get("/spells/{spell_id}", response_model=dict)
async def get_spell(
    spell_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    row = await conn.fetchrow(
        f"SELECT {SPELL_FULL_COLUMNS} FROM spells WHERE id = $1",
        spell_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Spell not found")
    return item_response(dict(row))


@router.put("/spells/{spell_id}", response_model=dict)
async def update_spell(
    spell_id: uuid.UUID,
    body: SpellUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update spells")

    existing = await conn.fetchrow("SELECT id FROM spells WHERE id = $1", spell_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Spell not found")

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts: list[str] = []
    params: list = []
    idx = 1
    for field, value in updates.items():
        cast = SPELL_FIELD_CASTS.get(field, "")
        set_parts.append(f"{field} = ${idx}{cast}")
        params.append(value)
        idx += 1

    params.append(spell_id)
    row = await conn.fetchrow(
        f"""
        UPDATE spells SET {', '.join(set_parts)}
        WHERE id = ${idx}
        RETURNING {SPELL_FULL_COLUMNS}
        """,
        *params,
    )
    result = dict(row)
    await log_event(conn, "spell_updated", "spell", str(result["id"]), result["name"],
                    actor_member_id=str(current_user["id"]))
    return item_response(result)


@router.delete("/spells/{spell_id}", status_code=204)
async def delete_spell(
    spell_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete spells")

    row = await conn.fetchrow("SELECT name FROM spells WHERE id = $1", spell_id)
    if not row:
        raise HTTPException(status_code=404, detail="Spell not found")

    await conn.execute("DELETE FROM spells WHERE id = $1", spell_id)
    await log_event(conn, "spell_deleted", "spell", str(spell_id), row["name"],
                    actor_member_id=str(current_user["id"]))


# ═══════════════════════════════════════════════════════
#  CHARACTER SPELL REPERTOIRE (character_spells) — Fase H5
# ═══════════════════════════════════════════════════════
_ABILITY_SCORE_COL = {"STR": "str_score", "DEX": "dex_score", "CON": "con_score",
                      "INT": "int_score", "WIS": "wis_score", "CHA": "cha_score"}

REPERTOIRE_COLUMNS = """
    cs.spell_id, cs.is_prepared, cs.is_always_known, cs.source,
    s.name, s.name_en, s.level, s.school, s.casting_time, s.range_text,
    s.range_type, s.range_feet, s.comp_verbal, s.comp_somatic, s.comp_material,
    s.material_description, s.duration, s.concentration, s.ritual,
    s.description, s.higher_levels, s.requires_attack_roll, s.saving_throw,
    s.damage_dice, s.damage_type, s.damage_scaling, s.classes
"""


async def _char_for_spells(conn, char_id):
    return await conn.fetchrow(
        """
        SELECT c.id, c.member_id, c.class AS char_class, c.subclass, c.level,
               c.str AS str_score, c.dex AS dex_score, c.con AS con_score,
               c.int AS int_score, c.wis AS wis_score, c.cha AS cha_score
        FROM characters c WHERE c.id = $1 AND c.active = TRUE
        """,
        char_id,
    )


def _can_edit(current_user, member_id) -> bool:
    return current_user["role"] in ("admin", "dm") or str(member_id) == str(current_user["id"])


def _ability_mod_for(char, key) -> int:
    ability = SPELLCASTING_ABILITY.get(key)
    return ability_mod(char[_ABILITY_SCORE_COL[ability]]) if ability else 0


@router.get("/characters/{char_id}/spells", response_model=dict)
async def get_character_spells(
    char_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    char = await conn.fetchrow(
        "SELECT id FROM characters WHERE id = $1 AND active = TRUE", char_id
    )
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    rows = await conn.fetch(
        f"""
        SELECT {REPERTOIRE_COLUMNS}
        FROM character_spells cs JOIN spells s ON s.id = cs.spell_id
        WHERE cs.character_id = $1
        ORDER BY s.level ASC, s.name ASC
        """,
        char_id,
    )
    return item_response(records_to_list(rows))


@router.post("/characters/{char_id}/spells", response_model=dict, status_code=201)
async def add_character_spell(
    char_id: uuid.UUID,
    body: CharacterSpellAdd,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char = await _char_for_spells(conn, char_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, char["member_id"]):
        raise HTTPException(status_code=403, detail="Cannot modify another player's spells")

    spell = await conn.fetchrow(
        "SELECT id, name, level, classes FROM spells WHERE id = $1", body.spell_id
    )
    if not spell:
        raise HTTPException(status_code=404, detail="Spell not found")

    key = class_key(char["char_class"], char["subclass"])
    level = char["level"] or 1

    # Disponibilidad por clase / nivel (documento §17), salvo que sea "siempre conocido"
    if not body.is_always_known:
        ok, reason = can_learn(dict(spell), key, level)
        if not ok:
            raise HTTPException(status_code=400, detail={"code": "SPELL_NOT_AVAILABLE", "message": reason})

    exists = await conn.fetchval(
        "SELECT 1 FROM character_spells WHERE character_id = $1 AND spell_id = $2",
        char_id, body.spell_id,
    )

    # Límites de repertorio (solo al añadir uno nuevo y no "siempre conocido")
    if not exists and not body.is_always_known and key:
        model = PREPARATION_MODEL.get(key)
        if spell["level"] == 0:
            count = await conn.fetchval(
                """
                SELECT COUNT(*) FROM character_spells cs JOIN spells s ON s.id = cs.spell_id
                WHERE cs.character_id = $1 AND s.level = 0 AND cs.is_always_known = FALSE
                """,
                char_id,
            )
            if count >= max_cantrips(key, level):
                raise HTTPException(status_code=400, detail={
                    "code": "CANTRIP_LIMIT", "message": "Alcanzaste el máximo de trucos conocidos"})
        elif model == "known":
            limit = max_spells_known(key, level) or 0
            count = await conn.fetchval(
                """
                SELECT COUNT(*) FROM character_spells cs JOIN spells s ON s.id = cs.spell_id
                WHERE cs.character_id = $1 AND s.level > 0 AND cs.is_always_known = FALSE
                """,
                char_id,
            )
            if count >= limit:
                raise HTTPException(status_code=400, detail={
                    "code": "KNOWN_LIMIT", "message": "Alcanzaste el máximo de hechizos conocidos"})

    row = await conn.fetchrow(
        f"""
        INSERT INTO character_spells (character_id, spell_id, is_prepared, is_always_known, source, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (character_id, spell_id)
        DO UPDATE SET is_prepared = EXCLUDED.is_prepared,
                      is_always_known = EXCLUDED.is_always_known,
                      source = EXCLUDED.source,
                      notes = COALESCE(EXCLUDED.notes, character_spells.notes)
        RETURNING spell_id, is_prepared, is_always_known, source, notes
        """,
        char_id, body.spell_id, body.is_prepared, body.is_always_known, body.source, body.notes,
    )
    await log_event(conn, "spell_learned", "character", str(char_id), spell["name"],
                    actor_member_id=str(current_user["id"]))
    return item_response(dict(row))


@router.put("/characters/{char_id}/spells/{spell_id}", response_model=dict)
async def update_character_spell(
    char_id: uuid.UUID,
    spell_id: uuid.UUID,
    body: CharacterSpellUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char = await _char_for_spells(conn, char_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, char["member_id"]):
        raise HTTPException(status_code=403, detail="Cannot modify another player's spells")

    entry = await conn.fetchrow(
        """
        SELECT s.level FROM character_spells cs JOIN spells s ON s.id = cs.spell_id
        WHERE cs.character_id = $1 AND cs.spell_id = $2
        """,
        char_id, spell_id,
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Spell not in repertoire")

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    key = class_key(char["char_class"], char["subclass"])
    level = char["level"] or 1

    # Límite de preparados (solo modelo "preparado", hechizos de nivel >= 1)
    if updates.get("is_prepared") is True and entry["level"] > 0 and PREPARATION_MODEL.get(key) == "prepared":
        prepared = await conn.fetchval(
            """
            SELECT COUNT(*) FROM character_spells cs JOIN spells s ON s.id = cs.spell_id
            WHERE cs.character_id = $1 AND s.level > 0 AND cs.is_prepared = TRUE AND cs.spell_id <> $2
            """,
            char_id, spell_id,
        )
        limit = max_spells_prepared(key, level, _ability_mod_for(char, key)) or 0
        if prepared >= limit:
            raise HTTPException(status_code=400, detail={
                "code": "PREPARED_LIMIT", "message": f"Ya tienes {limit} hechizos preparados (máximo)"})

    set_parts, params, idx = [], [], 1
    for field, value in updates.items():
        set_parts.append(f"{field} = ${idx}")
        params.append(value)
        idx += 1
    params += [char_id, spell_id]
    row = await conn.fetchrow(
        f"""
        UPDATE character_spells SET {', '.join(set_parts)}
        WHERE character_id = ${idx} AND spell_id = ${idx + 1}
        RETURNING spell_id, is_prepared, is_always_known, source, notes
        """,
        *params,
    )
    return item_response(dict(row))


@router.delete("/characters/{char_id}/spells/{spell_id}", status_code=204)
async def remove_character_spell(
    char_id: uuid.UUID,
    spell_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char = await _char_for_spells(conn, char_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, char["member_id"]):
        raise HTTPException(status_code=403, detail="Cannot modify another player's spells")

    result = await conn.execute(
        "DELETE FROM character_spells WHERE character_id = $1 AND spell_id = $2",
        char_id, spell_id,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Spell not in repertoire")


# ═══════════════════════════════════════════════════════
#  LANZAMIENTO / DESCANSOS / CONCENTRACIÓN — Fase H6
# ═══════════════════════════════════════════════════════
_RITUAL_CLASSES = {"bard", "cleric", "druid", "wizard"}


async def _cast_char(conn, char_id):
    return await conn.fetchrow(
        """
        SELECT c.id, c.member_id, c.class AS char_class, c.subclass, c.level,
               c.spell_slots, c.pact_magic, c.concentrating_on
        FROM characters c WHERE c.id = $1 AND c.active = TRUE
        """,
        char_id,
    )


def _parse_jsonb(val):
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (ValueError, TypeError):
            return {}
    return val or {}


def _used_map(spell_slots) -> dict:
    """{'1': used, ...} a partir del JSONB almacenado."""
    stored = _parse_jsonb(spell_slots)
    out = {}
    for lvl, entry in (stored or {}).items():
        if isinstance(entry, dict):
            out[str(lvl)] = int(entry.get("used") or 0)
    return out


def _slots_jsonb(used_map: dict) -> str:
    return json.dumps({lvl: {"used": u} for lvl, u in used_map.items()})


@router.post("/characters/{char_id}/cast", response_model=dict)
async def cast_spell(
    char_id: uuid.UUID,
    body: SpellCastRequest,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char = await _cast_char(conn, char_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, char["member_id"]):
        raise HTTPException(status_code=403, detail="Cannot act for another player's character")

    spell = await conn.fetchrow(
        """
        SELECT id, name, level, concentration, ritual, higher_levels,
               material_consumed, material_cost_gp, material_item_id
        FROM spells WHERE id = $1
        """,
        body.spell_id,
    )
    if not spell:
        raise HTTPException(status_code=404, detail="Spell not found")

    key = class_key(char["char_class"], char["subclass"])
    level = char["level"] or 1
    if not key or CASTER_TYPE.get(key) is None:
        raise HTTPException(status_code=400, detail={"code": "NOT_A_CASTER", "message": "Esta clase no lanza hechizos"})
    caster = CASTER_TYPE[key]

    warnings = []
    cast_level = spell["level"]
    scaling_note = None
    used_map = _used_map(char["spell_slots"])
    pact = _parse_jsonb(char["pact_magic"])
    pact_used = int(pact.get("used") or 0)

    # ── Determinar gasto de ranura ──
    if body.as_ritual:
        if not spell["ritual"] or key not in _RITUAL_CLASSES:
            raise HTTPException(status_code=400, detail={
                "code": "RITUAL_NOT_ALLOWED",
                "message": "Este hechizo o tu clase no permite lanzamiento ritual"})
        warnings.append("Lanzado como ritual (+10 min, sin gastar ranura).")
    elif spell["level"] == 0:
        pass  # los trucos no gastan ranura
    elif caster == "pact":
        pinfo = pact_slots_for(level)
        if not pinfo:
            raise HTTPException(status_code=400, detail={"code": "NO_SLOTS", "message": "No tienes ranuras de pacto"})
        if spell["level"] > pinfo["slot_level"]:
            raise HTTPException(status_code=400, detail={"code": "LEVEL_TOO_HIGH", "message": "Nivel de hechizo superior a tu ranura de pacto"})
        if pact_used >= pinfo["slots"]:
            raise HTTPException(status_code=400, detail={"code": "NO_SLOTS", "message": "Sin ranuras de pacto disponibles"})
        pact_used += 1
        cast_level = pinfo["slot_level"]
        if cast_level > spell["level"]:
            scaling_note = spell["higher_levels"]
    else:
        base = spell["level"]
        chosen = body.slot_level or base
        if chosen < base:
            raise HTTPException(status_code=400, detail={"code": "SLOT_TOO_LOW", "message": "La ranura es de nivel inferior al hechizo"})
        totals = spell_slots_for(key, level)  # {'1': total, ...}
        total = int(totals.get(str(chosen)) or 0)
        used = used_map.get(str(chosen), 0)
        if used >= total:
            raise HTTPException(status_code=400, detail={"code": "NO_SLOTS", "message": f"Sin ranuras de nivel {chosen} disponibles"})
        used_map[str(chosen)] = used + 1
        cast_level = chosen
        if chosen > base:
            scaling_note = spell["higher_levels"] or "Lanzado a nivel superior."

    # ── Componente material con coste ──
    consumed_name = None
    if spell["material_consumed"]:
        if spell["material_item_id"]:
            comp = await conn.fetchrow("SELECT name FROM items WHERE id = $1", spell["material_item_id"])
            comp_name = comp["name"] if comp else "componente"
            inv = await conn.fetchrow(
                "SELECT quantity FROM character_inventory WHERE character_id = $1 AND item_id = $2",
                char_id, spell["material_item_id"],
            )
            if not inv or inv["quantity"] < 1:
                raise HTTPException(status_code=400, detail={
                    "code": "MISSING_COMPONENT",
                    "message": f"Necesitas «{comp_name}» en tu inventario para lanzar este conjuro"})
            consumed_name = comp_name
        elif spell["material_cost_gp"]:
            warnings.append(
                f"Consume un componente material de {spell['material_cost_gp']:.0f} po "
                "(enlaza el ítem al hechizo para controlarlo).")

    # ── Concentración ──
    new_concentration = char["concentrating_on"]
    replaced = None
    if spell["concentration"]:
        if char["concentrating_on"] and str(char["concentrating_on"]) != str(spell["id"]):
            prev = await conn.fetchrow("SELECT name FROM spells WHERE id = $1", char["concentrating_on"])
            replaced = prev["name"] if prev else None
        new_concentration = spell["id"]

    # ── Persistir (transacción) ──
    async with conn.transaction():
        if consumed_name:
            row = await conn.fetchrow(
                "SELECT quantity FROM character_inventory WHERE character_id = $1 AND item_id = $2 FOR UPDATE",
                char_id, spell["material_item_id"],
            )
            if not row or row["quantity"] < 1:
                raise HTTPException(status_code=400, detail={
                    "code": "MISSING_COMPONENT", "message": "Ya no tienes el componente requerido"})
            if row["quantity"] <= 1:
                await conn.execute(
                    "DELETE FROM character_inventory WHERE character_id = $1 AND item_id = $2",
                    char_id, spell["material_item_id"])
            else:
                await conn.execute(
                    "UPDATE character_inventory SET quantity = quantity - 1 WHERE character_id = $1 AND item_id = $2",
                    char_id, spell["material_item_id"])
        await conn.execute(
            "UPDATE characters SET spell_slots = $1::jsonb, pact_magic = $2::jsonb, concentrating_on = $3 WHERE id = $4",
            _slots_jsonb(used_map),
            json.dumps({"used": pact_used}) if caster == "pact" else (json.dumps(pact) if pact else None),
            new_concentration, char_id,
        )
    await log_event(conn, "spell_cast", "character", str(char_id), spell["name"],
                    actor_member_id=str(current_user["id"]), metadata={"level": cast_level})

    return item_response({
        "spell": spell["name"], "cast_level": cast_level, "as_ritual": body.as_ritual,
        "scaling_note": scaling_note, "consumed_component": consumed_name,
        "concentration": bool(spell["concentration"]),
        "replaced_concentration": replaced, "warnings": warnings,
    })


@router.post("/characters/{char_id}/rest", response_model=dict)
async def rest(
    char_id: uuid.UUID,
    body: RestRequest,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char = await _cast_char(conn, char_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, char["member_id"]):
        raise HTTPException(status_code=403, detail="Cannot act for another player's character")

    pact = _parse_jsonb(char["pact_magic"])
    if body.type == "short":
        # Pact Magic se recupera en descanso corto
        pact["used"] = 0
        await conn.execute(
            "UPDATE characters SET pact_magic = $1::jsonb WHERE id = $2",
            json.dumps(pact), char_id)
        msg = "Descanso corto: ranuras de pacto recuperadas."
    else:
        # Descanso largo: todas las ranuras y la concentración
        pact["used"] = 0
        await conn.execute(
            "UPDATE characters SET spell_slots = '{}'::jsonb, pact_magic = $1::jsonb, concentrating_on = NULL WHERE id = $2",
            json.dumps(pact), char_id)
        msg = "Descanso largo: todas las ranuras recuperadas."
    return item_response({"rest": body.type, "message": msg})


@router.put("/characters/{char_id}/concentration", response_model=dict)
async def set_concentration(
    char_id: uuid.UUID,
    body: ConcentrationSet,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char = await _cast_char(conn, char_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, char["member_id"]):
        raise HTTPException(status_code=403, detail="Cannot act for another player's character")
    await conn.execute(
        "UPDATE characters SET concentrating_on = $1 WHERE id = $2", body.spell_id, char_id)
    return item_response({"concentrating_on": str(body.spell_id) if body.spell_id else None})


@router.post("/characters/{char_id}/spell-slots/restore", response_model=dict)
async def restore_slot(
    char_id: uuid.UUID,
    level: int = Query(..., ge=1, le=9),
    is_pact: bool = Query(False),
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Recupera manualmente una ranura (−1 al 'used')."""
    char = await _cast_char(conn, char_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, char["member_id"]):
        raise HTTPException(status_code=403, detail="Cannot act for another player's character")

    if is_pact:
        pact = _parse_jsonb(char["pact_magic"])
        pact["used"] = max(0, int(pact.get("used") or 0) - 1)
        await conn.execute("UPDATE characters SET pact_magic = $1::jsonb WHERE id = $2", json.dumps(pact), char_id)
    else:
        used_map = _used_map(char["spell_slots"])
        used_map[str(level)] = max(0, used_map.get(str(level), 0) - 1)
        await conn.execute("UPDATE characters SET spell_slots = $1::jsonb WHERE id = $2", _slots_jsonb(used_map), char_id)
    return item_response({"restored_level": level, "is_pact": is_pact})
