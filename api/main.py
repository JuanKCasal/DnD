import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from api.config import get_settings
from api.db.connection import close_pool, get_pool, init_pool
from api.db.kafka import close_producer, get_producer, init_producer
from api.routers import adventures, auth, campaigns, characters, chat, clans, combat, encounters, events, inventory, members, quests, ranks, sessions, spells, worldbuilding

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("Starting DnD Community Manager API...")

    await init_pool(settings)
    await init_producer(settings)

    logger.info("Startup complete")
    yield

    logger.info("Shutting down...")
    await close_pool()
    await close_producer()
    logger.info("Shutdown complete")


settings = get_settings()

app = FastAPI(
    title="DnD Community Manager",
    description="Backend API for a Dungeons & Dragons community management platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ─── CORS ────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── ROUTERS ─────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(members.router)
app.include_router(ranks.router)
app.include_router(clans.router)
app.include_router(campaigns.router)
app.include_router(adventures.router)
app.include_router(quests.router)
app.include_router(worldbuilding.router)
app.include_router(encounters.router)
app.include_router(combat.router)
app.include_router(characters.router)
app.include_router(sessions.router)
app.include_router(inventory.router)
app.include_router(spells.router)
app.include_router(chat.router)
app.include_router(events.router)

# ─── EXCEPTION HANDLERS ──────────────────────────────────────────────────────


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": {"code": "NOT_FOUND", "message": str(exc.detail) if hasattr(exc, "detail") else "Resource not found"}},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    details = []
    for error in exc.errors():
        details.append({
            "field": " -> ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        })
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": details,
            }
        },
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "Error interno del servidor"}},
    )


# ─── HEALTH CHECK ────────────────────────────────────────────────────────────


@app.get("/api/v1/health", tags=["health"])
async def health_check():
    db_status = "disconnected"
    kafka_status = "disconnected"

    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        db_status = "connected"
    except Exception as e:
        logger.warning(f"DB health check failed: {e}")

    producer = get_producer()
    if producer is not None:
        kafka_status = "connected"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "db": db_status,
        "kafka": kafka_status,
        "version": "1.0.0",
    }


@app.get("/", include_in_schema=False)
async def root():
    return {"message": "DnD Community Manager API", "docs": "/api/docs"}
