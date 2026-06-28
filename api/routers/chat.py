import json
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db, require_role
from api.db.helpers import item_response, list_response, paginate, records_to_list
from api.db.kafka import TOPIC_CHAT_MESSAGE_SENT, publish_event
from api.models.chat import (
    ChatMessageCreate,
    ChatRoomCreate,
    DirectMessageCreate,
)

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


@router.get("/rooms", response_model=dict)
async def list_rooms(
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return rooms accessible to the current user based on rank, clan membership, campaign membership."""
    rows = await conn.fetch(
        """
        SELECT r.id, r.name, r.slug, r.type AS room_type, r.clan_id, r.campaign_id,
               r.rank_required_id, r.description, r.icon, r.is_readonly,
               r.is_ic, r.sort_order, r.created_at
        FROM chat_rooms r
        WHERE
            -- General rooms with no restrictions
            (r.clan_id IS NULL AND r.campaign_id IS NULL AND r.rank_required_id IS NULL)
            -- OR clan rooms where user is member
            OR (r.clan_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM clan_members cm WHERE cm.clan_id = r.clan_id AND cm.member_id = $1
            ))
            -- OR campaign rooms where user is member
            OR (r.campaign_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM campaign_members cm WHERE cm.campaign_id = r.campaign_id AND cm.member_id = $1
            ))
            -- OR rank-required rooms where user has that rank or better
            OR (r.rank_required_id IS NOT NULL AND $2::uuid IS NOT NULL AND EXISTS (
                SELECT 1 FROM ranks r2
                JOIN ranks rr ON rr.id = r.rank_required_id
                WHERE r2.id = $2 AND r2.level >= rr.level
            ))
        ORDER BY r.sort_order ASC, r.name ASC
        """,
        current_user["id"],
        current_user.get("rank_id"),
    )
    return {"data": records_to_list(rows)}


@router.post("/rooms", response_model=dict, status_code=201)
async def create_room(
    body: ChatRoomCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "dm")),
):
    room_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO chat_rooms (id, name, slug, type, clan_id, campaign_id,
                                rank_required_id, description, icon, is_readonly,
                                is_ic, sort_order, created_by)
        VALUES ($1,$2,$3,$4::chat_room_type,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        """,
        room_id,
        body.name,
        body.slug,
        body.room_type,
        body.clan_id,
        body.campaign_id,
        body.rank_required_id,
        body.description,
        body.icon,
        body.is_readonly,
        body.is_ic,
        body.sort_order,
        current_user["id"],
    )
    row = await conn.fetchrow("SELECT * FROM chat_rooms WHERE id = $1", room_id)
    return item_response(dict(row))


