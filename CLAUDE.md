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
├── README.md                      # Documentación funcional de la app
├── PLAN_MEJORAS_ITEMS.md          # Plan por fases del sistema de ítems (I1–I6)
├── .gitignore
├── Dockerfile                     # ⚠️ Dockerfile en raíz (copia api/ → ./api/)
├── reset_admin.py                 # Utilidad: resetear password de admin (BD)
├── fix_alignments.py              # Utilidad one-off: normaliza alignment a enums (LG, NG…)
├── skills-lock.json               # Lock de skills instaladas
│
├── .agents/                       # Skills instaladas (NO editar manualmente)
│   └── skills/{emil-design-eng, impeccable, brandkit,
│               design-taste-frontend, high-end-visual-design, dnd}
│
├── certs/                         # Certificados Aiven (en .gitignore)
│   ├── ca.pem                     # CA compartido (Postgres + Kafka)
│   ├── service.cert               # Certificado de acceso Kafka
│   └── service.key                # Clave privada Kafka
│
├── frontend/                      # SPA → GitHub Pages
│   ├── index.html                 # Cache-bust por versión
│   ├── css/
│   │   ├── main.css               # Design system + tokens (light theme)
│   │   ├── animations.css         # Keyframes y transiciones
│   │   └── components.css         # Componentes reutilizables
│   ├── js/
│   │   ├── api.js                 # Fetch centralizado con JWT (get/post/put/del)
│   │   ├── auth.js                # Sesión, roles, guards
│   │   ├── router.js              # Hash-based SPA + nav horizontal con mega-menu
│   │   ├── utils.js               # Helpers (dice, formatters, etc.)
│   │   └── components/
│   │       ├── toast.js           # Notificaciones estilo Sonner
│   │       └── modal.js           # Diálogos con animación spring
│   └── pages/
│       ├── login.js
│       ├── dashboard.js           # 5 stats de comunidad en tiempo real
│       ├── campaigns.js           # CRUD campañas con cards animadas
│       ├── characters.js          # Ficha D&D 5e + modal 5 tabs + panel de combate calculado (~1900 líneas)
│       ├── sessions.js            # Timeline + detalle con tabs + asistencia + botín (loot)
│       ├── inventory.js           # Modo player/treasury/catalogue por hash; slots, sintonía, tienda, cargas, packs (~1400 líneas)
│       ├── members.js             # Grid de miembros + edición de rol
│       └── spells.js              # Catálogo de hechizos (#/spellbook): filtros, detalle,
│                                  #   CRUD admin + enlace de componente consumible (H3/H6)
│
├── api/                           # FastAPI → Railway
│   ├── Dockerfile                 # ⚠️ Segundo Dockerfile (copia . → ./api/) — redundante con el de raíz
│   ├── main.py                    # App, CORS, lifespan, routers
│   ├── config.py                  # Settings, decodificación de certs, CORS origins
│   ├── dependencies.py            # get_db, get_current_user, require_role, hash_password
│   ├── requirements.txt
│   ├── __init__.py                # (paquete)
│   ├── db/
│   │   ├── connection.py          # Pool asyncpg + SSL Aiven
│   │   ├── kafka.py               # Productor Kafka + topics
│   │   └── helpers.py             # paginate, list_response, item_response, records_to_list, log_event
│   ├── models/
│   │   ├── auth.py                # LoginRequest, Token, TokenData
│   │   ├── member.py              # MemberCreate, MemberUpdate, MemberOut
│   │   ├── campaign.py            # CampaignCreate, CampaignUpdate, CampaignOut
│   │   ├── character.py           # CharacterCreate/Update/Out, HPUpdate, etc.
│   │   ├── session_model.py       # SessionCreate, SessionUpdate, SessionOut
│   │   ├── inventory_model.py     # ÚNICO modelo de ítem: ItemCreate/Update/Out (armas, armaduras,
│   │   │                          #   cargas, magical_properties), InventoryAdd/Update (slot, attuned),
│   │   │                          #   TreasuryAdd/Update, CurrencyUpdate  [item.py fue eliminado en I1]
│   │   ├── rank.py                # RankCreate, RankUpdate, RankOut
│   │   ├── clan.py                # ClanCreate, ClanUpdate, ClanOut, ClanInvitationCreate
│   │   ├── chat.py                # ChatRoom*, ChatMessage*, DirectMessage*
│   │   ├── event.py               # EventLogOut
│   │   └── spell_model.py         # SpellCreate/Update/Out, CharacterSpellAdd/Update,
│   │                              #   SpellCastRequest, RestRequest, ConcentrationSet (Fases H1/H6)
│   ├── services/                  # Lógica de dominio pura (Fases I4–I5, H4)
│   │   ├── character_mechanics.py # compute_combat: CA efectiva, velocidad, sigilo, ataques
│   │   ├── economy.py             # conversión de moneda (cp), peso de monedas, carga/encumbramiento
│   │   └── spellcasting.py        # compute_spellcasting: CD/ataque, ranuras full/half/third/pact,
│   │                              #   límites, disponibilidad (can_learn) — clase ES→canónica
│   └── routers/
│       ├── auth.py                # POST /login, /register
│       ├── members.py             # GET/POST/PUT /members (POST admin-only)
│       ├── campaigns.py           # CRUD /campaigns + DELETE + /treasury (currency)
│       ├── characters.py          # CRUD /characters + /hp /conditions /spell-slots + /combat (I4)
│       ├── sessions.py            # CRUD /sessions + DELETE + asistencia
│       ├── inventory.py           # /items (catálogo completo), inventario de personaje (slots/sintonía),
│       │                          #   tesoro de campaña, /currency + /carry, /shop/buy|sell,
│       │                          #   /use /use-charge /recharge, /packs, /sessions/{id}/loot  (~1150 líneas)
│       ├── ranks.py               # CRUD /ranks
│       ├── clans.py               # CRUD /clans + membership + invitations
│       ├── chat.py                # GET/POST /chat/rooms + /messages + DMs
│       ├── events.py              # GET /events (event log público)
│       └── spells.py              # /spells (catálogo CRUD admin), repertorio del personaje
│                                  #   (/characters/{id}/spells), cast/rest/concentration,
│                                  #   spell-slots/restore  (Fases H1/H5/H6)
│
├── db/
│   ├── migrate.py                 # Runner de migraciones (acepta nombre por CLI)
│   ├── seed_items.py              # Seeder idempotente del catálogo SRD (216 ítems)
│   ├── seed_spells.py             # Seeder idempotente de hechizos SRD (319) — cachea db/data/srd_spells.json
│   ├── migrate_spells_known.py    # Migración de datos (obsoleto tras 006)
│   ├── data/
│   │   └── srd_spells.json        # Cache versionada de la SRD 5.1 (fuente del seed)
│   └── migrations/
│       ├── 001_initial_schema.sql # Schema v2.0 completo (656 líneas)
│       ├── 003_equipment_slots.sql# Columna character_inventory.slot (Fase I3)
│       ├── 004_spells.sql         # enum spell_school + tablas spells y character_spells (H1)
│       ├── 005_spellcasting_state.sql # characters.concentrating_on + spells.material_item_id (H6)
│       └── 006_drop_deprecated_spell_columns.sql # DROP spells_known/cantrips_known (H6)
│                                  # (no hay 002: el seed es el script standalone seed_items.py)
│
└── .github/
    └── workflows/
        └── deploy-frontend.yml
