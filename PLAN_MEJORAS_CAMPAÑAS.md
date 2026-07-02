# Plan de Implementación — Mejoras Globales al Manejo de Campañas, Sesiones y Tesoros

> **Estado:** Propuesta · **Fecha:** 2026-07-02
> **Base:** Análisis de `guides/dnd5e_campaigns_guide.md` contra el código actual (schema v2.0, `api/`, `frontend/`).
> **Objetivo:** Llevar el subsistema de campañas desde un CRUD plano (campaña + sesión + tesoro) hasta una herramienta de gestión de mesa completa alineada con D&D 5e: jerarquía narrativa (aventura → sesión → encuentro), mundo vivo (NPCs, localizaciones, facciones, misiones), balanceo de encuentros, progresión de nivel y visibilidad DM/jugador.

---

## 0. Diagnóstico — estado actual vs. lo que falta

El hallazgo central es idéntico al del subsistema de ítems: **el schema ya modela buena parte del mundo, pero la capa de modelos, routers y frontend solo expone la raíz** (campaña → sesión → tesoro). Las tablas `locations`, `npcs`, `factions`, `faction_reputation` y `quests` **ya existen** en la migración `001` (líneas 269–342) pero **no tienen ni modelo Pydantic, ni router, ni UI** — están muertas en la práctica. Por otro lado, todo lo referente a la **jerarquía de aventuras, el bestiario, los encuentros y su balanceo, y el rastreo de combate** no existe en absoluto.

### 0.1 Inconsistencias y deuda técnica confirmada

| # | Problema | Ubicación | Impacto |
|---|----------|-----------|---------|
| B1 | **`CampaignOut`/`CampaignCreate` exponen ~11 campos**; el modelo es delgado y no admite metadatos de campaña (nivel, tono, frecuencia, método de subida, reglas de mesa). | `api/models/campaign.py` L7–52 | Imposible registrar la ficha de identidad de la guía §2 |
| B2 | **`sessions.milestone_level` existe en el schema pero NO está en el modelo.** `SessionCreate/Update/Out` omiten la columna (igual que pasaba con `items` en I1). | `db/…/001` L354 vs `api/models/session_model.py` | La subida por hitos no se puede registrar desde la app |
| B3 | **Tablas `locations`, `npcs`, `factions`, `faction_reputation`, `quests` sin exponer.** Existen en el schema (L269–342) pero no hay modelos, routers ni UI. El router de `main.py` (L59–69) no las incluye. | schema vs `api/routers/` | Mundo vivo inaccesible; nav "Misiones" deshabilitado |
| B4 | **`campaign_status` solo tiene 4 estados** (`active`, `paused`, `completed`, `archived`). Faltan `planning` y `on_hiatus` de la máquina de estados de la guía §2. | `db/…/001` L16 | No hay estado de pre-lanzamiento ni pausa temporal explícita |
| B5 | **Transiciones de estado sin validar.** Cualquier estado puede saltar a cualquier otro; `DELETE` de campaña solo marca `archived`. | `api/routers/campaigns.py` L167–187 | Estados incoherentes posibles |
| B6 | **Inconsistencia de nombres de moneda.** Las tablas reales `campaign_currency`/`character_currency` usan columnas `copper/silver/electrum/gold/platinum` (L447–455, L251), pero CLAUDE.md y el modelo económico I5 las documentan como `pp/gp/ep/sp/cp`. | schema vs docs | Riesgo de bug al mapear; documentación desalineada |
| B7 | **Sin historial ni versionado** de crónicas de sesión ni de cambios de tesoro (solo `updated_at`). El `event_log` existe (L538) pero no se alimenta desde estos flujos de forma sistemática. | `sessions`, `campaign_treasury` | Sin trazabilidad de "antes/después" |

### 0.2 Capacidades de dominio ausentes (vs. la guía)

