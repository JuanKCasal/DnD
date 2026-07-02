import json
import uuid
from datetime import datetime

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


_ROOM_COLS = """
    SELECT r.id, r.name, r.slug, r.type AS room_type, r.clan_id, r.campaign_id,
           r.rank_required_id, r.description, r.icon, r.is_readonly,
           r.is_ic, r.sort_order, r.created_at
    FROM chat_rooms r
"""


@router.get("/rooms", response_model=dict)
async def list_rooms(
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Salas visibles según el PERSONAJE ACTIVO (CM1): públicas + campañas del
    jugador + clanes del personaje activo + por rango. El staff (admin/dm) ve
    todo, incluido el canal 'admin'."""
    # El staff ve todas las salas.
    if current_user["role"] in ("admin", "dm"):
        rows = await conn.fetch(_ROOM_COLS + " ORDER BY r.sort_order ASC, r.name ASC")
        return {"data": records_to_list(rows)}

    active_char = await conn.fetchval(
        "SELECT active_character_id FROM members WHERE id = $1", current_user["id"]
    )
    rows = await conn.fetch(
        _ROOM_COLS + """
        WHERE
            -- Públicas: sin clan/campaña/rango y que NO sean el canal de administradores
            (r.clan_id IS NULL AND r.campaign_id IS NULL AND r.rank_required_id IS NULL AND r.type <> 'admin')
            -- Salas de campaña donde el jugador participa
            OR (r.campaign_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM campaign_members cm WHERE cm.campaign_id = r.campaign_id AND cm.member_id = $1
            ))
            -- Salas de clan donde el PERSONAJE ACTIVO es miembro (CM1/D2)
            OR (r.clan_id IS NOT NULL AND $2::uuid IS NOT NULL AND EXISTS (
                SELECT 1 FROM clan_characters cc WHERE cc.clan_id = r.clan_id AND cc.character_id = $2
            ))
            -- Salas por rango
            OR (r.rank_required_id IS NOT NULL AND $3::uuid IS NOT NULL AND EXISTS (
                SELECT 1 FROM ranks r2
                JOIN ranks rr ON rr.id = r.rank_required_id
                WHERE r2.id = $3 AND r2.level >= rr.level
            ))
        ORDER BY r.sort_order ASC, r.name ASC
        """,
        current_user["id"],
        active_char,
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


_MSG_SELECT = """
    SELECT m.id, m.room_id, m.member_id, m.character_id, m.message_type,
           m.content, m.dice_result, m.created_at, m.edited_at, m.is_pinned,
           c.name AS character_name, c.portrait_url AS character_portrait,
           mem.display_name AS member_name
    FROM chat_messages m
    LEFT JOIN characters c ON c.id = m.character_id
    LEFT JOIN members mem ON mem.id = m.member_id
    WHERE m.room_id = $1 AND m.deleted_at IS NULL
"""


@router.get("/rooms/{room_id}/messages", response_model=dict)
async def get_messages(
    room_id: uuid.UUID,
    after: str | None = Query(None),   # timestamp ISO para polling incremental
    limit: int = Query(50, ge=1, le=100),
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Mensajes en orden cronológico ascendente. `after` (created_at ISO) trae
    solo los nuevos (polling). Sin `after`, los últimos `limit`."""
    if after:
        rows = await conn.fetch(
            _MSG_SELECT + " AND m.created_at > $2 ORDER BY m.created_at ASC LIMIT 200",
            room_id, datetime.fromisoformat(after),
        )
        data = records_to_list(rows)
    else:
        rows = await conn.fetch(
            _MSG_SELECT + " ORDER BY m.created_at DESC LIMIT $2", room_id, limit,
        )
        data = list(reversed(records_to_list(rows)))

    # Marca de lectura (best-effort)
    try:
        await conn.execute(
            """
            INSERT INTO chat_room_presence (room_id, member_id, last_read_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (room_id, member_id) DO UPDATE SET last_read_at = NOW()
            """,
            room_id, current_user["id"],
        )
    except Exception:
        pass
    return {"data": data}