```

> **Nota de limpieza:** No hay archivos vacíos "basura" — los `__init__.py` vacíos son marcadores de paquete Python necesarios. Sí existe **redundancia de Dockerfiles**: `Dockerfile` (raíz) y `api/Dockerfile` hacen prácticamente lo mismo con rutas distintas. Conviene conservar solo el que use Railway y borrar el otro para evitar confusión.

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
- **Configuración:** Miembros `#/members`, Catálogo `#/catalogue`, Catálogo de Hechizos `#/spellbook` | Event Log *(deshabilitado)*

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
campaign_status: 'planning' | 'active' | 'paused' | 'on_hiatus' | 'completed' | 'archived'  -- planning/on_hiatus añadidos en C1 (007)
quest_status:    'active' | 'completed' | 'failed' | 'abandoned'
location_type:   'city' | 'dungeon' | 'wilderness' | 'plane' | 'region' | 'poi'
npc_relationship:'ally' | 'enemy' | 'neutral' | 'unknown'
alignment_type:  'LG'|'NG'|'CG'|'LN'|'TN'|'CN'|'LE'|'NE'|'CE'
invite_status:   'pending' | 'accepted' | 'rejected'
item_type:       'weapon'|'armor'|'potion'|'spell_scroll'|'ring'|'rod'|'staff'|'wand'|
                 'wondrous'|'tool'|'ammunition'|'gear'|'treasure'|'vehicle'|'other'
