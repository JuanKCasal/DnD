# Plan de Implementación — Sistema de Comunidad (Chat, Calendario & Eventos, Clanes, Salón de la Fama)

> **Estado:** Propuesta · **Fecha:** 2026-07-02
> **Base:** Análisis de cómo funcionan las comunidades de D&D + los requisitos del usuario + el schema v2.0 (las tablas de chat, clanes, rangos y `event_log` **ya existen sin frontend**).
> **Objetivo:** Convertir la app en una **comunidad viva**: un chat multi-canal donde **hablas como personaje** (no como usuario), muros sociales para eventos y clanes, y un Salón de la Fama con premios y valoración de DMs. Es la contraparte "social" del sistema de mesa (campañas C1–C7).

---

## 0. Análisis: cómo funcionan las comunidades de D&D

Las comunidades de D&D (servidores de Discord, foros play-by-post, gremios, campañas West Marches) comparten patrones que conviene replicar:

1. **Separación In-Character (IC) vs Out-of-Character (OOC).** La "taberna" y los canales de mesa son IC: escribes **como tu personaje**. Los canales OOC (organización, dudas, memes) son como uno mismo. Esta distinción es el corazón del roleo por texto y ya está prevista en el schema (`chat_rooms.is_ic`, `chat_messages.character_id`).
2. **Canales segmentados por pertenencia.** Un servidor típico tiene: `#anuncios` (solo staff), `#general/taberna`, canales **por mesa/campaña** (solo sus jugadores), canales **por gremio/clan**, y **mensajes directos/susurros**. La visibilidad depende de a qué grupos perteneces.
3. **Mundo compartido y gremios (West Marches / guilds).** Los jugadores se agrupan en clanes/gremios que funcionan como **micro-comunidades**: comparten logros, botín, lore y organización. En redes modernas esto se siente como un **muro social**.
4. **Reconocimiento y recompensa.** Las comunidades sanas celebran proezas: subidas de nivel, jefes derrotados, "MVP de la sesión", objetos legendarios. El **Salón de la Fama** y los premios refuerzan la retención.
5. **Aprecio al DM.** El DM sostiene la mesa; darle **feedback/valoración** cierra el ciclo y ayuda a otros jugadores a elegir aventuras.
6. **Ritmo e información.** Un **muro de eventos/calendario** mantiene a todos al día (próximas sesiones, torneos, anuncios).
7. **Identidad.** En comunidades de rol, tu identidad social ES tu personaje: avatar, nombre, clan. Cambiar de personaje cambia tu "cara" y tus accesos.
8. **Moderación y seguridad.** Solo el staff publica en anuncios; el contenido sensible se controla en el servidor, no solo en el cliente.

**Mapeo a los 4 pilares pedidos:**

| Pilar | Patrón de comunidad D&D que implementa |
|-------|----------------------------------------|
| **Chat** | Canales IC/OOC segmentados + susurros; identidad = personaje |
| **Calendario & Eventos** | Muro de anuncios/ritmo de la comunidad |
| **Clanes** | Gremios como muros sociales (compartir logros, ítems, fotos) |
| **Salón de la Fama** | Reconocimiento de proezas + aprecio al DM |

---

## 1. Diagnóstico — estado actual vs. lo requerido

### 1.1 Lo que YA existe (aprovechable)

