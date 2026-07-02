import uuid
from datetime import datetime, timezone

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import (
    create_access_token,
    get_current_user,
    get_db,
    hash_password,
    verify_password,
)
from api.config import get_settings
from api.db.helpers import item_response, log_event
from api.services.community_feed import post_system_message
from api.models.auth import ChangePasswordRequest, LoginRequest, TokenResponse
from api.models.member import MemberCreate

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=dict, status_code=201)
async def register(
    body: MemberCreate,
    conn: asyncpg.Connection = Depends(get_db),
):
    existing = await conn.fetchrow(
        "SELECT id FROM members WHERE username=$1 OR email=$2",
        body.username,
        body.email,
    )
    if existing:
        raise HTTPException(status_code=409, detail="Username or email already taken")

    member_id = uuid.uuid4()
    password_hash = hash_password(body.password)
    display_name = body.display_name or body.username

    await conn.execute(
        """
        INSERT INTO members (id, username, email, password_hash, display_name, role)
        VALUES ($1, $2, $3, $4, $5, 'player')
        """,
        member_id,
        body.username,
        body.email,
        password_hash,
        display_name,
    )

    try:
        await conn.execute(
            "INSERT INTO member_xp (member_id, total_xp, messages_sent) VALUES ($1, 0, 0)",
            member_id,
        )
    except Exception:
        pass

    await log_event(
        conn,
        "member.registered",
        "member",
        target_id=str(member_id),
        target_name=body.username,
        actor_member_id=str(member_id),
        is_public=True,
    )
    await post_system_message(conn, "saludos", member_id, f"👋 ¡{display_name} se unió al gremio!")

    settings = get_settings()
    token = create_access_token({"sub": str(member_id), "role": "player"})
    return item_response(
        TokenResponse(
            access_token=token,
            expires_in=settings.JWT_EXPIRE_MINUTES * 60,
        ).model_dump()
    )


@router.post("/login", response_model=dict)
async def login(
    body: LoginRequest,
    conn: asyncpg.Connection = Depends(get_db),
):
    row = await conn.fetchrow(
        """
        SELECT id, username, email, password_hash, role, active
        FROM members
        WHERE username = $1 OR email = $1
        """,
        body.username_or_email,
    )
    if not row or not row["active"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    await conn.execute(
        "UPDATE members SET last_seen_at = $1 WHERE id = $2",
        datetime.now(timezone.utc),
        row["id"],
    )

    settings = get_settings()
    token = create_access_token({"sub": str(row["id"]), "role": row["role"]})
    return item_response(
        TokenResponse(
            access_token=token,
            expires_in=settings.JWT_EXPIRE_MINUTES * 60,
        ).model_dump()
    )


@router.get("/me", response_model=dict)
async def me(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    row = await conn.fetchrow(
        """
        SELECT m.id, m.username, m.email, m.display_name, m.avatar_url,
               m.role, m.rank_id, m.bio, m.timezone, m.discord_handle,
               m.active, m.last_seen_at, m.created_at, m.active_character_id,
               r.id AS r_id, r.name AS r_name, r.slug AS r_slug,
               r.color_hex AS r_color_hex, r.icon_url AS r_icon_url,
               r.level AS r_level, r.xp_threshold AS r_xp_threshold
        FROM members m
        LEFT JOIN ranks r ON r.id = m.rank_id
        WHERE m.id = $1
        """,
        current_user["id"],
    )
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")

    data = dict(row)
    if data.get("r_id"):
        data["rank"] = {
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
        data["rank"] = None

    xp = await conn.fetchrow(
        "SELECT total_xp, sessions_attended, messages_sent FROM member_xp WHERE member_id = $1",
        current_user["id"],
    )
    data["xp"] = dict(xp) if xp else {"total_xp": 0, "sessions_attended": 0, "messages_sent": 0}

    char_count = await conn.fetchval(
        "SELECT COUNT(*) FROM characters WHERE member_id = $1 AND active = TRUE",
        current_user["id"],
    )
    data["character_count"] = char_count or 0

    return item_response(data)


@router.post("/change-password", response_model=dict)
async def change_password(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 8 caracteres")

    row = await conn.fetchrow(
        "SELECT password_hash FROM members WHERE id = $1", current_user["id"]
    )
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")
    if not verify_password(body.current_password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="La contraseña actual no es correcta")

    await conn.execute(
        "UPDATE members SET password_hash = $1 WHERE id = $2",
        hash_password(body.new_password),
        current_user["id"],
    )
    await log_event(
        conn,
        "member.password_changed",
        "member",
        target_id=str(current_user["id"]),
        actor_member_id=str(current_user["id"]),
    )
    return item_response({"ok": True})