spell_school:    'abjuration'|'conjuration'|'divination'|'enchantment'|
                 'evocation'|'illusion'|'necromancy'|'transmutation'   (Fase H1)
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
                     lore, cover_image_url, is_public, world_name, setting, start_date, end_date,
                     subtitle, tone TEXT[], themes TEXT[], start_level, current_level, target_end_level,
                     session_frequency, leveling_method (xp|milestone), ruleset (dnd_5e_2014|2024|homebrew),
                     house_rules JSONB, variant_rules TEXT[], banner_image_url)   -- Fase C1 (007)
campaign_members    (campaign_id, member_id PK, joined_at)

characters          (id, member_id→members, campaign_id→campaigns, name, race, subrace, class, subclass,
                     background, alignment::alignment_type, deity, level 1-20, xp, inspiration,
                     str, dex, con, int, wis, cha,
                     hp, max_hp, temp_hp, ac, initiative_bonus, speed, prof_bonus, passive_perception,
                     spell_slots JSONB (used), pact_magic JSONB (used), spellcasting_ability,
                     concentrating_on→spells (H6), conditions TEXT[], feats JSONB, saving_throws JSONB, skills JSONB,
                     portrait_url, backstory, personality_traits, ideals, bonds, flaws, notes,
                     active, created_at)
                     -- H6: eliminadas spells_known (JSONB) y cantrips_known (TEXT[]); repertorio en character_spells
character_currency  (character_id→characters PK, copper, silver, electrum, gold, platinum)
                     -- ⚠️ columnas reales: copper/silver/electrum/gold/platinum (NO pp/gp/ep/sp/cp)

adventures          (id, campaign_id→campaigns, title, description, sort_order, source (official|homebrew),
                     module_name, status (not_started|active|completed|abandoned), rec_level_min/max,
                     visible_to_players, dm_notes, created_at)   -- Fase C2 (008); arco entre campaña y sesión
sessions            (id, campaign_id→campaigns, adventure_id→adventures (C2), session_number AUTO, title,
                     date, duration_min, summary, highlights TEXT[], xp_awarded, milestone_level,
                     next_session_date, created_by→members)   -- milestone_level expuesto en Fase C1
session_attendance  (session_id, member_id PK, character_id→characters, present)

quests              (id, campaign_id→campaigns, adventure_id→adventures (C2), title, description,
                     status::quest_status, quest_type (main|side|personal|faction|fetch|escort|bounty, C2),
                     quest_giver_npc_id→npcs, reward_description, reward_xp, reward_gp, objectives JSONB
                     [{text,completed,optional}], visible_to_players (C2), notes, completed_at)
                     -- expuesta en Fase C2 (routers/quests.py); npcs/locations/factions siguen sin exponer

items               (id, name, description, type::item_type, rarity::item_rarity, weight, value_gp,
                     is_magical, is_consumable, requires_attunement, attunement_restriction,
                     damage_dice, damage_type, ac_base, source_book, source_page)
character_inventory (character_id, item_id PK, quantity, equipped, attuned, notes, custom_name)
campaign_treasury   (campaign_id, item_id PK, quantity, notes, updated_at)
campaign_currency   (campaign_id→campaigns PK, copper, silver, electrum, gold, platinum, updated_at)
                     -- ⚠️ columnas reales: copper/silver/electrum/gold/platinum (NO pp/gp/ep/sp/cp)

spells              (id, name (ES), name_en, level 0-9, school::spell_school, casting_time(_type),
                     range_text/type/feet, comp_verbal/somatic/material, material_description,
                     material_cost_gp, material_consumed, material_item_id→items (H6),
                     duration, concentration, ritual, description, higher_levels,
                     requires_attack_roll, saving_throw, damage_dice/type/scaling,
                     classes TEXT[] (GIN), source_book, dnd5eapi_index UNIQUE)      -- catálogo global (H1)
character_spells    (character_id→characters, spell_id→spells PK, is_prepared,
                     is_always_known, source, notes, added_at)                      -- repertorio (H1)

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

