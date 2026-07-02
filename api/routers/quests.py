import json
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response, log_event
from api.models.quest import QuestCreate, QuestUpdate

router = APIRouter(prefix="/api/v1/campaigns", tags=["quests"])


async def _manager(conn: asyncpg.Connection, campaign_id: uuid.UUID, user: dict) -> bool:
    row = await conn.fetchrow("SELECT dm_id FROM campaigns WHERE id = $1", campaign_id)
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return str(row["dm_id"]) == str(user["id"]) or user["role"] == "admin"


def _hydrate(row: dict) -> dict:
    """objectives es JSONB → llega como str sin codec; parsear a lista."""
    obj = row.get("objectives")
    if isinstance(obj, str):
        try:
            row["objectives"] = json.loads(obj)
        except (ValueError, TypeError):
            row["objectives"] = []
    # NUMERIC(10,2) → Decimal; normalizar a float para el frontend
    if row.get("reward_gp") is not None:
        row["reward_gp"] = float(row["reward_gp"])
    return row


@router.get("/{campaign_id}/quests", response_model=dict)
async def list_quests(
    campaign_id: uuid.UUID,
    status: str | None = Query(None),
    adventure_id: str | None = Query(None),
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    is_manager = await _manager(conn, campaign_id, current_user)

    conditions = ["q.campaign_id = $1"]
    params: list = [campaign_id]
    idx = 2
    if not is_manager:
        conditions.append("q.visible_to_players = TRUE")
    if status:
        conditions.append(f"q.status = ${idx}::quest_status")
        params.append(status)
        idx += 1
    if adventure_id:
        conditions.append(f"q.adventure_id = ${idx}")
        params.append(uuid.UUID(adventure_id))
        idx += 1

    rows = await conn.fetch(
        f"""
        SELECT q.*, n.name AS quest_giver_name
        FROM quests q
        LEFT JOIN npcs n ON n.id = q.quest_giver_npc_id
        WHERE {' AND '.join(conditions)}
        ORDER BY q.created_at DESC
        """,
        *params,
    )
    return {"data": [_hydrate(dict(r)) for r in rows]}


@router.post("/{campaign_id}/quests", response_model=dict, status_code=201)
async def create_quest(
    campaign_id: uuid.UUID,
    body: QuestCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede crear misiones")

    quest_id = uuid.uuid4()
    objectives = json.dumps([o.model_dump() for o in body.objectives])
    completed_at_sql = "NOW()" if body.status == "completed" else "NULL"

    await conn.execute(
        f"""
        INSERT INTO quests (
            id, campaign_id, title, description, status, quest_type, adventure_id,
            quest_giver_npc_id, reward_description, reward_xp, reward_gp,
            objectives, notes, visible_to_players, completed_at
        ) VALUES ($1,$2,$3,$4,$5::quest_status,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,{completed_at_sql})
        """,
        quest_id, campaign_id, body.title, body.description, body.status,
        body.quest_type, body.adventure_id, body.quest_giver_npc_id,
        body.reward_description, body.reward_xp, body.reward_gp,
        objectives, body.notes, body.visible_to_players,
    )
    await log_event(
        conn, "quest.created", "quest",
        target_id=str(quest_id), target_name=body.title,
        actor_member_id=str(current_user["id"]),
    )
    row = await conn.fetchrow("SELECT * FROM quests WHERE id = $1", quest_id)
    return item_response(_hydrate(dict(row)))


@router.put("/{campaign_id}/quests/{quest_id}", response_model=dict)
async def update_quest(
    campaign_id: uuid.UUID,
    quest_id: uuid.UUID,
    body: QuestUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede editar misiones")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = []
    params = []
    i = 1
    for k, v in updates.items():
        if k == "objectives":
            set_clauses.append(f"{k} = ${i}::jsonb")
            params.append(json.dumps([o if isinstance(o, dict) else o.model_dump() for o in v]))
        elif k == "status":
            set_clauses.append(f"{k} = ${i}::quest_status")
            params.append(v)
        else:
            set_clauses.append(f"{k} = ${i}")
            params.append(v)
        i += 1

    # Sincronizar completed_at con el estado (guía §7.4)
    if "status" in updates:
        set_clauses.append("completed_at = " + ("NOW()" if updates["status"] == "completed" else "NULL"))

    params += [quest_id, campaign_id]
    row = await conn.fetchrow(
        f"UPDATE quests SET {', '.join(set_clauses)} "
        f"WHERE id = ${len(params) - 1} AND campaign_id = ${len(params)} RETURNING *",
        *params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Quest not found")
    return item_response(_hydrate(dict(row)))


@router.delete("/{campaign_id}/quests/{quest_id}", status_code=204)
async def delete_quest(
    campaign_id: uuid.UUID,
    quest_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not await _manager(conn, campaign_id, current_user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede eliminar misiones")
    result = await conn.execute(
        "DELETE FROM quests WHERE id = $1 AND campaign_id = $2", quest_id, campaign_id
    )
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Quest not found")