| # | Capacidad de la guía | ¿Existe hoy? |
|---|----------------------|--------------|
| G1 | **Jerarquía Aventura/Arco** (guía §1): campaña → **aventura** → sesión → encuentro | No. La campaña enlaza directo a sesiones; no hay tabla `adventures` |
| G2 | **Metadatos de campaña** (guía §2): subtítulo, tono[], temas[], `start/current/target_level`, `session_frequency`, banner | Parcial. Solo `name/slug/system/description/lore/world_name/setting/start_date/end_date/is_public` |
| G3 | **Estados de campaña completos** (guía §2): `planning`/`on_hiatus` | No (ver B4) |
| G4 | **Sistema y reglas de mesa** (guía §3): `ruleset` (2014/2024), `sourcebooks_allowed`, `variant_rules`, `house_rules` | No |
| G5 | **Mundo/ambientación estructurado** (guía §4): género, cosmología, jerarquía geográfica | Mínimo. `world_name`/`setting` como texto plano |
| G6 | **Localizaciones y mapas** (guía §8): tabla `locations` (con `parent_location_id`, `is_discovered`) existe | Solo schema. Sin router/UI. Mapas/battle map/tokens: inexistentes |
| G7 | **NPCs** (guía §9): tabla `npcs` con `stat_block JSONB`, `relationship`, `location_id`, `faction_id` existe | Solo schema. Sin router/UI. Faltan `attitude`, `secret`/`motivation`, `dm_only` |
| G8 | **Facciones y reputación** (guía §9.3): `factions` + `faction_reputation` existen | Solo schema. Sin router/UI |
| G9 | **Misiones (Quests)** (guía §7.4): tabla `quests` con `objectives JSONB`, `reward_*`, `quest_giver_npc_id` existe | Solo schema. Sin router/UI. Nav "⚔️ Misiones" deshabilitado (`router.js`) |
| G10 | **Plot hooks / arcos / giros** (guía §7) | No. Ninguna tabla |
| G11 | **Bestiario / stat blocks / monstruos con CR** (guía §10) | No. Solo `npcs.stat_block JSONB` libre, sin CR/XP ni tabla dedicada |
| G12 | **Encuentros** (guía §11): tipos, monstruos, dificultad | No. Ninguna tabla `encounters` |
| G13 | **Matemáticas de balanceo** (guía §12): umbrales XP por nivel, multiplicador por nº de monstruos, ajuste por tamaño de grupo, presupuesto diario | No. Ningún cálculo |
| G14 | **Recompensas** (guía §13): botín individual vs. acumulado, tabla de tesoro por nivel, reputación como recompensa | Parcial. `session_loot` + `campaign_treasury` + `campaign_currency` + `xp_awarded` existen y funcionan |
| G15 | **Progresión XP vs. hitos** (guía §14) a nivel de campaña | Parcial. `sessions.milestone_level` (oculto, B2) y `xp_awarded`; sin config de método ni XP acumulado del grupo |
| G16 | **Bitácora de sesión rica** (guía §15): prep, encuentros jugados, NPCs/localizaciones/quests tocados, cliffhanger, level-ups, recap | Parcial. `summary`, `highlights[]`, `attendance`, `loot` existen |
| G17 | **Initiative / combat tracker** (guía §15.3) | No |
| G18 | **Visibilidad DM-only granular** (guía §5.1, §17 regla 4) — filtrado en backend | No. Solo `campaigns.is_public` global y `locations.is_discovered` |

---

## 1. Principios de diseño del plan

