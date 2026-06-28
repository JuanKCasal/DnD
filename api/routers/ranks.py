import uuid
import json

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db, require_role
from api.db.helpers import item_response, list_response, paginate, records_to_list
from api.models.rank import RankCreate, RankUpdate

router = APIRouter(prefix="/api/v1/ranks", tags=["ranks"])


@router.get("", response_model=dict)
async def list_ranks(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    offset, limit = paginate(page, per_page)
    total = await conn.fetchval("SELECT COUNT(*) FROM ranks")
    rows = await conn.fetch(
        "SELECT * FROM ranks ORDER BY level ASC LIMIT $1 OFFSET $2",
        limit,
        offset,
    )
    return list_response(records_to_list(rows), total, page, per_page)


@router.get("/{rank_id}", response_model=dict)
async def get_rank(
    rank_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    row = await conn.fetchrow("SELECT * FROM ranks WHERE id = $1", rank_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rank not found")
    return item_response(dict(row))


@router.post("", response_model=dict, status_code=201)
async def create_rank(
    body: RankCreate,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    rank_id = uuid.uuid4()
    perms = json.dumps(body.permissions) if body.permissions else '{"can_post":true,"can_dm":true,"can_create_character":true}'
    await conn.execute(
        """
        INSERT INTO ranks (id, name, slug, description, color_hex, icon_url, level, xp_threshold, permissions)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        rank_id,
        body.name,
        body.slug,
        body.description,
        body.color_hex,
        body.icon_url,
        body.level,
        body.xp_threshold,
        perms,
    )
    row = await conn.fetchrow("SELECT * FROM ranks WHERE id = $1", rank_id)
    return item_response(dict(row))


@router.put("/{rank_id}", response_model=dict)
async def update_rank(
    rank_id: uuid.UUID,
    body: RankUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    row = await conn.fetchrow("SELECT id FROM ranks WHERE id = $1", rank_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rank not found")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = []
    params = []
    for i, (k, v) in enumerate(updates.items(), start=1):
        val = json.dumps(v) if k == "permissions" and isinstance(v, dict) else v
        set_clauses.append(f"{k} = ${i}")
        params.append(val)

    params.append(rank_id)
    await conn.execute(
        f"UPDATE ranks SET {', '.join(set_clauses)} WHERE id = ${len(params)}",
        *params,
    )
    row = await conn.fetchrow("SELECT * FROM ranks WHERE id = $1", rank_id)
    return item_response(dict(row))


@router.delete("/{rank_id}", status_code=204)
async def delete_rank(
    rank_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    row = await conn.fetchrow("SELECT id FROM ranks WHERE id = $1", rank_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rank not found")
    await conn.execute("DELETE FROM ranks WHERE id = $1", rank_id)
