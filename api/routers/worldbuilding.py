"""Mundo vivo (Fase C3): localizaciones, NPCs y facciones de campaña.

Expone tablas que ya existían en el schema (001) sin router. Aplica el
filtrado DM-only en el BACKEND (guía §17 regla 4): los jugadores no reciben
contenido secreto ni entidades ocultas, no solo se ocultan en el frontend.
"""
import json
import re
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response, log_event
from api.models.location import LocationCreate, LocationUpdate
from api.models.npc import NpcCreate, NpcUpdate
from api.models.faction import FactionCreate, FactionUpdate, ReputationSet

router = APIRouter(prefix="/api/v1/campaigns", tags=["worldbuilding"])

DEFAULT_REP_SCALE = {"hostile": -100, "unfriendly": -50, "neutral": 0, "friendly": 50, "ally": 100}


async def _manager(conn: asyncpg.Connection, campaign_id: uuid.UUID, user: dict) -> bool:
    row = await conn.fetchrow("SELECT dm_id FROM campaigns WHERE id = $1", campaign_id)
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return str(row["dm_id"]) == str(user["id"]) or user["role"] == "admin"


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9\s-]", "", (text or "").lower()).strip()
    return re.sub(r"\s+", "-", s) or "faccion"


def _parse_json(row: dict, key: str, default):
    v = row.get(key)
    if isinstance(v, str):
        try:
            row[key] = json.loads(v)
        except (ValueError, TypeError):
            row[key] = default
    return row


