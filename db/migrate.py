"""
DnD Community Manager — Migration runner
Uso: python db/migrate.py
"""
import asyncio
import ssl
import os
import re
from pathlib import Path

# Cargar .env manualmente (sin dependencias extra)
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

DATABASE_URL = os.environ["DATABASE_URL"]
CA_CERT = Path(__file__).parent.parent / os.environ.get("AIVEN_CA_CERT", "certs/ca.pem")
MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def split_sql(sql: str) -> list[str]:
    """Divide el SQL en statements individuales, ignorando ; dentro de strings y funciones."""
    # Quitar comentarios de línea
    sql = re.sub(r"--[^\n]*", "", sql)
    # Dividir por ; pero solo los que están fuera de bloques $$ ... $$
    statements = []
    current = []
    in_dollar_block = False

    for line in sql.splitlines():
        stripped = line.strip()
        if "$$" in stripped:
            count = stripped.count("$$")
            if count % 2 != 0:
                in_dollar_block = not in_dollar_block
        current.append(line)
        if not in_dollar_block and stripped.endswith(";"):
            stmt = "\n".join(current).strip().rstrip(";").strip()
            if stmt:
                statements.append(stmt)
            current = []

    # Último statement sin ; final
    leftover = "\n".join(current).strip()
    if leftover:
        statements.append(leftover)

    return [s for s in statements if s.strip()]


async def run_migration(filepath: Path):
    try:
        import asyncpg
    except ImportError:
        print("❌ asyncpg no instalado. Ejecuta: pip install asyncpg")
        return False

    print(f"\n📄 Aplicando: {filepath.name}")
    sql = filepath.read_text(encoding="utf-8")
    statements = split_sql(sql)
    print(f"   {len(statements)} statements encontrados")

    ssl_ctx = None
    if CA_CERT.exists():
        ssl_ctx = ssl.create_default_context(cafile=str(CA_CERT))
        print(f"   SSL: {CA_CERT.name} ✓")
    else:
        print(f"   ⚠️  CA cert no encontrado en {CA_CERT}, intentando sin SSL...")

    try:
        # Limpiar sslmode del DSN para asyncpg (usa ssl_ctx en su lugar)
        dsn = re.sub(r"\?sslmode=\w+", "", DATABASE_URL)
        conn = await asyncpg.connect(dsn, ssl=ssl_ctx)
    except Exception as e:
        print(f"\n❌ Error de conexión: {e}")
        return False

    errors = []
    for i, stmt in enumerate(statements, 1):
        # Preview del statement
        preview = stmt.strip().splitlines()[0][:70]
        try:
            await conn.execute(stmt)
            print(f"   [{i:3}/{len(statements)}] ✓  {preview}")
        except Exception as e:
            msg = str(e)
            # Ignorar errores de "ya existe" (idempotencia)
            ignorable = any(k in msg.lower() for k in [
                "already exists", "duplicate", "ya existe"
            ])
            if ignorable:
                print(f"   [{i:3}/{len(statements)}] ⏭  {preview}  (ya existe)")
            else:
                print(f"   [{i:3}/{len(statements)}] ✗  {preview}")
                print(f"         Error: {msg[:120]}")
                errors.append((i, preview, msg))

    await conn.close()

    if errors:
        print(f"\n⚠️  Migración completada con {len(errors)} error(es):")
        for num, prev, err in errors:
            print(f"   Statement {num}: {err[:100]}")
        return False
    else:
        print(f"\n✅ Migración aplicada correctamente")
        return True


async def main():
    import sys

    print("=" * 60)
    print("  DnD Community Manager — Database Migration")
    print("=" * 60)
    print(f"  DB: {DATABASE_URL[:50]}...")

    # Nombre de migración por argumento; por defecto el schema inicial.
    fname = sys.argv[1] if len(sys.argv) > 1 else "001_initial_schema.sql"
    if not fname.endswith(".sql"):
        fname += ".sql"
    migration_file = MIGRATIONS_DIR / fname
    if not migration_file.exists():
        print(f"\n❌ No encontrado: {migration_file}")
        print(f"   Migraciones disponibles: {[p.name for p in sorted(MIGRATIONS_DIR.glob('*.sql'))]}")
        return

    success = await run_migration(migration_file)

    if success:
        print("\n🎲 Base de datos lista. Ahora puedes arrancar el backend:")
        print("   uvicorn api.main:app --reload --port 8000")
    else:
        print("\n🔍 Revisa los errores arriba.")


if __name__ == "__main__":
    asyncio.run(main())
