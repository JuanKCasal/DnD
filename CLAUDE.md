# CLAUDE.md — DnD Community Manager
## Repositorio: JuanKCasal/DnD | Carpeta local: C:\Users\casal\Claude\DnD

---

## Contexto del Proyecto

Aplicación web de gestión para una comunidad de Dungeons & Dragons. SPA estática en **GitHub Pages** (frontend), backend **FastAPI** en **Railway**, base de datos **PostgreSQL** en Aiven, mensajería **Apache Kafka** en Aiven.

**Repo GitHub:** https://github.com/JuanKCasal/DnD.git
**Aiven Project:** juankcasal-dnd

---

## Servicios Aiven — Configuración

### PostgreSQL
- **Host:** postgresql-dnd-juankcasal-dnd.a.aivencloud.com
- **Port:** 23451
- **User:** avnadmin
- **Database:** defaultdb
- **SSL mode:** require
- **Connection limit:** 20
- **Service URI:** `postgres://avnadmin:<PASSWORD>@postgresql-dnd-juankcasal-dnd.a.aivencloud.com:23451/defaultdb?sslmode=require`
- **CA cert:** `./certs/ca.pem`

### Kafka
- **Host:** kafka-dnd-juankcasal-dnd.d.aivencloud.com
- **Port:** 23453
- **Authentication:** Client certificate
- **Service URI:** `kafka-dnd-juankcasal-dnd.d.aivencloud.com:23453`
- **CA cert:** `./certs/ca.pem`
- **Access cert:** `./certs/service.cert`
- **Access key:** `./certs/service.key`

### Archivos de certificados (en `./certs/` — ignorado por git)
```
certs/
├── ca.pem           ← CA compartido (Postgres + Kafka)
├── service.cert     ← Certificado de acceso Kafka
└── service.key      ← Clave privada Kafka
```

---

## Skills activas en este proyecto

Las siguientes skills están instaladas en `.agents/skills/` y se aplican automáticamente:

| Skill | Propósito | Cuándo aplicar |
|-------|-----------|----------------|
| `emil-design-eng` | Microinteracciones, animaciones, motion design | Cualquier componente de UI |
| `impeccable` | Quality check de diseño visual | Automático en cada edit de UI |
| `brandkit` | Sistema de marca cohesivo | Al definir colores, tipografía, iconos |
| `design-taste-frontend` | Criterio estético premium | Decisiones de layout y composición |
| `high-end-visual-design` | Acabado visual de nivel producto | Revisión final de pantallas |
| `dnd` (v2.2.2) | Mecánicas D&D 5e, lore, reglas | Cualquier dato de campaña, personaje, combate |

**Regla:** Antes de escribir cualquier componente de UI, consultar `emil-design-eng` y `design-taste-frontend`. Antes de trabajar con datos de juego (clases, razas, hechizos, stats), consultar la skill `dnd`.

---

## Stack Tecnológico

| Capa | Tecnología | Deploy |
|------|-----------|--------|
| Frontend | HTML5 + Vanilla JS (ES Modules) + CSS custom | GitHub Pages (`/frontend`) |
| Backend | FastAPI (Python 3.11+) | Railway |
| Base de datos | PostgreSQL 15 (Aiven) | Aiven Cloud |
| Mensajería | Apache Kafka 4.2 (Aiven) | Aiven Cloud |
| Auth | JWT (python-jose) + bcrypt | — |
| Migraciones | SQL puro en `/db/migrations/` | Manual |

**Sin build step en el frontend.** ES Modules nativos del browser. Sin Webpack, Vite ni bundlers. GitHub Pages sirve los archivos directamente.

---

## Estructura del Repositorio

