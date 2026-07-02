import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db, require_role
from api.db.helpers import item_response, list_response, log_event, paginate, records_to_list
from api.models.clan import ClanCreate, ClanInvitationCreate, ClanUpdate

router = APIRouter(prefix="/api/v1/clans", tags=["clans"])


@router.get("", response_model=dict)
async def list_clans(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    offset, limit = paginate(page, per_page)
    total = await conn.fetchval("SELECT COUNT(*) FROM clans WHERE active = TRUE")
    rows = await conn.fetch(
        """
        SELECT c.*, (SELECT COUNT(*) FROM clan_members cm WHERE cm.clan_id = c.id) AS member_count
        FROM clans c
        WHERE c.active = TRUE
        ORDER BY c.created_at DESC
        LIMIT $1 OFFSET $2
        """,
        limit,
        offset,
    )
    return list_response(records_to_list(rows), total, page, per_page)


@router.post("", response_model=dict, status_code=201)
async def create_clan(
    body: ClanCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    clan_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO clans (id, name, slug, description, motto, emblem_url, color_hex,
                           alignment, leader_member_id, is_public, requires_approval, max_members, lore)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::alignment_type,$9,$10,$11,$12,$13)
        """,
        clan_id,
        body.name,
        body.slug,
        body.description,
        body.motto,
        body.emblem_url,
        body.color_hex,
        body.alignment,
        current_user["id"],
        body.is_public,
        body.requires_approval,
        body.max_members,
        body.lore,
    )
    # Add creator as leader
    await conn.execute(
        """
        INSERT INTO clan_members (clan_id, member_id, clan_role)
        VALUES ($1, $2, 'leader')
        """,
        clan_id,
        current_user["id"],
    )
    await log_event(
        conn, "clan.created", "clan",
        target_id=str(clan_id), target_name=body.name,
        actor_member_id=str(current_user["id"]), is_public=True,
    )
    # Sala de chat del clan (CM2) + membresía por personaje del líder (CM1)
    try:
        await conn.execute(
            """
            INSERT INTO chat_rooms (id, name, slug, type, clan_id, description, icon, is_ic, sort_order, created_by)
            VALUES ($1,$2,$3,'clan'::chat_room_type,$4,$5,'🛡️',FALSE,60,$6)
            ON CONFLICT (slug) DO NOTHING
            """,
            uuid.uuid4(), f"Clan: {body.name}"[:100], f"clan-{body.slug}"[:100],
            clan_id, "Sala del clan", current_user["id"],
        )
        acid = current_user.get("active_character_id")
        if acid:
            await conn.execute(
                "INSERT INTO clan_characters (clan_id, character_id, clan_role) VALUES ($1,$2,'leader') ON CONFLICT DO NOTHING",
                clan_id, acid,
            )
    except Exception:
        pass
    row = await conn.fetchrow("SELECT * FROM clans WHERE id = $1", clan_id)
    return item_response(dict(row))


@router.get("/{clan_id}", response_model=dict)
async def get_clan(
    clan_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    row = await conn.fetchrow(
        """
        SELECT c.*, (SELECT COUNT(*) FROM clan_members cm WHERE cm.clan_id = c.id) AS member_count
        FROM clans c WHERE c.id = $1
        """,
        clan_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Clan not found")

    members = await conn.fetch(
        """
        SELECT cm.member_id, cm.clan_role, cm.title, cm.contribution_pts, cm.joined_at,
               m.display_name, m.username, m.avatar_url
        FROM clan_members cm
        JOIN members m ON m.id = cm.member_id
        WHERE cm.clan_id = $1
        ORDER BY cm.joined_at ASC
        """,
        clan_id,
    )
    data = dict(row)
    data["members"] = records_to_list(members)
    return item_response(data)


@router.put("/{clan_id}", response_model=dict)
async def update_clan(
    clan_id: uuid.UUID,
    body: ClanUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow("SELECT leader_member_id FROM clans WHERE id = $1", clan_id)
    if not row:
        raise HTTPException(status_code=404, detail="Clan not found")

    if str(row["leader_member_id"]) != str(current_user["id"]) and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the clan leader or admin can edit this clan")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = []
    params = []
    for i, (k, v) in enumerate(updates.items(), start=1):
        clause = f"{k} = ${i}"
        if k == "alignment":
            clause = f"{k} = ${i}::alignment_type"
        set_clauses.append(clause)
        params.append(v)

    params.append(clan_id)
    await conn.execute(
        f"UPDATE clans SET {', '.join(set_clauses)} WHERE id = ${len(params)}",
        *params,
    )
    row = await conn.fetchrow("SELECT * FROM clans WHERE id = $1", clan_id)
    return item_response(dict(row))


@router.post("/{clan_id}/invite", response_model=dict, status_code=201)
async def invite_member(
    clan_id: uuid.UUID,
    body: ClanInvitationCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # Verify inviter is clan member with officer+ role
    inviter = await conn.fetchrow(
        "SELECT clan_role FROM clan_members WHERE clan_id = $1 AND member_id = $2",
        clan_id, current_user["id"],
    )
    if not inviter and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Must be clan member to invite")

    invite_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO clan_invitations (id, clan_id, invited_member_id, invited_by, status)
        VALUES ($1, $2, $3, $4, 'pending')
        """,
        invite_id, clan_id, body.invited_member_id, current_user["id"],
    )
    row = await conn.fetchrow("SELECT * FROM clan_invitations WHERE id = $1", invite_id)
    return item_response(dict(row))