@router.post("/rooms/{room_id}/messages", response_model=dict, status_code=201)
async def post_message(
    room_id: uuid.UUID,
    body: ChatMessageCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    room = await conn.fetchrow(
        "SELECT type AS room_type, is_readonly, is_ic, clan_id, campaign_id FROM chat_rooms WHERE id = $1",
        room_id,
    )
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    is_staff = current_user["role"] in ("admin", "dm")
    active_char = current_user.get("active_character_id")

    # Permisos de escritura por tipo/pertenencia (CM2). El staff puede escribir en todo.
    if not is_staff:
        if room["is_readonly"]:
            raise HTTPException(status_code=403, detail="Canal de solo lectura")
        if room["room_type"] == "admin":
            raise HTTPException(status_code=403, detail="Canal solo para administradores")
        if room["campaign_id"] is not None:
            ok = await conn.fetchval(
                "SELECT 1 FROM campaign_members WHERE campaign_id = $1 AND member_id = $2",
                room["campaign_id"], current_user["id"],
            )
            if not ok:
                raise HTTPException(status_code=403, detail="No participas en esta campaña")
        if room["clan_id"] is not None:
            if not active_char:
                raise HTTPException(status_code=403, detail="Necesitas un personaje del clan activo")
            ok = await conn.fetchval(
                "SELECT 1 FROM clan_characters WHERE clan_id = $1 AND character_id = $2",
                room["clan_id"], active_char,
            )
            if not ok:
                raise HTTPException(status_code=403, detail="Tu personaje activo no pertenece a este clan")

    # Los canales In-Character exigen hablar como personaje (D1).
    if room["is_ic"] and not active_char:
        raise HTTPException(status_code=400, detail="Necesitas un personaje activo para hablar In-Character")

    msg_id = uuid.uuid4()
    character_id = active_char
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


@router.get("/dm", response_model=dict)
async def list_conversations(
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Bandeja de susurros del personaje activo (estilo @WhatsApp): con quién,
    último mensaje y no-leídos."""
    char_id = current_user.get("active_character_id")
    if not char_id:
        return {"data": []}
    rows = await conn.fetch(
        """
        WITH convo AS (
          SELECT CASE WHEN from_character_id = $1 THEN to_character_id ELSE from_character_id END AS other_id,
                 MAX(created_at) AS last_at
          FROM chat_direct_messages
          WHERE deleted_at IS NULL AND $1 IN (from_character_id, to_character_id)
          GROUP BY 1
        )
        SELECT convo.other_id, oc.name AS other_name, oc.portrait_url AS other_portrait, convo.last_at,
               (SELECT content FROM chat_direct_messages d
                 WHERE d.deleted_at IS NULL
                   AND ((d.from_character_id = $1 AND d.to_character_id = convo.other_id)
                     OR (d.from_character_id = convo.other_id AND d.to_character_id = $1))
                 ORDER BY d.created_at DESC LIMIT 1) AS last_content,
               (SELECT COUNT(*) FROM chat_direct_messages d
                 WHERE d.deleted_at IS NULL AND d.to_character_id = $1
                   AND d.from_character_id = convo.other_id AND d.read_at IS NULL) AS unread
        FROM convo JOIN characters oc ON oc.id = convo.other_id
        ORDER BY convo.last_at DESC
        """,
        char_id,
    )
    return {"data": records_to_list(rows)}


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

    # Marcar como leídos los recibidos de ese personaje (best-effort)
    try:
        await conn.execute(
            "UPDATE chat_direct_messages SET read_at = NOW() WHERE to_character_id = $1 AND from_character_id = $2 AND read_at IS NULL",
            char_id, to_character_id,
        )
    except Exception:
        pass

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