# ══════════════════════════ LOCATIONS ══════════════════════════
@router.get("/{campaign_id}/locations", response_model=dict)
async def list_locations(campaign_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    is_manager = await _manager(conn, campaign_id, current_user)
    where = "WHERE campaign_id = $1"
    if not is_manager:
        where += " AND is_discovered = TRUE"
    rows = await conn.fetch(f"SELECT * FROM locations {where} ORDER BY created_at ASC", campaign_id)
    out = []
    for r in rows:
        d = dict(r)
        if not is_manager:
            d.pop("notes", None)  # notas = contenido DM
        out.append(d)
    return {"data": out}


@router.post("/{campaign_id}/locations", response_model=dict, status_code=201)
async def create_location(campaign_id: uuid.UUID, body: LocationCreate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede crear localizaciones")
    loc_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO locations (id, campaign_id, parent_location_id, name, type, description, map_url, is_discovered, notes)
        VALUES ($1,$2,$3,$4,$5::location_type,$6,$7,$8,$9)
        """,
        loc_id, campaign_id, body.parent_location_id, body.name, body.type,
        body.description, body.map_url, body.is_discovered, body.notes,
    )
    await log_event(conn, "location.created", "location", target_id=str(loc_id),
                    target_name=body.name, actor_member_id=str(current_user["id"]))
    row = await conn.fetchrow("SELECT * FROM locations WHERE id = $1", loc_id)
    return item_response(dict(row))


@router.put("/{campaign_id}/locations/{loc_id}", response_model=dict)
async def update_location(campaign_id: uuid.UUID, loc_id: uuid.UUID, body: LocationUpdate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede editar localizaciones")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    clauses, params = [], []
    for i, (k, v) in enumerate(updates.items(), start=1):
        clauses.append(f"{k} = ${i}::location_type" if k == "type" else f"{k} = ${i}")
        params.append(v)
    params += [loc_id, campaign_id]
    row = await conn.fetchrow(
        f"UPDATE locations SET {', '.join(clauses)} WHERE id = ${len(params)-1} AND campaign_id = ${len(params)} RETURNING *",
        *params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Location not found")
    return item_response(dict(row))


@router.delete("/{campaign_id}/locations/{loc_id}", status_code=204)
async def delete_location(campaign_id: uuid.UUID, loc_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede eliminar localizaciones")
    result = await conn.execute("DELETE FROM locations WHERE id = $1 AND campaign_id = $2", loc_id, campaign_id)
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Location not found")


# ══════════════════════════ NPCS ══════════════════════════
_NPC_SELECT = """
    SELECT n.id, n.campaign_id, n.name, n.race, n.class AS npc_class, n.role,
           n.relationship, n.attitude, n.description, n.portrait_url, n.stat_block,
           n.location_id, n.faction_id, n.alive, n.motivation, n.secret, n.notes,
           n.dm_only, n.created_at,
           l.name AS location_name, f.name AS faction_name
    FROM npcs n
    LEFT JOIN locations l ON l.id = n.location_id
    LEFT JOIN factions f ON f.id = n.faction_id
"""
# field (Pydantic) → (columna DB, sufijo de cast)
_NPC_MAP = {
    "npc_class": ("class", ""),
    "relationship": ("relationship", "::npc_relationship"),
    "stat_block": ("stat_block", "::jsonb"),
}


def _strip_npc(row: dict, is_manager: bool) -> dict:
    _parse_json(row, "stat_block", {})
    if not is_manager:
        for k in ("secret", "motivation", "notes", "stat_block"):
            row.pop(k, None)
    return row


@router.get("/{campaign_id}/npcs", response_model=dict)
async def list_npcs(campaign_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    is_manager = await _manager(conn, campaign_id, current_user)
    where = "WHERE n.campaign_id = $1"
    if not is_manager:
        where += " AND n.dm_only = FALSE"
    rows = await conn.fetch(f"{_NPC_SELECT} {where} ORDER BY n.name ASC", campaign_id)
    return {"data": [_strip_npc(dict(r), is_manager) for r in rows]}


@router.post("/{campaign_id}/npcs", response_model=dict, status_code=201)
async def create_npc(campaign_id: uuid.UUID, body: NpcCreate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede crear NPCs")
    npc_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO npcs (id, campaign_id, name, race, class, role, relationship, attitude,
                          description, portrait_url, stat_block, location_id, faction_id, alive,
                          motivation, secret, notes, dm_only)
        VALUES ($1,$2,$3,$4,$5,$6,$7::npc_relationship,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18)
        """,
        npc_id, campaign_id, body.name, body.race, body.npc_class, body.role,
        body.relationship, body.attitude, body.description, body.portrait_url,
        json.dumps(body.stat_block or {}), body.location_id, body.faction_id, body.alive,
        body.motivation, body.secret, body.notes, body.dm_only,
    )
    await log_event(conn, "npc.created", "npc", target_id=str(npc_id),
                    target_name=body.name, actor_member_id=str(current_user["id"]))
    row = await conn.fetchrow(f"{_NPC_SELECT} WHERE n.id = $1", npc_id)
    return item_response(_strip_npc(dict(row), True))


@router.put("/{campaign_id}/npcs/{npc_id}", response_model=dict)
async def update_npc(campaign_id: uuid.UUID, npc_id: uuid.UUID, body: NpcUpdate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede editar NPCs")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    clauses, params = [], []
    i = 1
    for k, v in updates.items():
        col, cast = _NPC_MAP.get(k, (k, ""))
        clauses.append(f"{col} = ${i}{cast}")
        params.append(json.dumps(v) if k == "stat_block" else v)
        i += 1
    params += [npc_id, campaign_id]
    row = await conn.fetchrow(
        f"UPDATE npcs SET {', '.join(clauses)} WHERE id = ${len(params)-1} AND campaign_id = ${len(params)} RETURNING id",
        *params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="NPC not found")
    full = await conn.fetchrow(f"{_NPC_SELECT} WHERE n.id = $1", npc_id)
    return item_response(_strip_npc(dict(full), True))


@router.delete("/{campaign_id}/npcs/{npc_id}", status_code=204)
async def delete_npc(campaign_id: uuid.UUID, npc_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede eliminar NPCs")
    result = await conn.execute("DELETE FROM npcs WHERE id = $1 AND campaign_id = $2", npc_id, campaign_id)
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="NPC not found")


# ══════════════════════════ FACTIONS ══════════════════════════
@router.get("/{campaign_id}/factions", response_model=dict)
async def list_factions(campaign_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    await _manager(conn, campaign_id, current_user)  # valida existencia de campaña
    rows = await conn.fetch("SELECT * FROM factions WHERE campaign_id = $1 ORDER BY name ASC", campaign_id)
    return {"data": [_parse_json(dict(r), "reputation_scale", DEFAULT_REP_SCALE) for r in rows]}


@router.post("/{campaign_id}/factions", response_model=dict, status_code=201)
async def create_faction(campaign_id: uuid.UUID, body: FactionCreate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede crear facciones")
    faction_id = uuid.uuid4()
    slug = _slugify(body.slug or body.name)
    scale = json.dumps(body.reputation_scale or DEFAULT_REP_SCALE)
    try:
        await conn.execute(
            """
            INSERT INTO factions (id, campaign_id, name, slug, description, goals, alignment, emblem_url, leader_name, reputation_scale)
            VALUES ($1,$2,$3,$4,$5,$6,$7::alignment_type,$8,$9,$10::jsonb)
            """,
            faction_id, campaign_id, body.name, slug, body.description, body.goals,
            body.alignment, body.emblem_url, body.leader_name, scale,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="Ya existe una facción con ese slug en la campaña")
    await log_event(conn, "faction.created", "faction", target_id=str(faction_id),
                    target_name=body.name, actor_member_id=str(current_user["id"]))
    row = await conn.fetchrow("SELECT * FROM factions WHERE id = $1", faction_id)
    return item_response(_parse_json(dict(row), "reputation_scale", DEFAULT_REP_SCALE))


@router.put("/{campaign_id}/factions/{faction_id}", response_model=dict)
async def update_faction(campaign_id: uuid.UUID, faction_id: uuid.UUID, body: FactionUpdate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede editar facciones")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    clauses, params = [], []
    i = 1
    for k, v in updates.items():
        if k == "alignment":
            clauses.append(f"{k} = ${i}::alignment_type")
            params.append(v)
        elif k == "reputation_scale":
            clauses.append(f"{k} = ${i}::jsonb")
            params.append(json.dumps(v))
        elif k == "slug":
            clauses.append(f"{k} = ${i}")
            params.append(_slugify(v))
        else:
            clauses.append(f"{k} = ${i}")
            params.append(v)
        i += 1
    params += [faction_id, campaign_id]
    row = await conn.fetchrow(
        f"UPDATE factions SET {', '.join(clauses)} WHERE id = ${len(params)-1} AND campaign_id = ${len(params)} RETURNING *",
        *params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Faction not found")
    return item_response(_parse_json(dict(row), "reputation_scale", DEFAULT_REP_SCALE))


@router.delete("/{campaign_id}/factions/{faction_id}", status_code=204)
async def delete_faction(campaign_id: uuid.UUID, faction_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede eliminar facciones")
    result = await conn.execute("DELETE FROM factions WHERE id = $1 AND campaign_id = $2", faction_id, campaign_id)
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Faction not found")


# ── Reputación del grupo con una facción (faction_reputation) ──
@router.get("/{campaign_id}/factions/{faction_id}/reputation", response_model=dict)
async def list_reputation(campaign_id: uuid.UUID, faction_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    await _manager(conn, campaign_id, current_user)
    rows = await conn.fetch(
        """
        SELECT fr.character_id, fr.reputation_pts, fr.rank_title, c.name AS character_name
        FROM faction_reputation fr
        JOIN characters c ON c.id = fr.character_id
        WHERE fr.faction_id = $1
        ORDER BY fr.reputation_pts DESC
        """,
        faction_id,
    )
    return {"data": [dict(r) for r in rows]}


@router.put("/{campaign_id}/factions/{faction_id}/reputation", response_model=dict)
async def set_reputation(campaign_id: uuid.UUID, faction_id: uuid.UUID, body: ReputationSet, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede ajustar reputación")
    await conn.execute(
        """
        INSERT INTO faction_reputation (faction_id, character_id, reputation_pts, rank_title)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (faction_id, character_id) DO UPDATE
        SET reputation_pts = EXCLUDED.reputation_pts, rank_title = EXCLUDED.rank_title, updated_at = NOW()
        """,
        faction_id, body.character_id, body.reputation_pts, body.rank_title,
    )
    return item_response({
        "faction_id": str(faction_id),
        "character_id": str(body.character_id),
        "reputation_pts": body.reputation_pts,
        "rank_title": body.rank_title,
    })
