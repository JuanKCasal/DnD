"""Bestiario, encuentros y balanceo (Fase C5).

Expone el bestiario (stat_blocks: SRD global + homebrew de campaña), los
encuentros y la calculadora de dificultad del DMG (guía §12). El multiplicador
solo mide dificultad; el XP de recompensa usa el XP base (guía §13.1, §17.9).
"""
import json
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response, log_event
from api.models.stat_block import StatBlockCreate, StatBlockUpdate
from api.models.encounter import EncounterCreate, EncounterUpdate, DifficultyPreview
from api.services import encounter_math as em

router = APIRouter(prefix="/api/v1/campaigns", tags=["encounters"])

_SB_FIELDS = [
    "name", "size", "creature_type", "subtype", "alignment", "armor_class",
    "armor_class_note", "hit_points", "hit_dice", "speed", "abilities",
    "saving_throws", "skills", "senses", "languages", "damage_tags",
    "challenge_rating", "xp_value", "proficiency_bonus", "traits", "actions",
    "legendary_actions", "reactions", "description", "source", "is_homebrew",
]
_SB_JSON_DICT = {"speed", "abilities", "saving_throws", "skills", "senses", "damage_tags"}
_SB_JSON_LIST = {"traits", "actions", "legendary_actions", "reactions"}
_SB_JSON = _SB_JSON_DICT | _SB_JSON_LIST


async def _manager(conn, campaign_id, user) -> bool:
    row = await conn.fetchrow("SELECT dm_id FROM campaigns WHERE id = $1", campaign_id)
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return str(row["dm_id"]) == str(user["id"]) or user["role"] == "admin"


def _hydrate_sb(row: dict) -> dict:
    d = dict(row)
    for k in _SB_JSON:
        v = d.get(k)
        if isinstance(v, str):
            try:
                d[k] = json.loads(v)
            except (ValueError, TypeError):
                d[k] = [] if k in _SB_JSON_LIST else {}
    if d.get("challenge_rating") is not None:
        d["challenge_rating"] = float(d["challenge_rating"])
    return d


def _sb_value(field: str, raw):
    if field in _SB_JSON:
        default = [] if field in _SB_JSON_LIST else {}
        return json.dumps(raw if raw is not None else default)
    return raw


# ══════════════════════════ BESTIARY ══════════════════════════
@router.get("/{campaign_id}/bestiary", response_model=dict)
async def list_bestiary(
    campaign_id: uuid.UUID,
    search: str | None = Query(None),
    creature_type: str | None = Query(None),
    conn=Depends(get_db), current_user=Depends(get_current_user),
):
    await _manager(conn, campaign_id, current_user)  # valida campaña
    conditions = ["(campaign_id IS NULL OR campaign_id = $1)"]
    params: list = [campaign_id]
    idx = 2
    if search:
        conditions.append(f"name ILIKE ${idx}")
        params.append(f"%{search}%")
        idx += 1
    if creature_type:
        conditions.append(f"creature_type = ${idx}")
        params.append(creature_type)
        idx += 1
    rows = await conn.fetch(
        f"SELECT * FROM stat_blocks WHERE {' AND '.join(conditions)} ORDER BY challenge_rating ASC, name ASC",
        *params,
    )
    return {"data": [_hydrate_sb(r) for r in rows]}