```
DnD/
├── CLAUDE.md
├── README.md
├── .env.example
├── .gitignore
│
├── .agents/                       ← Skills instaladas (NO editar manualmente)
│   └── skills/
│       ├── emil-design-eng/
│       ├── impeccable/
│       ├── brandkit/
│       ├── design-taste-frontend/
│       ├── high-end-visual-design/
│       └── dnd/
│
├── certs/                         ← Certificados Aiven (en .gitignore)
│   ├── ca.pem
│   ├── service.cert
│   └── service.key
│
├── frontend/                      ← SPA → GitHub Pages
│   ├── index.html
│   ├── css/
│   │   ├── main.css               # Design system + tokens
│   │   ├── animations.css         # Keyframes y transiciones
│   │   └── components.css         # Componentes reutilizables
│   ├── js/
│   │   ├── api.js                 # Fetch centralizado con JWT
│   │   ├── auth.js                # Sesión, roles, guards
│   │   ├── router.js              # Hash-based SPA router
│   │   ├── utils.js               # Helpers (dice, formatters, etc.)
│   │   └── components/
│   │       ├── toast.js           # Notificaciones estilo Sonner
│   │       ├── modal.js           # Diálogos con animación spring
│   │       ├── card.js            # Campaign/character cards
│   │       └── dice-roller.js     # Componente de dados 3D
│   └── pages/
│       ├── login.js
│       ├── dashboard.js
│       ├── campaigns.js
│       ├── characters.js
│       ├── sessions.js
│       ├── inventory.js
│       └── members.js
│
├── api/                           ← FastAPI → Railway
│   ├── main.py
│   ├── config.py
│   ├── dependencies.py
│   ├── requirements.txt
│   ├── db/
│   │   ├── connection.py          # Pool asyncpg + SSL Aiven
│   │   └── kafka.py               # Productor/consumidor Kafka
│   ├── models/
│   │   ├── member.py
│   │   ├── campaign.py
│   │   ├── character.py
│   │   ├── session.py
│   │   └── inventory.py
│   └── routers/
│       ├── auth.py
│       ├── members.py
│       ├── campaigns.py
│       ├── characters.py
│       ├── sessions.py
│       └── inventory.py
│
├── db/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── README.md
│
└── .github/
    └── workflows/
        └── deploy-frontend.yml
```

---

## Design System — Identidad Visual

### Filosofía
La app debe sentirse como un **artefacto del mundo de D&D digitalizado**: pergamino oscuro, oro envejecido, runas como detalles decorativos, pero con la claridad y velocidad de un producto SaaS moderno. No un juego retro — una herramienta premium para jugadores serios.

### Tokens de color
```css
:root {
  /* Fondos */
  --void:         #09080A;   /* negro profundo con tinte violeta */
  --stone:        #141218;   /* paneles principales */
  --stone-light:  #1C1820;   /* hover states, cards elevadas */
  --border:       #2A2430;   /* bordes sutiles */

  /* Acento dorado — la firma visual */
  --gold:         #C9A84C;   /* dorado envejecido, NO amarillo brillante */
  --gold-dim:     #8A6E2F;   /* estados secundarios */
  --gold-glow:    rgba(201, 168, 76, 0.15);

  /* Acento rojo — combate, alertas */
  --crimson:      #9B2335;
  --crimson-dim:  rgba(155, 35, 53, 0.2);

  /* Texto */
  --ink:          #EDE8DF;
  --ink-muted:    #7D7468;
  --ink-faint:    #3D3830;

  /* Semánticos */
  --success:      #3D6B4F;
  --warning:      #7A5C1E;
  --danger:       var(--crimson);
}
```

### Tipografía
```css
--font-display: 'Cinzel', 'Palatino Linotype', serif;      /* Títulos, nombres campaña */
--font-body:    'EB Garamond', Georgia, serif;              /* Texto corrido */
--font-ui:      'Inter', system-ui, sans-serif;             /* Labels, botones, datos */
--font-mono:    'JetBrains Mono', monospace;                /* Stats, dados, códigos */
/* Google Fonts: Cinzel 400/700 | EB Garamond 400/500/600 | Inter 400/500/600 */
```

