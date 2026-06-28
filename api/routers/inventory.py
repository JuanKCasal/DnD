import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db
from api.db.helpers import error_response, item_response, list_response, log_event, paginate, records_to_list
from api.db.kafka import TOPIC_INVENTORY_UPDATED, publish_event
from api.models.inventory_model import (
    CurrencyUpdate, InventoryAdd, InventoryUpdate,
    ItemCreate, ItemUpdate, TreasuryAdd, TreasuryUpdate,
)

router = APIRouter(prefix="/api/v1", tags=["inventory"])


# ═══════════════════════════════════════════════════════
#  ITEMS CATALOGUE
# ═══════════════════════════════════════════════════════

@router.get("/items", response_model=dict)
async def list_items(
    search: str | None = Query(None),
    type: str | None = Query(None),
    rarity: str | None = Query(None),
    is_magical: bool | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    conditions = []
    params: list = []
    idx = 1

    if search:
        conditions.append(f"name ILIKE ${idx}")
        params.append(f"%{search}%")
        idx += 1
    if type:
        conditions.append(f"type = ${idx}::item_type")
        params.append(type)
        idx += 1
    if rarity:
        conditions.append(f"rarity = ${idx}::item_rarity")
        params.append(rarity)
        idx += 1
    if is_magical is not None:
        conditions.append(f"is_magical = ${idx}")
        params.append(is_magical)
        idx += 1

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    offset, limit = paginate(page, per_page)
    total = await conn.fetchval(f"SELECT COUNT(*) FROM items {where}", *params)

    rows = await conn.fetch(
        f"""
        SELECT id, name, description, type, rarity, weight, value_gp,
               is_magical, is_consumable, requires_attunement, attunement_restriction,
               source_book, source_page
        FROM items {where}
        ORDER BY name ASC
        LIMIT ${idx} OFFSET ${idx + 1}
        """,
        *(params + [limit, offset]),
    )
    return list_response(records_to_list(rows), total, page, per_page)


@router.post("/items", response_model=dict, status_code=201)
async def create_item(
    body: ItemCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("admin", "dm"):
        raise HTTPException(status_code=403, detail="Only admins and DMs can create items")

    row = await conn.fetchrow(
        """
        INSERT INTO items (name, description, type, rarity, weight, value_gp,
                           is_magical, is_consumable, requires_attunement,
                           attunement_restriction, source_book, source_page)
        VALUES ($1,$2,$3::item_type,$4::item_rarity,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id, name, description, type, rarity, weight, value_gp,
                  is_magical, is_consumable, requires_attunement, attunement_restriction,
                  source_book, source_page
        """,
        body.name, body.description, body.type, body.rarity,
        body.weight, body.value_gp, body.is_magical, body.is_consumable,
        body.requires_attunement, body.attunement_restriction,
        body.source_book, body.source_page,
    )
    await log_event(conn, "item_created", "item", str(row["id"]), row["name"],
                    actor_member_id=str(current_user["id"]))
    return item_response(dict(row))


@router.get("/items/{item_id}", response_model=dict)
async def get_item(
    item_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    row = await conn.fetchrow(
        """
        SELECT id, name, description, type, rarity, weight, value_gp,
               is_magical, is_consumable, requires_attunement, attunement_restriction,
               charges_max, charges_recharge, sentient, cursed,
               source_book, source_page
        FROM items WHERE id = $1
        """,
        item_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    return item_response(dict(row))


@router.put("/items/{item_id}", response_model=dict)
async def update_item(
    item_id: uuid.UUID,
    body: ItemUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update items")

    existing = await conn.fetchrow("SELECT id FROM items WHERE id = $1", item_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Build dynamic SET clause, casting enums as needed
    set_parts = []
    params: list = []
    idx = 1
    enum_fields = {"type": "item_type", "rarity": "item_rarity"}
    for field, value in updates.items():
        cast = f"::{enum_fields[field]}" if field in enum_fields else ""
        set_parts.append(f"{field} = ${idx}{cast}")
        params.append(value)
        idx += 1

    params.append(item_id)
    row = await conn.fetchrow(
        f"""
        UPDATE items SET {', '.join(set_parts)}
        WHERE id = ${idx}
        RETURNING id, name, description, type, rarity, weight, value_gp,
                  is_magical, is_consumable, requires_attunement, source_book, source_page
        """,
        *params,
    )
    return item_response(dict(row))


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete items")

    result = await conn.execute("DELETE FROM items WHERE id = $1", item_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Item not found")


# ═══════════════════════════════════════════════════════
#  CHARACTER INVENTORY
# ═══════════════════════════════════════════════════════

@router.get("/characters/{char_id}/inventory", response_model=dict)
async def get_character_inventory(
    char_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char = await conn.fetchrow(
        "SELECT id, member_id FROM characters WHERE id = $1 AND active = TRUE", char_id
    )
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    rows = await conn.fetch(
        """
        SELECT ci.item_id, ci.quantity, ci.equipped, ci.attuned,
               ci.charges_current, ci.custom_name, ci.notes,
               i.name, i.description, i.type, i.rarity, i.weight, i.value_gp,
               i.is_magical, i.is_consumable, i.requires_attunement,
               i.charges_max, i.source_book
        FROM character_inventory ci
        JOIN items i ON i.id = ci.item_id
        WHERE ci.character_id = $1
        ORDER BY ci.equipped DESC, i.type, i.name
        """,
        char_id,
    )
    return item_response(records_to_list(rows))


@router.post("/characters/{char_id}/inventory", response_model=dict, status_code=201)
async def add_to_character_inventory(
    char_id: uuid.UUID,
    body: InventoryAdd,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char = await conn.fetchrow(
        "SELECT id, member_id FROM characters WHERE id = $1 AND active = TRUE", char_id
    )
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    # Can modify: owner, admin, or DM of the campaign
    if current_user["role"] not in ("admin", "dm") and str(char["member_id"]) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Cannot modify another player's inventory")

    item = await conn.fetchrow("SELECT id, name FROM items WHERE id = $1", body.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Upsert: if already exists, add quantity
    row = await conn.fetchrow(
        """
        INSERT INTO character_inventory (character_id, item_id, quantity, equipped, notes)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (character_id, item_id)
        DO UPDATE SET quantity = character_inventory.quantity + EXCLUDED.quantity,
                      notes = COALESCE(EXCLUDED.notes, character_inventory.notes)
        RETURNING item_id, quantity, equipped, attuned, charges_current, custom_name, notes
        """,
        char_id, body.item_id, body.quantity, body.equipped, body.notes,
    )
    await publish_event(TOPIC_INVENTORY_UPDATED, {
        "event": "item_added", "character_id": str(char_id),
        "item_id": str(body.item_id), "item_name": item["name"],
        "quantity": body.quantity,
    })
    return item_response(dict(row))


@router.put("/characters/{char_id}/inventory/{item_id}", response_model=dict)
async def update_character_inventory(
    char_id: uuid.UUID,
    item_id: uuid.UUID,
    body: InventoryUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char = await conn.fetchrow(
        "SELECT id, member_id FROM characters WHERE id = $1", char_id
    )
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if current_user["role"] not in ("admin", "dm") and str(char["member_id"]) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Cannot modify another player's inventory")

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts = []
    params: list = []
    idx = 1
    for field, value in updates.items():
        set_parts.append(f"{field} = ${idx}")
        params.append(value)
        idx += 1

    params += [char_id, item_id]
    row = await conn.fetchrow(
        f"""
        UPDATE character_inventory SET {', '.join(set_parts)}
        WHERE character_id = ${idx} AND item_id = ${idx + 1}
        RETURNING item_id, quantity, equipped, attuned, charges_current, custom_name, notes
        """,
        *params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Inventory entry not found")
    return item_response(dict(row))


@router.delete("/characters/{char_id}/inventory/{item_id}", status_code=204)
async def remove_from_character_inventory(
    char_id: uuid.UUID,
    item_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char = await conn.fetchrow(
        "SELECT id, member_id FROM characters WHERE id = $1", char_id
    )
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if current_user["role"] not in ("admin", "dm") and str(char["member_id"]) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Cannot modify another player's inventory")

    result = await conn.execute(
        "DELETE FROM character_inventory WHERE character_id = $1 AND item_id = $2",
        char_id, item_id,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Inventory entry not found")
    await publish_event(TOPIC_INVENTORY_UPDATED, {
        "event": "item_removed", "character_id": str(char_id), "item_id": str(item_id),
    })


# ═══════════════════════════════════════════════════════
#  CAMPAIGN TREASURY
# ═══════════════════════════════════════════════════════

@router.get("/campaigns/{camp_id}/treasury", response_model=dict)
async def get_campaign_treasury(
    camp_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    camp = await conn.fetchrow("SELECT id FROM campaigns WHERE id = $1", camp_id)
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")

    items = await conn.fetch(
        """
        SELECT ct.item_id, ct.quantity, ct.notes, ct.updated_at,
               i.name, i.description, i.type, i.rarity, i.weight, i.value_gp,
               i.is_magical, i.source_book
        FROM campaign_treasury ct
        JOIN items i ON i.id = ct.item_id
        WHERE ct.campaign_id = $1
        ORDER BY i.rarity DESC, i.name
        """,
        camp_id,
    )
    currency = await conn.fetchrow(
        "SELECT copper, silver, electrum, gold, platinum FROM campaign_currency WHERE campaign_id = $1",
        camp_id,
    )
    return item_response({
        "items": records_to_list(items),
        "currency": dict(currency) if currency else {"copper": 0, "silver": 0, "electrum": 0, "gold": 0, "platinum": 0},
    })


@router.post("/campaigns/{camp_id}/treasury/items", response_model=dict, status_code=201)
async def add_to_treasury(
    camp_id: uuid.UUID,
    body: TreasuryAdd,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    camp = await conn.fetchrow("SELECT id, dm_id FROM campaigns WHERE id = $1", camp_id)
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if current_user["role"] != "admin" and str(camp["dm_id"]) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Only the DM or admin can manage treasury")

    item = await conn.fetchrow("SELECT id, name FROM items WHERE id = $1", body.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    row = await conn.fetchrow(
        """
        INSERT INTO campaign_treasury (campaign_id, item_id, quantity, notes)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (campaign_id, item_id)
        DO UPDATE SET quantity = campaign_treasury.quantity + EXCLUDED.quantity,
                      notes = COALESCE(EXCLUDED.notes, campaign_treasury.notes),
                      updated_at = NOW()
        RETURNING item_id, quantity, notes, updated_at
        """,
        camp_id, body.item_id, body.quantity, body.notes,
    )
    await publish_event(TOPIC_INVENTORY_UPDATED, {
        "event": "treasury_item_added", "campaign_id": str(camp_id),
        "item_id": str(body.item_id), "item_name": item["name"],
        "quantity": body.quantity,
    })
    return item_response(dict(row))


@router.put("/campaigns/{camp_id}/treasury/items/{item_id}", response_model=dict)
async def update_treasury_item(
    camp_id: uuid.UUID,
    item_id: uuid.UUID,
    body: TreasuryUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    camp = await conn.fetchrow("SELECT id, dm_id FROM campaigns WHERE id = $1", camp_id)
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if current_user["role"] != "admin" and str(camp["dm_id"]) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Only the DM or admin can manage treasury")

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts = []
    params: list = []
    idx = 1
    for field, value in updates.items():
        set_parts.append(f"{field} = ${idx}")
        params.append(value)
        idx += 1

    params += [camp_id, item_id]
    row = await conn.fetchrow(
        f"""
        UPDATE campaign_treasury SET {', '.join(set_parts)}, updated_at = NOW()
        WHERE campaign_id = ${idx} AND item_id = ${idx + 1}
        RETURNING item_id, quantity, notes, updated_at
        """,
        *params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Treasury entry not found")
    return item_response(dict(row))


@router.delete("/campaigns/{camp_id}/treasury/items/{item_id}", status_code=204)
async def remove_from_treasury(
    camp_id: uuid.UUID,
    item_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    camp = await conn.fetchrow("SELECT id, dm_id FROM campaigns WHERE id = $1", camp_id)
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if current_user["role"] != "admin" and str(camp["dm_id"]) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Only the DM or admin can manage treasury")

    result = await conn.execute(
        "DELETE FROM campaign_treasury WHERE campaign_id = $1 AND item_id = $2",
        camp_id, item_id,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Treasury entry not found")


@router.put("/campaigns/{camp_id}/treasury/currency", response_model=dict)
async def update_campaign_currency(
    camp_id: uuid.UUID,
    body: CurrencyUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    camp = await conn.fetchrow("SELECT id, dm_id FROM campaigns WHERE id = $1", camp_id)
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if current_user["role"] != "admin" and str(camp["dm_id"]) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Only the DM or admin can manage treasury")

    row = await conn.fetchrow(
        """
        INSERT INTO campaign_currency (campaign_id, copper, silver, electrum, gold, platinum)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (campaign_id)
        DO UPDATE SET copper=$2, silver=$3, electrum=$4, gold=$5, platinum=$6, updated_at=NOW()
        RETURNING copper, silver, electrum, gold, platinum, updated_at
        """,
        camp_id, body.copper, body.silver, body.electrum, body.gold, body.platinum,
    )
    await publish_event(TOPIC_INVENTORY_UPDATED, {
        "event": "currency_updated", "campaign_id": str(camp_id),
        "gold": body.gold, "silver": body.silver,
    })
    return item_response(dict(row))
