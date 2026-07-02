import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response, log_event
from api.models.adventure import AdventureCreate, AdventureUpdate

router = APIRouter(prefix="/api/v1/campaigns", tags=["adventures"])

# Columnas editables de adventures (sin id/campaign_id/created_at).
_FIELDS = [
    "title", "description", "sort_order", "source", "module_name",
    "status", "rec_level_min", "rec_level_max", "visible_to_players", "dm_notes",
]


async def _manager(conn: asyncpg.Connection, campaign_id: uuid.UUID, user: dict) -> bool:
    """True si el usuario es el DM de la campaña o admin. 404 si no existe."""
    row = await conn.fetchrow("SELECT dm_id FROM campaigns WHERE id = $1", campaign_id)
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return str(row["dm_id"]) == str(user["id"]) or user["role"] == "admin"


def _strip(row: dict, is_manager: bool) -> dict:
    """Oculta contenido dm_only a jugadores (guía §17 regla 4)."""
    if not is_manager:
        row.pop("dm_notes", None)
    return row


@router.get("/{campaign_id}/adventures", response_model=dict)
async def list_adventures(
    campaign_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    is_manager = await _manager(conn, campaign_id, current_user)
    where = "WHERE a.campaign_id = $1"
    if not is_manager:
        where += " AND a.visible_to_players = TRUE"
    rows = await conn.fetch(
        f"""
        SELECT a.*,
               (SELECT COUNT(*) FROM sessions s WHERE s.adventure_id = a.id) AS session_count,
               (SELECT COUNT(*) FROM quests q WHERE q.adventure_id = a.id) AS quest_count
        FROM adventures a
        {where}
        ORDER BY a.sort_order ASC, a.created_at ASC
        """,
        campaign_id,
    )
    return {"data": [_strip(dict(r), is_manager) for r in rows]}


@router.post("/{campaign_id}/adventures", response_model=dict, status_code=201)
async def create_adventure(
    campaign_id: uuid.UUID,
    body: AdventureCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede crear aventuras")

    adventure_id = uuid.uuid4()
    values = body.model_dump()
    cols = ", ".join(["id", "campaign_id"] + _FIELDS)
    placeholders = ", ".join(f"${i}" for i in range(1, len(_FIELDS) + 3))
    params = [adventure_id, campaign_id] + [values[f] for f in _FIELDS]
    await conn.execute(f"INSERT INTO adventures ({cols}) VALUES ({placeholders})", *params)

    await log_event(
        conn, "adventure.created", "adventure",
        target_id=str(adventure_id), target_name=body.title,
        actor_member_id=str(current_user["id"]),
    )
    row = await conn.fetchrow("SELECT * FROM adventures WHERE id = $1", adventure_id)
    return item_response(dict(row))


@router.put("/{campaign_id}/adventures/{adventure_id}", response_model=dict)
async def update_adventure(
    campaign_id: uuid.UUID,
    adventure_id: uuid.UUID,
    body: AdventureUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede editar aventuras")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = [f"{k} = ${i}" for i, k in enumerate(updates.keys(), start=1)]
    params = list(updates.values()) + [adventure_id, campaign_id]
    row = await conn.fetchrow(
        f"UPDATE adventures SET {', '.join(set_clauses)} "
        f"WHERE id = ${len(params) - 1} AND campaign_id = ${len(params)} RETURNING *",
        *params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Adventure not found")
    return item_response(dict(row))


@router.delete("/{campaign_id}/adventures/{adventure_id}", status_code=204)
async def delete_adventure(
    campaign_id: uuid.UUID,
    adventure_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede eliminar aventuras")
    result = await conn.execute(
        "DELETE FROM adventures WHERE id = $1 AND campaign_id = $2", adventure_id, campaign_id
    )
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Adventure not found")
