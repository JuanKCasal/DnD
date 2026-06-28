import uuid
from datetime import datetime, timezone

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db, hash_password, require_role
from api.db.helpers import item_response, list_response, log_event, paginate, records_to_list
from api.models.member import MemberCreate, MemberUpdate

router = APIRouter(prefix="/api/v1/members", tags=["members"])


@router.post("", response_model=dict, status_code=201)
async def create_member(
    body: MemberCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    """Admin-only: create a member with a specific role."""
    existing = await conn.fetchrow(
        "SELECT id FROM members WHERE username = $1 OR email = $2",
        body.username, body.email,
    )
    if existing:
        raise HTTPException(status_code=409, detail="Username or email already in use")

    role = body.role or "player"
    if role not in ("admin", "dm", "player"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be admin, dm, or player")

    password_hash = hash_password(body.password)
    member_id = uuid.uuid4()

    try:
        await conn.execute(
            """
            INSERT INTO members (id, username, email, password_hash, display_name, role)
            VALUES ($1, $2, $3, $4, $5, $6::member_role)
            """,
            member_id,
            body.username,
            body.email,
            password_hash,
            body.display_name or body.username,
            role,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    row = await conn.fetchrow(
        "SELECT id, username, email, display_name, avatar_url, role, rank_id, bio, timezone, discord_handle, active, last_seen_at, created_at FROM members WHERE id = $1",
        member_id,
    )
    await log_event(
        conn,
        "member.created",
        "member",
        target_id=str(member_id),
        target_name=body.username,
        actor_member_id=str(current_user["id"]),
    )
    return item_response(dict(row))


@router.get("", response_model=dict)
async def list_members(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    role: str | None = Query(None),
    rank_id: str | None = Query(None),
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    offset, limit = paginate(page, per_page)

    conditions = ["m.active = TRUE"]
    params: list = []
    idx = 1

    if role:
        conditions.append(f"m.role = ${idx}::member_role")
        params.append(role)
        idx += 1
    if rank_id:
        conditions.append(f"m.rank_id = ${idx}")
        params.append(uuid.UUID(rank_id))
        idx += 1

    where = " AND ".join(conditions)

    total = await conn.fetchval(
        f"SELECT COUNT(*) FROM members m WHERE {where}", *params
    )

    params_page = params + [limit, offset]
    rows = await conn.fetch(
        f"""
        SELECT m.id, m.username, m.email, m.display_name, m.avatar_url,
               m.role, m.rank_id, m.bio, m.timezone, m.discord_handle,
               m.active, m.last_seen_at, m.created_at,
               r.name AS rank_name, r.color_hex AS rank_color, r.level AS rank_level
        FROM members m
        LEFT JOIN ranks r ON r.id = m.rank_id
        WHERE {where}
        ORDER BY m.created_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
        """,
        *params_page,
    )
    return list_response(records_to_list(rows), total, page, per_page)


@router.get("/{member_id}", response_model=dict)
async def get_member(
    member_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    row = await conn.fetchrow(
        """
        SELECT m.id, m.username, m.email, m.display_name, m.avatar_url,
               m.role, m.rank_id, m.bio, m.timezone, m.discord_handle,
               m.active, m.last_seen_at, m.created_at,
               r.id AS r_id, r.name AS r_name, r.slug AS r_slug,
               r.color_hex AS r_color_hex, r.icon_url AS r_icon_url,
               r.level AS r_level, r.xp_threshold AS r_xp_threshold
        FROM members m
        LEFT JOIN ranks r ON r.id = m.rank_id
        WHERE m.id = $1
        """,
        member_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")

    data = dict(row)
    rank = None
    if data.get("r_id"):
        rank = {
            "id": data.pop("r_id"),
            "name": data.pop("r_name"),
            "slug": data.pop("r_slug"),
            "color_hex": data.pop("r_color_hex"),
            "icon_url": data.pop("r_icon_url"),
            "level": data.pop("r_level"),
            "xp_threshold": data.pop("r_xp_threshold"),
        }
    else:
        for k in ["r_id", "r_name", "r_slug", "r_color_hex", "r_icon_url", "r_level", "r_xp_threshold"]:
            data.pop(k, None)
    data["rank"] = rank
    return item_response(data)


@router.put("/{member_id}", response_model=dict)
async def update_member(
    member_id: uuid.UUID,
    body: MemberUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if str(current_user["id"]) != str(member_id) and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Cannot edit another member's profile")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Only admins can change role or active status
    if ("role" in updates or "active" in updates) and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can change role or active status")

    if "role" in updates and updates["role"] not in ("admin", "dm", "player"):
        raise HTTPException(status_code=400, detail="Invalid role")

    set_clauses = []
    params = []
    for i, (k, v) in enumerate(updates.items(), start=1):
        if k == "role":
            set_clauses.append(f"{k} = ${i}::member_role")
        else:
            set_clauses.append(f"{k} = ${i}")
        params.append(v)

    params.append(member_id)
    await conn.execute(
        f"UPDATE members SET {', '.join(set_clauses)} WHERE id = ${len(params)}",
        *params,
    )

    row = await conn.fetchrow(
        """
        SELECT id, username, email, display_name, avatar_url, role, rank_id,
               bio, timezone, discord_handle, active, last_seen_at, created_at
        FROM members WHERE id = $1
        """,
        member_id,
    )
    return item_response(dict(row))


@router.delete("/{member_id}", status_code=204)
async def delete_member(
    member_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    row = await conn.fetchrow("SELECT username FROM members WHERE id = $1", member_id)
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")

    await conn.execute("UPDATE members SET active = FALSE WHERE id = $1", member_id)
    await log_event(
        conn,
        "member.deactivated",
        "member",
        target_id=str(member_id),
        target_name=row["username"],
        actor_member_id=str(current_user["id"]),
    )


@router.get("/{member_id}/characters", response_model=dict)
async def get_member_characters(
    member_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    rows = await conn.fetch(
        """
        SELECT c.id, c.name, c.race, c.class AS char_class, c.level,
               c.campaign_id, c.active, c.portrait_url, c.hp, c.max_hp, c.ac,
               c.created_at
        FROM characters c
        WHERE c.member_id = $1
        ORDER BY c.active DESC, c.created_at DESC
        """,
        member_id,
    )
    return {"data": records_to_list(rows)}


@router.put("/{member_id}/active-character", response_model=dict)
async def set_active_character(
    member_id: uuid.UUID,
    body: dict,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if str(current_user["id"]) != str(member_id) and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Cannot edit another member")

    character_id = body.get("character_id")
    if not character_id:
        raise HTTPException(status_code=400, detail="character_id required")

    char = await conn.fetchrow(
        "SELECT id FROM characters WHERE id = $1 AND member_id = $2",
        uuid.UUID(str(character_id)),
        member_id,
    )
    if not char:
        raise HTTPException(status_code=404, detail="Character not found or does not belong to member")

    await conn.execute(
        "UPDATE members SET active_character_id = $1 WHERE id = $2",
        uuid.UUID(str(character_id)),
        member_id,
    )
    return item_response({"active_character_id": str(character_id)})