| Área | Existe | Detalle |
|------|--------|---------|
| Chat — salas | ✅ schema + router | `chat_rooms` (`type`: general/clan/rank/campaign/dm_channel/ooc/announcements; `clan_id`, `campaign_id`, `rank_required_id`, `is_ic`, `is_readonly`, `icon`, `sort_order`). Router `chat.py`: `GET/POST /chat/rooms`. 5 salas sembradas (General, Taberna, Anuncios, Fuera de Mesa, Lore) |
| Chat — mensajes | ✅ schema + router | `chat_messages` (`member_id`+`character_id`, `message_type` ic/ooc/dice/emote/system/whisper, `dice_result`, `reply_to_id`, `attachments`, `mentions`, `is_pinned`, edit/delete). `GET/POST /chat/rooms/{id}/messages`, `DELETE /chat/messages/{id}` |
| Chat — susurros | ✅ schema + router | `chat_direct_messages` (character→character). `GET/POST /chat/dm/{to_character_id}` |
| Chat — presencia/reacciones | ✅ schema | `chat_room_presence` (no-leído por miembro), `chat_reactions` (por personaje) |
| Clanes | ✅ schema + router | `clans`, `clan_members` (**a nivel de miembro**), `clan_invitations`. `clans.py`: CRUD + invite/join/accept/reject + expulsar |
| Rangos / XP | ✅ schema | `ranks` (permisos JSONB, xp_threshold, color), `member_xp` (total_xp, sessions_attended, `messages_sent`) |
| Bitácora | ✅ schema + router | `event_log` (feed público con actor personaje/miembro) — fuente natural de notificaciones |
| Mensajería | ✅ Kafka | Tópicos `dnd.chat.message_sent`, `dnd.community.event`, `dnd.characters.leveled_up`, `dnd.sessions.created` (consumidor pendiente) |
| Personaje activo | ✅ columna | `members.active_character_id` — base para "hablar como personaje" |

### 1.2 Ausencias confirmadas (vs. los requisitos)

| # | Requisito | ¿Existe hoy? |
|---|-----------|--------------|
| G1 | **Frontend de comunidad** (Chat, Calendario, Clanes, Fama): las 4 rutas están **deshabilitadas** en el nav | No |
| G2 | **Hablar como PERSONAJE**, con la identidad y accesos cambiando según el personaje activo | Parcial. El mensaje guarda `character_id`, pero no hay "contexto de personaje activo" que gobierne identidad ni visibilidad |
| G3 | **Membresía de clan por personaje** ("si tienes personajes en distintos clanes…") | No. `clan_members` es por **miembro**, no por personaje |
| G4 | **Motor de visibilidad de canales** por afiliación del personaje activo (público/admin/rango/campaña/clan/fama) | Parcial. Hay columnas (`campaign_id`, `clan_id`, `rank_required_id`) pero el `GET /chat/rooms` no filtra por pertenencia real del personaje |
| G5 | **Canal "Anuncios y Eventos"** solo-admin | Parcial. Existe "Anuncios" `readonly`; falta forzar que **solo admin publique** y fusionar con eventos |
| G6 | **Canal "Saludos"** con mensajes del **sistema** (registros y personajes creados) | No |
| G7 | **Canal "Administradores"** (staff) | No (existe enum `dm_channel` sin sala ni gating de rol) |
| G8 | **Una sala de Campaña por cada campaña** — creación automática | No. La columna existe; nada crea la sala al crear la campaña |
| G9 | **Una sala de Clan por cada clan** — creación automática | No (igual que G8) |
| G10 | **Sala "Salón de la Fama"** con notificaciones de proezas/logros | No |
| G11 | **Canales privados estilo @WhatsApp** (lista de susurros) | Parcial (backend char↔char); falta la UX de bandeja/hilos |
| G12 | **Entrega "en vivo"** (los mensajes aparecen sin recargar) | No. Todo es REST puntual; sin polling/SSE ni websockets |
| G13 | **Calendario & Eventos = muro** de publicaciones de Admin/DM | No. Ninguna tabla de muro/publicaciones |
| G14 | **Clanes = muro social** (posts, fotos, comentarios, compartir ítems) | No. Los clanes existen pero sin feed social |
| G15 | **Salón de la Fama = premios a personajes** otorgados por Admin/DM | No |
| G16 | **Valoración de DMs** por los jugadores (calificar aventuras) | No |

### 1.3 Decisiones de arquitectura clave (a resolver en el plan)

