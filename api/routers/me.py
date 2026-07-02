"""Contexto del usuario actual (Fase CM1).

Personaje activo: identidad social del usuario. Gobierna con qué personaje
"hablas" y qué canales/clanes ves (motor de visibilidad en chat.py).
"""
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response

router = APIRouter(prefix="/api/v1/me", tags=["me"])


@router.get("/active-character", response_model=dict)
async def get_active_character(
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    acid = await conn.fetchval("SELECT active_character_id FROM members WHERE id = $1", current_user["id"])
    char = None
    if acid:
        char = await conn.fetchrow(
            "SELECT id, name, class AS char_class, level, portrait_url, campaign_id FROM characters WHERE id = $1 AND active = TRUE",
            acid,
        )
    return item_response({
        "active_character_id": str(acid) if acid else None,
        "character": dict(char) if char else None,
    })


@router.put("/active-character", response_model=dict)
async def set_active_character(
    body: dict,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char_id = body.get("character_id")
    if char_id:
        cid = uuid.UUID(str(char_id))
        owner = await conn.fetchrow("SELECT member_id FROM characters WHERE id = $1 AND active = TRUE", cid)
        if not owner:
            raise HTTPException(status_code=404, detail="Character not found")
        if str(owner["member_id"]) != str(current_user["id"]) and current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Ese personaje no es tuyo")
        await conn.execute("UPDATE members SET active_character_id = $1 WHERE id = $2", cid, current_user["id"])
        return item_response({"active_character_id": str(cid)})

    await conn.execute("UPDATE members SET active_character_id = NULL WHERE id = $1", current_user["id"])
    return item_response({"active_character_id": None})
