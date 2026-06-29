import json
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response, list_response, log_event, paginate, records_to_list
from api.db.kafka import TOPIC_CHARACTERS_LEVELED_UP, TOPIC_INVENTORY_UPDATED, publish_event
from api.models.character import (
    CharacterCreate,
    CharacterUpdate,
    ConditionsUpdate,
    HPUpdate,
    SpellSlotsUpdate,
)
from api.models.item import InventoryAdd

router = APIRouter(prefix="/api/v1/characters", tags=["characters"])


def _can_edit(current_user: dict, member_id) -> bool:
    return (
        str(current_user["id"]) == str(member_id)
        or current_user["role"] in ("admin", "dm")
    )


@router.get("", response_model=dict)
async def list_characters(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    campaign_id: str | None = Query(None),
    member_id: str | None = Query(None),
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    offset, limit = paginate(page, per_page)

    conditions = ["c.active = TRUE"]
    params: list = []
    idx = 1

    if campaign_id:
        conditions.append(f"c.campaign_id = ${idx}")
        params.append(uuid.UUID(campaign_id))
        idx += 1
    if member_id:
        conditions.append(f"c.member_id = ${idx}")
        params.append(uuid.UUID(member_id))
        idx += 1

    where = " AND ".join(conditions)
    total = await conn.fetchval(f"SELECT COUNT(*) FROM characters c WHERE {where}", *params)

    params_page = params + [limit, offset]
    rows = await conn.fetch(
        f"""
        SELECT c.id, c.member_id, c.campaign_id, c.name, c.race, c.class AS char_class,
               c.level, c.hp, c.max_hp, c.ac, c.portrait_url, c.active, c.created_at,
               c.str AS str_score, c.dex AS dex_score, c.con AS con_score,
               c.int AS int_score, c.wis AS wis_score, c.cha AS cha_score
        FROM characters c
        WHERE {where}
        ORDER BY c.created_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
        """,
        *params_page,
    )
    return list_response(records_to_list(rows), total, page, per_page)


@router.post("", response_model=dict, status_code=201)
async def create_character(
    body: CharacterCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char_id = uuid.uuid4()

    # If no campaign_id, use a dummy. Per schema: campaign_id NOT NULL
    # We'll allow NULL by checking schema; if NOT NULL we need a real campaign
    # Schema shows: campaign_id UUID NOT NULL REFERENCES campaigns
    if body.campaign_id is None:
        raise HTTPException(status_code=400, detail="campaign_id is required")

    await conn.execute(
        """
        INSERT INTO characters (
            id, member_id, campaign_id, name, race, subrace, class, subclass,
            background, alignment, deity, level,
            str, dex, con, int, wis, cha,
            hp, max_hp, temp_hp, ac, initiative_bonus, speed, prof_bonus, passive_perception,
            portrait_url, backstory, personality_traits, ideals, bonds, flaws, notes
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::alignment_type,$11,$12,
            $13,$14,$15,$16,$17,$18,
            $19,$20,$21,$22,$23,$24,$25,$26,
            $27,$28,$29,$30,$31,$32,$33
        )
        """,
        char_id,
        current_user["id"],
        body.campaign_id,
        body.name,
        body.race,
        body.subrace,
        body.char_class,
        body.subclass,
        body.background,
        body.alignment,
        body.deity,
        body.level,
        body.str_score,
        body.dex_score,
        body.con_score,
        body.int_score,
        body.wis_score,
        body.cha_score,
        body.hp,
        body.max_hp,
        body.temp_hp,
        body.ac,
        body.initiative_bonus,
        body.speed,
        body.prof_bonus,
        body.passive_perception,
        body.portrait_url,
        body.backstory,
        body.personality_traits,
        body.ideals,
        body.bonds,
        body.flaws,
        body.notes,
    )
    # Insert currency row
    try:
        await conn.execute(
            "INSERT INTO character_currency (character_id) VALUES ($1)", char_id
        )
    except Exception:
        pass

    await log_event(
        conn, "character.created", "character",
        target_id=str(char_id), target_name=body.name,
        actor_member_id=str(current_user["id"]), is_public=True,
    )
    row = await conn.fetchrow(_character_select() + " WHERE c.id = $1", char_id)
    return item_response(dict(row))


@router.get("/{char_id}", response_model=dict)
async def get_character(
    char_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    row = await conn.fetchrow(_character_select() + " WHERE c.id = $1", char_id)
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")
    return item_response(dict(row))


@router.put("/{char_id}", response_model=dict)
async def update_character(
    char_id: uuid.UUID,
    body: CharacterUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow("SELECT member_id, level FROM characters WHERE id = $1", char_id)
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, row["member_id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    old_level = row["level"]
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Map field names to column names
    col_map = {
        "char_class": "class",
        "str_score": "str",
        "dex_score": "dex",
        "con_score": "con",
        "int_score": "int",
        "wis_score": "wis",
        "cha_score": "cha",
    }
    json_fields = {"spell_slots", "conditions", "feats", "saving_throws", "skills"}
    enum_fields = {"alignment": "alignment_type"}

    set_clauses = []
    params = []
    for i, (k, v) in enumerate(updates.items(), start=1):
        col = col_map.get(k, k)
        if k in json_fields:
            set_clauses.append(f"{col} = ${i}")
            params.append(json.dumps(v) if not isinstance(v, str) else v)
        elif k in enum_fields:
            set_clauses.append(f"{col} = ${i}::{enum_fields[k]}")
            params.append(v)
        else:
            set_clauses.append(f"{col} = ${i}")
            params.append(v)

    params.append(char_id)
    await conn.execute(
        f"UPDATE characters SET {', '.join(set_clauses)} WHERE id = ${len(params)}",
        *params,
    )

    # Publish level-up event
    new_level = updates.get("level")
    if new_level and new_level > old_level:
        await publish_event(TOPIC_CHARACTERS_LEVELED_UP, {
            "character_id": str(char_id),
            "member_id": str(row["member_id"]),
            "old_level": old_level,
            "new_level": new_level,
        })
        await log_event(
            conn, "character.leveled_up", "character",
            target_id=str(char_id), actor_member_id=str(current_user["id"]),
            after={"level": new_level}, is_public=True,
        )

    row = await conn.fetchrow(_character_select() + " WHERE c.id = $1", char_id)
    return item_response(dict(row))


@router.delete("/{char_id}", status_code=204)
async def delete_character(
    char_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow("SELECT member_id FROM characters WHERE id = $1", char_id)
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, row["member_id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    await conn.execute("UPDATE characters SET active = FALSE WHERE id = $1", char_id)
    await log_event(
        conn, "character.deleted", "character",
        target_id=str(char_id), actor_member_id=str(current_user["id"]),
    )


@router.patch("/{char_id}/hp", response_model=dict)
async def update_hp(
    char_id: uuid.UUID,
    body: HPUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow("SELECT member_id, hp FROM characters WHERE id = $1", char_id)
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, row["member_id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    old_hp = row["hp"]
    await conn.execute("UPDATE characters SET hp = $1 WHERE id = $2", body.hp, char_id)
    await log_event(
        conn, "character.hp_changed", "character",
        target_id=str(char_id), actor_member_id=str(current_user["id"]),
        before={"hp": old_hp}, after={"hp": body.hp},
        metadata={"reason": body.reason} if body.reason else {},
    )
    return item_response({"hp": body.hp})


@router.patch("/{char_id}/conditions", response_model=dict)
async def update_conditions(
    char_id: uuid.UUID,
    body: ConditionsUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow("SELECT member_id FROM characters WHERE id = $1", char_id)
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, row["member_id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    await conn.execute(
        "UPDATE characters SET conditions = $1 WHERE id = $2",
        body.conditions, char_id,
    )
    await log_event(
        conn, "character.conditions_updated", "character",
        target_id=str(char_id), actor_member_id=str(current_user["id"]),
        after={"conditions": body.conditions},
    )
    return item_response({"conditions": body.conditions})


@router.patch("/{char_id}/spell-slots", response_model=dict)
async def update_spell_slots(
    char_id: uuid.UUID,
    body: SpellSlotsUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow("SELECT member_id FROM characters WHERE id = $1", char_id)
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, row["member_id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    await conn.execute(
        "UPDATE characters SET spell_slots = $1 WHERE id = $2",
        json.dumps(body.spell_slots), char_id,
    )
    return item_response({"spell_slots": body.spell_slots})


@router.get("/{char_id}/inventory", response_model=dict)
async def get_inventory(
    char_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    rows = await conn.fetch(
        """
        SELECT ci.item_id, ci.quantity, ci.equipped, ci.attuned, ci.notes, ci.custom_name,
               i.name, i.type AS item_type, i.rarity, i.weight, i.value_gp, i.is_magical,
               i.damage_dice, i.damage_type, i.ac_base
        FROM character_inventory ci
        JOIN items i ON i.id = ci.item_id
        WHERE ci.character_id = $1
        ORDER BY i.name ASC
        """,
        char_id,
    )
    return {"data": records_to_list(rows)}


@router.post("/{char_id}/inventory", response_model=dict, status_code=201)
async def add_to_inventory(
    char_id: uuid.UUID,
    body: InventoryAdd,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow("SELECT member_id FROM characters WHERE id = $1", char_id)
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, row["member_id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    await conn.execute(
        """
        INSERT INTO character_inventory (character_id, item_id, quantity, equipped, notes)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (character_id, item_id) DO UPDATE
        SET quantity = character_inventory.quantity + EXCLUDED.quantity
        """,
        char_id, body.item_id, body.quantity, body.equipped, body.notes,
    )
    await publish_event(TOPIC_INVENTORY_UPDATED, {
        "character_id": str(char_id),
        "item_id": str(body.item_id),
        "action": "added",
        "quantity": body.quantity,
    })
    return item_response({"character_id": str(char_id), "item_id": str(body.item_id)})


@router.delete("/{char_id}/inventory/{item_id}", status_code=204)
async def remove_from_inventory(
    char_id: uuid.UUID,
    item_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow("SELECT member_id FROM characters WHERE id = $1", char_id)
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit(current_user, row["member_id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    await conn.execute(
        "DELETE FROM character_inventory WHERE character_id = $1 AND item_id = $2",
        char_id, item_id,
    )


def _character_select() -> str:
    return """
    SELECT c.id, c.member_id, c.campaign_id, c.name, c.portrait_url,
           c.race, c.subrace, c.class AS char_class, c.subclass,
           c.level, c.background, c.alignment, c.deity, c.xp, c.inspiration,
           c.str AS str_score, c.dex AS dex_score, c.con AS con_score,
           c.int AS int_score, c.wis AS wis_score, c.cha AS cha_score,
           c.hp, c.max_hp, c.temp_hp, c.ac, c.initiative_bonus, c.speed,
           c.prof_bonus, c.passive_perception,
           c.spell_slots, c.conditions, c.feats, c.saving_throws, c.skills,
           c.backstory, c.personality_traits, c.ideals, c.bonds, c.flaws,
           c.active, c.created_at
    FROM characters c
    """