@router.post("/{clan_id}/join", response_model=dict)
async def join_clan(
    clan_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    clan = await conn.fetchrow("SELECT requires_approval, active FROM clans WHERE id = $1", clan_id)
    if not clan or not clan["active"]:
        raise HTTPException(status_code=404, detail="Clan not found")

    existing = await conn.fetchrow(
        "SELECT member_id FROM clan_members WHERE clan_id = $1 AND member_id = $2",
        clan_id, current_user["id"],
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already a member of this clan")

    await conn.execute(
        "INSERT INTO clan_members (clan_id, member_id, clan_role) VALUES ($1, $2, 'initiate')",
        clan_id, current_user["id"],
    )
    # Membresía por personaje (CM1/CM5): añade el personaje activo al clan.
    acid = current_user.get("active_character_id")
    if acid:
        try:
            await conn.execute(
                "INSERT INTO clan_characters (clan_id, character_id, clan_role) VALUES ($1,$2,'initiate') ON CONFLICT DO NOTHING",
                clan_id, acid,
            )
        except Exception:
            pass
    await log_event(
        conn, "clan.member_joined", "clan",
        target_id=str(clan_id), actor_member_id=str(current_user["id"]), is_public=True,
    )
    return item_response({"clan_id": str(clan_id), "status": "joined"})


@router.post("/invitations/{invitation_id}/accept", response_model=dict)
async def accept_invitation(
    invitation_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    inv = await conn.fetchrow(
        "SELECT * FROM clan_invitations WHERE id = $1 AND invited_member_id = $2 AND status = 'pending'",
        invitation_id, current_user["id"],
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")

    await conn.execute(
        "UPDATE clan_invitations SET status = 'accepted', resolved_at = NOW() WHERE id = $1",
        invitation_id,
    )
    await conn.execute(
        "INSERT INTO clan_members (clan_id, member_id, clan_role) VALUES ($1, $2, 'initiate') ON CONFLICT DO NOTHING",
        inv["clan_id"], current_user["id"],
    )
    acid = current_user.get("active_character_id")
    if acid:
        try:
            await conn.execute(
                "INSERT INTO clan_characters (clan_id, character_id, clan_role) VALUES ($1,$2,'initiate') ON CONFLICT DO NOTHING",
                inv["clan_id"], acid,
            )
        except Exception:
            pass
    await log_event(
        conn, "clan.member_joined", "clan",
        target_id=str(inv["clan_id"]), actor_member_id=str(current_user["id"]), is_public=True,
    )
    return item_response({"status": "accepted"})


@router.post("/invitations/{invitation_id}/reject", response_model=dict)
async def reject_invitation(
    invitation_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    inv = await conn.fetchrow(
        "SELECT id FROM clan_invitations WHERE id = $1 AND invited_member_id = $2 AND status = 'pending'",
        invitation_id, current_user["id"],
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")

    await conn.execute(
        "UPDATE clan_invitations SET status = 'rejected', resolved_at = NOW() WHERE id = $1",
        invitation_id,
    )
    return item_response({"status": "rejected"})


@router.delete("/{clan_id}/members/{member_id}", status_code=204)
async def remove_member(
    clan_id: uuid.UUID,
    member_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    clan = await conn.fetchrow("SELECT leader_member_id FROM clans WHERE id = $1", clan_id)
    if not clan:
        raise HTTPException(status_code=404, detail="Clan not found")

    is_self = str(current_user["id"]) == str(member_id)
    is_leader = str(clan["leader_member_id"]) == str(current_user["id"])
    if not is_self and not is_leader and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only leader/admin can remove other members")

    await conn.execute(
        "DELETE FROM clan_members WHERE clan_id = $1 AND member_id = $2",
        clan_id, member_id,
    )
    await log_event(
        conn, "clan.member_removed", "clan",
        target_id=str(clan_id), actor_member_id=str(current_user["id"]),
    )
