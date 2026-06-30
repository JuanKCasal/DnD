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

**Railway env vars:** Los certs se pasan en base64 (`AIVEN_CA_CERT_B64`, `AIVEN_KAFKA_CERT_B64`, `AIVEN_KAFKA_KEY_B64`). `config.py` los decodifica con padding correcto (`rstrip('=')` + `len % 4`).

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
├── reset_admin.py                 ← Utilidad para resetear password de admin
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
│   ├── index.html                 # Cache-bust: v=20260630
│   ├── css/
│   │   ├── main.css               # Design system + tokens (light theme)
│   │   ├── animations.css         # Keyframes y transiciones
│   │   └── components.css         # Componentes reutilizables
│   ├── js/
│   │   ├── api.js                 # Fetch centralizado con JWT
│   │   ├── auth.js                # Sesión, roles, guards
│   │   ├── router.js              # Hash-based SPA + nav horizontal con mega-menu
│   │   ├── utils.js               # Helpers (dice, formatters, etc.)
│   │   └── components/
│   │       ├── toast.js           # Notificaciones estilo Sonner
│   │       └── modal.js           # Diálogos con animación spring
│   └── pages/
│       ├── login.js
│       ├── dashboard.js
│       ├── campaigns.js
│       ├── characters.js          # Ficha completa D&D 5e + edit/delete + modal 5 tabs + inventario inline (~1843 líneas)
│       ├── sessions.js
│       ├── inventory.js           # Modo player/treasury/catalogue detectado por hash
│       └── members.js
│
├── api/                           ← FastAPI → Railway
│   ├── main.py                    # App, CORS, lifespan, routers
│   ├── config.py                  # Settings, cert decoding, CORS origins
│   ├── dependencies.py            # get_db, get_current_user, require_role, hash_password
│   ├── requirements.txt
│   ├── db/
│   │   ├── connection.py          # Pool asyncpg + SSL Aiven
│   │   ├── kafka.py               # Productor/consumidor Kafka + topics
│   │   └── helpers.py             # paginate, list_response, item_response, records_to_list, log_event
│   ├── models/
│   │   ├── auth.py                # LoginRequest, Token, TokenData
│   │   ├── member.py              # MemberCreate, MemberUpdate, MemberOut
│   │   ├── campaign.py            # CampaignCreate, CampaignUpdate, CampaignOut
│   │   ├── character.py           # CharacterCreate, CharacterUpdate, CharacterOut, HPUpdate, etc.
│   │   ├── session_model.py       # SessionCreate, SessionUpdate, SessionOut
│   │   ├── item.py                # ItemCreate, ItemUpdate, ItemOut, InventoryAdd
│   │   ├── inventory_model.py     # Extended item fields (magical, damage, ac_base, etc.)
│   │   ├── rank.py                # RankCreate, RankUpdate, RankOut
│   │   ├── clan.py                # ClanCreate, ClanUpdate, ClanOut, ClanInvitationCreate
│   │   ├── chat.py                # ChatRoomCreate/Out, ChatMessageCreate/Out, DirectMessageCreate/Out
│   │   └── event.py               # EventLogOut
│   └── routers/
│       ├── auth.py                # POST /login, /register
│       ├── members.py             # GET/POST/PUT /members (POST admin-only)
│       ├── campaigns.py           # CRUD /campaigns + DELETE
│       ├── characters.py          # CRUD /characters + DELETE + /hp /conditions /spell-slots /inventory
│       ├── sessions.py            # CRUD /sessions + DELETE + asistencia
│       ├── inventory.py           # GET/POST/PUT/DELETE /items + campaign treasury
│       ├── ranks.py               # CRUD /ranks
│       ├── clans.py               # CRUD /clans + membership + invitations
│       ├── chat.py                # GET/POST /chat/rooms + /messages + DMs
│       └── events.py              # GET /events (event log público)
│
├── db/
│   ├── migrate.py                 ← Runner de migraciones
│   └── migrations/
│       ├── 001_initial_schema.sql # Schema v2.0 completo (656 líneas)
│       └── README.md
│
└── .github/
    └── workflows/
        └── deploy-frontend.yml
