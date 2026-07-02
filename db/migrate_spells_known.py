"""
DnD Community Manager — Migración de datos: spells_known → character_spells
Fase H1 (se ejecuta DESPUÉS del seed de catálogo de la Fase H2).

OBSOLETO tras la migración 006 (las columnas spells_known/cantrips_known se
eliminan). Conservado como referencia histórica del proceso de migración.

Lee characters.spells_known (JSONB) y characters.cantrips_known (TEXT[]),
casa cada hechizo contra el catálogo `spells` por nombre (español o inglés)
e inserta las filas en `character_spells`. Es idempotente (ON CONFLICT DO NOTHING).
Los hechizos que no casen se listan al final para revisión manual.

Uso: python db/migrate_spells_known.py
"""
import asyncio
import json
import os
import re
import ssl
from pathlib import Path

# Cargar .env manualmente (mismo patrón que db/migrate.py)
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

DATABASE_URL = os.environ["DATABASE_URL"]
CA_CERT = Path(__file__).parent.parent / os.environ.get("AIVEN_CA_CERT", "certs/ca.pem")


def _norm(s: str) -> str:
    """Normaliza un nombre para matching laxo: minúsculas, sin espacios extra."""
    return re.sub(r"\s+", " ", (s or "").strip().lower())


async def main():
    import asyncpg

    ssl_ctx = ssl.create_default_context(cafile=str(CA_CERT)) if CA_CERT.exists() else None
    dsn = re.sub(r"\?sslmode=\w+", "", DATABASE_URL)
    conn = await asyncpg.connect(dsn, ssl=ssl_ctx)

    # Índice de nombre → spell_id (español e inglés)
    spell_rows = await conn.fetch("SELECT id, name, name_en, level FROM spells")
    by_name: dict[str, str] = {}
    for r in spell_rows:
        if r["name"]:
            by_name[_norm(r["name"])] = r["id"]
        if r["name_en"]:
            by_name.setdefault(_norm(r["name_en"]), r["id"])
    print(f"Catálogo cargado: {len(spell_rows)} hechizos, {len(by_name)} claves de nombre")

    if not spell_rows:
        print("⚠️  El catálogo `spells` está vacío. Ejecuta primero el seed (Fase H2).")
        await conn.close()
        return

    chars = await conn.fetch(
        "SELECT id, name, spells_known, cantrips_known FROM characters"
    )

    inserted = 0
    unmatched: list[str] = []

    for ch in chars:
        entries: list[tuple[str, bool]] = []  # (nombre, is_prepared)

        # spells_known: JSONB [{name, level, prepared, school}]
        raw = ch["spells_known"]
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except (ValueError, TypeError):
                raw = []
        for entry in (raw or []):
            if isinstance(entry, dict) and entry.get("name"):
                entries.append((entry["name"], bool(entry.get("prepared", False))))
            elif isinstance(entry, str):
                entries.append((entry, False))

        # cantrips_known: TEXT[] de nombres
        for cname in (ch["cantrips_known"] or []):
            if cname:
                entries.append((cname, False))

        for name, prepared in entries:
            spell_id = by_name.get(_norm(name))
            if not spell_id:
                unmatched.append(f"{ch['name']}: {name}")
                continue
            res = await conn.execute(
                """
                INSERT INTO character_spells (character_id, spell_id, is_prepared, source)
                VALUES ($1, $2, $3, 'class')
                ON CONFLICT (character_id, spell_id) DO NOTHING
                """,
                ch["id"], spell_id, prepared,
            )
            if res == "INSERT 0 1":
                inserted += 1

    await conn.close()

    print(f"\n✅ {inserted} filas insertadas en character_spells")
    if unmatched:
        print(f"\n⚠️  {len(unmatched)} hechizos sin casar (revisión manual):")
        for u in unmatched:
            print(f"   - {u}")


if __name__ == "__main__":
    asyncio.run(main())