### Entorno local (Windows) — comandos de referencia
- **Python (usar SIEMPRE esta ruta en PowerShell):** `C:\Users\casal\AppData\Local\Programs\Python\Python312\python.exe`
  - Ej. migración: `C:\Users\casal\AppData\Local\Programs\Python\Python312\python.exe db/migrate.py 004_spells`
  - Ej. seed: `C:\Users\casal\AppData\Local\Programs\Python\Python312\python.exe db/seed_spells.py`
- **Git add + commit + push (una sola línea, sin saltos ni backticks):**
  - `git add -A; git commit -m "mensaje"; git push origin main`

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

## Sistema de Ítems — Fases I1–I6 ✅ COMPLETADA

Rediseño integral del manejo de ítems (ver `PLAN_MEJORAS_ITEMS.md`).

### Fase I1 — Saneamiento del modelo de datos
- [x] Eliminado `api/models/item.py` (modelo muerto/duplicado con `item_type` e `icon_url` inexistente)
- [x] `inventory_model.py` como única fuente: `ItemCreate/Update/Out` exponen TODAS las columnas del schema (armas, armaduras, cargas, `sentient/cursed`, `magical_properties`, refs SRD) con validación de enums
- [x] `create/update/list/get` de `/items` reescritos con INSERT/UPDATE dinámico y casts (`::item_type`, `::item_rarity`, `::jsonb`)
- [x] **Fix crítico:** `_character_select()` en `characters.py` estaba truncado (rompía todas las consultas de personajes)

### Fase I2 — Catálogo SRD + UI de ítem
- [x] `db/seed_items.py` — seeder idempotente (índice único `dnd5eapi_index` + `ON CONFLICT`), **216 ítems** de la guía (armas, armaduras, munición, herramientas, gear, pociones, pergaminos, venenos, monturas/vehículos, objetos mágicos)
- [x] Modal de detalle de ítem (daño/CA/propiedades) + modal crear/editar con campos condicionales por tipo
- [x] Filtro de tipos completo (rod, staff, wand, ammunition, vehicle)

### Fase I3 — Slots de equipo, sintonía y reglas de manos
- [x] Migración `003_equipment_slots.sql` — `character_inventory.slot`
- [x] Consolidados los endpoints de inventario en `inventory.py` (eliminados los duplicados de `characters.py`)
- [x] Reglas: 1 ítem por slot (anillos = 2 slots), arma a 2 manos bloquea off_hand, escudo vs 2 manos, **límite de sintonía = 3** (solo ítems que la requieren)
- [x] Frontend: selector de slot al equipar, contador "🔮 X/3", toggle de sintonía

### Fase I4 — Integración mecánica con la ficha
- [x] `api/services/character_mechanics.py` → `compute_combat`: CA efectiva con desglose, penalización de velocidad por FUE, desventaja de sigilo, ataques (FUE/DES según finesse/distancia + competencia + bonos mágicos)
- [x] `GET /api/v1/characters/{id}/combat` (derivado, no persiste)
- [x] Ficha: panel "Combate según equipo"

### Fase I5 — Economía
- [x] `api/services/economy.py` — conversión en cobre, peso de monedas (50 = 1 lb), capacidad de carga (FUE×15) y encumbramiento
- [x] `GET/PUT /characters/{id}/currency`, `POST /shop/buy`, `POST /shop/sell` (transaccionales)
- [x] Frontend: cartera editable, barra de carga, botones vender/comprar

### Fase I6 — Consumibles, cargas, packs y botín
- [x] `POST /inventory/{item_id}/use` (pociones de curación aplican PG con tirada), `/use-charge`, `/recharge`
- [x] `GET /packs` + `POST /characters/{id}/packs/{key}` — 4 packs de aventurero
- [x] `session_loot`: `GET/POST/DELETE /sessions/{id}/loot` + `POST .../award` (a personaje o tesoro)
- [x] Frontend inventario: botón Usar, control de cargas, selector de packs
- [x] Frontend sesiones: **tab "💎 Botín"** en el detalle — listar, añadir (DM/admin), otorgar a personaje o tesoro, eliminar

---

## Sistema de Hechizos — Fases H1–H6 (ver PLAN_MEJORAS_HECHIZOS.md)

Sistema de magia D&D 5e: catálogo administrable + equipar/preparar hechizos por clase/nivel/disponibilidad. Alcance acordado: **pragmático**. Seed: **SRD completo (~319)**.