```

---

## Design System — Identidad Visual

### Filosofía
La app debe sentirse como un **artefacto del mundo de D&D digitalizado**: pergamino claro, oro antiguo, runas como detalles decorativos, pero con la claridad y velocidad de un producto SaaS moderno. No un juego retro — una herramienta premium para jugadores serios.

### Tokens de color (Light Theme — vigente desde Fase 6)
```css
:root {
  /* Fondos */
  --void:         #F5F3EE;   /* crema pergamino — fondo página */
  --stone:        #FFFFFF;   /* paneles principales */
  --stone-light:  #FAF9F7;   /* hover states, cards elevadas */
  --border:       #E8E4DC;   /* bordes sutiles */

  /* Acento dorado — la firma visual */
  --gold:         #7A5C0A;   /* dorado envejecido en light */
  --gold-dim:     #A67C1A;   /* estados secundarios */
  --gold-glow:    rgba(122, 92, 10, 0.12);

  /* Acento rojo — combate, alertas */
  --crimson:      #9B2335;
  --crimson-dim:  rgba(155, 35, 53, 0.12);

  /* Texto */
  --ink:          #1A1714;
  --ink-muted:    #6B6460;
  --ink-faint:    #C4BDB5;

  /* Semánticos */
  --success:      #2D6A4F;
  --warning:      #7A5C0A;
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
--ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);
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
*/
```

---

## Navegación — Top Nav Horizontal

Estructura del mega-menu (en `router.js`, constante `NAV_GROUPS`):

- **Noticias** *(deshabilitado)*
- **Dashboard** → `#/dashboard`
- **Mi DnD:** Personajes `#/characters`, Inventario del Jugador `#/inventory` | Perfil *(deshabilitado)*
- **Juego:** Campañas `#/campaigns`, Sesiones `#/sessions`, Tesoros `#/treasury` | Misiones *(deshabilitado)*
- **Mundo:** Clanes, Salón de la Fama *(deshabilitados)*
- **Comunidad:** Chat, Calendario & Eventos *(deshabilitados)*
- **Configuración:** Miembros `#/members`, Catálogo `#/catalogue` | Event Log *(deshabilitado)*

**Rutas de inventario — todas usan `inventory.js`, modo por hash:**
- `#/inventory` → modo `player` — equipamiento del jugador entre personajes
- `#/treasury` → modo `treasury` — tesoros y monedas por campaña (admin/DM)
- `#/catalogue` → modo `catalogue` — catálogo de items de la comunidad (admin only)

Items deshabilitados: badge "Próximamente", `cursor:not-allowed`, no clickeables.
`max-width: 1300px` global en nav, main-content y todas las páginas.

---

## Modelo de Datos — Schema v2.0

### Enums definidos
```sql
member_role:     'admin' | 'dm' | 'player'
clan_role:       'leader' | 'officer' | 'veteran' | 'member' | 'initiate'
campaign_status: 'active' | 'paused' | 'completed' | 'archived'
quest_status:    'active' | 'completed' | 'failed' | 'abandoned'
location_type:   'city' | 'dungeon' | 'wilderness' | 'plane' | 'region' | 'poi'
npc_relationship:'ally' | 'enemy' | 'neutral' | 'unknown'
alignment_type:  'LG'|'NG'|'CG'|'LN'|'TN'|'CN'|'LE'|'NE'|'CE'
invite_status:   'pending' | 'accepted' | 'rejected'
item_type:       'weapon'|'armor'|'potion'|'spell_scroll'|'ring'|'rod'|'staff'|'wand'|
                 'wondrous'|'tool'|'ammunition'|'gear'|'treasure'|'vehicle'|'other'
item_rarity:     'common'|'uncommon'|'rare'|'very_rare'|'legendary'|'artifact'
chat_room_type:  'general'|'clan'|'rank'|'campaign'|'dm_channel'|'ooc'|'announcements'
message_type:    'ic'|'ooc'|'dice'|'emote'|'system'|'whisper'
dm_message_type: 'ic'|'ooc'|'whisper'
```

