# DnD Community Manager

Aplicación web de gestión para una comunidad de **Dungeons & Dragons 5e**: personajes, campañas, sesiones, **gestión de mesa para el DM** (aventuras, misiones, mundo vivo, encuentros con balanceo del DMG, combate en vivo y trama), inventario/economía, **hechizos** y comunidad, con mecánicas fieles al PHB/DMG.

- **Frontend:** SPA estática (HTML + Vanilla JS con ES Modules, sin build step) servida por **GitHub Pages**.
- **Backend:** **FastAPI** (Python 3.11+) desplegado en **Railway**.
- **Base de datos:** **PostgreSQL 15** en Aiven. **Mensajería:** Apache Kafka en Aiven.
- **Auth:** JWT (python-jose) + bcrypt.

Repo: https://github.com/JuanKCasal/DnD

---

## Índice

1. [Autenticación y roles](#1-autenticación-y-roles)
2. [Dashboard](#2-dashboard)
3. [Miembros](#3-miembros)
4. [Campañas](#4-campañas)
5. [Personajes](#5-personajes)
6. [Sesiones, bitácora y botín](#6-sesiones-bitácora-y-botín)
7. [Aventuras y misiones](#7-aventuras-y-misiones)
8. [Mundo vivo: NPCs, localizaciones y facciones](#8-mundo-vivo-npcs-localizaciones-y-facciones)
9. [Encuentros y bestiario](#9-encuentros-y-bestiario)
10. [Rastreador de combate](#10-rastreador-de-combate)
11. [Trama: arcos, giros y recompensas](#11-trama-arcos-giros-y-recompensas)
12. [Sistema de ítems e inventario](#12-sistema-de-ítems-e-inventario)
13. [Economía](#13-economía)
14. [Sistema de hechizos y magia](#14-sistema-de-hechizos-y-magia)
15. [Navegación de la app](#15-navegación-de-la-app)
16. [Referencia de API](#16-referencia-de-api)
17. [Desarrollo local y despliegue](#17-desarrollo-local-y-despliegue)
18. [Estado del proyecto](#18-estado-del-proyecto)

---

## 1. Autenticación y roles

- **Login** con usuario/contraseña → JWT guardado en `localStorage` (`dnd_token`); datos de usuario en `dnd_user`.
- **Registro** de nuevos miembros.
- Tres roles: **admin**, **dm** (dungeon master), **player**. Las rutas y acciones se protegen por rol tanto en frontend (guards) como en backend (`require_role`).

| Acción | Admin | DM | Player |
|--------|:---:|:---:|:---:|
| Gestionar miembros | ✅ | ❌ | ❌ |
| Crear/editar campaña | ✅ | ✅ (la suya) | ❌ |
| Registrar sesión | ✅ | ✅ (su campaña) | ❌ |
| Crear/editar/eliminar personaje | ✅ | ✅ | ✅ (el propio) |
| Modificar tesoro / botín de campaña | ✅ | ✅ (su campaña) | ❌ |
| Gestionar inventario/moneda de un PJ | ✅ | ✅ | ✅ (el propio) |
| Catálogo de ítems (crear/editar/borrar) | ✅ | ✅ crear | ❌ |
| Catálogo de hechizos (crear/editar/borrar) | ✅ | ❌ | ❌ |
| Equipar/preparar/lanzar hechizos de un PJ | ✅ | ✅ | ✅ (el propio) |
| Aventuras, misiones, mundo, encuentros, combate, trama | ✅ | ✅ (su campaña) | 👁️ solo contenido visible |

> **Visibilidad DM/jugador:** el contenido secreto (notas del DM, secretos/motivaciones de NPCs, localizaciones no descubiertas, encuentros y giros ocultos) se **filtra en el backend** según el rol, no solo se oculta en la UI.

---

## 2. Dashboard

Página de inicio con **5 estadísticas de comunidad en tiempo real** (miembros, personajes, campañas, sesiones, etc.).

---

## 3. Miembros

- Grid de tarjetas de miembros.
- Creación de miembros (admin).
- Edición de **rol** y estado **activo/inactivo** (admin).
- Seguimiento de XP de miembro (sesiones asistidas, etc.).

---

## 4. Campañas

- **CRUD completo** con tarjetas animadas.
- **Identidad:** nombre, subtítulo, DM, sistema, descripción, lore, mundo/ambientación, banner, fechas, tono y temas (chips).
- **Estados** (máquina de estados): `planning` · `active` · `paused` · `on_hiatus` · `completed` · `archived`, con **validación de transición** en el backend.
- **Progresión:** nivel inicial/actual/objetivo y **método de subida** (`xp` o `milestone`).
- **Sistema y reglas de mesa:** edición de reglas (`dnd_5e_2014/2024/homebrew`), frecuencia de sesiones, **reglas variantes** y editor de **reglas caseras** (house rules).
- Miembros de campaña y **tesoro** propio (ítems + monedas) — ver §12–13.

---

## 5. Personajes

Ficha completa de D&D 5e con creación/edición en un **modal de 5 pestañas**:

- **General:** identidad (raza, subraza dinámica, clase, trasfondo, alineamiento, deidad, nivel, campaña, retrato), combate (HP, CA, velocidad…), 6 puntuaciones de característica, personalidad e historia.
- **Habilidades:** tiradas de salvación deterministas por clase (PHB) y 18 habilidades con competencias (trasfondo/raza bloqueadas, clase con checkboxes limitados).
- **Hechizos:** parámetros de conjuración, ranuras y repertorio completo — ver §14.
- **Rasgos:** personalidad, ideales, vínculos, defectos, trasfondo, notas, dotes.
- **🎒 Inventario:** ítems del personaje con equipar/desequipar y quitar (ver §12).

Funciones adicionales: tarjetas con retrato a pantalla completa (glassmorphism), editar/eliminar (soft-delete), subir de nivel (evento Kafka `dnd.characters.leveled_up`), editar HP, y el **panel "Combate según equipo"** (CA efectiva, velocidad, sigilo y ataques calculados vía `GET /characters/{id}/combat`, sin persistir).

---

## 6. Sesiones, bitácora y botín

- **CRUD de sesiones** con numeración automática por campaña, vinculación a una **aventura** (§7) y eliminación.
- Vista **timeline** con tarjetas y filtro por campaña.
- **Panel de progresión** al filtrar por campaña: nivel actual, XP acumulado del grupo, barra al siguiente nivel, BPC y **sugerencia de subida** (método XP o hitos, guía §14).
- Detalle en **modal con pestañas**:
  - **📖 Crónica** en markdown (marked.js), con **cliffhanger** y **recap de la sesión anterior** (`GET /sessions/{id}/recap`).
  - **⭐ Highlights**.
  - **👥 Asistencia** — presentes/ausentes y XP por miembro.
  - **💎 Botín** — el DM añade ítems del catálogo y los **otorga a un personaje o al tesoro** de campaña.
- **Bitácora del DM:** notas de preparación privadas y `milestone_level`.
- Evento Kafka `dnd.sessions.created` al crear una sesión.

---

## 7. Aventuras y misiones

Jerarquía narrativa **Campaña → Aventura → Sesión** (guía §1) — página **#/quests** ("⚔️ Aventuras & Misiones").

- **Aventuras / arcos** (CRUD DM): título, descripción, orden, fuente (oficial/homebrew), módulo, estado, rango de nivel recomendado, notas del DM y visibilidad. Cada sesión puede pertenecer a una aventura.
- **Misiones (quests)** (CRUD DM): tipo (principal/secundaria/personal/facción/recadero/escolta/recompensa), estado, aventura, dador (NPC), recompensas (XP, po, descripción), **objetivos** con checklist (opcionales incluidos) y visibilidad para jugadores.

---

## 8. Mundo vivo: NPCs, localizaciones y facciones

Página **#/world** ("🌍 Compendio") con pestañas y CRUD (escritura solo DM/admin, guía §9):

- **NPCs:** raza/clase/rol, relación, actitud, localización y facción, retrato; **contenido del DM** separado (motivación, secreto, notas, `stat_block`) y flag *oculto a jugadores*.
- **Localizaciones:** jerarquía padre/hijo, tipo, mapa, notas del DM y `is_discovered` (gatea la visibilidad).
- **Facciones:** objetivos, alineamiento, líder, escala de reputación; reputación por personaje.

Los jugadores solo reciben NPCs no ocultos (sin campos secretos) y localizaciones descubiertas — **filtrado en el backend**.

---

## 9. Encuentros y bestiario

Página **#/encounters** ("🐉 Encuentros") con las **matemáticas de balanceo del DMG** (guía §12).

- **Bestiario:** monstruos **SRD globales** (22 curados vía `db/seed_monsters.py`) + **homebrew** por campaña (CRUD con CR→XP automático, características, CA/HP, etc.).
- **Constructor de encuentros:** selector de monstruos del bestiario con cantidades y **dificultad en vivo** (`POST /campaigns/{id}/encounters/preview-difficulty`): XP base, XP ajustado por multiplicador, umbrales del grupo y clasificación **trivial → mortal**, con avisos de letalidad y de *action economy*.
- El **XP de recompensa usa el XP base** (no el ajustado), como indica el DMG.

---

## 10. Rastreador de combate

Overlay de combate en vivo (botón **⚔️ Combatir** en cada encuentro, guía §15.3–§15.4):

- **Iniciar** auto-puebla los **monstruos** del encuentro (cada instancia con HP propio) y los **personajes** de la campaña, con **iniciativa tirada 1d20 + DES**.
- Lista ordenada por iniciativa con el **turno activo resaltado** y contador de **ronda** (con salto de ronda al completar la vuelta).
- Por combatiente: **daño/curación** (HP no negativo), **14 condiciones** (añadir/quitar), **agotamiento** (0–6), **concentración** y eliminación.

---

## 11. Trama: arcos, giros y recompensas

Página **#/narrative** ("🎭 Trama"), herramienta de planificación del DM (guía §7, §13):

- **Arcos argumentales:** tipo, estado, **beats** (momentos clave con checklist), visibilidad y notas.
- **Giros argumentales (plot twists):** **dm_only** por defecto — los jugadores solo ven los marcados como **revelados**; incluyen pistas sembradas, condición de revelación e impacto, con toggle **Revelar/Ocultar**.
- **Guía de recompensas por nivel:** tesoro acumulado (hoard) vs. individual y rareza de objetos mágicos por tier (`GET /campaigns/{id}/treasure-guidance`).

---

## 12. Sistema de ítems e inventario

Catálogo SRD completo y mecánicas de equipo fieles a 5e. El catálogo se puebla con **216 ítems** mediante `db/seed_items.py` (armas, armaduras, munición, herramientas, equipo, pociones, pergaminos, venenos, monturas/vehículos y objetos mágicos).

La página de inventario tiene **tres modos** según la ruta:

### `#/inventory` — Inventario del jugador
- Selector de personaje + **cartera** y **barra de carga** (ver §13).
- Lista **Equipado / Mochila**, **equipar** con selector de **ranura** y reglas de manos, **sintonía** (límite 3, contador "🔮 X/3").
- **Usar** consumibles (pociones aplican PG), **cargas** (usar/recargar), **vender** (50%) y **comprar** desde el catálogo, y **🎒 packs de aventurero**.

### `#/treasury` — Tesoros de campaña (DM/admin)
- Ítems y **monedas** del grupo por campaña.

### `#/catalogue` — Catálogo de la comunidad (admin)
- Búsqueda/filtros, **detalle** mecánico y **CRUD** con campos condicionales por tipo.

Cada ítem soporta: tipo, rareza, peso, valor, flags, cargas, bloque de arma, bloque de armadura, `magical_properties` (JSONB) y referencias SRD.

---

## 13. Economía

- **Moneda del personaje** (pp/po/pe/pa/pc) editable, con conversión interna en piezas de cobre.
- **Peso de monedas** (50 = 1 lb) y **capacidad de carga** (FUE × 15) con **encumbramiento** (barra).
- **Tienda** transaccional (comprar/vender) y **moneda de campaña** en el tesoro.

---

## 14. Sistema de hechizos y magia

Sistema completo de conjuración D&D 5e (Fases H1–H6), fiel al PHB.

### Catálogo de hechizos — `#/spellbook` (menú Configuración)
- **319 hechizos de la SRD 5.1** (`db/seed_spells.py`, cachea `db/data/srd_spells.json`), nombres en español.
- Grid con color/ícono por **escuela**, filtros (nombre, nivel, escuela, clase, ritual/concentración), **detalle** completo y **CRUD admin** (incluye enlace a ítem consumible como componente material).

### Parámetros y repertorio en la ficha (pestaña Hechizos)
- Estado de conjuración **calculado** (`GET /characters/{id}/spellcasting`): característica, **CD**, **ataque**, nivel máx y contadores de trucos/preparados/conocidos.
- **Espacios** (o **Pact Magic**), **repertorio** por nivel, **añadir** desde el catálogo filtrado por clase/nivel, **preparar** con límites.

### Lanzamiento y estado (Fase H6)
- **✦ Lanzar** (gasta ranura), **upcasting** asistido, **rituales** sin ranura, **concentración** única, **descansos** (corto/largo) y **coste de componentes** (bloquea/consume el ítem enlazado).

Reglas en `api/services/spellcasting.py`; catálogo y repertorio en `api/routers/spells.py`.

---

## 15. Navegación de la app

Barra superior horizontal con mega-menú (`max-width: 1300px`):

- **Dashboard** → `#/dashboard`
- **Mi DnD:** Personajes `#/characters`, Inventario del jugador `#/inventory`
- **Juego:** Campañas `#/campaigns`, Sesiones `#/sessions`, Tesoros `#/treasury`, Aventuras & Misiones `#/quests`, Encuentros `#/encounters`, Trama `#/narrative`, Compendio `#/world`
- **Comunidad:** Chat `#/chat`, Calendario & Eventos `#/calendario`, Clanes `#/clanes`, Salón de la Fama `#/fama`
- **Configuración:** Miembros `#/members`, Catálogo `#/catalogue`, Catálogo de Hechizos `#/spellbook`
- Cada usuario elige su **personaje activo** en la barra superior: es su identidad social en el chat y los clanes.
- *Próximamente (deshabilitados):* Noticias, Perfil, Event Log.

---

## 16. Referencia de API

Base: `/api/v1`. Respuestas: lista `{"data":[...], "meta":{...}}`, ítem `{"data":{...}}`, error `{"error":{"code","message"}}`.

| Recurso | Endpoints principales |
|--------|----------------------|
| Auth | `POST /auth/login`, `POST /auth/register` |
| Members | `GET/POST/PUT /members` |
| Campaigns | `GET/POST/PUT/DELETE /campaigns` + `/treasury` + **`/progression`** |
| Adventures | `GET/POST/PUT/DELETE /campaigns/{id}/adventures` |
| Quests | `GET/POST/PUT/DELETE /campaigns/{id}/quests` |
| Worldbuilding | `GET/POST/PUT/DELETE /campaigns/{id}/{locations\|npcs\|factions}` + `/factions/{id}/reputation` |
| Bestiary | `GET/POST/PUT/DELETE /campaigns/{id}/bestiary` |
| Encounters | `GET/POST/PUT/DELETE /campaigns/{id}/encounters` + `POST …/preview-difficulty` |
| Combat | `/campaigns/{id}/encounters/{eid}/combat` (`GET`, `/start`, `/next-turn`, `/combatants`, `DELETE`) |
| Narrative | `GET/POST/PUT/DELETE /campaigns/{id}/arcs` · `/plot-twists` · `GET /treasure-guidance` |
| Characters | `GET/POST/PUT/DELETE /characters`, `/hp`, `/conditions`, `/spell-slots`, **`/combat`**, **`/spellcasting`** |
| Char. inventory | `GET/POST/PUT/DELETE /characters/{id}/inventory` |
| Char. economía | `GET/PUT /characters/{id}/currency`, `POST /shop/buy`, `POST /shop/sell` |
| Sessions | `GET/POST/PUT/DELETE /sessions` + `/attendance` + **`/recap`** |
| Session loot | `GET/POST/DELETE /sessions/{id}/loot`, `POST /sessions/{id}/loot/{loot}/award` |
| Items / Spells | `GET/POST/PUT/DELETE /items` · `/spells` (mutaciones admin) |
| Repertorio / Conjuración | `/characters/{id}/spells`, `/cast`, `/rest`, `/concentration`, `/spell-slots/restore` |
| Personaje activo | `GET/PUT /me/active-character` |
| Chat | `GET/POST /chat/rooms`, `GET/POST /chat/rooms/{id}/messages`, `GET /chat/dm`, `GET/POST /chat/dm/{characterId}` |
| Comunidad (muros) | `GET/POST/PUT/DELETE /community/posts` + `/comments`, `/react` |
| Clanes | `GET/POST/PUT /clans` + `/invite` `/join` `/{id}/members` |
| Salón de la Fama | `GET/POST/DELETE /hall/awards`, `GET /hall/leaderboard`, `POST /hall/ratings`, `GET /hall/dm-ratings` |
| Otros (backend listo) | `/ranks`, `/events` |

Docs interactivas: `/api/docs`.

---

## 17. Desarrollo local y despliegue

```bash
# Backend
cd api && uvicorn api.main:app --reload --port 8000     # http://localhost:8000/api/docs

# Frontend
cd frontend && python -m http.server 3000

# Migraciones (requiere .env con DATABASE_URL y certs/ca.pem) — ejecutar en orden
python db/migrate.py                          # 001 schema inicial
python db/migrate.py 003_equipment_slots
python db/migrate.py 004_spells
python db/migrate.py 005_spellcasting_state
python db/migrate.py 006_drop_deprecated_spell_columns
python db/migrate.py 007_campaign_metadata    # C1
python db/migrate.py 008_adventures           # C2
python db/migrate.py 009_worldbuilding_fields # C3
python db/migrate.py 010_session_log          # C4
python db/migrate.py 011_bestiary_encounters  # C5
python db/migrate.py 012_combat_tracker       # C6
python db/migrate.py 013_narrative_rewards    # C7
python db/migrate.py 014_community_identity   # CM1 (clanes por personaje)
python db/migrate.py 015_community_rooms      # CM2 (salas globales de chat)
python db/migrate.py 016_community_walls      # CM4 (muros community_posts)
python db/migrate.py 017_awards_ratings       # CM6 (premios + valoración DMs)

# Seeds (idempotentes)
python db/seed_items.py      # 216 ítems SRD
python db/seed_spells.py     # 319 hechizos SRD (cachea db/data/srd_spells.json)
python db/seed_monsters.py   # 22 monstruos SRD (usa db/data/srd_monsters.json; --dry-run para validar)

# Utilidades
python reset_admin.py        # resetear password de admin
python fix_alignments.py     # normalizar alignment a enums (one-off)
```

> En Windows/PowerShell, usar la ruta completa del intérprete, p. ej.:
> `C:\Users\casal\AppData\Local\Programs\Python\Python312\python.exe db/migrate.py 007_campaign_metadata`

**Despliegue:** frontend por GitHub Actions a GitHub Pages (`deploy-frontend.yml`); backend en Railway vía Docker. Los secretos (`.env`, `certs/`) están en `.gitignore` y **no se versionan**.

> ⚠️ Existen dos Dockerfiles (`Dockerfile` en raíz y `api/Dockerfile`) que hacen casi lo mismo. Conviene conservar solo el que use Railway.

---

## 18. Estado del proyecto

**Completado:** Auth, Dashboard, Miembros, Personajes (ficha completa + combate calculado), el **sistema de ítems integral (I1–I6)**, el **sistema de hechizos integral (H1–H6)** y el **sistema de campañas integral (C1–C7)**:

- **C1** metadatos, estados y progresión de campaña · **C2** aventuras + misiones · **C3** mundo vivo (NPCs/localizaciones/facciones) · **C4** bitácora de sesión (prep/cliffhanger/recap) + progresión XP/hitos · **C5** bestiario + encuentros + calculadora de dificultad del DMG · **C6** rastreador de combate (iniciativa/HP/condiciones/concentración) · **C7** arcos/giros + guía de recompensas, con visibilidad DM/jugador filtrada en el backend.

Y el **sistema de comunidad integral (CM1–CM6)**:

- **CM1** identidad de personaje activo + visibilidad de canales + clanes por personaje · **CM2** chat multi-canal (con provisión automática de salas por campaña/clan, entrega en vivo por polling, IC/OOC, `/roll`, susurros) · **CM3** canales de sistema (Saludos + notificaciones de Fama) · **CM4** Calendario & Eventos (muro de Admin/DM) · **CM5** Clanes como muro social (posts, imágenes, ítems, comentarios) · **CM6** Salón de la Fama (premios a personajes + valoración de DMs + ranking).

**Backend listo, frontend pendiente:** Rangos, Event Log, perfil de usuario.

**Pendiente / futuro:** mapas y tokens de batalla (canvas táctico), dice roller flotante global, consumer Kafka → Discord.

Ver `CLAUDE.md` para detalles técnicos y los planes por fases: `PLAN_MEJORAS_ITEMS.md` (ítems), `PLAN_MEJORAS_HECHIZOS.md` (hechizos), `PLAN_MEJORAS_CAMPAÑAS.md` (campañas) y `PLAN_MEJORAS_COMUNIDAD.md` (comunidad).
