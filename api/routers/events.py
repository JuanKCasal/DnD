import uuid
from datetime import datetime

import asyncpg
from fastapi import APIRouter, Depends, Query

from api.dependencies import get_current_user, get_db, require_role
from api.db.helpers import list_response, paginate, records_to_list

router = APIRouter(prefix="/api/v1/events", tags=["events"])


@router.get("", response_model=dict)
async def list_public_events(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    offset, limit = paginate(page, per_page)
    total = await conn.fetchval(
        "SELECT COUNT(*) FROM event_log WHERE is_public = TRUE"
    )
    rows = await conn.fetch(
        """
        SELECT id, occurred_at, actor_member_id, actor_character_id,
               action, target_type, target_id, target_name, metadata, is_public
        FROM event_log
        WHERE is_public = TRUE
        ORDER BY occurred_at DESC
        LIMIT $1 OFFSET $2
        """,
        limit,
        offset,
    )
    return list_response(records_to_list(rows), total, page, per_page)


@router.get("/all", response_model=dict)
async def list_all_events(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    actor_member_id: str | None = Query(None),
    action: str | None = Query(None),
    target_type: str | None = Query(None),
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    offset, limit = paginate(page, per_page)

    conditions = []
    params: list = []
    idx = 1

    if actor_member_id:
        conditions.append(f"actor_member_id = ${idx}")
        params.append(uuid.UUID(actor_member_id))
        idx += 1
    if action:
        conditions.append(f"action = ${idx}")
        params.append(action)
        idx += 1
    if target_type:
        conditions.append(f"target_type = ${idx}")
        params.append(target_type)
        idx += 1
    if from_date:
        conditions.append(f"occurred_at >= ${idx}")
        params.append(from_date)
        idx += 1
    if to_date:
        conditions.append(f"occurred_at <= ${idx}")
        params.append(to_date)
        idx += 1

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    total = await conn.fetchval(f"SELECT COUNT(*) FROM event_log {where}", *params)

    params_page = params + [limit, offset]
    rows = await conn.fetch(
        f"""
        SELECT id, occurred_at, actor_member_id, actor_character_id,
               action, target_type, target_id, target_name, metadata, is_public
        FROM event_log
        {where}
        ORDER BY occurred_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
        """,
        *params_page,
    )
    return list_response(records_to_list(rows), total, page, per_page)
