import asyncio, ssl, asyncpg, re, os, bcrypt
from pathlib import Path

for line in Path('.env').read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip())

new_hash = bcrypt.hashpw(b'Admin1234!', bcrypt.gensalt()).decode()

async def main():
    ssl_ctx = ssl.create_default_context(cafile='certs/ca.pem')
    dsn = re.sub(r'\?sslmode=\w+', '', os.environ['DATABASE_URL'])
    conn = await asyncpg.connect(dsn, ssl=ssl_ctx)
    await conn.execute("UPDATE members SET password_hash=$1 WHERE username='admin'", new_hash)
    print('Password actualizado. Entra con admin / Admin1234!')
    await conn.close()

asyncio.run(main())