### Motion — principios de animación (Emil Design Eng)
```css
--ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);  /* bounce suave */
--ease-smooth:   cubic-bezier(0.4, 0, 0.2, 1);
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);

--dur-instant:  80ms;
--dur-fast:     150ms;
--dur-normal:   250ms;
--dur-slow:     400ms;
--dur-dramatic: 600ms;

/*
  Entradas de página : fade + translateY(12px), dur-slow, ease-out-expo
  Cards hover        : scale(1.02) + gold glow, dur-fast, ease-spring
  Botones active     : scale(0.97), dur-instant
  Modales            : scale(0.95)→1 + opacity, dur-normal, ease-spring
  Toasts             : slideInFromBottom + fade, dur-normal, ease-spring
  Dados              : rotación 3D CSS keyframes, dur-dramatic
*/
```

### Efectos especiales
- **Glow dorado** en hover: `box-shadow: 0 0 0 1px var(--gold-dim), 0 0 24px var(--gold-glow)`
- **Textura grain** en headers: SVG filter inline (sin imágenes externas)
- **Runas ornamentales** en separadores: `᛭ ᚱ ᚢ ᚾ`
- **Contador animado** en stats de personaje: 0 → valor real al cargar

---

## Componentes Core — Especificaciones

### Toast (Notificaciones)
Inspirado en Sonner. Vanilla JS puro:
- Stack bottom-right, máx 3 visibles simultáneos
- Tipos: `success` `error` `info` `dice`
- Auto-dismiss 4s con barra de progreso animada
- Hover pausa el timer; swipe-to-dismiss en mobile

### Modal
- Backdrop: `backdrop-filter: blur(8px)` + `rgba(9,8,10,0.8)`
- Entrada: scale(0.95) + opacity 0→1, ease-spring 250ms
- Salida: scale(0.98) + opacity 1→0, ease-smooth 150ms
- Trap focus; cerrar con Escape

### Cards de Campaña
- Borde izquierdo 3px: dorado=activa, gris=archivada, crimson=en pausa
- Hover: `translateY(-3px)` + gold glow
- Badge de sistema (D&D 5e, Pathfinder, etc.)
- Avatar del DM esquina superior derecha

### Ficha de Personaje
- Grid 3×2 para las 6 stats con counter animado al cargar
- Barra HP gradiente crimson→verde según porcentaje
- Nivel con d20 que rota en hover
- Tabs animados para hechizos por nivel

### Dice Roller (global)
- Activar con `/roll` o botón flotante (bottom-left)
- Soporte: d4 d6 d8 d10 d12 d20 d100
- Animación 3D CSS mientras "cae"
- Historial de últimas 10 tiradas en sesión
- Modificadores: `/roll 2d6+3`

---

## Modelo de Datos

```sql
-- Enums
CREATE TYPE member_role     AS ENUM ('admin', 'dm', 'player');
CREATE TYPE campaign_status AS ENUM ('active', 'paused', 'completed', 'archived');
CREATE TYPE item_type       AS ENUM ('weapon','armor','potion','spell_scroll','tool','treasure','wondrous','ammunition','other');
CREATE TYPE item_rarity     AS ENUM ('common','uncommon','rare','very_rare','legendary','artifact');

-- Tablas
members             (id UUID PK, username, email, discord_handle, role, password_hash, active, created_at, updated_at)
campaigns           (id UUID PK, name, slug UNIQUE, dm_id→members, system, status, description, start_date, end_date, created_at)
campaign_members    (campaign_id→campaigns, member_id→members, joined_at)
characters          (id UUID PK, member_id→members, campaign_id→campaigns, name, race, class, subclass, level 1-20, background, stats_json JSONB, notes, active, created_at)
sessions            (id UUID PK, campaign_id→campaigns, session_number, title, date, summary, created_by→members, created_at)
session_attendance  (session_id→sessions, member_id→members, character_id→characters, present)
items               (id UUID PK, name, description, type, rarity, weight, value_gp)
character_inventory (character_id→characters, item_id→items, quantity, equipped, notes)
campaign_treasury   (campaign_id→campaigns, item_id→items, quantity, gold_pieces, notes, updated_at)

-- stats_json D&D 5e:
-- { "str":10, "dex":10, "con":10, "int":10, "wis":10, "cha":10,
--   "hp":8, "max_hp":8, "ac":10, "speed":30, "prof_bonus":2,
--   "initiative":0, "passive_perception":10,
--   "saving_throws":{...}, "skills":{...}, "spell_slots":{...} }
```

