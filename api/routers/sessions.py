import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response, list_response, log_event, paginate, records_to_list
from api.db.kafka import TOPIC_SESSIONS_CREATED, publish_event
from api.models.session_model import AttendanceCreate, SessionCreate, SessionUpdate

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"])


@router.get("", response_model=dict)
async def list_sessions(
    campaign_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    offset, limit = paginate(page, per_page)

    conditions = []
    params: list = []
    idx = 1

    if campaign_id:
        conditions.append(f"s.campaign_id = ${idx}")
        params.append(uuid.UUID(campaign_id))
        idx += 1

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    total = await conn.fetchval(f"SELECT COUNT(*) FROM sessions s {where}", *params)

    params_page = params + [limit, offset]
    rows = await conn.fetch(
        f"""
        SELECT s.id, s.campaign_id, s.adventure_id, s.session_number, s.title, s.date,
               s.duration_min, s.xp_awarded, s.milestone_level, s.created_by,
               s.created_at, s.next_session_date
        FROM sessions s
        {where}
        ORDER BY s.session_number DESC
        LIMIT ${idx} OFFSET ${idx + 1}
        """,
        *params_page,
    )
    return list_response(records_to_list(rows), total, page, per_page)


@router.post("", response_model=dict, status_code=201)
async def create_session(
    body: SessionCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    camp = await conn.fetchrow(
        "SELECT dm_id FROM campaigns WHERE id = $1", body.campaign_id
    )
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if str(camp["dm_id"]) != str(current_user["id"]) and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the DM or admin can register sessions")

    # Auto-increment session_number
    max_num = await conn.fetchval(
        "SELECT COALESCE(MAX(session_number), 0) FROM sessions WHERE campaign_id = $1",
        body.campaign_id,
    )
    session_number = max_num + 1
    session_id = uuid.uuid4()

    highlights = body.highlights or []

    await conn.execute(
        """
        INSERT INTO sessions (
            id, campaign_id, adventure_id, session_number, title, date, duration_min,
            summary, highlights, xp_awarded, milestone_level, next_session_date, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        """,
        session_id,
        body.campaign_id,
        body.adventure_id,
        session_number,
        body.title,
        body.date,
        body.duration_min,
        body.summary,
        highlights,
        body.xp_awarded,
        body.milestone_level,
        body.next_session_date,
        current_user["id"],
    )

    await log_event(
        conn, "session.created", "session",
        target_id=str(session_id),
        target_name=body.title or f"Session {session_number}",
        actor_member_id=str(current_user["id"]), is_public=True,
    )

    await publish_event(TOPIC_SESSIONS_CREATED, {
        "session_id": str(session_id),
        "campaign_id": str(body.campaign_id),
        "session_number": session_number,
        "title": body.title,
        "created_by": str(current_user["id"]),
        "xp_awarded": body.xp_awarded,
    })

    row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
    return item_response(dict(row))


@router.get("/{session_id}", response_model=dict)
async def get_session(
    session_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return item_response(dict(row))


@router.put("/{session_id}", response_model=dict)
async def update_session(
    session_id: uuid.UUID,
    body: SessionUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow(
        """
        SELECT s.created_by, c.dm_id
        FROM sessions s
        JOIN campaigns c ON c.id = s.campaign_id
        WHERE s.id = $1
        """,
        session_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if (
        str(row["dm_id"]) != str(current_user["id"])
        and str(row["created_by"]) != str(current_user["id"])
        and current_user["role"] != "admin"
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = []
    params = []
    for i, (k, v) in enumerate(updates.items(), start=1):
        set_clauses.append(f"{k} = ${i}")
        params.append(v)

    params.append(session_id)
    await conn.execute(
        f"UPDATE sessions SET {', '.join(set_clauses)} WHERE id = ${len(params)}",
        *params,
    )
    row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
    return item_response(dict(row))


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow(
        "SELECT s.created_by, c.dm_id FROM sessions s JOIN campaigns c ON c.id = s.campaign_id WHERE s.id = $1",
        session_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if str(row["dm_id"]) != str(current_user["id"]) and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    await conn.execute("DELETE FROM sessions WHERE id = $1", session_id)


@router.post("/{session_id}/attendance", response_model=dict, status_code=201)
async def record_attendance(
    session_id: uuid.UUID,
    body: AttendanceCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow(
        "SELECT s.campaign_id, c.dm_id FROM sessions s JOIN campaigns c ON c.id = s.campaign_id WHERE s.id = $1",
        session_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if str(row["dm_id"]) != str(current_user["id"]) and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only DM or admin can record attendance")

    await conn.execute(
        """
        INSERT INTO session_attendance (session_id, member_id, character_id, present, xp_received)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (session_id, member_id) DO UPDATE
        SET character_id = EXCLUDED.character_id,
            present = EXCLUDED.present,
            xp_received = EXCLUDED.xp_received
        """,
        session_id, body.member_id, body.character_id, body.present, body.xp_received,
    )

    # Update member_xp sessions_attended
    if body.present:
        try:
            await conn.execute(
                """
                INSERT INTO member_xp (member_id, total_xp, sessions_attended)
                VALUES ($1, $2, 1)
                ON CONFLICT (member_id) DO UPDATE
                SET total_xp = member_xp.total_xp + EXCLUDED.total_xp,
                    sessions_attended = member_xp.sessions_attended + 1
                """,
                body.member_id, body.xp_received,
            )
        except Exception:
            pass

    return item_response({
        "session_id": str(session_id),
        "member_id": str(body.member_id),
        "present": body.present,
    })


@router.get("/{session_id}/attendance", response_model=dict)
async def get_attendance(
    session_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    rows = await conn.fetch(
        """
        SELECT sa.member_id, sa.character_id, sa.present, sa.xp_received,
               m.username, m.display_name
        FROM session_attendance sa
        JOIN members m ON m.id = sa.member_id
        WHERE sa.session_id = $1
        """,
        session_id,
    )
    return {"data": records_to_list(rows)}