### Tablas principales
```
ranks               (id, name, slug, description, color_hex, icon_url, level, permissions JSONB, xp_threshold)
members             (id, username, email, password_hash, display_name, avatar_url, discord_handle, discord_id,
                     role::member_role, rank_id→ranks, bio, timezone, active_character_id, active, last_seen_at)
member_xp           (member_id→members PK, total_xp, sessions_attended, messages_sent)

clans               (id, name, slug, description, motto, emblem_url, color_hex, alignment, leader_member_id,
                     is_public, requires_approval, max_members, lore, active)
clan_members        (clan_id, member_id PK, clan_role, title, contribution_pts, joined_at, approved_by)
clan_invitations    (id, clan_id, invited_member_id, invited_by, status::invite_status, resolved_at)

campaigns           (id, name, slug UNIQUE, dm_id→members, system, status::campaign_status, description,
                     lore, cover_image_url, is_public, world_name, setting, start_date, end_date)
campaign_members    (campaign_id, member_id PK, joined_at)

characters          (id, member_id→members, campaign_id→campaigns, name, race, subrace, class, subclass,
                     background, alignment::alignment_type, deity, level 1-20, xp, inspiration,
                     str, dex, con, int, wis, cha,
                     hp, max_hp, temp_hp, ac, initiative_bonus, speed, prof_bonus, passive_perception,
                     spell_slots JSONB, conditions TEXT[], feats JSONB, saving_throws JSONB, skills JSONB,
                     portrait_url, backstory, personality_traits, ideals, bonds, flaws, notes,
                     active, created_at)
character_currency  (character_id→characters PK, pp, gp, ep, sp, cp)

sessions            (id, campaign_id→campaigns, session_number AUTO, title, date, duration_minutes,
                     summary, highlights TEXT[], created_by→members)
session_attendance  (session_id, member_id PK, character_id→characters, present)

items               (id, name, description, type::item_type, rarity::item_rarity, weight, value_gp,
                     is_magical, is_consumable, requires_attunement, attunement_restriction,
                     damage_dice, damage_type, ac_base, source_book, source_page)
character_inventory (character_id, item_id PK, quantity, equipped, attuned, notes, custom_name)
campaign_treasury   (campaign_id, item_id PK, quantity, notes, updated_at)
campaign_currency   (campaign_id→campaigns PK, pp, gp, ep, sp, cp, notes)

chat_rooms          (id, name, slug, type::chat_room_type, clan_id, campaign_id, rank_required_id,
                     description, icon, is_readonly, is_ic, sort_order)
chat_messages       (id, room_id→chat_rooms, member_id→members, character_id→characters,
                     message_type::message_type, content, dice_result JSONB, reply_to_id, is_pinned)
direct_messages     (id, from_character_id, to_character_id, content, message_type::dm_message_type, read_at)

event_log           (id, occurred_at, actor_member_id, actor_character_id, action, target_type,
                     target_id, target_name, before JSONB, after JSONB, metadata JSONB, is_public)
```

### Mapeo campos Pydantic ↔ columnas DB en Characters

Los nombres de columna en PostgreSQL usan palabras reservadas sin sufijo:

| Pydantic field | DB column |
|---------------|-----------|
| `char_class` | `class` |
| `str_score` | `str` |
| `dex_score` | `dex` |
| `con_score` | `con` |
| `int_score` | `int` |
| `wis_score` | `wis` |
| `cha_score` | `cha` |

En los SELECT se usan aliases: `c.str AS str_score`, etc. El router incluye `_character_select()` que devuelve el SELECT completo. El `col_map` en `update_character` mapea automáticamente.

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
| Eliminar personaje | ✅ | ✅ | ✅ solo el propio |
| Ver inventario campaña | ✅ | ✅ | ✅ si participa |
| Modificar tesoro | ✅ | ✅ solo su campaña | ❌ |

---

## Convenciones de Código

