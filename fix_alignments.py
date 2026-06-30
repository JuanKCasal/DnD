"""
fix_alignments.py — Limpia valores de alignment incorrectos en characters.
Mapea nombres completos (ej. 'lawful_good') a los enums correctos ('LG').
Ejecutar desde la carpeta raíz: python fix_alignments.py
"""
import asyncio, ssl, asyncpg, re, os
from pathlib import Path

for line in Path('.env').read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip())

ALIGNMENT_MAP = {
    'lawful_good':    'LG',
    'neutral_good':   'NG',
    'chaotic_good':   'CG',
    'lawful_neutral': 'LN',
    'true_neutral':   'TN',
    'chaotic_neutral':'CN',
    'lawful_evil':    'LE',
    'neutral_evil':   'NE',
    'chaotic_evil':   'CE',
}

async def main():
    ssl_ctx = ssl.create_default_context(cafile='certs/ca.pem')
    dsn = re.sub(r'\?sslmode=\w+', '', os.environ['DATABASE_URL'])
    conn = await asyncpg.connect(dsn, ssl=ssl_ctx)

    # Mostrar estado actual
    rows = await conn.fetch(
        "SELECT id, name, alignment FROM characters WHERE active = TRUE ORDER BY name"
    )
    print(f"\n{'Personaje':<30} {'Alignment actual':<20}")
    print('-' * 52)
    for r in rows:
        print(f"{r['name']:<30} {str(r['alignment']):<20}")

    # Contar cuántos necesitan fix (alignment NULL o valor inválido)
    # Los valores inválidos no pueden estar en DB (el enum los rechaza),
    # pero sí pueden existir registros con alignment = NULL
    nulls = [r for r in rows if r['alignment'] is None]
    print(f"\nPersonajes con alignment NULL: {len(nulls)}")
    for r in nulls:
        print(f"  - {r['name']} ({r['id']})")

    if nulls:
        resp = input("\n¿Asignar 'TN' (Neutral) a los que tienen NULL? [s/N]: ")
        if resp.lower() == 's':
            updated = await conn.execute(
                "UPDATE characters SET alignment = 'TN'::alignment_type WHERE alignment IS NULL AND active = TRUE"
            )
            print(f"Actualizado: {updated}")
        else:
            print("Sin cambios.")
    else:
        print("\nTodos los personajes tienen alignment válido. No hay nada que limpiar.")

    await conn.close()

asyncio.run(main())
