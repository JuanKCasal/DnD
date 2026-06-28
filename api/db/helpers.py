import json
import logging
import uuid
from typing import Any

import asyncpg
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def paginate(page: int, per_page: int) -> tuple[int, int]:
    page = max(1, page)
    per_page = min(max(1, per_page), 100)
    offset = (page - 1) * per_page
    return offset, per_page


def list_response(data: list, total: int, page: int, per_page: int) -> dict:
    pages = (total + per_page - 1) // per_page if per_page > 0 else 0
    return {
        "data": data,
        "meta": {
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": pages,
        },
    }


def item_response(data: Any) -> dict:
    return {"data": data}


def error_response(code: str, message: str, status: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message}},
    )


def record_to_dict(record) -> dict | None:
    if record is None:
        return None
    return dict(record)


def records_to_list(records) -> list[dict]:
    return [dict(r) for r in records]


async def log_event(
    conn: asyncpg.Connection,
    action: str,
    target_type: str,
    target_id: str | None = None,
    target_name: str | None = None,
    actor_member_id: str | None = None,
    actor_character_id: str | None = None,
    before: dict | None = None,
    after: dict | None = None,
    metadata: dict | None = None,
    is_public: bool = False,
) -> None:
    """Insert a row into event_log. Best-effort: does not raise."""
    try:
        meta = metadata or {}
        if before:
            meta["before"] = before
        if after:
            meta["after"] = after

        await conn.execute(
            """
            INSERT INTO event_log (
                action, target_type, target_id, target_name,
                actor_member_id, actor_character_id,
                metadata, is_public
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            """,
            action,
            target_type,
            target_id,
            target_name,
            uuid.UUID(actor_member_id) if actor_member_id else None,
            uuid.UUID(actor_character_id) if actor_character_id else None,
            json.dumps(meta, default=str),
            is_public,
        )
    except Exception as e:
        logger.error(f"log_event failed: {e}")
