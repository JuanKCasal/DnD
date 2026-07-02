"""Salón de la Fama (Fase CM6): premios a personajes, valoración de DMs y ranking."""
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response, records_to_list, log_event
from api.services.community_feed import post_system_message
from api.models.hall import AwardCreate, RatingCreate

router = APIRouter(prefix="/api/v1/hall", tags=["hall"])


# ══════════════════════════ PREMIOS ══════════════════════════
@router.post("/awards", response_model=dict, status_code=201)
async def create_award(body: AwardCreate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] not in ("admin", "dm"):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede otorgar premios")
    ch = await conn.fetchrow("SELECT name FROM characters WHERE id = $1 AND active = TRUE", body.character_id)
    if not ch:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")

    award_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO awards (id, character_id, campaign_id, title, description, icon, rarity, awarded_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        """,
        award_id, body.character_id, body.campaign_id, body.title, body.description,
        body.icon or "🏅", body.rarity or "rare", current_user["id"],
    )
    await log_event(conn, "award.granted", "award", target_id=str(award_id),
                    target_name=body.title, actor_member_id=str(current_user["id"]), is_public=True)
    # Notifica en la sala "Salón de la Fama" (CM3)
    await post_system_message(conn, "salon-fama", current_user["id"],
                              f"🏅 ¡{ch['name']} recibió «{body.title}»!")
    row = await conn.fetchrow(
        """
        SELECT a.*, c.name AS character_name, c.portrait_url AS character_portrait,
               m.display_name AS awarded_by_name
        FROM awards a
        JOIN characters c ON c.id = a.character_id
        LEFT JOIN members m ON m.id = a.awarded_by
        WHERE a.id = $1
        """,
        award_id,
    )
    return item_response(dict(row))


@router.get("/awards", response_model=dict)
async def list_awards(
    character_id: str | None = Query(None),
    campaign_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    conn=Depends(get_db), _=Depends(get_current_user),
):
    conditions = []
    params: list = []
    idx = 1
    if character_id:
        conditions.append(f"a.character_id = ${idx}"); params.append(uuid.UUID(character_id)); idx += 1
    if campaign_id:
        conditions.append(f"a.campaign_id = ${idx}"); params.append(uuid.UUID(campaign_id)); idx += 1
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)
    rows = await conn.fetch(
        f"""
        SELECT a.id, a.character_id, a.campaign_id, a.title, a.description, a.icon, a.rarity, a.created_at,
               c.name AS character_name, c.portrait_url AS character_portrait,
               m.display_name AS awarded_by_name, cp.name AS campaign_name
        FROM awards a
        JOIN characters c ON c.id = a.character_id
        LEFT JOIN members m ON m.id = a.awarded_by
        LEFT JOIN campaigns cp ON cp.id = a.campaign_id
        {where}
        ORDER BY a.created_at DESC
        LIMIT ${idx}
        """,
        *params,
    )
    return {"data": records_to_list(rows)}


@router.delete("/awards/{award_id}", status_code=204)
async def delete_award(award_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] not in ("admin", "dm"):
        raise HTTPException(status_code=403, detail="Solo el DM o admin puede quitar premios")
    result = await conn.execute("DELETE FROM awards WHERE id = $1", award_id)
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Award not found")


# ══════════════════════════ RANKING ══════════════════════════
@router.get("/leaderboard", response_model=dict)
async def leaderboard(conn=Depends(get_db), _=Depends(get_current_user)):
    rows = await conn.fetch(
        """
        SELECT m.id AS member_id, m.display_name, m.username,
               COALESCE(mx.total_xp, 0) AS total_xp,
               COALESCE(mx.sessions_attended, 0) AS sessions_attended,
               (SELECT COUNT(*) FROM awards a JOIN characters c ON c.id = a.character_id WHERE c.member_id = m.id) AS awards
        FROM members m
        LEFT JOIN member_xp mx ON mx.member_id = m.id
        WHERE m.active = TRUE
        ORDER BY total_xp DESC, sessions_attended DESC
        LIMIT 20
        """,
    )
    return {"data": records_to_list(rows)}


# ══════════════════════════ VALORACIÓN DE DMs ══════════════════════════
@router.post("/ratings", response_model=dict, status_code=201)
async def rate_dm(body: RatingCreate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    camp = await conn.fetchrow("SELECT dm_id FROM campaigns WHERE id = $1", body.campaign_id)
    if not camp:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if str(camp["dm_id"]) == str(current_user["id"]):
        raise HTTPException(status_code=400, detail="No puedes valorar tu propia campaña")

    # El valorador debe haber participado (miembro de la campaña o asistió a una sesión).
    participated = await conn.fetchval(
        """
        SELECT 1 WHERE EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = $1 AND member_id = $2)
                     OR EXISTS (SELECT 1 FROM session_attendance sa JOIN sessions s ON s.id = sa.session_id
                                WHERE s.campaign_id = $1 AND sa.member_id = $2)
        """,
        body.campaign_id, current_user["id"],
    )
    if not participated and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Solo quienes jugaron la campaña pueden valorar al DM")

    await conn.execute(
        """
        INSERT INTO dm_ratings (id, dm_member_id, campaign_id, rater_member_id, rater_character_id, stars, comment)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (campaign_id, rater_member_id) DO UPDATE
        SET stars = EXCLUDED.stars, comment = EXCLUDED.comment, created_at = NOW(), dm_member_id = EXCLUDED.dm_member_id
        """,
        uuid.uuid4(), camp["dm_id"], body.campaign_id, current_user["id"],
        current_user.get("active_character_id"), body.stars, body.comment,
    )
    return item_response({"campaign_id": str(body.campaign_id), "stars": body.stars})


@router.get("/dm-ratings", response_model=dict)
async def dm_ratings(conn=Depends(get_db), _=Depends(get_current_user)):
    rows = await conn.fetch(
        """
        SELECT r.dm_member_id, m.display_name AS dm_name,
               ROUND(AVG(r.stars)::numeric, 1) AS avg_stars, COUNT(*) AS ratings
        FROM dm_ratings r
        JOIN members m ON m.id = r.dm_member_id
        GROUP BY r.dm_member_id, m.display_name
        ORDER BY avg_stars DESC, ratings DESC
        """,
    )
    data = []
    for r in rows:
        d = dict(r)
        if d.get("avg_stars") is not None:
            d["avg_stars"] = float(d["avg_stars"])
        data.append(d)
    return {"data": data}


@router.get("/my-ratings", response_model=dict)
async def my_ratings(conn=Depends(get_db), current_user=Depends(get_current_user)):
    """Valoraciones que el usuario ya emitió (para prellenar la UI)."""
    rows = await conn.fetch(
        "SELECT campaign_id, stars, comment FROM dm_ratings WHERE rater_member_id = $1",
        current_user["id"],
    )
    return {"data": records_to_list(rows)}
