"""Arcos, giros argumentales y guía de recompensas (Fase C7).

Los giros (plot_twists) son dm_only por defecto (guía §7.3): los jugadores solo
ven los ya revelados. Filtrado en el backend (guía §17 regla 4).
"""
import json
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response, log_event
from api.models.arc import StoryArcCreate, StoryArcUpdate, PlotTwistCreate, PlotTwistUpdate
from api.services import treasure

router = APIRouter(prefix="/api/v1/campaigns", tags=["narrative"])


async def _manager(conn, campaign_id, user) -> bool:
    row = await conn.fetchrow("SELECT dm_id FROM campaigns WHERE id = $1", campaign_id)
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return str(row["dm_id"]) == str(user["id"]) or user["role"] == "admin"


def _hydrate_arc(row: dict) -> dict:
    d = dict(row)
    b = d.get("beats")
    if isinstance(b, str):
        try:
            d["beats"] = json.loads(b)
        except (ValueError, TypeError):
            d["beats"] = []
    return d


# ══════════════════════════ STORY ARCS ══════════════════════════
@router.get("/{campaign_id}/arcs", response_model=dict)
async def list_arcs(campaign_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    is_manager = await _manager(conn, campaign_id, current_user)
    where = "WHERE campaign_id = $1"
    if not is_manager:
        where += " AND visible_to_players = TRUE"
    rows = await conn.fetch(f"SELECT * FROM story_arcs {where} ORDER BY sort_order ASC, created_at ASC", campaign_id)
    out = []
    for r in rows:
        d = _hydrate_arc(r)
        if not is_manager:
            d.pop("notes", None)
        out.append(d)
    return {"data": out}


@router.post("/{campaign_id}/arcs", response_model=dict, status_code=201)
async def create_arc(campaign_id: uuid.UUID, body: StoryArcCreate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede crear arcos")
    arc_id = uuid.uuid4()
    beats = json.dumps([b.model_dump() for b in body.beats])
    await conn.execute(
        """
        INSERT INTO story_arcs (id, campaign_id, title, description, arc_type, status, beats, visible_to_players, notes, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
        """,
        arc_id, campaign_id, body.title, body.description, body.arc_type, body.status,
        beats, body.visible_to_players, body.notes, body.sort_order,
    )
    await log_event(conn, "arc.created", "story_arc", target_id=str(arc_id),
                    target_name=body.title, actor_member_id=str(current_user["id"]))
    row = await conn.fetchrow("SELECT * FROM story_arcs WHERE id = $1", arc_id)
    return item_response(_hydrate_arc(row))


@router.put("/{campaign_id}/arcs/{arc_id}", response_model=dict)
async def update_arc(campaign_id: uuid.UUID, arc_id: uuid.UUID, body: StoryArcUpdate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede editar arcos")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    clauses, params = [], []
    for i, (k, v) in enumerate(updates.items(), start=1):
        if k == "beats":
            clauses.append(f"{k} = ${i}::jsonb")
            params.append(json.dumps([b if isinstance(b, dict) else b.model_dump() for b in v]))
        else:
            clauses.append(f"{k} = ${i}")
            params.append(v)
    params += [arc_id, campaign_id]
    row = await conn.fetchrow(
        f"UPDATE story_arcs SET {', '.join(clauses)} WHERE id = ${len(params)-1} AND campaign_id = ${len(params)} RETURNING *",
        *params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Arc not found")
    return item_response(_hydrate_arc(row))


@router.delete("/{campaign_id}/arcs/{arc_id}", status_code=204)
async def delete_arc(campaign_id: uuid.UUID, arc_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede eliminar arcos")
    result = await conn.execute("DELETE FROM story_arcs WHERE id = $1 AND campaign_id = $2", arc_id, campaign_id)
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Arc not found")


# ══════════════════════════ PLOT TWISTS ══════════════════════════
@router.get("/{campaign_id}/plot-twists", response_model=dict)
async def list_twists(campaign_id: uuid.UUID, arc_id: str | None = Query(None), conn=Depends(get_db), current_user=Depends(get_current_user)):
    is_manager = await _manager(conn, campaign_id, current_user)
    conditions = ["campaign_id = $1"]
    params: list = [campaign_id]
    idx = 2
    if not is_manager:
        # Los jugadores solo ven giros ya revelados (guía §7.3)
        conditions.append("revealed = TRUE")
    if arc_id:
        conditions.append(f"arc_id = ${idx}")
        params.append(uuid.UUID(arc_id))
        idx += 1
    rows = await conn.fetch(
        f"SELECT * FROM plot_twists WHERE {' AND '.join(conditions)} ORDER BY created_at ASC", *params
    )
    return {"data": [dict(r) for r in rows]}


@router.post("/{campaign_id}/plot-twists", response_model=dict, status_code=201)
async def create_twist(campaign_id: uuid.UUID, body: PlotTwistCreate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede crear giros")
    twist_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO plot_twists (id, campaign_id, arc_id, title, description, setup_clues, reveal_condition, impact, revealed, dm_only)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        """,
        twist_id, campaign_id, body.arc_id, body.title, body.description, body.setup_clues,
        body.reveal_condition, body.impact, body.revealed, body.dm_only,
    )
    row = await conn.fetchrow("SELECT * FROM plot_twists WHERE id = $1", twist_id)
    return item_response(dict(row))


@router.put("/{campaign_id}/plot-twists/{twist_id}", response_model=dict)
async def update_twist(campaign_id: uuid.UUID, twist_id: uuid.UUID, body: PlotTwistUpdate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede editar giros")
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    clauses = [f"{k} = ${i}" for i, k in enumerate(updates.keys(), start=1)]
    params = list(updates.values()) + [twist_id, campaign_id]
    row = await conn.fetchrow(
        f"UPDATE plot_twists SET {', '.join(clauses)} WHERE id = ${len(params)-1} AND campaign_id = ${len(params)} RETURNING *",
        *params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Twist not found")
    return item_response(dict(row))


@router.delete("/{campaign_id}/plot-twists/{twist_id}", status_code=204)
async def delete_twist(campaign_id: uuid.UUID, twist_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede eliminar giros")
    result = await conn.execute("DELETE FROM plot_twists WHERE id = $1 AND campaign_id = $2", twist_id, campaign_id)
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Twist not found")


# ══════════════════════════ TREASURE GUIDANCE ══════════════════════════
@router.get("/{campaign_id}/treasure-guidance", response_model=dict)
async def treasure_guidance(campaign_id: uuid.UUID, party_level: int = Query(1, ge=1, le=20), conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede ver la guía de recompensas")
    return item_response({
        "current": treasure.guidance(party_level),
        "table": treasure.full_table(),
        "rarity_labels": treasure.RARITY_LABEL,
    })
