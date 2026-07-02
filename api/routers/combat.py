"""Rastreador de combate en vivo (Fase C6).

Iniciativa, turnos/rondas, HP, condiciones y concentración (guía §15.3–§15.4).
Reglas de integridad: HP no negativo (§17.6), una entrada por combatiente (§17.7),
concentración única por combatiente (§17.8). Herramienta del DM (solo DM/admin).
"""
import json
import random
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response
from api.models.combat import CombatantAdd, CombatantUpdate

router = APIRouter(prefix="/api/v1/campaigns", tags=["combat"])


async def _manager(conn, campaign_id, user) -> bool:
    row = await conn.fetchrow("SELECT dm_id FROM campaigns WHERE id = $1", campaign_id)
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return str(row["dm_id"]) == str(user["id"]) or user["role"] == "admin"


async def _require_manager(conn, campaign_id, user):
    if not await _manager(conn, campaign_id, user):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede gestionar el combate")


def _ability_mod(score) -> int:
    try:
        return (int(score) - 10) // 2
    except (TypeError, ValueError):
        return 0


async def _tracker(conn, encounter_id):
    return await conn.fetchrow("SELECT * FROM combat_trackers WHERE encounter_id = $1", encounter_id)


async def _combat_payload(conn, tracker) -> dict:
    if not tracker:
        return None
    rows = await conn.fetch(
        """
        SELECT * FROM combatants WHERE tracker_id = $1
        ORDER BY initiative DESC, initiative_tiebreak DESC, name ASC
        """,
        tracker["id"],
    )
    return {
        "id": str(tracker["id"]),
        "encounter_id": str(tracker["encounter_id"]),
        "round": tracker["round"],
        "current_turn_index": tracker["current_turn_index"],
        "active": tracker["active"],
        "combatants": [dict(r) for r in rows],
    }