### Frontend (Vanilla JS)
- ES Modules nativos (`type="module"`) — sin build step
- Router hash-based: `#/dashboard`, `#/campaigns`, `#/characters`, etc.
- JWT en `localStorage` clave `dnd_token`; user info en `dnd_user`
- `api.js` inyecta `Authorization: Bearer <token>` automáticamente
- **DELETE method:** `api.del(path)` — no `api.delete` (palabra reservada JS)
- Cada página exporta `render(container)` — función async que popula `#app`
- Nunca innerHTML con datos del servidor sin sanitizar — usar textContent o DOMPurify
- **Anti-truncación:** Después de editar archivos JS grandes, verificar con `tail -5` que el archivo cierra correctamente

### CSS
- Variables CSS en `:root` para todos los tokens
- BEM-lite: `.card`, `.card__title`, `.card--active`
- Sin `!important`
- Mobile-first: base → `@media (min-width: 768px)`
- `@media (prefers-reduced-motion: reduce)` al final de `animations.css`

### Backend (FastAPI)
- Python 3.11+, type hints obligatorios
- Pydantic v2 — todos los modelos `*Out` deben incluir `model_config = {"from_attributes": True}`
- `async/await` para DB y Kafka
- Endpoints bajo `/api/v1/`
- Respuesta lista: `{"data": [...], "meta": {"total": n, "page": n, "per_page": n}}`
- Respuesta item: `{"data": {...}}`
- Error: `{"error": {"code": "CAMPAIGN_NOT_FOUND", "message": "..."}}`
- Usar `helpers.py`: `list_response()`, `item_response()`, `records_to_list()`, `log_event()`
- **Anti-truncación:** Después de editar modelos, verificar con `python3 -c "import ast; ast.parse(open('file.py').read())"`

### Git
- `main` → producción | `develop` → integración | `feature/nombre`
- Commits: `feat:` `fix:` `db:` `style:` `docs:` `test:`
- **Lock files:** Git lock desde el sandbox tiene permisos limitados — si falla, el usuario debe hacer commit/push desde PowerShell en Windows

---

## Conexiones Aiven — Patrones de código

### PostgreSQL
```python
# api/db/connection.py
import asyncpg, ssl

async def init_pool(settings):
    ssl_ctx = ssl.create_default_context(cafile=settings.AIVEN_CA_CERT)
    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        ssl=ssl_ctx,
        min_size=2,
        max_size=10,
        command_timeout=30
    )
```