- **D1 — Identidad = personaje activo.** Toda interacción social ocurre a través del **personaje activo** (`members.active_character_id`). El usuario elige "con qué personaje entra"; eso define su avatar/nombre y **qué canales ve** (los clanes/campañas de ese personaje). Los canales OOC permiten hablar como usuario.
- **D2 — Membresía de clan a nivel de personaje.** Para soportar "personajes en distintos clanes", la pertenencia a clan debe ser **del personaje**, no del miembro. Se propone una tabla `clan_characters` (y `clan_members` se conserva para propiedad/liderazgo del **jugador**). Cambiar de personaje activo cambia los clanes visibles.
- **D3 — Entrega sin WebSockets.** El stack (FastAPI en Railway + SPA estática) no tiene WebSockets. Se propone **polling incremental** (traer mensajes `after_id` cada ~3–5 s) apoyado en `chat_room_presence` para no-leídos; opcionalmente **SSE** (`text/event-stream`) como mejora. Kafka queda para el **fan-out a Discord** y notificaciones, no para la entrega al navegador.
- **D4 — Muros sociales unificados.** Calendario/Eventos, feed de Clan y Salón de la Fama comparten la misma mecánica de "publicación + comentarios + reacciones". Se propone un modelo genérico `community_posts` con un campo `board` (`events` | `hall` | `clan`) para no triplicar tablas.
- **D5 — Seguridad en el backend.** Igual que en C1–C7: los permisos (quién publica en anuncios, quién ve qué canal, contenido de staff) se **filtran en el servidor**, no solo se ocultan en la UI.

---

## 2. Principios de diseño

1. **Hablas como personaje.** El emisor social por defecto es el personaje activo; los canales `is_ic` **exigen** un personaje; los OOC permiten al usuario. Los susurros son personaje↔personaje.
2. **Visibilidad por pertenencia del personaje activo.** Un canal se ve si: es público; o es de una **campaña** en la que participa el personaje; o de un **clan** al que pertenece el personaje; o cumple el **rango** requerido; o el usuario es **staff** (admin/DM). Anuncios/Eventos, Saludos y Fama son públicos de lectura.
3. **Provisión automática.** Crear una campaña crea su sala; crear un clan crea la suya; registrarse/crear personaje dispara mensajes de sistema en "Saludos".
4. **Muros = feed con permisos.** Eventos y Fama: publican Admin/DM, todos leen y (opcional) comentan. Clanes: publican los miembros del clan.
5. **Reutilizar antes de crear.** Las tablas `chat_*`, `clans`, `event_log`, `member_xp` ya existen; la mayor parte del trabajo es exponerlas, completar el motor de visibilidad y construir el frontend.
6. **Convenciones del repo:** respuestas `list_response`/`item_response`, `log_event`, casts de enums, ES Modules sin build, tokens CSS, filtrado DM/rol en backend, verificación (`ast.parse`, `node --check`).

---

## 3. Fases de implementación

### Fase CM1 — Identidad de personaje + motor de visibilidad + clanes por personaje  ⭐ *base de todo*

**Meta:** que "quién soy" en la comunidad sea el **personaje activo**, y que la visibilidad de canales dependa de sus afiliaciones. Sin esto, ningún canal segmentado funciona bien.

- **Migración `014_community_identity.sql`:**
  - `ALTER TYPE chat_room_type ADD VALUE 'welcome'` (Saludos), `'hall_of_fame'` (Fama) y `'admin'` (Administradores) — idempotente con `IF NOT EXISTS`.
  - Tabla `clan_characters` (`clan_id`, `character_id`, `clan_role`, `title`, `joined_at`, PK compuesta) para membresía **por personaje** (D2). Migrar datos de `clan_members` → asignar al personaje activo/primero de cada miembro (script idempotente).
  - Índices por `character_id` para resolver "clanes del personaje" rápido.
