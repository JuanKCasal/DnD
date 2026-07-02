"""Muros de comunidad (Fase CM4+). Modelo unificado `community_posts` por `board`:
events (Calendario/Eventos, CM4), clan (CM5) y hall (Salón de la Fama, CM6).

Permisos de publicación: events/hall → staff (admin/dm); clan → miembro del clan
o staff. Filtrado en el backend (guía §17 regla 4).
"""
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user, get_db
from api.db.helpers import item_response, records_to_list, log_event
from api.models.community import PostCreate, PostUpdate, CommentCreate, ReactionSet

router = APIRouter(prefix="/api/v1/community", tags=["community"])

_POST_SELECT = """
    SELECT p.id, p.board, p.clan_id, p.author_member_id, p.author_character_id,
           p.title, p.body, p.image_url, p.item_id, p.event_date, p.pinned, p.created_at,
           am.display_name AS author_member_name,
           ac.name AS author_character_name,
           it.name AS item_name,
           (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = p.id) AS comment_count
    FROM community_posts p
    LEFT JOIN members am ON am.id = p.author_member_id
    LEFT JOIN characters ac ON ac.id = p.author_character_id
    LEFT JOIN items it ON it.id = p.item_id
"""


async def _clan_member(conn, clan_id, user) -> bool:
    if clan_id is None:
        return False
    ok = await conn.fetchval("SELECT 1 FROM clan_members WHERE clan_id = $1 AND member_id = $2", clan_id, user["id"])
    if ok:
        return True
    ac = user.get("active_character_id")
    if ac:
        ok = await conn.fetchval("SELECT 1 FROM clan_characters WHERE clan_id = $1 AND character_id = $2", clan_id, ac)
    return bool(ok)


async def _can_post(conn, board, clan_id, user) -> bool:
    is_staff = user["role"] in ("admin", "dm")
    if board in ("events", "hall"):
        return is_staff
    if board == "clan":
        return is_staff or await _clan_member(conn, clan_id, user)
    return False


async def _can_view(conn, board, clan_id, user) -> bool:
    if board in ("events", "hall"):
        return True
    if board == "clan":
        if user["role"] in ("admin", "dm"):
            return True
        is_public = await conn.fetchval("SELECT is_public FROM clans WHERE id = $1", clan_id)
        return bool(is_public) or await _clan_member(conn, clan_id, user)
    return False