@router.get("/rooms/{room_id}/messages", response_model=dict)
async def get_messages(
    room_id: uuid.UUID,
    before_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    params: list = [room_id]
    cursor_clause = ""
    if before_id:
        cursor_clause = "AND m.id < $2"
        params.append(uuid.UUID(before_id))

    params.append(limit)
    rows = await conn.fetch(
        f"""
        SELECT m.id, m.room_id, m.member_id, m.character_id, m.message_type,
               m.content, m.dice_result, m.created_at, m.edited_at, m.is_pinned,
               c.name AS character_name, c.portrait_url AS character_portrait
        FROM chat_messages m
        LEFT JOIN characters c ON c.id = m.character_id
        WHERE m.room_id = $1 AND m.deleted_at IS NULL {cursor_clause}
        ORDER BY m.created_at DESC
        LIMIT ${len(params)}
        """,
        *params,
    )
    return {"data": records_to_list(rows)}


@router.post("/rooms/{room_id}/messages", response_model=dict, status_code=201)
async def post_message(
    room_id: uuid.UUID,
    body: ChatMessageCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    room = await conn.fetchrow("SELECT is_readonly FROM chat_rooms WHERE id = $1", room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room["is_readonly"] and current_user["role"] not in ("admin", "dm"):
        raise HTTPException(status_code=403, detail="Room is read-only")

    msg_id = uuid.uuid4()
    character_id = current_user.get("active_character_id")
    dice_json = json.dumps(body.dice_result) if body.dice_result else None

    await conn.execute(
        """
        INSERT INTO chat_messages (id, room_id, member_id, character_id, message_type, content, dice_result, reply_to_id)
        VALUES ($1,$2,$3,$4,$5::message_type,$6,$7,$8)
        """,
        msg_id,
        room_id,
        current_user["id"],
        character_id,
        body.message_type,
        body.content,
        dice_json,
        body.reply_to_id,
    )

    # Increment messages_sent XP
    try:
        await conn.execute(
            """
            INSERT INTO member_xp (member_id, total_xp, messages_sent)
            VALUES ($1, 1, 1)
            ON CONFLICT (member_id) DO UPDATE
            SET messages_sent = member_xp.messages_sent + 1,
                total_xp = member_xp.total_xp + 1
            """,
            current_user["id"],
        )
    except Exception:
        pass

    await publish_event(TOPIC_CHAT_MESSAGE_SENT, {
        "message_id": str(msg_id),
        "room_id": str(room_id),
        "member_id": str(current_user["id"]),
        "character_id": str(character_id) if character_id else None,
        "message_type": body.message_type,
        "content": body.content[:200],
    })

    row = await conn.fetchrow(
        """
        SELECT m.id, m.room_id, m.member_id, m.character_id, m.message_type,
               m.content, m.dice_result, m.created_at, m.edited_at, m.is_pinned,
               c.name AS character_name, c.portrait_url AS character_portrait
        FROM chat_messages m
        LEFT JOIN characters c ON c.id = m.character_id
        WHERE m.id = $1
        """,
        msg_id,
    )
    return item_response(dict(row))


@router.delete("/messages/{message_id}", status_code=204)
async def delete_message(
    message_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    msg = await conn.fetchrow("SELECT member_id FROM chat_messages WHERE id = $1", message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if str(msg["member_id"]) != str(current_user["id"]) and current_user["role"] not in ("admin", "dm"):
        raise HTTPException(status_code=403, detail="Cannot delete others' messages")

    await conn.execute(
        "UPDATE chat_messages SET deleted_at = NOW() WHERE id = $1", message_id
    )


@router.get("/dm/{to_character_id}", response_model=dict)
async def get_direct_messages(
    to_character_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char_id = current_user.get("active_character_id")
    if not char_id:
        raise HTTPException(status_code=400, detail="No active character set")

    rows = await conn.fetch(
        """
        SELECT dm.id, dm.from_character_id, dm.to_character_id, dm.content,
               dm.message_type, dm.read_at, dm.created_at,
               fc.name AS from_character_name, tc.name AS to_character_name
        FROM chat_direct_messages dm
        JOIN characters fc ON fc.id = dm.from_character_id
        JOIN characters tc ON tc.id = dm.to_character_id
        WHERE dm.deleted_at IS NULL
          AND (
            (dm.from_character_id = $1 AND dm.to_character_id = $2)
            OR (dm.from_character_id = $2 AND dm.to_character_id = $1)
          )
        ORDER BY dm.created_at DESC
        LIMIT $3
        """,
        char_id, to_character_id, limit,
    )
    return {"data": records_to_list(rows)}


@router.post("/dm/{to_character_id}", response_model=dict, status_code=201)
async def send_direct_message(
    to_character_id: uuid.UUID,
    body: DirectMessageCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from_char_id = current_user.get("active_character_id")
    if not from_char_id:
        raise HTTPException(status_code=400, detail="No active character set")

    msg_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO chat_direct_messages (id, from_character_id, to_character_id, content, message_type)
        VALUES ($1, $2, $3, $4, $5::dm_message_type)
        """,
        msg_id, from_char_id, to_character_id, body.content, body.message_type,
    )

    row = await conn.fetchrow(
        """
        SELECT dm.id, dm.from_character_id, dm.to_character_id, dm.content,
               dm.message_type, dm.read_at, dm.created_at,
               fc.name AS from_character_name, tc.name AS to_character_name
        FROM chat_direct_messages dm
        JOIN characters fc ON fc.id = dm.from_character_id
        JOIN characters tc ON tc.id = dm.to_character_id
        WHERE dm.id = $1
        """,
        msg_id,
    )
    return item_response(dict(row))