### Fase H1 — Fundaciones de datos (backend) ✅ COMPLETADA
- [x] Migración `db/migrations/004_spells.sql`: enum `spell_school` (8 escuelas), tabla `spells` (catálogo global, anatomía completa: nivel, escuela, tiempo/alcance, componentes V/S/M, duración, concentración, ritual, descripción, upcasting, resolución ataque/salvación/daño, `classes TEXT[]`, refs SRD), tabla `character_spells` (repertorio: `is_prepared`, `is_always_known`, `source`). Índice GIN en `classes`, único en `dnd5eapi_index`.
- [x] `api/models/spell_model.py`: `SpellCreate/SpellUpdate/SpellOut` + `CharacterSpellAdd/CharacterSpellUpdate` con validadores (level 0–9, school, saving_throw ∈ {STR..CHA} normalizado a mayúsculas, classes ⊆ set canónico, source).
- [x] `api/routers/spells.py`: CRUD del catálogo `/api/v1/spells` — GET lista (filtros `search`, `level`, `school`, `class`, `ritual`, `concentration`), GET id, POST/PUT/DELETE **admin-only**. Cast `::spell_school`, `helpers.py`, `log_event`.
- [x] Router registrado en `api/main.py`.
- [x] `db/migrate_spells_known.py`: migración de datos (casa `spells_known`/`cantrips_known` existentes contra el catálogo → `character_spells`, idempotente). **Ejecutar DESPUÉS del seed de H2.**

**Claves canónicas de clase** (en `classes`): `bard, cleric, druid, paladin, ranger, sorcerer, warlock, wizard, eldritch_knight, arcane_trickster`. La ficha mapea el `class` en español a estas claves (pendiente H5).

**Nota de datos:** `characters.spells_known` (JSONB) y `cantrips_known` (TEXT[]) quedan como **respaldo deprecado**; se eliminan en H6 tras validar la migración. `spell_slots` y `pact_magic` se conservan (estado de recursos).

**⚠️ PENDIENTE DE DESPLIEGUE (H1):**
```powershell
# 1. Aplicar migración (desde PowerShell o Railway)
python db/migrate.py 004_spells
# 2. (Tras seed de H2) migrar datos existentes
python db/migrate_spells_known.py
# 3. Commit
git add db/migrations/004_spells.sql db/migrate_spells_known.py api/models/spell_model.py api/routers/spells.py api/main.py CLAUDE.md PLAN_MEJORAS_HECHIZOS.md
git commit -m "feat: H1 sistema de hechizos — schema, modelo, router CRUD catálogo"
git push origin main
```

### Fase H2 — Seed SRD completo + validación ✅ COMPLETADA (pendiente de ejecutar)
- [x] `db/seed_spells.py`: seeder idempotente (índice único `dnd5eapi_index` + `ON CONFLICT DO UPDATE`). Descarga la SRD 5.1 (OGL) una vez desde 5e-bits/dnd5eapi y la **cachea versionada** en `db/data/srd_spells.json` (Railway y re-ejecuciones NO requieren red). Modos `--dry-run` (QA sin BD) y `--refresh` (re-descarga).
- [x] `transform_spell()` (función pura): mapea el esquema dnd5eapi → columnas de `spells` (componentes V/S/M, tipo de tiempo/alcance derivados, `range_feet`, daño base por nivel/nivel-de-personaje, salvación, `requires_attack_roll` desde `attack_type`, clases filtradas al set canónico). Verificado con fireball / fire-bolt / detect-magic.
- [x] Nombres en **español** para el núcleo icónico (`SPANISH_NAMES`, ~90 hechizos); el resto usa el nombre inglés (`name_en` siempre poblado). Todo editable en el catálogo admin (H3).
- [x] `report()`: QA de conteos por nivel/escuela/clase, duplicados y enums inválidos.

**Nota de idioma:** las descripciones son el texto oficial SRD (inglés, OGL). Traducción de descripciones = pasada futura / edición manual en H3.

**⚠️ PENDIENTE DE DESPLIEGUE (H2) — desde PowerShell:**
`C:\Users\casal\AppData\Local\Programs\Python\Python312\python.exe db/seed_spells.py --dry-run` (revisar conteos) y luego `C:\Users\casal\AppData\Local\Programs\Python\Python312\python.exe db/seed_spells.py` (siembra). Después correr `db/migrate_spells_known.py` (migra repertorios existentes) y commitear también `db/data/srd_spells.json`.