### Kafka
```python
# Topics activos:
# dnd.sessions.created | dnd.inventory.updated | dnd.characters.leveled_up
# (dnd.chat.message.sent definido pero consumidor pendiente)

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

### Fase 1 — Base y Auth ✅ COMPLETADA
- [x] Certs Aiven configurados (ca.pem, service.cert, service.key)
- [x] PostgreSQL conectado con pool asyncpg + SSL
- [x] Migración inicial ejecutada (schema v2.0, 656 líneas)
- [x] FastAPI funcional: health check, CORS, lifespan
- [x] Auth: POST `/api/v1/auth/login` y `/api/v1/auth/register`
- [x] Members: GET/POST/PUT `/api/v1/members`
- [x] Frontend: login + dashboard
- [x] GitHub Pages habilitado

**Nota Railway:** `api/Dockerfile` copia archivos en `./api/` para que `uvicorn api.main:app` funcione.

### Fase 2 — Campañas y Personajes ✅ COMPLETADA
- [x] CRUD Campaigns (backend + frontend con cards animadas)
- [x] CRUD Characters con stats D&D 5e (backend + frontend con ficha completa)

### Fase 3 — Sesiones ✅ COMPLETADA
- [x] CRUD Sessions + session_number automático + asistencia
- [x] Crónicas en markdown (marked.js CDN) + Kafka `dnd.sessions.created`
- [x] Frontend: timeline con cards, filtro, modal, detail con tabs

**Fix crítico:** Alias `date` → `Date` en `session_model.py` — conflicto Pydantic v2 con tipo `datetime.date`.

### Fase 4 — Inventario y Tesoro ✅ COMPLETADA
- [x] Catálogo de items con rarities (CRUD, filtros)
- [x] Inventario individual + Tesoro por campaña + monedas
- [x] Kafka: `dnd.inventory.updated`
- [x] Frontend: 3 tabs — Mi Inventario / Tesoro / Catálogo

**Bug fix:** Modal huérfano — `overlay.appendChild(modal)` antes de `document.body.appendChild(overlay)`.

### Fase 5 — Mejoras de Comunidad ✅ COMPLETADA
- [x] Dashboard con 5 stats de comunidad en tiempo real
- [x] Página Miembros: grid de cards, edición de rol (admin), activar/desactivar
- [x] Level-up tracker: botón "Subir nivel" → Kafka `dnd.characters.leveled_up` → toast
- [x] Editar HP desde la ficha de personaje

### Fase 6 — Rediseño UI + CRUD Completo ✅ COMPLETADA

#### Rediseño visual
- [x] **Tema claro** — tokens CSS completamente reescritos (ver Design System)
- [x] **Nav horizontal** con mega-menu y drawer mobile — `max-width: 1300px` global
- [x] Items deshabilitados con badge "Próximamente"

#### CRUD extendido
- [x] `POST /api/v1/members` admin-only + modal de creación en UI
- [x] `MemberUpdate` acepta `role` y `active`
- [x] `DELETE /api/v1/campaigns/{id}` + `DELETE /api/v1/sessions/{id}` con botones en UI

#### Fixes aplicados
- `dashboard.js` truncado → restaurado `emptyState()` completo
- `user is not defined` en personajes → `auth.getUser()` movido al scope correcto
- Botón asistencia silencioso → `payload` undefined eliminado
- `active` y `role` en `MemberUpdate` con cast correcto `::member_role` en SQL

### Fase 7 — Personajes: Mejoras completas ✅ COMPLETADA

#### Modal + Ficha
- [x] **6 ability scores en cards** — list SQL incluye `c.str AS str_score`...`c.cha AS cha_score`
- [x] **Edit/delete en cards** — botones hover (visibles para admin, dm y dueño del personaje)
- [x] **Modal unificado create/edit** (`openCharacterModal`) — 5 tabs: General · Habilidades · Hechizos · Rasgos · 🎒 Inventario
  - General: Identidad (raza, subraza dinámica, clase, trasfondo, alineamiento, deidad, nivel, campaña, retrato), Combate (HP, CA, velocidad, etc.), Puntuaciones 3-col, Personalidad & Historia
  - Habilidades: tiradas de salvación (determinísticas por clase PHB §10) + 18 habilidades con competencias (trasfondo locked, raza locked, clase con checkboxes limitados)
  - Rasgos: personalidad, ideales, vínculos, defectos, trasfondo, notas, dotes
  - 🎒 Inventario: lazy-loaded al primer click, lista de items con equip/desequip + quitar, botón "Añadir item" con modal de búsqueda en catálogo
- [x] **DELETE endpoint** — soft-delete (`active = FALSE`) con verificación de dueño
- [x] **CharacterOut** incluye todos los campos

#### PHB Competencias (implementadas en Fase 7)
- [x] **Tiradas de salvación** — `CLASS_SAVES_KEYS` en `characters.js` mapea clase → 2 saves; se refleja en círculos del tab Habilidades y se guarda en `saving_throws` JSONB
- [x] **18 habilidades** — `BACKGROUND_SKILLS`, `RACE_SKILLS`, `CLASS_SKILLS` (con conteo y lista de opciones por clase PHB); trasfondo y raza como badges 🔒 gold, clase como checkboxes reactivos
- [x] **Skill payload** — `lockedSkillKeys` (trasfondo + raza) + checkboxes de clase → `skills` JSONB al guardar

#### Módulos de constantes (al inicio de `characters.js`, scope de módulo)
```javascript
CLASS_SAVES_KEYS   // clase → [k1, k2] (PHB)
RACE_SKILLS        // raza → [skill_key, ...]
SKILL_NAME_TO_KEY  // 'Acrobacias' → 'acrobatics'
SKILL_KEY_TO_NAME  // inverso
CLASS_SKILLS       // clase → { count, options[] }
RACE_DATA          // raza → { bonuses, speed, subraces, special }
BACKGROUND_SKILLS  // trasfondo → [skill_name, skill_name]
CLASS_SAVES        // clase → ['STR','CON'] (display label)
```

#### Reestructura de Inventario (también en Fase 7)
- [x] **`inventory.js` — modo por hash** — detecta `#/inventory` / `#/treasury` / `#/catalogue` y renderiza la vista correcta
- [x] **Nav actualizada** — Inventario del Jugador bajo Mi DnD, Tesoros bajo Juego, Catálogo bajo Configuración
- [x] **Tab Inventario en ficha** — `renderShInventario(el)` lazy-load: carga `GET /characters/{id}/inventory`, items con equip toggle y quitar; `openInvAddModal` busca en catálogo y POST al inventario