1. **Aprovechar el schema existente antes de migrar.** Buena parte de C2–C3 es exponer tablas que ya existen (`locations`, `npcs`, `factions`, `quests`), no crearlas — igual que I1 hizo con las columnas de `items`.
2. **La campaña es el agregado raíz; el contenido pesado se referencia por id** (guía §16). NPCs, monstruos, encuentros, mapas viven en tablas propias con FK `campaign_id`, no anidados en la campaña.
3. **Cálculo mecánico derivado, no duplicado.** La dificultad de encuentro, el XP repartido y el presupuesto diario se **calculan** a partir de constantes del sistema + composición del grupo; no se persisten (coherente con I4/H4).
4. **Constantes del sistema como código, no como datos editables** (guía §17 regla 5): umbrales de XP, tabla CR→XP, multiplicadores viven en un servicio `api/services/encounter_math.py`, no en tablas mutables por el usuario.
5. **Visibilidad DM-only se filtra en el backend, no solo en la UI** (guía §17 regla 4). Es un requisito de seguridad: los endpoints deben omitir campos/registros `dm_only` según el rol antes de serializar.
6. **Backward-compatible.** Migraciones aditivas (`ADD COLUMN … DEFAULT`, `ALTER TYPE … ADD VALUE`), sin romper datos existentes.
7. **Seguir convenciones del repo:** respuestas `list_response`/`item_response`, `log_event`, eventos Kafka, ES Modules sin build, tokens CSS, skills de UI (`emil-design-eng`, `design-taste-frontend`), skill `dnd` para valores canónicos, y anti-truncación (`tail -5`, `ast.parse`) en archivos grandes.

---

## 2. Fases de implementación (ordenadas por prioridad)

### Fase C1 — Saneamiento y enriquecimiento de la ficha de campaña y sesión  ⭐ *base, bajo riesgo*

**Meta:** que la campaña y la sesión expongan la ficha de identidad de la guía, sin tocar aún el mundo. Es la fase de menor esfuerzo y sin dependencias.

- **Migración `007_campaign_metadata.sql`:**
  - `ALTER TYPE campaign_status ADD VALUE 'planning'` y `'on_hiatus'` (B4). *(Nota: `ADD VALUE` no es reversible dentro de una transacción; ejecutar suelto.)*
  - `ALTER TABLE campaigns ADD COLUMN`: `subtitle VARCHAR(200)`, `tone TEXT[] DEFAULT '{}'`, `themes TEXT[] DEFAULT '{}'`, `start_level SMALLINT DEFAULT 1`, `current_level SMALLINT DEFAULT 1`, `target_end_level SMALLINT`, `session_frequency VARCHAR(20)`, `leveling_method VARCHAR(12) DEFAULT 'xp'` (`xp`|`milestone`), `ruleset VARCHAR(20) DEFAULT 'dnd_5e_2014'`, `house_rules JSONB DEFAULT '[]'`, `variant_rules JSONB DEFAULT '[]'`, `banner_image_url TEXT`.
- **Exponer `sessions.milestone_level` (B2)** en `SessionCreate/Update/Out`.
- **Ampliar `CampaignCreate/Update/Out`** con todos los campos nuevos; validar `start_level ≤ current_level ≤ target_end_level ≤ 20` (guía §17 regla 3) y `leveling_method ∈ {xp, milestone}`.
- **Validación de transición de estado (B5):** helper `_valid_transition(old, new)` según la máquina de estados de la guía §2; advertencia (no bloqueo) al pasar a `completed` con sesiones futuras.
- **Frontend `campaigns.js`:** ampliar `openModal()` con secciones "Sistema y reglas" (ruleset, variant/house rules) y "Progresión" (niveles, método); mostrar tono/temas como chips en la card. Editor de reglas caseras como lista simple (categoría + título + descripción + activo, guía §3.3).
- **Corregir B6:** documentar en CLAUDE.md que las columnas reales son `copper/silver/electrum/gold/platinum`; alinear o aliasar en los modelos económicos.
- **Verificación:** `ast.parse` de modelos; smoke test POST/PUT `/campaigns`; `node --check` de `campaigns.js`.

**Entregables:** `db/migrations/007_*.sql`, `models/campaign.py`, `models/session_model.py`, `routers/campaigns.py`, `routers/sessions.py`, `frontend/pages/campaigns.js`.

---

### Fase C2 — Jerarquía narrativa: Aventuras/Arcos + Misiones (Quests)

**Meta:** introducir el nivel "Aventura" que falta entre campaña y sesión, y activar la tabla `quests` que ya existe.