- **Backend — "personaje activo":** endpoints `GET/PUT /me/active-character` (setea `members.active_character_id`, validando que el personaje sea del usuario). El resto de la comunidad lee este contexto.
- **Backend — motor de visibilidad:** helper `visible_rooms(user, active_character)` que arma el `WHERE` de `GET /chat/rooms`: públicas + de sus campañas (via `campaign_members`/personaje) + de sus clanes (`clan_characters`) + por rango + staff ve todo. Reescribir `list_rooms` para usarlo (hoy no filtra por pertenencia).
- **Frontend:** **selector de personaje activo** en la barra superior (avatar + nombre); al cambiarlo, se recargan canales/muros visibles.
- **Verificación:** un jugador con personaje en Clan A pero no en Clan B ve la sala de A y no la de B; al cambiar de personaje, cambia el set de salas.

**Entregables:** `014_*.sql`, `routers/members.py` (o `me.py`), `routers/chat.py` (visibilidad), `frontend/js` (selector) + `router.js`.

---

### Fase CM2 — Chat: canales, provisión automática y entrega en vivo

**Meta:** un chat usable con todos los canales pedidos y mensajes que aparecen sin recargar.

- **Provisión de salas:**
  - **Seed/UPSERT** de las salas globales pedidas: **Anuncios y Eventos** (`announcements`, `readonly`, solo admin publica), **Saludos** (`welcome`, `readonly`, solo sistema), **Público** (`general`), **Administradores** (`admin`, solo staff), **Salón de la Fama** (`hall_of_fame`, `readonly`, solo sistema).
  - **Automática:** al crear **campaña** → crear su sala (`type='campaign'`, `campaign_id`); al crear **clan** → crear su sala (`type='clan'`, `clan_id`). (Hooks en `campaigns.py`/`clans.py`.)
- **Publicar como personaje (D1):** `POST /chat/rooms/{id}/messages` toma la identidad del **personaje activo** en salas `is_ic`; valida permiso de escritura (readonly, `admin` solo staff, campaña/clan solo miembros). `message_type` ic/ooc/emote/dice.
- **Entrega en vivo (D3):** `GET /chat/rooms/{id}/messages?after_id=…` (incremental) + **polling** cada ~4 s desde el frontend; marcar leído con `chat_room_presence`; badges de no-leídos por sala. (Opcional: endpoint SSE `/chat/stream`.)
- **Susurros / canales privados (G11):** bandeja estilo @WhatsApp — lista de conversaciones (últimos DMs por personaje), hilo `char↔char` con `GET/POST /chat/dm/{to_character_id}`, no-leídos.
- **Frontend `frontend/pages/chat.js`** (`#/chat`, habilitar en **Comunidad**): panel de canales a la izquierda (agrupados: Comunidad / Campañas / Clanes / Privados), hilo a la derecha, editor con IC/OOC y `/roll` (integra `dice_result`), respuestas, reacciones, fijados.
- **Kafka (opcional):** publicar en `dnd.chat.message_sent` y preparar el **consumidor → webhook de Discord**.
- **Verificación:** enviar un mensaje aparece en <5 s en otra sesión; readonly bloquea a no-staff; sala de campaña solo visible para sus jugadores.

**Entregables:** seed/UPSERT de salas, hooks de provisión, `routers/chat.py`, `frontend/pages/chat.js`, `router.js`.

---

### Fase CM3 — Canales de sistema: "Saludos" y notificaciones de "Salón de la Fama"

**Meta:** que el sistema hable solo en los canales de notificación.

- **Mensajes de sistema (`message_type='system'`)** publicados por un actor de sistema (sin personaje) en salas `readonly`:
  - **Saludos (G6):** al **registrarse** un miembro y al **crear un personaje** → mensaje de bienvenida ("¡{nombre} se unió al gremio!", "¡Ha nacido {personaje}, {clase} de nivel 1!").
  - **Salón de la Fama (G10):** al **subir de nivel** (`dnd.characters.leveled_up`), completar una **sesión**, otorgar un **premio** (CM6) → nota en la sala Fama.
