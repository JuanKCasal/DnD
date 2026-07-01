import json
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db
from api.db.helpers import error_response, item_response, list_response, log_event, paginate, records_to_list
from api.db.kafka import TOPIC_INVENTORY_UPDATED, publish_event
from api.services.economy import (
    to_copper, from_copper, coin_weight, carrying_capacity, encumbrance, format_currency,
)
from api.models.inventory_model import (
    CurrencyUpdate, InventoryAdd, InventoryUpdate,
    ItemCreate, ItemUpdate, TreasuryAdd, TreasuryUpdate,
)

router = APIRouter(prefix="/api/v1", tags=["inventory"])

# ── Columnas y casts del catálogo de ítems ────────────────────────────
# Proyección ligera para listados (sin magical_properties para evitar parseo por fila)
ITEM_LIST_COLUMNS = """
    id, name, description, type, rarity, weight, value_gp,
    is_magical, is_consumable, requires_attunement, attunement_restriction,
    charges_max, charges_recharge, sentient, cursed,
    weapon_category, weapon_range_type, damage_dice, damage_type,
    damage_dice_versatile, weapon_properties, bonus_attack,
    armor_category, ac_base, ac_dex_bonus, ac_max_dex_bonus,
    str_minimum, stealth_disadvantage, bonus_ac,
    source_book, source_page
"""

# Proyección completa (incluye magical_properties y rangos) para detalle/escritura
ITEM_FULL_COLUMNS = """
    id, name, description, type, rarity, weight, value_gp,
    is_magical, is_consumable, requires_attunement, attunement_restriction,
    charges_max, charges_recharge, sentient, cursed,
    weapon_category, weapon_range_type, damage_dice, damage_type, damage_dice_versatile,
    range_normal, range_long, throw_range_normal, throw_range_long,
    weapon_properties, bonus_attack,
    armor_category, ac_base, ac_dex_bonus, ac_max_dex_bonus,
    str_minimum, stealth_disadvantage, bonus_ac,
    magical_properties, source_book, source_page, dnd5eapi_index, open5e_key
"""

# Campos que requieren cast explícito en INSERT/UPDATE
ITEM_FIELD_CASTS = {
    "type": "::item_type",
    "rarity": "::item_rarity",
    "magical_properties": "::jsonb",
}


def _serialize_item_field(field: str, value):
    """JSONB se pasa como texto serializado; el resto sin cambios."""
    if field == "magical_properties" and value is not None:
        return json.dumps(value)
    return value


def _suggest_slot(item) -> str | None:
    """Slot sugerido según el tipo de ítem (el cliente puede sobrescribirlo)."""
    t = item["type"]
    if t == "weapon":
        return "main_hand"
    if t == "armor":
        return "off_hand" if item["armor_category"] == "Shield" else "body"
    if t == "ring":
        return "ring_left"
    return None


def _row_to_item(row) -> dict:
    """Convierte un Record a dict, parseando magical_properties (JSONB → dict)."""
    data = dict(row)
    mp = data.get("magical_properties")
    if isinstance(mp, str):
        try:
            data["magical_properties"] = json.loads(mp)
        except (ValueError, TypeError):
            data["magical_properties"] = {}
    return data


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
        SELECT {ITEM_LIST_COLUMNS}
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

    data = body.model_dump(exclude_unset=True)

    cols: list[str] = []
    placeholders: list[str] = []
    params: list = []
    idx = 1
    for field, value in data.items():
        cast = ITEM_FIELD_CASTS.get(field, "")
        cols.append(field)
        placeholders.append(f"${idx}{cast}")
        params.append(_serialize_item_field(field, value))
        idx += 1

    row = await conn.fetchrow(
        f"""
        INSERT INTO items ({', '.join(cols)})
        VALUES ({', '.join(placeholders)})
        RETURNING {ITEM_FULL_COLUMNS}
        """,
        *params,
    )
    result = _row_to_item(row)
    await log_event(conn, "item_created", "item", str(result["id"]), result["name"],
                    actor_member_id=str(current_user["id"]))
    return item_response(result)