---

## Roles y Permisos

| Acción | Admin | DM | Player |
|--------|-------|----|--------|
| Gestionar miembros | ✅ | ❌ | ❌ |
| Crear campaña | ✅ | ✅ | ❌ |
| Editar campaña | ✅ | ✅ solo la suya | ❌ |
| Registrar sesión | ✅ | ✅ solo su campaña | ❌ |
| Crear personaje | ✅ | ✅ | ✅ |
| Editar personaje | ✅ | ✅ | ✅ solo el propio |
| Ver inventario campaña | ✅ | ✅ | ✅ si participa |
| Modificar tesoro | ✅ | ✅ solo su campaña | ❌ |

---

## Convenciones de Código

### Frontend (Vanilla JS)
- ES Modules nativos (`type="module"`) — sin build step
- Router hash-based: `#/dashboard`, `#/campaigns`, `#/characters`, etc.
- JWT en `localStorage` clave `dnd_token`; user info en `dnd_user`
- `api.js` inyecta `Authorization: Bearer <token>` automáticamente
- Cada página exporta `render(container)` — función async que popula `#app`
- Componentes en `js/components/` — funciones puras que retornan nodos DOM
- Nunca innerHTML con datos del servidor sin sanitizar — usar textContent o DOMPurify
- Animaciones: preferir CSS transitions/keyframes; Web Animations API solo para secuencias complejas

### CSS
- Variables CSS en `:root` para todos los tokens
- BEM-lite: `.card`, `.card__title`, `.card--active`
- Sin `!important`
- Mobile-first: base → `@media (min-width: 768px)`
- `@media (prefers-reduced-motion: reduce)` al final de `animations.css`

### Backend (FastAPI)
- Python 3.11+, type hints obligatorios
- Pydantic v2 para schemas
- `async/await` para DB y Kafka
- Endpoints bajo `/api/v1/`
- Respuesta lista: `{"data": [...], "meta": {"total": n, "page": n, "per_page": n}}`
- Respuesta item: `{"data": {...}}`
- Error: `{"error": {"code": "CAMPAIGN_NOT_FOUND", "message": "..."}}`

### Git
- `main` → producción | `develop` → integración | `feature/nombre`
- Commits: `feat:` `fix:` `db:` `style:` `docs:` `test:`

---

## Conexiones Aiven — Patrones de código

### PostgreSQL
```python
# api/db/connection.py
import asyncpg, ssl
from api.config import get_settings

_pool = None

async def init_pool():
    global _pool
    settings = get_settings()
    ssl_ctx = ssl.create_default_context(cafile=settings.AIVEN_CA_CERT)
    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        ssl=ssl_ctx,
        min_size=2,
        max_size=10,
        command_timeout=30
    )

def get_pool():
    if _pool is None:
        raise RuntimeError("Pool no inicializado")
    return _pool
```

### Kafka
```python
# api/db/kafka.py
from aiokafka import AIOKafkaProducer
import ssl, json

# Topics: dnd.sessions.created | dnd.inventory.updated | dnd.characters.leveled_up

async def get_producer(settings):
    ssl_ctx = ssl.create_default_context(cafile=settings.KAFKA_SSL_CA_CERT)
    ssl_ctx.load_cert_chain(settings.KAFKA_SSL_CERT, settings.KAFKA_SSL_KEY)
    producer = AIOKafkaProducer(
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        security_protocol="SSL",
        ssl_context=ssl_ctx,
        value_serializer=lambda v: json.dumps(v).encode()
    )
    await producer.start()
    return producer
```