- **Implementación:** un helper `post_system_message(room_slug, text)` invocado desde `auth.register`, `characters.create` y desde un **consumidor Kafka** (o llamadas directas) para los eventos ya emitidos. Reutiliza `event_log` como fuente.
- **Verificación:** registrar un usuario y crear un personaje generan mensajes en "Saludos"; subir de nivel genera uno en "Fama".

**Entregables:** `services/community_feed.py` (helper), enganches en `auth.py`/`characters.py`, consumidor Kafka opcional.

---

### Fase CM4 — Calendario & Eventos (muro de Admin/DM)

**Meta:** un muro donde Admin/DM publican para mantener informada a la comunidad.

- **Migración `015_community_walls.sql`:** modelo unificado (D4) —
  - `community_posts` (`id`, `board` `events`|`hall`|`clan`, `clan_id` NULL, `author_member_id`, `author_character_id` NULL, `title`, `body`, `image_url`, `item_id` NULL (compartir ítem), `event_date` NULL, `pinned`, `created_at`, `deleted_at`).
  - `community_comments` (`post_id`, `author_*`, `body`, `created_at`).
  - `community_reactions` (`post_id`, `character_id`, `emoji`, PK).
- **Backend `routers/community.py`:** CRUD de posts por `board`. **Eventos:** publican **Admin/DM**, todos leen; `event_date` para ordenar próximos; opción de enlazar a una **sesión** (`next_session_date`).
- **Frontend `frontend/pages/calendar.js`** (`#/calendario`, habilitar): muro cronológico + vista "próximos eventos"; formulario de publicación para Admin/DM.
- **Verificación:** un jugador no puede publicar en Eventos; los eventos se ordenan por fecha.

**Entregables:** `015_*.sql`, `models/community.py`, `routers/community.py`, `frontend/pages/calendar.js`, `router.js`.

---

### Fase CM5 — Clanes como muro social

**Meta:** que cada clan sea un "muro de red social": la comunidad se agrupa, comparte y organiza.

- **Reutiliza** `community_posts` con `board='clan'` + `clan_id` (D4) y la **membresía por personaje** (CM1/`clan_characters`).
- **Backend:** `GET/POST /clans/{id}/posts` (+ comentarios/reacciones); **solo miembros del clan** (por personaje activo) publican/ven el feed privado; feed público si `clan.is_public`. **Compartir ítems** (`item_id` → catálogo/`character_inventory`) y **fotos** (`image_url`). Exponer también el CRUD de clanes ya existente (crear, unirse, invitar) en el frontend.
- **Frontend `frontend/pages/clans.js`** (`#/clanes`, habilitar): lista/descubrir clanes, **perfil de clan** (emblema, lema, miembros, roles) y **muro** (publicaciones, comentarios, reacciones, ítems compartidos). Estética de red social (tarjetas, avatares de personaje).
- **Verificación:** un personaje que no pertenece a un clan privado no ve su muro; compartir un ítem lo muestra con su ficha.

**Entregables:** `routers/clans.py` (posts) o `community.py`, `frontend/pages/clans.js`, `router.js`.

---

### Fase CM6 — Salón de la Fama: premios y valoración de DMs

**Meta:** reconocer proezas de los personajes y permitir valorar a los DMs.

- **Migración `016_awards_ratings.sql`:**
  - `awards` (`id`, `character_id`, `campaign_id` NULL, `title`, `description`, `icon`, `rarity`, `awarded_by`→members, `created_at`) — premios/medallas otorgados por **Admin/DM** a personajes por sus proezas (G15).
  - `dm_ratings` (`id`, `dm_member_id`, `campaign_id`, `rater_member_id`, `rater_character_id`, `stars` 1–5, `comment`, `created_at`, UNIQUE(`campaign_id`,`rater_member_id`)) — los **jugadores** califican al DM por la aventura (G16).