- **Migración `008_adventures.sql`:** tabla `adventures` (`id`, `campaign_id`, `title`, `description`, `order` SMALLINT, `source` `official`|`homebrew`, `module_name`, `status` `not_started`|`active`|`completed`|`abandoned`, `rec_level_min/max`, `visible_to_players BOOLEAN`, `created_at`). Añadir `sessions.adventure_id UUID REFERENCES adventures(id) ON DELETE SET NULL` (aditivo, sesiones existentes quedan sin aventura).
- **Exponer `quests` (G9, B3):** modelo `QuestCreate/Update/Out` (incluye `objectives: list[{text, completed, optional?}]`, `reward_xp`, `reward_gp`, `quest_giver_npc_id`, `status::quest_status`, `visible_to_players`), router `api/routers/quests.py` CRUD bajo `/api/v1/campaigns/{id}/quests`. Permisos: crear/editar solo DM/admin; jugadores ven solo `visible_to_players` o `status != 'available'` oculta. Regla de integridad guía §17.10: `status='completed'` requiere objetivos no-opcionales completos (advertencia).
- **Frontend:** nueva página `frontend/pages/quests.js` (`#/quests?campaign=…`), habilitar el nav "⚔️ Misiones" (`router.js`). Panel de aventuras dentro del detalle de campaña (lista ordenable, estado, rango de nivel). Vincular sesión ↔ aventura en el modal de sesión.
- **Verificación:** casos de quest con objetivos parciales; jerarquía sin referencias cruzadas entre campañas (guía §17 regla 2).

**Entregables:** `db/migrations/008_*.sql`, `models/quest.py` + `models/adventure.py`, `routers/quests.py` (+ endpoints de adventures), `frontend/pages/quests.js`, `frontend/js/router.js`, ajustes a `campaigns.js`/`sessions.js`.

---

### Fase C3 — Mundo vivo: NPCs, Localizaciones, Facciones (exponer schema existente)

**Meta:** activar las tres tablas de mundo que ya existen (G6–G8) con visibilidad DM/jugador. Alto valor, esfuerzo medio (el schema ya está).

- **Modelos y routers** para `locations`, `npcs`, `factions` (+ `faction_reputation`), todos bajo `/api/v1/campaigns/{id}/…`:
  - **Localizaciones:** jerarquía por `parent_location_id` (árbol, guía §4.3), `is_discovered` como flag de visibilidad para jugadores.
  - **NPCs:** exponer `relationship`, `role`, `location_id`, `faction_id`, `stat_block JSONB`, `alive`; **añadir en migración `009_dm_only_fields.sql`** columnas `attitude` (`hostile`…`helpful`, guía §9.2), `motivation TEXT`, `secret TEXT`, `dm_only BOOLEAN DEFAULT FALSE`.
  - **Facciones:** exponer `goals`, `alignment`, `reputation_scale JSONB`, `leader_name`; endpoints de reputación del grupo (`faction_reputation`).
- **Filtrado backend DM-only (G18, guía §17 regla 4):** helper `strip_dm_fields(record, role)` que elimina `secret`/`motivation`/`notes`/`dm_only=true` y localizaciones `is_discovered=false` antes de serializar para rol jugador. **Filtrar en el backend, no ocultar en el frontend.**
- **Frontend:** páginas `npcs.js`, `locations.js`, `factions.js` (o un "Compendio de campaña" con pestañas) bajo el grupo **Mundo** del nav (hoy deshabilitado). Consultar skill `dnd` para razas/alineamientos canónicos y `design-taste-frontend`/`high-end-visual-design` para el layout de fichas.
- **Verificación:** un jugador NO recibe campos `secret`/`dm_only` ni NPCs/localizaciones ocultas en la respuesta JSON (test de contrato, no solo visual).

**Entregables:** `db/migrations/009_*.sql`, `models/{location,npc,faction}.py`, `routers/{locations,npcs,factions}.py`, `frontend/pages/{npcs,locations,factions}.js`, `router.js`.

---

### Fase C4 — Bitácora de sesión enriquecida + progresión de nivel/hitos

