import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response, list_response, log_event, paginate, records_to_list
from api.models.campaign import CampaignCreate, CampaignUpdate

router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns"])


@router.get("", response_model=dict)
async def list_campaigns(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    offset, limit = paginate(page, per_page)

    conditions = []
    params: list = []
    idx = 1

    # Non-admins only see public or campaigns they're in
    if current_user["role"] not in ("admin", "dm"):
        conditions.append(
            f"(c.is_public = TRUE OR EXISTS (SELECT 1 FROM campaign_members cm WHERE cm.campaign_id = c.id AND cm.member_id = ${idx}))"
        )
        params.append(current_user["id"])
        idx += 1

    if status:
        conditions.append(f"c.status = ${idx}::campaign_status")
        params.append(status)
        idx += 1

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    total = await conn.fetchval(f"SELECT COUNT(*) FROM campaigns c {where}", *params)

    params_page = params + [limit, offset]
    rows = await conn.fetch(
        f"""
        SELECT c.*,
               (SELECT COUNT(*) FROM campaign_members cm WHERE cm.campaign_id = c.id) AS member_count
        FROM campaigns c
        {where}
        ORDER BY c.created_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
        """,
        *params_page,
    )
    return list_response(records_to_list(rows), total, page, per_page)


@router.post("", response_model=dict, status_code=201)
async def create_campaign(
    body: CampaignCreate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("admin", "dm"):
        raise HTTPException(status_code=403, detail="Only DMs and admins can create campaigns")

    campaign_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO campaigns (id, name, slug, dm_id, system, description, lore,
                               cover_image_url, is_public, world_name, setting, start_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        """,
        campaign_id,
        body.name,
        body.slug,
        current_user["id"],
        body.system,
        body.description,
        body.lore,
        body.cover_image_url,
        body.is_public,
        body.world_name,
        body.setting,
        body.start_date,
    )
    # Add DM as member
    await conn.execute(
        "INSERT INTO campaign_members (campaign_id, member_id) VALUES ($1, $2)",
        campaign_id, current_user["id"],
    )
    await log_event(
        conn, "campaign.created", "campaign",
        target_id=str(campaign_id), target_name=body.name,
        actor_member_id=str(current_user["id"]), is_public=True,
    )
    row = await conn.fetchrow("SELECT * FROM campaigns WHERE id = $1", campaign_id)
    return item_response(dict(row))


@router.get("/{campaign_id}", response_model=dict)
async def get_campaign(
    campaign_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow(
        """
        SELECT c.*,
               (SELECT COUNT(*) FROM campaign_members cm WHERE cm.campaign_id = c.id) AS member_count
        FROM campaigns c WHERE c.id = $1
        """,
        campaign_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    data = dict(row)
    if not data["is_public"] and current_user["role"] not in ("admin", "dm"):
        is_member = await conn.fetchval(
            "SELECT 1 FROM campaign_members WHERE campaign_id = $1 AND member_id = $2",
            campaign_id, current_user["id"],
        )
        if not is_member:
            raise HTTPException(status_code=403, detail="Access denied")

    return item_response(data)


@router.put("/{campaign_id}", response_model=dict)
async def update_campaign(
    campaign_id: uuid.UUID,
    body: CampaignUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow("SELECT dm_id FROM campaigns WHERE id = $1", campaign_id)
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if str(row["dm_id"]) != str(current_user["id"]) and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the DM or admin can edit this campaign")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = []
    params = []
    for i, (k, v) in enumerate(updates.items(), start=1):
        clause = f"{k} = ${i}"
        if k == "status":
            clause = f"{k} = ${i}::campaign_status"
        set_clauses.append(clause)
        params.append(v)

    params.append(campaign_id)
    await conn.execute(
        f"UPDATE campaigns SET {', '.join(set_clauses)} WHERE id = ${len(params)}",
        *params,
    )
    row = await conn.fetchrow("SELECT * FROM campaigns WHERE id = $1", campaign_id)
    return item_response(dict(row))


@router.delete("/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow("SELECT dm_id, name FROM campaigns WHERE id = $1", campaign_id)
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if str(row["dm_id"]) != str(current_user["id"]) and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the DM or admin can delete this campaign")

    await conn.execute(
        "UPDATE campaigns SET status = 'archived'::campaign_status WHERE id = $1",
        campaign_id,
    )
    await log_event(
        conn, "campaign.archived", "campaign",
        target_id=str(campaign_id), target_name=row["name"],
        actor_member_id=str(current_user["id"]),
    )


@router.post("/{campaign_id}/members", response_model=dict, status_code=201)
async def add_campaign_member(
    campaign_id: uuid.UUID,
    body: dict,
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await conn.fetchrow("SELECT dm_id FROM campaigns WHERE id = $1", campaign_id)
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if str(row["dm_id"]) != str(current_user["id"]) and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the DM or admin can add members")

    member_id = body.get("member_id")
    if not member_id:
        raise HTTPException(status_code=400, detail="member_id required")

    await conn.execute(
        "INSERT INTO campaign_members (campaign_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        campaign_id, uuid.UUID(str(member_id)),
    )
    return item_response({"campaign_id": str(campaign_id), "member_id": str(member_id)})


@router.get("/{campaign_id}/members", response_model=dict)
async def list_campaign_members(
    campaign_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    rows = await conn.fetch(
        """
        SELECT m.id, m.username, m.display_name, m.avatar_url, m.role, cm.joined_at
        FROM campaign_members cm
        JOIN members m ON m.id = cm.member_id
        WHERE cm.campaign_id = $1
        ORDER BY cm.joined_at ASC
        """,
        campaign_id,
    )
    return {"data": records_to_list(rows)}