@router.get("/posts", response_model=dict)
async def list_posts(
    board: str = Query(...),
    clan_id: str | None = Query(None),
    conn: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    cid = uuid.UUID(clan_id) if clan_id else None
    if not await _can_view(conn, board, cid, current_user):
        raise HTTPException(status_code=403, detail="Sin acceso a este muro")
    conditions = ["p.deleted_at IS NULL", "p.board = $1"]
    params: list = [board]
    if cid:
        conditions.append("p.clan_id = $2")
        params.append(cid)
    rows = await conn.fetch(
        _POST_SELECT + f" WHERE {' AND '.join(conditions)} ORDER BY p.pinned DESC, p.created_at DESC",
        *params,
    )
    return {"data": records_to_list(rows)}


@router.post("/posts", response_model=dict, status_code=201)
async def create_post(body: PostCreate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    if not await _can_post(conn, body.board, body.clan_id, current_user):
        raise HTTPException(status_code=403, detail="No tienes permiso para publicar en este muro")
    post_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO community_posts (id, board, clan_id, author_member_id, author_character_id,
                                     title, body, image_url, item_id, event_date, pinned)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        """,
        post_id, body.board, body.clan_id, current_user["id"], current_user.get("active_character_id"),
        body.title, body.body, body.image_url, body.item_id, body.event_date, body.pinned,
    )
    await log_event(conn, "community.posted", "community_post", target_id=str(post_id),
                    target_name=body.title, actor_member_id=str(current_user["id"]))
    row = await conn.fetchrow(_POST_SELECT + " WHERE p.id = $1", post_id)
    return item_response(dict(row))


@router.put("/posts/{post_id}", response_model=dict)
async def update_post(post_id: uuid.UUID, body: PostUpdate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    post = await conn.fetchrow("SELECT author_member_id FROM community_posts WHERE id = $1 AND deleted_at IS NULL", post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if str(post["author_member_id"]) != str(current_user["id"]) and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Solo el autor o admin puede editar")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    clauses = [f"{k} = ${i}" for i, k in enumerate(updates.keys(), start=1)]
    params = list(updates.values()) + [post_id]
    await conn.execute(f"UPDATE community_posts SET {', '.join(clauses)} WHERE id = ${len(params)}", *params)
    row = await conn.fetchrow(_POST_SELECT + " WHERE p.id = $1", post_id)
    return item_response(dict(row))


@router.delete("/posts/{post_id}", status_code=204)
async def delete_post(post_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    post = await conn.fetchrow("SELECT author_member_id FROM community_posts WHERE id = $1", post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if str(post["author_member_id"]) != str(current_user["id"]) and current_user["role"] not in ("admin", "dm"):
        raise HTTPException(status_code=403, detail="Sin permiso para eliminar")
    await conn.execute("UPDATE community_posts SET deleted_at = NOW() WHERE id = $1", post_id)


# ── Comentarios ──
@router.get("/posts/{post_id}/comments", response_model=dict)
async def list_comments(post_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    rows = await conn.fetch(
        """
        SELECT cc.id, cc.post_id, cc.body, cc.created_at,
               am.display_name AS author_member_name, ac.name AS author_character_name
        FROM community_comments cc
        LEFT JOIN members am ON am.id = cc.author_member_id
        LEFT JOIN characters ac ON ac.id = cc.author_character_id
        WHERE cc.post_id = $1
        ORDER BY cc.created_at ASC
        """,
        post_id,
    )
    return {"data": records_to_list(rows)}


@router.post("/posts/{post_id}/comments", response_model=dict, status_code=201)
async def add_comment(post_id: uuid.UUID, body: CommentCreate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    post = await conn.fetchrow("SELECT board, clan_id FROM community_posts WHERE id = $1 AND deleted_at IS NULL", post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not await _can_view(conn, post["board"], post["clan_id"], current_user):
        raise HTTPException(status_code=403, detail="Sin acceso a este muro")
    cid = uuid.uuid4()
    await conn.execute(
        "INSERT INTO community_comments (id, post_id, author_member_id, author_character_id, body) VALUES ($1,$2,$3,$4,$5)",
        cid, post_id, current_user["id"], current_user.get("active_character_id"), body.body,
    )
    row = await conn.fetchrow(
        """
        SELECT cc.id, cc.post_id, cc.body, cc.created_at,
               am.display_name AS author_member_name, ac.name AS author_character_name
        FROM community_comments cc
        LEFT JOIN members am ON am.id = cc.author_member_id
        LEFT JOIN characters ac ON ac.id = cc.author_character_id
        WHERE cc.id = $1
        """,
        cid,
    )
    return item_response(dict(row))


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(comment_id: uuid.UUID, conn=Depends(get_db), current_user=Depends(get_current_user)):
    row = await conn.fetchrow("SELECT author_member_id FROM community_comments WHERE id = $1", comment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Comment not found")
    if str(row["author_member_id"]) != str(current_user["id"]) and current_user["role"] not in ("admin", "dm"):
        raise HTTPException(status_code=403, detail="Sin permiso")
    await conn.execute("DELETE FROM community_comments WHERE id = $1", comment_id)


# ── Reacciones (toggle por personaje activo) ──
@router.post("/posts/{post_id}/react", response_model=dict)
async def toggle_reaction(post_id: uuid.UUID, body: ReactionSet, conn=Depends(get_db), current_user=Depends(get_current_user)):
    ac = current_user.get("active_character_id")
    if not ac:
        raise HTTPException(status_code=400, detail="Necesitas un personaje activo para reaccionar")
    existing = await conn.fetchval(
        "SELECT 1 FROM community_reactions WHERE post_id = $1 AND character_id = $2 AND emoji = $3",
        post_id, ac, body.emoji,
    )
    if existing:
        await conn.execute("DELETE FROM community_reactions WHERE post_id = $1 AND character_id = $2 AND emoji = $3", post_id, ac, body.emoji)
        active = False
    else:
        await conn.execute("INSERT INTO community_reactions (post_id, character_id, emoji) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", post_id, ac, body.emoji)
        active = True
    return item_response({"post_id": str(post_id), "emoji": body.emoji, "active": active})