### Fase H3 — Catálogo en menú Configuración ✅ COMPLETADA
- [x] `frontend/pages/spells.js`: página del catálogo (`export render`) — grid de tarjetas con color/ícono por escuela, meta rápida (tiempo/alcance/componentes), insignias (concentración, ritual, ataque, salvación, daño).
- [x] Filtros: búsqueda (nombre ES/EN), nivel (0–9), escuela, clase, ritual/concentración. Debounce en búsqueda.
- [x] **Modal de detalle** con toda la info de uso: nivel/escuela, tiempo, alcance, componentes + material, duración, salvación/ataque, daño, descripción (párrafos), "A niveles superiores", clases. Traductores ligeros de campos SRD (tCasting/tRange/tDuration).
- [x] **CRUD admin** (solo rol admin): modal crear/editar con todos los campos (incl. checkboxes de clases y componentes) → `POST/PUT/DELETE /api/v1/spells`; recarga tras guardar.
- [x] Ruta `#/spellbook` en `router.js` + entrada "📖 Catálogo de Hechizos" en el grupo **Configuración** de `NAV_GROUPS`.
- [x] Verificado con `node --check` (spells.js y router.js).

### Fase H4 — Servicio de conjuración + cálculos ✅ COMPLETADA
- [x] `api/services/spellcasting.py` (lógica pura): `class_key()` mapea `characters.class` (ES/EN + subclase para EK/AT) → clave canónica; tablas de ranuras full/half/third/pact (documento §3); `spell_save_dc`/`spell_attack_bonus`; `spell_slots_for`/`pact_slots_for`; `max_cantrips`/`max_spells_known`/`max_spells_prepared`/`max_spell_level`; `cantrip_dice_count`; `can_learn(spell, key, level)` (disponibilidad por lista de clase + nivel); `compute_spellcasting(char)`.
- [x] `GET /api/v1/characters/{id}/spellcasting` (en `characters.py`): estado derivado (no persiste); fusiona los totales calculados con el `used` guardado en `characters.spell_slots`.
- [x] Verificado con tests de reglas: Mago N5 INT16 → CD14/+6/[4,3,2]/máx3/prep8; Mago N1 (ejemplo doc) → CD13/+5; Brujo N5 → pacto 2×N3/conocidos6; Paladín N1 no lanza, N5 [4,2]/prep5; Caballero Arcano N7 → [4,2]; `can_learn` por clase/nivel; escalado de trucos 1/2/3/4.

**Mapa de clase ES→canónica** (en `class_key`): mago→wizard, clérigo→cleric, druida→druid, paladín→paladin, explorador→ranger, bardo→bard, hechicero→sorcerer, brujo→warlock; Guerrero/Pícaro solo lanzan si su subclase es Caballero Arcano / Pícaro Arcano.

### Fase H5 — Equipar/preparar hechizos en la ficha ✅ COMPLETADA
- [x] **Backend** (`spells.py`): repertorio del personaje — `GET/POST/PUT/DELETE /api/v1/characters/{id}/spells`. POST valida disponibilidad (`can_learn`) + límites (trucos/conocidos); PUT `is_prepared` valida límite de preparados (modelo preparado, nivel ≥1); autorización dueño/DM/admin; `log_event`. Modelos `CharacterSpellAdd/Update`.
- [x] **Frontend** (`characters.js`, pestaña Hechizos reescrita, lazy-load): cabecera con característica, CD, ataque y nivel máx; contadores Trucos/Preparados/Conocidos; panel de ranuras (o Pact Magic); repertorio agrupado por nivel con detalle expandible (tiempo/alcance/duración/material/descripción/upcasting), toggle "Preparado" (modelo preparado) y quitar.
- [x] **Modal "Añadir hechizo"**: busca en el catálogo filtrado por clase (`class=sc.class_key`) y nivel ≤ `max_spell_level` (+ trucos); POST al repertorio con mensajes de límite desde el backend.
- [x] Verificado: `node --check` en `characters.js`; contrato endpoints↔frontend alineado.

**Nota:** `characters.spell_slots` sigue guardando el estado `used`; el endpoint `/spellcasting` fusiona totales calculados con ese `used`. La columna `characters.spells_known` (JSONB) queda deprecada (se elimina en H6).

