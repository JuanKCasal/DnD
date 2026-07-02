"""
DnD Community Manager — Seed del bestiario SRD (Fase C5)
Uso:
  python db/seed_monsters.py --dry-run   # valida el JSON y muestra conteos
  python db/seed_monsters.py             # siembra en la BD (idempotente)

Siembra monstruos globales (campaign_id NULL, is_homebrew FALSE) desde
db/data/srd_monsters.json. Idempotente vía ON CONFLICT (dnd5eapi_index).
"""
import asyncio
import json
import os
import re
import ssl
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA_FILE = Path(__file__).parent / "data" / "srd_monsters.json"

# Cargar .env
env_path = ROOT / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

JSON_FIELDS = ("speed", "abilities")


def load_monsters() -> list[dict]:
    monsters = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    seen = set()
    for m in monsters:
        idx = m["index"]
        if idx in seen:
            raise ValueError(f"Índice duplicado en el JSON: {idx}")
        seen.add(idx)
    return monsters


def report(monsters: list[dict]) -> None:
    by_cr: dict = {}
    for m in monsters:
        by_cr[m["challenge_rating"]] = by_cr.get(m["challenge_rating"], 0) + 1
    print(f"  Total monstruos: {len(monsters)}")
    print("  Por CR: " + ", ".join(f"CR{cr}={n}" for cr, n in sorted(by_cr.items())))


async def seed() -> None:
    monsters = load_monsters()
    print(f"📖 {len(monsters)} monstruos en {DATA_FILE.name}")
    report(monsters)

    if "--dry-run" in sys.argv:
        print("✅ Dry-run: JSON válido, sin escribir en la BD.")
        return

    import asyncpg

    ca = ROOT / os.environ.get("AIVEN_CA_CERT", "certs/ca.pem")
    ssl_ctx = ssl.create_default_context(cafile=str(ca)) if ca.exists() else None
    dsn = re.sub(r"\?sslmode=\w+", "", os.environ["DATABASE_URL"])
    conn = await asyncpg.connect(dsn, ssl=ssl_ctx)

    inserted = 0
    for m in monsters:
        await conn.execute(
            """
            INSERT INTO stat_blocks (
                name, size, creature_type, alignment, armor_class, hit_points, hit_dice,
                speed, abilities, challenge_rating, xp_value, description, source,
                is_homebrew, dnd5eapi_index
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,'SRD',FALSE,$13)
            ON CONFLICT (dnd5eapi_index) DO UPDATE SET
                name = EXCLUDED.name, size = EXCLUDED.size, creature_type = EXCLUDED.creature_type,
                alignment = EXCLUDED.alignment, armor_class = EXCLUDED.armor_class,
                hit_points = EXCLUDED.hit_points, hit_dice = EXCLUDED.hit_dice,
                speed = EXCLUDED.speed, abilities = EXCLUDED.abilities,
                challenge_rating = EXCLUDED.challenge_rating, xp_value = EXCLUDED.xp_value,
                description = EXCLUDED.description
            """,
            m["name"], m.get("size"), m.get("creature_type"), m.get("alignment"),
            m.get("armor_class"), m.get("hit_points"), m.get("hit_dice"),
            json.dumps(m.get("speed", {})), json.dumps(m.get("abilities", {})),
            m["challenge_rating"], m["xp_value"], m.get("description"), m["index"],
        )
        inserted += 1

    await conn.close()
    print(f"✅ Sembrados/actualizados {inserted} monstruos globales.")


if __name__ == "__main__":
    asyncio.run(seed())
