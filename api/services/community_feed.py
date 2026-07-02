"""Mensajes de sistema en canales de notificación (Fase CM3).

Publica notas del "sistema" (message_type='system', sin personaje) en salas de
solo lectura como "Saludos" y "Salón de la Fama". Best-effort: nunca rompe el
flujo principal si la sala no existe o falla la inserción.

`member_id` debe ser un miembro válido (la columna es NOT NULL); se usa el actor
que disparó el evento, pero el mensaje se marca como de sistema.
"""
import uuid

import asyncpg


async def post_system_message(conn: asyncpg.Connection, room_slug: str, member_id, text: str) -> None:
    try:
        room_id = await conn.fetchval("SELECT id FROM chat_rooms WHERE slug = $1", room_slug)
        if not room_id:
            return
        await conn.execute(
            """
            INSERT INTO chat_messages (id, room_id, member_id, message_type, content)
            VALUES ($1, $2, $3, 'system', $4)
            """,
            uuid.uuid4(), room_id, member_id, text,
        )
    except Exception:
        pass