### Fase H6 — Refinamientos mecánicos + limpieza ✅ COMPLETADA
Alcance: ranuras+descansos, concentración, rituales+upcasting asistido, **coste de componentes** y **limpieza de columnas deprecadas**.
- [x] Migración `006_drop_deprecated_spell_columns.sql`: elimina `characters.spells_known` (JSONB) y `cantrips_known` (TEXT[]); el repertorio vive en `character_spells`. `db/migrate_spells_known.py` queda como referencia histórica (obsoleto).
- [x] **Estética de fichas** (`characters.js`): el retrato del personaje cubre el 100% de la tarjeta (fondo) y el bloque de datos (nombre, clase, HP, características) usa un panel con `backdrop-filter: blur` para legibilidad sobre la imagen.
- [x] Migración `005_spellcasting_state.sql`: `characters.concentrating_on UUID` (→spells) y `spells.material_item_id UUID` (→items, ítem consumible enlazado).
- [x] **Backend** (`spells.py`): `POST /characters/{id}/cast` (gasta ranura o pacto, **upcasting** con `slot_level`, **ritual** sin ranura, fija **concentración** reemplazando la previa, **consume el componente** enlazado y bloquea si falta), `POST /characters/{id}/rest` (corto=pacto, largo=todo+concentración), `PUT /characters/{id}/concentration`, `POST /characters/{id}/spell-slots/restore`. Modelos `SpellCastRequest/RestRequest/ConcentrationSet`.
- [x] `/spellcasting` ahora incluye `concentrating_on` y el `used` de pacto.
- [x] **Seeder**: `transform_spell` parsea `material_cost_gp` y `material_consumed` desde el texto del material SRD (regex "worth [at least] X gp" + "consumes"). `COLUMNS` actualizado. **Requiere re-ejecutar el seed** para poblar esos campos.
- [x] **Frontend ficha** (`characters.js`): banner de concentración con "Terminar", botones de descanso corto/largo, restaurar ranura (↺), y botón **✦ Lanzar** por hechizo con selector de nivel (upcasting), opción ritual, y avisos de escalado/componente/concentración.
- [x] **Frontend catálogo** (`spells.js`): el editor admin permite fijar coste, marcar "se consume" y **enlazar el ítem consumible** (buscador del catálogo) para activar el bloqueo/consumo.
- [x] Verificado: `node --check` (characters.js, spells.js); parse de `spells.py`/`characters.py`/`seed_spells.py`; lógica de `_material_cost` (5 casos); `sqlglot` en `005`.

**Nota de componentes:** el bloqueo/consumo se activa **por hechizo** al enlazar su ítem consumible en el editor (admin). Sin enlace, un hechizo con componente costoso solo muestra un aviso no bloqueante.

**⚠️ PENDIENTE DE DESPLIEGUE (H6) — desde PowerShell:**
```
C:\Users\casal\AppData\Local\Programs\Python\Python312\python.exe db/migrate.py 005_spellcasting_state
C:\Users\casal\AppData\Local\Programs\Python\Python312\python.exe db/seed_spells.py
C:\Users\casal\AppData\Local\Programs\Python\Python312\python.exe db/migrate.py 006_drop_deprecated_spell_columns
```
Luego `git add -A; git commit -m "feat: H6 lanzamiento/descansos/concentración/upcasting + coste de componentes + limpieza"; git push origin main`.

---

## Sistema de Campañas — Fases C1–C7 (ver PLAN_MEJORAS_CAMPAÑAS.md)

Rediseño integral de la gestión de campañas basado en `guides/dnd5e_campaigns_guide.md`: jerarquía narrativa, mundo vivo (NPCs/localizaciones/facciones/misiones ya existen en el schema sin exponer), balanceo de encuentros, progresión y visibilidad DM/jugador.