**⚠️ COMMIT PENDIENTE — ejecutar desde PowerShell:**
```powershell
cd C:\Users\casal\Claude\DnD
git add frontend/pages/characters.js frontend/js/router.js frontend/pages/inventory.js
git commit -m "feat: PHB competencias + tab inventario en ficha + reestructura rutas inventario"
git push origin main
```

---

## Próximas Fases (Pendiente)

### Fase 8 — Chat y Comunidad en tiempo real
- [ ] Frontend: página Chat — rooms list + room view con mensajes IC/OOC/dice
- [ ] Frontend: Direct Messages entre personajes
- [ ] Frontend: Clanes — lista, perfil, membresía, invitaciones
- [ ] Frontend: Rangos — tabla con colores y niveles de XP
- [ ] Kafka consumer → Discord Webhook (level-up, session created)
- [ ] Dice roller global flotante (bottom-left, `/roll 2d6+3`, d4/d6/d8/d10/d12/d20/d100)

### Fase 9 — Worldbuilding y contenido
- [ ] NPCs, Locations, Quests (tablas en schema, routers pendientes)
- [ ] Salón de la Fama — miembros destacados, stats de comunidad
- [ ] Calendario & Eventos
- [ ] Event Log frontend page
- [ ] Perfil de usuario completo

---

## Instrucciones para el Agente (Claude)

### Al iniciar una sesión nueva
1. Leer este CLAUDE.md completo
2. Verificar fase activa por los checkboxes
3. Revisar skills en `.agents/skills/` antes de tocar UI
4. Verificar con `git status` si hay cambios sin commitear

### Al trabajar en Frontend
1. Consultar `emil-design-eng` para animaciones y microinteracciones
2. Consultar `design-taste-frontend` y `high-end-visual-design` para decisiones estéticas
3. Usar exclusivamente los tokens CSS de este documento
4. Después de editar archivos JS grandes: `tail -5 archivo.js` para confirmar que no está truncado
5. Probar en 375px (mobile) y 1280px (desktop)

### Al trabajar con datos D&D
1. Consultar skill `dnd` para valores canónicos D&D 5e
2. Columnas DB de stats: `str`, `dex`, `con`, `int`, `wis`, `cha` (sin sufijo `_score`)
3. En Pydantic usar `str_score`, etc. — el `col_map` del router mapea automáticamente

### Al crear un componente
```
1. HTML semántico primero
2. Tokens CSS (nunca valores hardcoded)
3. Transiciones según principios de motion
4. Testear teclado: Tab, Enter, Escape
```

### Comandos útiles
```bash
# Backend local
cd api && uvicorn api.main:app --reload --port 8000
# Docs: http://localhost:8000/api/docs

# Verificar conexión PostgreSQL
psql "$DATABASE_URL" -c "SELECT version();"

# Aplicar migración
psql "$DATABASE_URL" -f db/migrations/001_initial_schema.sql

# Frontend local
cd frontend && python -m http.server 3000

# Verificar archivos no truncados
tail -5 frontend/pages/characters.js
python3 -c "import ast; ast.parse(open('api/models/character.py').read()); print('OK')"

# Generar JWT secret
python -c "import secrets; print(secrets.token_hex(32))"
```