@router.get("/{campaign_id}/encounters/{encounter_id}/combat", response_model=dict)
async def get_combat(campaign_id: uuid.UUID, encounter_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    await _require_manager(conn, campaign_id, current_user)
    return item_response(await _combat_payload(conn, await _tracker(conn, encounter_id)))


@router.post("/{campaign_id}/encounters/{encounter_id}/combat/start", response_model=dict, status_code=201)
async def start_combat(campaign_id: uuid.UUID, encounter_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    await _require_manager(conn, campaign_id, current_user)
    enc = await conn.fetchrow("SELECT id FROM encounters WHERE id = $1 AND campaign_id = $2", encounter_id, campaign_id)
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")

    # Reiniciar: borrar rastreador anterior (cascada a combatientes)
    await conn.execute("DELETE FROM combat_trackers WHERE encounter_id = $1", encounter_id)
    tid = uuid.uuid4()
    await conn.execute(
        "INSERT INTO combat_trackers (id, encounter_id, campaign_id) VALUES ($1,$2,$3)",
        tid, encounter_id, campaign_id,
    )

    async def _add(name, ctype, ref, initiative, tiebreak, max_hp, cur_hp, ac):
        await conn.execute(
            """
            INSERT INTO combatants (tracker_id, name, combatant_type, reference_id,
                                    initiative, initiative_tiebreak, max_hp, current_hp, armor_class)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            """,
            tid, name, ctype, ref, initiative, tiebreak, max_hp, cur_hp, ac,
        )

    # Monstruos del encuentro (instancias individuales con HP propio)
    mons = await conn.fetch(
        """
        SELECT em.stat_block_id, em.name_override, em.quantity,
               s.name AS sb_name, s.hit_points, s.armor_class, s.abilities
        FROM encounter_monsters em
        LEFT JOIN stat_blocks s ON s.id = em.stat_block_id
        WHERE em.encounter_id = $1
        """,
        encounter_id,
    )
    for m in mons:
        base = m["name_override"] or m["sb_name"] or "Monstruo"
        abilities = m["abilities"]
        if isinstance(abilities, str):
            try:
                abilities = json.loads(abilities)
            except (ValueError, TypeError):
                abilities = {}
        dexmod = _ability_mod((abilities or {}).get("DEX", 10))
        qty = m["quantity"] or 1
        for i in range(1, qty + 1):
            nm = f"{base} #{i}" if qty > 1 else base
            await _add(nm, "monster", m["stat_block_id"], random.randint(1, 20) + dexmod,
                       dexmod, m["hit_points"], m["hit_points"], m["armor_class"])

    # Personajes de la campaña
    chars = await conn.fetch(
        "SELECT id, name, hp, max_hp, ac, dex FROM characters WHERE campaign_id = $1 AND active = TRUE",
        campaign_id,
    )
    for c in chars:
        dexmod = _ability_mod(c["dex"])
        await _add(c["name"], "pc", c["id"], random.randint(1, 20) + dexmod,
                   dexmod, c["max_hp"], c["hp"], c["ac"])

    return item_response(await _combat_payload(conn, await _tracker(conn, encounter_id)))


@router.post("/{campaign_id}/encounters/{encounter_id}/combat/next-turn", response_model=dict)
async def next_turn(campaign_id: uuid.UUID, encounter_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    await _require_manager(conn, campaign_id, current_user)
    tr = await _tracker(conn, encounter_id)
    if not tr:
        raise HTTPException(status_code=404, detail="No hay combate activo")
    count = await conn.fetchval("SELECT COUNT(*) FROM combatants WHERE tracker_id = $1", tr["id"])
    if not count:
        return item_response(await _combat_payload(conn, tr))
    idx = tr["current_turn_index"] + 1
    rnd = tr["round"]
    if idx >= count:
        idx = 0
        rnd += 1
    await conn.execute(
        "UPDATE combat_trackers SET current_turn_index = $1, round = $2 WHERE id = $3",
        idx, rnd, tr["id"],
    )
    return item_response(await _combat_payload(conn, await _tracker(conn, encounter_id)))


@router.delete("/{campaign_id}/encounters/{encounter_id}/combat", status_code=204)
async def end_combat(campaign_id: uuid.UUID, encounter_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    await _require_manager(conn, campaign_id, current_user)
    await conn.execute("DELETE FROM combat_trackers WHERE encounter_id = $1", encounter_id)


@router.post("/{campaign_id}/encounters/{encounter_id}/combat/combatants", response_model=dict, status_code=201)
async def add_combatant(campaign_id: uuid.UUID, encounter_id: uuid.UUID, body: CombatantAdd, conn=Depends(get_db), current_user=Depends(get_current_user)):
    await _require_manager(conn, campaign_id, current_user)
    tr = await _tracker(conn, encounter_id)
    if not tr:
        raise HTTPException(status_code=404, detail="No hay combate activo; inícialo primero")
    await conn.execute(
        """
        INSERT INTO combatants (tracker_id, name, combatant_type, reference_id, initiative,
                                initiative_tiebreak, max_hp, current_hp, armor_class, conditions, concentration)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        """,
        tr["id"], body.name, body.combatant_type, body.reference_id, body.initiative,
        body.initiative_tiebreak, body.max_hp,
        body.current_hp if body.current_hp is not None else body.max_hp,
        body.armor_class, body.conditions, body.concentration,
    )
    return item_response(await _combat_payload(conn, await _tracker(conn, encounter_id)))


@router.put("/{campaign_id}/encounters/{encounter_id}/combat/combatants/{combatant_id}", response_model=dict)
async def update_combatant(campaign_id: uuid.UUID, encounter_id: uuid.UUID, combatant_id: uuid.UUID, body: CombatantUpdate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    await _require_manager(conn, campaign_id, current_user)
    tr = await _tracker(conn, encounter_id)
    if not tr:
        raise HTTPException(status_code=404, detail="No hay combate activo")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "current_hp" in updates and updates["current_hp"] is not None:
        updates["current_hp"] = max(0, updates["current_hp"])  # HP no negativo (guía §17.6)

    clauses = [f"{k} = ${i}" for i, k in enumerate(updates.keys(), start=1)]
    params = list(updates.values()) + [combatant_id, tr["id"]]
    row = await conn.fetchrow(
        f"UPDATE combatants SET {', '.join(clauses)} WHERE id = ${len(params)-1} AND tracker_id = ${len(params)} RETURNING id",
        *params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Combatant not found")
    return item_response(await _combat_payload(conn, await _tracker(conn, encounter_id)))


@router.delete("/{campaign_id}/encounters/{encounter_id}/combat/combatants/{combatant_id}", status_code=204)
async def delete_combatant(campaign_id: uuid.UUID, encounter_id: uuid.UUID, combatant_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    await _require_manager(conn, campaign_id, current_user)
    tr = await _tracker(conn, encounter_id)
    if not tr:
        raise HTTPException(status_code=404, detail="No hay combate activo")
    result = await conn.execute("DELETE FROM combatants WHERE id = $1 AND tracker_id = $2", combatant_id, tr["id"])
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Combatant not found")