---

## Fases de Desarrollo

### Fase 1 — Base y Auth ← EMPEZAR AQUÍ
**PostgreSQL y Kafka ya están configurados y activos en Aiven.**
- [ ] Crear `certs/ca.pem`, `certs/service.cert`, `certs/service.key` (contenidos en `.env`)
- [ ] Verificar conexión: `psql "$DATABASE_URL" -c "SELECT version();"`
- [ ] Ejecutar migración: `psql "$DATABASE_URL" -f db/migrations/001_initial_schema.sql`
- [ ] FastAPI funcional: health check, CORS, lifespan con pool
- [ ] Auth: POST `/api/v1/auth/login` y `/api/v1/auth/register`
- [ ] Members: GET/POST/PUT `/api/v1/members`
- [ ] Frontend: login con animación de entrada premium
- [ ] Frontend: dashboard con stats
- [ ] Habilitar GitHub Pages: Settings → Pages → Source: gh-pages branch

### Fase 2 — Campañas y Personajes
- [ ] CRUD Campaigns
- [ ] CRUD Characters con stats_json D&D 5e
- [ ] Vinculación personaje ↔ campaña ↔ jugador
- [ ] Frontend: página campaigns con cards animadas
- [ ] Frontend: ficha de personaje completa

### Fase 3 — Sesiones
- [ ] CRUD Sessions + session_number automático
- [ ] Asistencia por sesión
- [ ] Crónicas en markdown (marked.js CDN)
- [ ] Kafka: publicar `dnd.sessions.created`

### Fase 4 — Inventario y Tesoro
- [ ] Catálogo de items con rarities
- [ ] Inventario individual + drag-and-drop para equipar
- [ ] Tesoro compartido por campaña + GP
- [ ] Kafka: publicar `dnd.inventory.updated`

### Fase 5 — Dashboard y Notificaciones
- [ ] Dashboard con estadísticas de comunidad
- [ ] Kafka consumer → Discord Webhook
- [ ] Dice roller global flotante
- [ ] Level-up tracker

---

## Instrucciones para el Agente (Claude Code)

### Al iniciar una sesión nueva
1. Leer este CLAUDE.md completo
2. Verificar fase activa por los checkboxes
3. Revisar skills en `.agents/skills/` antes de tocar UI
4. Ejecutar `/impeccable init` si es la primera sesión en el proyecto

### Al trabajar en Frontend
1. Consultar `emil-design-eng` para animaciones y microinteracciones
2. Consultar `design-taste-frontend` y `high-end-visual-design` para decisiones estéticas
3. Usar exclusivamente los tokens CSS de este documento
4. Impeccable hook revisa automáticamente cada edit de UI
5. Probar en 375px (mobile) y 1280px (desktop)

### Al trabajar con datos D&D
1. Consultar skill `dnd` para valores canónicos D&D 5e
2. Stats, spell slots, proficiencies — siempre del SRD vía la skill `dnd`
3. `stats_json` sigue el schema de la sección Modelo de Datos

### Al crear un componente
```
1. HTML semántico primero
2. Tokens CSS (nunca valores hardcoded)
3. Transiciones según principios de motion
4. Verificar con impeccable
5. Testear teclado: Tab, Enter, Escape
```

### Comandos útiles
```bash
# Backend local
cd api
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
# Docs: http://localhost:8000/api/docs

# Verificar conexión PostgreSQL
psql "$DATABASE_URL" -c "SELECT version();"

# Aplicar migración
psql "$DATABASE_URL" -f db/migrations/001_initial_schema.sql

# Frontend local
cd frontend
python -m http.server 3000

# Tests
cd api && pytest tests/ -v

# Generar JWT secret
python -c "import secrets; print(secrets.token_hex(32))"
```