**Meta:** cerrar el ciclo de la sesión (guía §15) y la progresión del grupo (guía §14).

- **Migración `010_session_log.sql`:** ampliar `sessions` con `prep_notes TEXT`, `cliffhanger TEXT`, y tablas puente ligeras o columnas `UUID[]`: `npcs_introduced`, `locations_visited`, `quests_advanced` (referencias a las entidades de C2/C3). Registrar `level_ups` (character_id → new_level) — puede derivarse de `session_attendance` + evento existente `dnd.characters.leveled_up`.
- **Recap automático (guía §15.2):** endpoint `GET /sessions/{id}/recap` que combina `summary` + `cliffhanger` + `quests_advanced` de la sesión anterior; botón "Resumen de la sesión anterior" en la UI.
- **Progresión (G15):** usar `campaigns.leveling_method` (de C1). Para `xp`: acumular `xp_awarded`/`xp_received` y comparar contra la tabla de XP por nivel (guía §14.1) → sugerir subida. Para `milestone`: exponer `milestone_level` (ya desbloqueado en C1) y avanzar `campaigns.current_level`. Servicio `api/services/progression.py` con la tabla de XP y BPC por nivel.
- **Frontend `sessions.js`:** pestaña "Preparación" (encuentros planificados, notas privadas DM), sección de cierre (cliffhanger, level-ups), y bloque de recap al abrir el detalle.
- **Verificación:** XP acumulado round-trip contra la tabla de la guía; cambio de método a mitad de campaña (guía §14.2 nota) no rompe datos.

**Entregables:** `db/migrations/010_*.sql`, `models/session_model.py`, `services/progression.py`, `routers/sessions.py`, `frontend/pages/sessions.js`.

---

### Fase C5 — Bestiario, Encuentros y Calculadora de dificultad  ⭐ *sección "crunchy" de mayor valor DM*

**Meta:** que el DM diseñe encuentros balanceados con las matemáticas del DMG (guía §10–§12).

- **Migración `011_bestiary_encounters.sql`:**
  - Tabla `stat_blocks` (bestiario, guía §10.1): `name`, `size`, `creature_type`, `alignment`, `armor_class`, `hit_points`, `hit_dice`, `speed JSONB`, `abilities JSONB` (6 stats), defensas/sentidos JSONB, `challenge_rating NUMERIC(4,3)` (soporta 1/8, 1/4…), `xp_value INT`, `proficiency_bonus`, `traits/actions/legendary_actions JSONB`, `source`, `is_homebrew`, `campaign_id` NULL (global SRD) o por campaña (casero).
  - Tabla `encounters` (guía §11.2): `campaign_id`, `session_id` NULL, `location_id` NULL, `name`, `encounter_type`, `description`, `difficulty` (derivada), `terrain_features`, `status`, `dm_notes`, `visible_to_players`.
  - Tabla `encounter_monsters` (puente): `encounter_id`, `stat_block_id`, `quantity`, `name_override`.
- **Seed SRD de monstruos** `db/seed_monsters.py` (idempotente, patrón de `seed_items.py`/`seed_spells.py`): descargar/cachear una muestra representativa de la SRD (dnd5eapi) con `challenge_rating` y `xp_value`; cache versionado en `db/data/srd_monsters.json`.
- **Servicio `api/services/encounter_math.py` (constantes de sistema, no editables — principio 4):** tablas de umbrales de XP por nivel (guía §12.1), CR→XP (guía §10.2), multiplicadores por nº de monstruos (guía §12.3), ajuste por tamaño de grupo (guía §12.4). Función `calculate_difficulty(monsters, party)` → `{base_xp, adjusted_xp, difficulty}` **replicando exactamente el algoritmo y el ejemplo de la guía §12.6**. Presupuesto diario (guía §12.7) para advertencias.
- **Endpoint** `POST /api/v1/campaigns/{id}/encounters/preview-difficulty` (derivado, no persiste) y CRUD de encuentros.
- **Reglas de reparto (guía §13.1, §17 regla 9):** el XP de recompensa usa el **XP base**, NO el ajustado por multiplicador (error común); documentarlo y testearlo.
- **Frontend:** página `encounters.js` — constructor de encuentro con selector de monstruos del bestiario, badge de dificultad en vivo (trivial→mortal) y advertencias (encuentro mortal, día sobrecargado, un solo monstruo vs. action economy — guía §17 advertencias).
- **Verificación:** reproducir el ejemplo de la guía §12.6 (4 PJ nivel 3 + 6 goblins → 600 XP ajustado = Media) como test unitario; casos de grupo 1–2 y 6+ (ajuste de fila).