@router.get("/items/{item_id}", response_model=dict)
async def get_item(
    item_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    row = await conn.fetchrow(
        f"SELECT {ITEM_FULL_COLUMNS} FROM items WHERE id = $1",
        item_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    return item_response(_row_to_item(row))


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

    # Build dynamic SET clause, casting enums/JSONB as needed
    set_parts = []
    params: list = []
    idx = 1
    for field, value in updates.items():
        cast = ITEM_FIELD_CASTS.get(field, "")
        set_parts.append(f"{field} = ${idx}{cast}")
        params.append(_serialize_item_field(field, value))
        idx += 1

    params.append(item_id)
    row = await conn.fetchrow(
        f"""
        UPDATE items SET {', '.join(set_parts)}
        WHERE id = ${idx}
        RETURNING {ITEM_FULL_COLUMNS}
        """,
        *params,
    )
    return item_response(_row_to_item(row))


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
        SELECT ci.item_id, ci.quantity, ci.equipped, ci.slot, ci.attuned,
               ci.charges_current, ci.custom_name, ci.notes,
               i.name, i.description, i.type, i.rarity, i.weight, i.value_gp,
               i.is_magical, i.is_consumable, i.requires_attunement,
               i.charges_max, i.source_book,
               i.damage_dice, i.damage_type, i.damage_dice_versatile,
               i.ac_base, i.armor_category, i.weapon_category, i.weapon_properties
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

    # Metadatos del ítem (para reglas de equipo y sintonía)
    item = await conn.fetchrow(
        """
        SELECT i.type, i.armor_category, i.weapon_properties, i.requires_attunement
        FROM character_inventory ci JOIN items i ON i.id = ci.item_id
        WHERE ci.character_id = $1 AND ci.item_id = $2
        """,
        char_id, item_id,
    )
    if not item:
        raise HTTPException(status_code=404, detail="Inventory entry not found")

    props = list(item["weapon_properties"] or [])
    two_handed = "two_handed" in props

    async with conn.transaction():
        # ── Regla de sintonía ──
        if updates.get("attuned") is True:
            if not item["requires_attunement"]:
                raise HTTPException(status_code=400, detail={
                    "code": "ATTUNEMENT_NOT_REQUIRED",
                    "message": "Este objeto no requiere sintonía",
                })
            attuned_count = await conn.fetchval(
                """
                SELECT COUNT(*) FROM character_inventory
                WHERE character_id = $1 AND attuned = TRUE AND item_id <> $2
                """,
                char_id, item_id,
            )
            if attuned_count >= 3:
                raise HTTPException(status_code=400, detail={
                    "code": "ATTUNEMENT_LIMIT_REACHED",
                    "message": "Ya tienes 3 objetos sintonizados (máximo permitido)",
                })

        # ── Reglas de equipo / slots ──
        if updates.get("equipped") is True:
            slot = updates.get("slot") or _suggest_slot(item)
            updates["slot"] = slot
            if slot:
                # Un solo ítem por slot (los anillos usan dos slots distintos)
                await conn.execute(
                    """
                    UPDATE character_inventory SET equipped = FALSE, slot = NULL
                    WHERE character_id = $1 AND slot = $2 AND item_id <> $3
                    """,
                    char_id, slot, item_id,
                )
                # Arma a dos manos ocupa main_hand y bloquea off_hand
                if slot == "main_hand" and two_handed:
                    await conn.execute(
                        "UPDATE character_inventory SET equipped = FALSE, slot = NULL "
                        "WHERE character_id = $1 AND slot = 'off_hand'",
                        char_id,
                    )
                # Equipar en off_hand (escudo/arma) desaloja un arma a dos manos
                if slot == "off_hand":
                    await conn.execute(
                        """
                        UPDATE character_inventory ci SET equipped = FALSE, slot = NULL
                        FROM items i
                        WHERE ci.item_id = i.id AND ci.character_id = $1
                          AND ci.slot = 'main_hand' AND 'two_handed' = ANY(i.weapon_properties)
                        """,
                        char_id,
                    )
        elif updates.get("equipped") is False:
            updates["slot"] = None  # al desequipar, se libera el slot

        # ── Aplicar cambios ──
        set_parts, params, idx = [], [], 1
        for field, value in updates.items():
            set_parts.append(f"{field} = ${idx}")
            params.append(value)
            idx += 1
        params += [char_id, item_id]
        row = await conn.fetchrow(
            f"""
            UPDATE character_inventory SET {', '.join(set_parts)}
            WHERE character_id = ${idx} AND item_id = ${idx + 1}
            RETURNING item_id, quantity, equipped, slot, attuned,
                      charges_current, custom_name, notes
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


# ═══════════════════════════════════════════════════════
#  CHARACTER CURRENCY / CARGA / TIENDA (Fase I5)
# ═══════════════════════════════════════════════════════
_ZERO_CURRENCY = {"copper": 0, "silver": 0, "electrum": 0, "gold": 0, "platinum": 0}


async def _char_for_economy(conn, char_id):
    return await conn.fetchrow(
        "SELECT id, member_id, str AS str_score FROM characters WHERE id = $1 AND active = TRUE",
        char_id,
    )


def _can_edit_char(current_user, member_id) -> bool:
    return current_user["role"] in ("admin", "dm") or str(member_id) == str(current_user["id"])


async def _read_currency(conn, char_id) -> dict:
    row = await conn.fetchrow(
        "SELECT copper, silver, electrum, gold, platinum FROM character_currency WHERE character_id = $1",
        char_id,
    )
    return dict(row) if row else dict(_ZERO_CURRENCY)


async def _write_currency(conn, char_id, currency: dict):
    await conn.execute(
        """
        INSERT INTO character_currency (character_id, copper, silver, electrum, gold, platinum)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (character_id)
        DO UPDATE SET copper=$2, silver=$3, electrum=$4, gold=$5, platinum=$6
        """,
        char_id, currency["copper"], currency["silver"], currency["electrum"],
        currency["gold"], currency["platinum"],
    )


async def _inventory_weight(conn, char_id) -> float:
    val = await conn.fetchval(
        """
        SELECT COALESCE(SUM(COALESCE(i.weight, 0) * ci.quantity), 0)
        FROM character_inventory ci JOIN items i ON i.id = ci.item_id
        WHERE ci.character_id = $1
        """,
        char_id,
    )
    return float(val or 0)


@router.get("/characters/{char_id}/currency", response_model=dict)
async def get_character_currency(
    char_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    char = await _char_for_economy(conn, char_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    currency = await _read_currency(conn, char_id)
    total_weight = await _inventory_weight(conn, char_id) + coin_weight(currency)
    return item_response({
        "currency": currency,
        "total_cp": to_copper(currency),
        "formatted": format_currency(currency),
        "coin_weight": coin_weight(currency),
        "encumbrance": encumbrance(total_weight, char["str_score"]),
    })


@router.put("/characters/{char_id}/currency", response_model=dict)
async def update_character_currency(
    char_id: uuid.UUID,
    body: CurrencyUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char = await _char_for_economy(conn, char_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit_char(current_user, char["member_id"]):
        raise HTTPException(status_code=403, detail="Cannot modify another player's currency")
    currency = {"copper": body.copper, "silver": body.silver, "electrum": body.electrum,
                "gold": body.gold, "platinum": body.platinum}
    await _write_currency(conn, char_id, currency)
    return item_response({"currency": currency, "formatted": format_currency(currency)})


@router.post("/characters/{char_id}/shop/buy", response_model=dict)
async def shop_buy(
    char_id: uuid.UUID,
    body: InventoryAdd,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char = await _char_for_economy(conn, char_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit_char(current_user, char["member_id"]):
        raise HTTPException(status_code=403, detail="Cannot modify another player's inventory")

    item = await conn.fetchrow("SELECT id, name, value_gp FROM items WHERE id = $1", body.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item["value_gp"] is None:
        raise HTTPException(status_code=400, detail={
            "code": "NO_PRICE", "message": "Este objeto no tiene precio de compra"})

    qty = max(1, body.quantity or 1)
    cost_cp = int(round(float(item["value_gp"]) * 100)) * qty

    async with conn.transaction():
        currency = await _read_currency(conn, char_id)
        have = to_copper(currency)
        if have < cost_cp:
            raise HTTPException(status_code=400, detail={
                "code": "INSUFFICIENT_FUNDS",
                "message": "No tienes suficiente dinero para esta compra"})
        await _write_currency(conn, char_id, from_copper(have - cost_cp))
        await conn.execute(
            """
            INSERT INTO character_inventory (character_id, item_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (character_id, item_id)
            DO UPDATE SET quantity = character_inventory.quantity + EXCLUDED.quantity
            """,
            char_id, body.item_id, qty,
        )
    new_currency = await _read_currency(conn, char_id)
    await publish_event(TOPIC_INVENTORY_UPDATED, {
        "event": "item_bought", "character_id": str(char_id),
        "item_id": str(body.item_id), "quantity": qty, "spent_cp": cost_cp,
    })
    return item_response({"bought": item["name"], "quantity": qty,
                          "spent_cp": cost_cp, "currency": new_currency,
                          "formatted": format_currency(new_currency)})


@router.post("/characters/{char_id}/shop/sell", response_model=dict)
async def shop_sell(
    char_id: uuid.UUID,
    body: InventoryAdd,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    char = await _char_for_economy(conn, char_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if not _can_edit_char(current_user, char["member_id"]):
        raise HTTPException(status_code=403, detail="Cannot modify another player's inventory")

    item = await conn.fetchrow("SELECT id, name, value_gp FROM items WHERE id = $1", body.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    qty = max(1, body.quantity or 1)
    # Venta a mitad de precio (regla común de mercado)
    gain_cp = int(round(float(item["value_gp"] or 0) * 100 * 0.5)) * qty

    async with conn.transaction():
        inv = await conn.fetchrow(
            "SELECT quantity FROM character_inventory WHERE character_id = $1 AND item_id = $2",
            char_id, body.item_id,
        )
        if not inv or inv["quantity"] < qty:
            raise HTTPException(status_code=400, detail={
                "code": "NOT_ENOUGH_ITEMS",
                "message": "No tienes suficientes unidades para vender"})
        if inv["quantity"] == qty:
            await conn.execute(
                "DELETE FROM character_inventory WHERE character_id = $1 AND item_id = $2",
                char_id, body.item_id,
            )
        else:
            await conn.execute(
                "UPDATE character_inventory SET quantity = quantity - $3 "
                "WHERE character_id = $1 AND item_id = $2",
                char_id, body.item_id, qty,
            )
        currency = await _read_currency(conn, char_id)
        await _write_currency(conn, char_id, from_copper(to_copper(currency) + gain_cp))
    new_currency = await _read_currency(conn, char_id)
    await publish_event(TOPIC_INVENTORY_UPDATED, {
        "event": "item_sold", "character_id": str(char_id),
        "item_id": str(body.item_id), "quantity": qty, "gained_cp": gain_cp,
    })
    return item_response({"sold": item["name"], "quantity": qty,
                          "gained_cp": gain_cp, "currency": new_currency,
                          "formatted": format_currency(new_currency)})
