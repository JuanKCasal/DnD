import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response, list_response, log_event, paginate, records_to_list
from api.models.spell_model import SpellCreate, SpellUpdate

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
    material_cost_gp, material_consumed,
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