### Fase C1 — Ficha de campaña/sesión enriquecida ✅ COMPLETADA (pendiente de desplegar)
- [x] Migración `db/migrations/007_campaign_metadata.sql` — `ALTER TYPE campaign_status ADD VALUE 'planning'/'on_hiatus'` (idempotente); metadatos de campaña (`subtitle`, `tone[]`, `themes[]`, `start_level`, `current_level`, `target_end_level`, `session_frequency`, `leveling_method`, `ruleset`, `house_rules JSONB`, `variant_rules TEXT[]`, `banner_image_url`); CHECK de niveles (guía §17.3).
- [x] Modelos: `CampaignCreate/Update/Out` amplían todos los campos con validadores (niveles 1–20, `leveling_method`, `ruleset`, `session_frequency`, `status`); `SessionCreate/Update/Out` exponen `milestone_level` (B2).
- [x] Router `campaigns.py`: INSERT dinámico con casts (`::campaign_status`, `::jsonb`), UPDATE con cast de `house_rules::jsonb` y **validación de transición de estado** (`_STATUS_TRANSITIONS`, B5). `sessions.py`: `milestone_level` en INSERT y proyección de `list_sessions`.
- [x] Frontend `campaigns.js`: modal con secciones **Progresión** (niveles, método) y **Sistema y reglas** (ruleset, frecuencia, tono/temas/variantes, editor simple de reglas caseras); estados `planning`/`on_hiatus` en filtros y badges; card muestra subtítulo, rango de nivel y chips de tono/tema; corregido bug de descripción duplicada.
- [x] Verificado: `node --check` (lógica JS), `ast.parse` (modelos/routers), INSERT 25 columnas = 25 placeholders. Doc de moneda corregida (columnas reales `copper/silver/electrum/gold/platinum`).

**⚠️ PENDIENTE DE DESPLIEGUE (C1) — desde PowerShell:**
```
C:\Users\casal\AppData\Local\Programs\Python\Python312\python.exe db/migrate.py 007_campaign_metadata
```
Luego `git add -A; git commit -m "feat: C1 metadatos de campaña + estados + milestone_level + validación de transición"; git push origin main`.

### Fase C2 — Jerarquía narrativa: Aventuras + Misiones ✅ COMPLETADA (pendiente de desplegar)
- [x] Migración `db/migrations/008_adventures.sql` — tabla `adventures` (arco entre campaña y sesión; `status`/`source` VARCHAR validados en Pydantic, CHECK de niveles); `sessions.adventure_id`; en `quests` añade `adventure_id`, `quest_type`, `visible_to_players`.
- [x] Modelos `adventure.py` (Create/Update/Out) y `quest.py` (Create/Update/Out + `QuestObjective`) con validadores (status/source/quest_type, niveles 1–20).
- [x] Routers `adventures.py` y `quests.py` bajo `/api/v1/campaigns/{id}/adventures|quests` — CRUD; **crear/editar/eliminar solo DM de la campaña o admin**; filtro `visible_to_players` + strip de `dm_notes` para jugadores (guía §17 regla 4). `objectives` JSONB parseado en el router (la BD no tiene codec JSONB → llega como str; mismo patrón que `characters`/`inventory`). `completed_at` se sincroniza con `status`. Registrados en `main.py`.
- [x] `sessions.py` + `session_model.py`: `adventure_id` en INSERT, proyección de lista y modelos.
- [x] Frontend: nueva página `frontend/pages/quests.js` (`#/quests`) — selector de campaña, sección Aventuras (CRUD) y sección Misiones (CRUD con editor de objetivos, tipo, recompensas, visibilidad). Nav "⚔️ Aventuras & Misiones" habilitado en `router.js`. Selector de aventura añadido al modal de sesión (`sessions.js`).
- [x] **Fix C1 relacionado:** `campaigns.house_rules` (JSONB) también se parsea ahora en el router (`_hydrate`) — sin esto, el modal de edición fallaba al hacer `.map` sobre un string.
- [x] Verificado: `ast.parse` de modelos/routers nuevos; `node --check` de `quests.js`/`sessions.js`/`router.js`/`campaigns.js`; conteos INSERT (adventures 12/12, quests 14 params + `completed_at` literal, sessions 13/13).

**⚠️ PENDIENTE DE DESPLIEGUE (C2) — desde PowerShell:**
```
C:\Users\casal\AppData\Local\Programs\Python\Python312\python.exe db/migrate.py 008_adventures
```
Luego `git add -A; git commit -m "feat: C2 aventuras/arcos + misiones (quests) con visibilidad DM/jugador"; git push origin main`.

### Fases C3–C7 — Pendientes
Ver `PLAN_MEJORAS_CAMPAÑAS.md`: C3 NPCs/localizaciones/facciones · C4 bitácora + progresión · C5 bestiario + encuentros + balanceo · C6 combat tracker · C7 recompensas/mapas/visibilidad.

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