- **Backend `routers/hall.py`:** otorgar premio (Admin/DM) → publica nota de sistema en la sala Fama (CM3) y en el muro (`board='hall'`); listar premios por personaje/campaña; enviar/leer valoración de DM (solo jugadores que **participaron** en la campaña); promedio de estrellas por DM. **Ranking/leaderboard** derivado de `member_xp` (XP, sesiones) y `clan_members.contribution_pts`.
- **Frontend `frontend/pages/hall.js`** (`#/fama`, habilitar): muro de proezas + medallas por personaje, **tabla de líderes**, y flujo de **valoración de DMs** (estrellas + comentario) con promedio visible.
- **Verificación:** solo Admin/DM otorga premios; un jugador solo puede valorar al DM de una campaña en la que participó, y una sola vez por campaña.

**Entregables:** `016_*.sql`, `models/`, `routers/hall.py`, `frontend/pages/hall.js`, `router.js`.

---

## 4. Resumen de migraciones DB

| Migración | Contenido | Fase |
|-----------|-----------|------|
| `014_community_identity.sql` | enum `chat_room_type` +welcome/hall_of_fame/admin; `clan_characters` (membresía por personaje) | CM1 |
| *(sin migración)* | provisión automática de salas + seed de salas globales (hooks/seed) | CM2 |
| `015_community_walls.sql` | `community_posts` / `community_comments` / `community_reactions` | CM4 (reusada por CM5) |
| `016_awards_ratings.sql` | `awards`, `dm_ratings` | CM6 |

Las columnas `members.active_character_id`, `chat_*`, `clans`, `event_log` y `member_xp` **ya existen** (migración 001).

---

## 5. Orden recomendado y dependencias

```
CM1 (identidad + visibilidad + clanes por personaje)  ──►  CM2 (chat: canales + entrega)
                                                              │
                                                              ├─►  CM3 (canales de sistema)
CM4 (muro Eventos)  ──►  CM5 (muro de Clanes)  ◄── CM1 (membresía por personaje)
                                                              │
                                                              └─►  CM6 (Fama: premios + rating de DM) ──► notifica en CM3
```

- **CM1 es la base**: sin identidad de personaje ni motor de visibilidad, los canales segmentados y los clanes por personaje no funcionan.
- **CM2** entrega el chat completo; **CM3** lo puebla con mensajes de sistema.
- **CM4** introduce el modelo de muros que **CM5** y **CM6** reutilizan.
- **CM6** cierra el ciclo de reconocimiento y se apoya en CM3 para notificar.

---

## 6. Riesgos y mitigaciones

- **`ALTER TYPE … ADD VALUE` no transaccional** → ejecutar la migración de enum por separado (patrón C1/007).
- **Sin WebSockets** → empezar con **polling incremental** (barato y robusto); medir carga; migrar a SSE si hace falta. Evitar polling agresivo (backoff cuando la pestaña no está visible).
- **Migración de membresía de clan (miembro→personaje)** → script idempotente que asigna al personaje activo/primero; conservar `clan_members` para propiedad del jugador y compatibilidad de `clans.py`.
- **Fuga de contenido por canal** (mensajes de campaña/clan/admin a quien no pertenece) → **filtrar en el backend** con el motor de visibilidad (D5), con tests de contrato por rol/pertenencia.
- **Spam / moderación** → `readonly` en anuncios/saludos/fama, escritura solo-staff donde corresponde, borrado lógico (`deleted_at`) y `is_pinned` ya disponibles.
- **XSS en contenido de usuario** (posts, mensajes, comentarios) → `textContent`/escape en el frontend (patrón ya usado en C2–C7), nunca `innerHTML` con datos del servidor.
- **Ítems compartidos en muros** → referenciar por `item_id` y renderizar la ficha desde el catálogo (no duplicar datos).

---

## 7. Próximo paso sugerido

Comenzar por **Fase CM1** (identidad de personaje + motor de visibilidad + `clan_characters`): es la base que habilita todo lo demás y de-riesga la decisión de "hablar como personaje". Seguir con **CM2** (chat completo con entrega en vivo), que es la pieza de mayor valor percibido. ¿Avanzo con la implementación de CM1?
