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
from api.models.auth import LoginRequest, TokenResponse
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
               m.active, m.last_seen_at, m.created_at
        FROM members m
        WHERE m.id = $1
        """,
        current_user["id"],
    )
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")
    return item_response(dict(row))