**Entregables:** `db/migrations/011_*.sql`, `db/seed_monsters.py`, `db/data/srd_monsters.json`, `services/encounter_math.py`, `models/{stat_block,encounter}.py`, `routers/encounters.py`, `frontend/pages/encounters.js`.

---

### Fase C6 — Rastreador de combate en vivo (Initiative Tracker)

**Meta:** correr el combate desde la app (guía §15.3–§15.4). Depende del bestiario y los encuentros de C5.

- **Estado de combate:** puede ser efímero (en memoria/tabla `combat_trackers` + `combatants`) por encuentro: `round`, `current_turn_index`, y por combatiente `initiative`, `current_hp/max_hp/temp_hp`, `armor_class`, `conditions TEXT[]` (las 15 de la guía §10.4), `concentration` (coherente con la Guía de Hechizos, guía §17 regla 8).
- **Lógica:** orden de iniciativa (1d20 + mod DES, desempate por mod DES — guía §15.4), avance de turno/ronda, aplicar daño/curación, togglear condiciones, agotamiento por niveles (guía §10.5). HP no negativo (guía §17 regla 6); una entrada de iniciativa por combatiente (regla 7).
- **Integración:** PJs cargan HP/CA/condiciones desde `characters`; monstruos desde `stat_blocks` (instancias con HP propio). Empujar eventos de combate por Kafka opcional.
- **Frontend:** panel de iniciativa (lista ordenada, turno activo resaltado, controles de daño/condición/concentración) con microinteracciones (`emil-design-eng`).
- **Verificación:** desempates, múltiples instancias del mismo monstruo con HP independiente, pérdida de concentración al concentrarse en otro hechizo.

**Entregables:** `db/migrations/012_*.sql` (opcional si se persiste), `services/combat.py`, `routers/encounters.py`, `frontend/pages/encounters.js` (o `combat.js`).

---

### Fase C7 — Recompensas avanzadas, mapas y pulido de visibilidad *(mejoras finales)*

**Meta:** cerrar recompensas por nivel, mapas tácticos y afinar el modelo de permisos.

- **Recompensas (G14, guía §13):** distinguir botín **individual** vs. **acumulado (hoard)**; guía de tesoro por rango de nivel (guía §13.3) como sugerencias al DM; reputación de facción como recompensa (integra con C3). Reforzar el flujo `session_loot → personaje/tesoro` ya existente.
- **Mapas y tokens (guía §8, opcional/mayor esfuerzo):** `game_maps` (world/regional/settlement/battle/dungeon) con `grid_*`, `fog_of_war`, y `map_tokens` posicionables. Battle map con escala 5 ft y tamaños de criatura (guía §8.4). Sugerido como fase opcional por su costo de UI.
- **Plot hooks / arcos / giros (G10, guía §7):** tablas `story_arcs`/`plot_hooks`/`plot_twists` con `dm_only` por defecto en los giros (guía §7.3). De menor prioridad; puede quedar como iteración futura.
- **Endurecer visibilidad (guía §17 reglas de permisos):** revisión transversal de que TODO endpoint de campaña filtra `dm_only`/`visible_to_players`/`is_discovered` por rol (DM ve todo; jugador solo lo descubierto; invitado solo público si `is_public`).
- **Verificación:** matriz de permisos DM/jugador/invitado por entidad; auditoría de que ningún endpoint filtra secretos solo en el frontend.

**Entregables:** `db/migrations/013_*.sql` (opc.), `models/`, `routers/`, `frontend/`.