@router.post("/{campaign_id}/bestiary", response_model=dict, status_code=201)
async def create_statblock(campaign_id: uuid.UUID, body: StatBlockCreate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede crear monstruos")
    values = body.model_dump()
    if not values.get("xp_value"):
        values["xp_value"] = em.xp_for_cr(values.get("challenge_rating") or 0)
    sb_id = uuid.uuid4()
    cols = ["id", "campaign_id"] + _SB_FIELDS
    ph, params = ["$1", "$2"], [sb_id, campaign_id]
    for i, f in enumerate(_SB_FIELDS, start=3):
        ph.append(f"${i}::jsonb" if f in _SB_JSON else f"${i}")
        params.append(_sb_value(f, values.get(f)))
    await conn.execute(f"INSERT INTO stat_blocks ({', '.join(cols)}) VALUES ({', '.join(ph)})", *params)
    await log_event(conn, "statblock.created", "stat_block", target_id=str(sb_id),
                    target_name=body.name, actor_member_id=str(current_user["id"]))
    row = await conn.fetchrow("SELECT * FROM stat_blocks WHERE id = $1", sb_id)
    return item_response(_hydrate_sb(row))


@router.put("/{campaign_id}/bestiary/{sb_id}", response_model=dict)
async def update_statblock(campaign_id: uuid.UUID, sb_id: uuid.UUID, body: StatBlockUpdate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede editar monstruos")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    clauses, params = [], []
    for i, (k, v) in enumerate(updates.items(), start=1):
        clauses.append(f"{k} = ${i}::jsonb" if k in _SB_JSON else f"{k} = ${i}")
        params.append(_sb_value(k, v))
    params += [sb_id, campaign_id]
    # Solo homebrew de la campaña es editable (los globales tienen campaign_id NULL)
    row = await conn.fetchrow(
        f"UPDATE stat_blocks SET {', '.join(clauses)} WHERE id = ${len(params)-1} AND campaign_id = ${len(params)} RETURNING *",
        *params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Monstruo no encontrado o es global (no editable)")
    return item_response(_hydrate_sb(row))


@router.delete("/{campaign_id}/bestiary/{sb_id}", status_code=204)
async def delete_statblock(campaign_id: uuid.UUID, sb_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede eliminar monstruos")
    result = await conn.execute("DELETE FROM stat_blocks WHERE id = $1 AND campaign_id = $2", sb_id, campaign_id)
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Monstruo no encontrado o es global (no eliminable)")


# ══════════════════════════ DIFFICULTY ══════════════════════════
async def _resolve_monsters(conn, monsters: list) -> list[dict]:
    """Convierte [{stat_block_id, quantity, xp_each?}] → [{xp, quantity, ...}] resolviendo XP del bestiario."""
    resolved = []
    for m in monsters:
        qty = int(m.quantity or 1)
        xp = m.xp_each
        name = m.name_override
        if xp is None and m.stat_block_id:
            r = await conn.fetchrow("SELECT xp_value, name FROM stat_blocks WHERE id = $1", m.stat_block_id)
            if r:
                xp = r["xp_value"]
                name = name or r["name"]
        resolved.append({
            "stat_block_id": m.stat_block_id, "name_override": name,
            "quantity": qty, "xp": int(xp or 0),
        })
    return resolved


@router.post("/{campaign_id}/encounters/preview-difficulty", response_model=dict)
async def preview_difficulty(campaign_id: uuid.UUID, body: DifficultyPreview, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede calcular encuentros")
    resolved = await _resolve_monsters(conn, body.monsters)
    levels = [body.party_level] * max(1, body.party_size)
    return item_response(em.calculate_difficulty(resolved, levels))


# ══════════════════════════ ENCOUNTERS ══════════════════════════
async def _load_monsters(conn, encounter_id) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT em.stat_block_id, em.name_override, em.quantity, em.xp_each, s.name AS stat_block_name
        FROM encounter_monsters em
        LEFT JOIN stat_blocks s ON s.id = em.stat_block_id
        WHERE em.encounter_id = $1
        """,
        encounter_id,
    )
    return [dict(r) for r in rows]


async def _replace_monsters(conn, encounter_id, resolved: list[dict]):
    await conn.execute("DELETE FROM encounter_monsters WHERE encounter_id = $1", encounter_id)
    for m in resolved:
        await conn.execute(
            "INSERT INTO encounter_monsters (encounter_id, stat_block_id, name_override, quantity, xp_each) VALUES ($1,$2,$3,$4,$5)",
            encounter_id, m["stat_block_id"], m["name_override"], m["quantity"], m["xp"],
        )


def _difficulty_of(resolved: list[dict], party_size: int, party_level: int) -> dict:
    levels = [party_level] * max(1, party_size)
    return em.calculate_difficulty(resolved, levels)


@router.get("/{campaign_id}/encounters", response_model=dict)
async def list_encounters(campaign_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    is_manager = await _manager(conn, campaign_id, current_user)
    where = "WHERE campaign_id = $1"
    if not is_manager:
        where += " AND visible_to_players = TRUE"
    rows = await conn.fetch(f"SELECT * FROM encounters {where} ORDER BY created_at DESC", campaign_id)
    out = []
    for r in rows:
        d = dict(r)
        if not is_manager:
            d.pop("dm_notes", None)
        d["monsters"] = await _load_monsters(conn, r["id"])
        out.append(d)
    return {"data": out}


@router.post("/{campaign_id}/encounters", response_model=dict, status_code=201)
async def create_encounter(campaign_id: uuid.UUID, body: EncounterCreate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede crear encuentros")
    resolved = await _resolve_monsters(conn, body.monsters)
    diff = _difficulty_of(resolved, body.party_size, body.party_level)
    enc_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO encounters (id, campaign_id, session_id, location_id, name, encounter_type,
                                description, difficulty, party_size, party_level, terrain_features,
                                status, dm_notes, visible_to_players)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        """,
        enc_id, campaign_id, body.session_id, body.location_id, body.name, body.encounter_type,
        body.description, diff["difficulty"], body.party_size, body.party_level,
        body.terrain_features, body.status, body.dm_notes, body.visible_to_players,
    )
    await _replace_monsters(conn, enc_id, resolved)
    await log_event(conn, "encounter.created", "encounter", target_id=str(enc_id),
                    target_name=body.name, actor_member_id=str(current_user["id"]))
    row = await conn.fetchrow("SELECT * FROM encounters WHERE id = $1", enc_id)
    d = dict(row)
    d["monsters"] = await _load_monsters(conn, enc_id)
    d["difficulty_detail"] = diff
    return item_response(d)


@router.put("/{campaign_id}/encounters/{enc_id}", response_model=dict)
async def update_encounter(campaign_id: uuid.UUID, enc_id: uuid.UUID, body: EncounterUpdate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede editar encuentros")
    existing = await conn.fetchrow("SELECT * FROM encounters WHERE id = $1 AND campaign_id = $2", enc_id, campaign_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Encounter not found")

    updates = body.model_dump(exclude_none=True)
    updates.pop("monsters", None)

    # Recalcular dificultad si cambian monstruos o composición del grupo
    if body.monsters is not None:
        resolved = await _resolve_monsters(conn, body.monsters)
        await _replace_monsters(conn, enc_id, resolved)
    else:
        rows = await _load_monsters(conn, enc_id)
        resolved = [{"stat_block_id": r["stat_block_id"], "name_override": r["name_override"],
                     "quantity": r["quantity"], "xp": r["xp_each"]} for r in rows]
    ps = updates.get("party_size", existing["party_size"])
    pl = updates.get("party_level", existing["party_level"])
    updates["difficulty"] = _difficulty_of(resolved, ps, pl)["difficulty"]

    clauses = [f"{k} = ${i}" for i, k in enumerate(updates.keys(), start=1)]
    params = list(updates.values()) + [enc_id, campaign_id]
    row = await conn.fetchrow(
        f"UPDATE encounters SET {', '.join(clauses)} WHERE id = ${len(params)-1} AND campaign_id = ${len(params)} RETURNING *",
        *params,
    )
    d = dict(row)
    d["monsters"] = await _load_monsters(conn, enc_id)
    return item_response(d)


@router.delete("/{campaign_id}/encounters/{enc_id}", status_code=204)
async def delete_encounter(campaign_id: uuid.UUID, enc_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede eliminar encuentros")
    result = await conn.execute("DELETE FROM encounters WHERE id = $1 AND campaign_id = $2", enc_id, campaign_id)
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Encounter not found")