---

## 3. Resumen de migraciones DB

| Migración | Contenido | Fase |
|-----------|-----------|------|
| `007_campaign_metadata.sql` | `ALTER TYPE campaign_status ADD VALUE`; metadatos de campaña; expone `milestone_level` | C1 |
| `008_adventures.sql` | Tabla `adventures` + `sessions.adventure_id` | C2 |
| `009_dm_only_fields.sql` | NPCs: `attitude`, `motivation`, `secret`, `dm_only` | C3 |
| `010_session_log.sql` | `sessions`: `prep_notes`, `cliffhanger`, refs a npcs/locations/quests | C4 |
| `011_bestiary_encounters.sql` | `stat_blocks`, `encounters`, `encounter_monsters` + seed monstruos | C5 |
| `012_combat_tracker.sql` *(opc.)* | `combat_trackers`, `combatants` (si se persiste) | C6 |
| `013_maps_rewards.sql` *(opc.)* | `game_maps`, `map_tokens`, arcos/giros | C7 |

Las constantes de balanceo (umbrales XP, CR→XP, multiplicadores) van en `services/encounter_math.py` como **código**, no en tablas (guía §17 regla 5).

---

## 4. Orden recomendado y dependencias

```
C1 (ficha campaña/sesión)  ──►  C2 (aventuras + quests)  ──►  C3 (NPCs/locs/facciones)
                                        │                             │
                                        └──►  C4 (bitácora + progresión)
                                                                      │
C5 (bestiario + encuentros + balanceo)  ◄─────────────────────────────┘ (usa locations/quests)
        │
        └──►  C6 (combat tracker)  ──►  C7 (recompensas/mapas/visibilidad — pulido)
```

- **C1 es la base y no tiene dependencias** (menor esfuerzo, alto retorno: desbloquea metadatos y `milestone_level`).
- **C2 y C3** son mayormente "exponer schema existente" → alto valor, riesgo bajo.
- **C5** es el mayor diferenciador para el DM (matemáticas del DMG); depende de tener bestiario y, para vincular, de C3 (localizaciones) y C2 (sesiones/aventuras).
- **C6** depende de C5. **C7** es pulido y puede recortarse/posponerse.

---

## 5. Riesgos y mitigaciones

- **`ALTER TYPE … ADD VALUE` no transaccional** → ejecutar la migración de enum por separado (no dentro de un `BEGIN` con otras sentencias).
- **Fuga de contenido DM-only** → filtrar en el backend antes de serializar (principio 5); test de contrato JSON por rol, no solo revisión visual.
- **Algoritmo de balanceo mal implementado** (error común: usar XP ajustado para repartir) → test unitario que reproduce el ejemplo de la guía §12.6 y la regla §17.9.
- **Seed SRD de monstruos voluminoso** → script idempotente con cache versionado y `ON CONFLICT`, sembrar por lotes y verificar conteos (patrón `seed_spells.py`).
- **Alcance excesivo** → C6/C7 (combat tracker, mapas, arcos/giros) son opcionales; la app aporta valor completo ya en C1–C5.
- **Git lock desde el sandbox** (ver CLAUDE.md) → commits/push desde PowerShell en Windows.
- **Truncación de archivos grandes** (`sessions.js` 1037 L, `inventory.js` 1520 L) → verificar con `tail -5`/`node --check` tras cada edición.
- **Inconsistencia de nombres de moneda (B6)** → decidir una convención (`copper/silver/…`) y alinear docs + modelos antes de C4.

---

## 6. Próximo paso sugerido

Comenzar por **Fase C1** (ficha de campaña/sesión) por ser la base sin dependencias y de bajo riesgo: expone `milestone_level`, añade los metadatos de la guía §2–§3 y los estados `planning`/`on_hiatus`. Seguir con **C2/C3** para dar vida al mundo reutilizando las tablas `quests`/`npcs`/`locations`/`factions` que ya existen en el schema. ¿Avanzo con la implementación de C1?
