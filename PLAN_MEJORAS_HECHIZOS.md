# PLAN DE MEJORAS — Sistema de Hechizos (Fases H1–H6)

> **Objetivo:** Dotar a la app de un sistema completo de magia D&D 5e: un **catálogo de hechizos administrable** para toda la comunidad (bajo Configuración), y la capacidad de que cada jugador **equipe/prepare hechizos en sus personajes** respetando las reglas de clase, nivel y disponibilidad, con toda la información necesaria para entender su uso.
>
> **Alcance mecánico acordado:** *Pragmático*. Catálogo + equipar/preparar validado por clase/nivel/disponibilidad + ranuras y CD/ataque calculados + concentración simple. El upcasting avanzado automatizado, Pact Magic completo (Mystic Arcanum), puntos de hechicería y consumo de componentes con coste quedan señalados como **fase posterior (H6+)**, no bloqueante.
>
> **Fuente de datos:** SRD 5.1 completo (~319 hechizos) vía seeder idempotente, replicando el patrón de `seed_items.py` (216 ítems).
>
> **Referencia de diseño:** este plan replica la arquitectura ya probada del **sistema de ítems** (`items` + `character_inventory` + `inventory.py` + `inventory.js` + `seed_items.py` + servicios). Ver `PLAN_MEJORAS_ITEMS.md`.

---

## 0. Diagnóstico del estado actual

### Lo que YA existe (parcial, sin catálogo)

En la tabla `characters` (schema v2.0) hay campos de magia pensados para almacenar el estado del personaje, **pero no hay catálogo global ni join table**:

| Campo actual | Tipo | Problema |
|--------------|------|----------|
| `spellcasting_ability` | `VARCHAR(3)` | OK, se conserva |
| `spell_attack_bonus` | `SMALLINT` | Se recalcula (ver H4) |
| `spell_save_dc` | `SMALLINT` | Se recalcula (ver H4) |
| `spell_slots` | `JSONB` | OK como estado de ranuras `{ "1": {total,used}, ... }` |
| `pact_magic` | `JSONB` | OK, base para Brujo |
| `cantrips_known` | `TEXT[]` | **Solo guarda nombres sueltos** — sin vínculo al catálogo |
| `spells_known` | `JSONB` `[{name,level,prepared,school}]` | **Datos denormalizados y libres** — sin vínculo al catálogo, sin descripción, sin componentes |

En el frontend, la pestaña **"Hechizos"** de la ficha (`characters.js`, tab `hechizos`, líneas ~907–945) **solo dibuja burbujas de ranuras**. No muestra la lista de hechizos, ni trucos, ni preparación, ni descripción.

### Lo que FALTA (lo que construye este plan)

1. **Catálogo global** de hechizos (`spells`) — administrable por admin, disponible para toda la comunidad.
2. **Enum de escuela** de magia (`spell_school`).
3. **Join table** `character_spells` — qué hechizos conoce/prepara cada personaje (con vínculo real al catálogo).
4. **Modelo Pydantic** único (`spell_model.py`) exponiendo toda la anatomía del hechizo.
5. **Router** `spells.py` — CRUD del catálogo + endpoints de repertorio del personaje.
6. **Seeder** `seed_spells.py` — SRD 5.1 completo, idempotente.
7. **Servicio** `spellcasting.py` — reglas: CD/ataque, límites de preparación/conocidos, ranuras por clase/nivel, disponibilidad por lista de clase.
8. **Página frontend** `spells.js` (modo por hash) — catálogo bajo Configuración + integración en la ficha.
9. **Reescritura de la pestaña Hechizos** de la ficha para gestionar el repertorio real.

### Decisión de arquitectura: catálogo relacional, no JSONB libre

Se **migra** de `spells_known` (JSONB libre) a la join table `character_spells` que referencia `spells.id`. Se conserva `spell_slots` y `pact_magic` como JSONB (son estado de recursos, no repertorio). Motivo: coherencia con el sistema de ítems, evitar duplicar la descripción del hechizo en cada personaje, y permitir validación real de disponibilidad por lista de clase.

---

## 1. Modelo de datos objetivo

### 1.1 Nuevo enum

```sql
CREATE TYPE spell_school AS ENUM (
  'abjuration','conjuration','divination','enchantment',
  'evocation','illusion','necromancy','transmutation'
);
```

### 1.2 Tabla `spells` (catálogo global)

Réplica del patrón de `items`. Cubre toda la anatomía del hechizo (documento §5) y los parámetros de resolución (§10):

```sql
CREATE TABLE spells (
  id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  VARCHAR(200) NOT NULL,          -- nombre en español (display)
  name_en              VARCHAR(200),                    -- nombre en inglés (matching SRD)
  level                 SMALLINT     NOT NULL CHECK (level BETWEEN 0 AND 9),  -- 0 = truco
  school                spell_school NOT NULL,

  -- Ejecución
  casting_time          VARCHAR(60)  NOT NULL DEFAULT '1 acción',
  casting_time_type     VARCHAR(20),                    -- action|bonus_action|reaction|minutes|hours
  range_text            VARCHAR(60)  NOT NULL DEFAULT 'Toque',
  range_type            VARCHAR(20),                    -- self|touch|ranged|sight|unlimited
  range_feet            INTEGER,

  -- Componentes
  comp_verbal           BOOLEAN      NOT NULL DEFAULT FALSE,
  comp_somatic          BOOLEAN      NOT NULL DEFAULT FALSE,
  comp_material         BOOLEAN      NOT NULL DEFAULT FALSE,
  material_description   TEXT,
  material_cost_gp       NUMERIC(12,2),                 -- si aplica (para H6: consumo)
  material_consumed      BOOLEAN      NOT NULL DEFAULT FALSE,

  duration              VARCHAR(80)  NOT NULL DEFAULT 'Instantáneo',
  concentration         BOOLEAN      NOT NULL DEFAULT FALSE,
  ritual                BOOLEAN      NOT NULL DEFAULT FALSE,

  -- Contenido
  description           TEXT         NOT NULL,
  higher_levels         TEXT,                           -- texto de upcasting

  -- Resolución
  requires_attack_roll  BOOLEAN      NOT NULL DEFAULT FALSE,
  saving_throw          VARCHAR(3),                     -- STR|DEX|CON|INT|WIS|CHA
  damage_dice           VARCHAR(20),                    -- "8d6"
  damage_type           VARCHAR(20),                    -- fire|cold|... (reusa nomenclatura de items)
  damage_scaling        VARCHAR(120),                   -- "+1d6 por nivel sobre 3"

  -- Disponibilidad por clase (fuente de verdad de "quién puede aprenderlo")
  classes               TEXT[]       NOT NULL DEFAULT '{}',  -- ['wizard','sorcerer',...]

  -- Referencia SRD
  source_book           VARCHAR(10)  DEFAULT 'PHB',
  source_page           INTEGER,
  dnd5eapi_index        TEXT,                           -- índice único para seed idempotente
  open5e_key            TEXT,

  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_spells_dnd5eapi ON spells(dnd5eapi_index) WHERE dnd5eapi_index IS NOT NULL;
CREATE INDEX idx_spells_level   ON spells(level);
CREATE INDEX idx_spells_school  ON spells(school);
CREATE INDEX idx_spells_classes ON spells USING GIN (classes);
```

> **Nota sobre valores de clase:** se usan las claves canónicas del documento (§16): `bard, cleric, druid, paladin, ranger, sorcerer, warlock, wizard, eldritch_knight, arcane_trickster`. La ficha mapea el `class` en español del personaje a estas claves.

### 1.3 Tabla `character_spells` (repertorio del personaje)

```sql
CREATE TABLE character_spells (
  character_id  UUID     NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  spell_id      UUID     NOT NULL REFERENCES spells(id) ON DELETE CASCADE,
  is_prepared   BOOLEAN  NOT NULL DEFAULT FALSE,   -- para modelo "preparado"
  is_always_known BOOLEAN NOT NULL DEFAULT FALSE,  -- dominio/subclase que no cuenta al límite
  source        VARCHAR(20) NOT NULL DEFAULT 'class', -- class|subclass|race|feat|item
  notes         TEXT,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, spell_id)
);

CREATE INDEX idx_character_spells_char ON character_spells(character_id);
```

- **Modelo "conocido"** (Bardo, Hechicero, Brujo, Explorador): las filas *son* los hechizos conocidos; `is_prepared` se ignora (siempre lanzables).
- **Modelo "preparado"** (Clérigo, Druida, Paladín, Mago): las filas son el "grimorio"/acceso; `is_prepared=TRUE` marca los preparados del día.
- **Trucos (nivel 0):** también viven aquí (level=0 en `spells`), sin contar para límites de nivel 1+.

### 1.4 Migración de datos existentes

Migración one-off (script `db/migrate_spells_known.py`, idempotente):
1. Para cada personaje con `spells_known` no vacío, intentar casar cada `{name}` contra `spells.name`/`name_en`; si casa → insertar en `character_spells`. Si no casa → registrar en un log para revisión manual.
2. Convertir `cantrips_known` (TEXT[]) igual, marcando `source='class'`.
3. **No** se borran las columnas viejas en H1 (se dejan como respaldo); se marcan como deprecadas y se eliminan en H6 tras validar la migración.

---

## 2. Fases de implementación

### Fase H1 — Fundaciones de datos (backend) 🎯

**Entregables**
- [ ] Migración `db/migrations/004_spells.sql`: enum `spell_school`, tablas `spells` y `character_spells`, índices.
- [ ] `api/models/spell_model.py`: `SpellCreate / SpellUpdate / SpellOut` (toda la anatomía, validación de enums: `level 0–9`, `school`, `saving_throw ∈ {STR..CHA}`, `classes ⊆` set canónico) + `CharacterSpellAdd / CharacterSpellUpdate`.
- [ ] `api/routers/spells.py` con CRUD del catálogo:
  - `GET /api/v1/spells` — lista paginada + filtros (`level`, `school`, `class`, `q` búsqueda por nombre, `ritual`, `concentration`).
  - `GET /api/v1/spells/{id}`
  - `POST /api/v1/spells` — **admin-only** (`require_role`).
  - `PUT /api/v1/spells/{id}` — admin-only (INSERT/UPDATE dinámico con casts `::spell_school`, `::text[]`).
  - `DELETE /api/v1/spells/{id}` — admin-only.
- [ ] Registrar router en `api/main.py`.
- [ ] Respuestas con `helpers.py` (`list_response`, `item_response`) y `log_event` en create/update/delete.

**Criterio de aceptación:** migración aplica sin error; `python3 -c "import ast; ast.parse(open('api/models/spell_model.py').read())"` OK; CRUD probado en `/api/docs`.

---

### Fase H2 — Seed SRD completo + validación 🎯

**Entregables**
- [ ] `db/seed_spells.py`: seeder idempotente (índice único `dnd5eapi_index` + `ON CONFLICT (dnd5eapi_index) DO UPDATE`), patrón idéntico a `seed_items.py`.
  - Fuente: SRD 5.1 estructurada (dnd5eapi / open5e). Se descarga/parsea a un JSON local versionado en `db/data/srd_spells.json` para builds reproducibles sin depender de red en Railway.
  - Mapeo de campos SRD → columnas `spells` (incluye traducción de `name` a español donde exista; `name_en` siempre poblado).
  - Normalización de `classes` a claves canónicas.
- [ ] Verificación: conteo esperado (~319 hechizos SRD), 0 duplicados, todos con `school`, `level`, `classes` no vacío para los de clase.
- [ ] Script de conteo por nivel/escuela/clase para QA.

**Criterio de aceptación:** re-ejecutar el seed no crea duplicados; muestreo manual de 10 hechizos icónicos (Fireball, Magic Missile, Eldritch Blast, Cure Wounds, Counterspell, Wish) con datos correctos.

---

### Fase H3 — Catálogo en el menú Configuración (frontend) 🎯

**Entregables**
- [ ] Nueva ruta `#/spellbook` en `router.js` → `spells.js` (o reutilizar `spells.js` con modo por hash como hace `inventory.js`).
- [ ] Entrada en `NAV_GROUPS` → grupo **Configuración**: `{ icon: '📖', label: 'Catálogo de Hechizos', desc: 'Hechizos disponibles en la comunidad', route: '#/spellbook' }` (junto a "Catálogo" de ítems y "Miembros").
- [ ] `frontend/pages/spells.js`:
  - Grid/lista de hechizos con **filtros**: nivel (0–9), escuela, clase, ritual, concentración, búsqueda por texto.
  - Tarjeta compacta: nombre, nivel + escuela, tiempo/alcance, iconos V/S/M, insignias 🔵 concentración / 📜 ritual.
  - **Modal de detalle** con toda la información necesaria para entender el uso: nivel/escuela, tiempo de lanzamiento, alcance, componentes (con descripción material y coste), duración, concentración, ritual, descripción completa, "A niveles superiores", tirada de ataque/salvación, daño y escalado, clases que lo tienen.
  - **Admin:** botones crear/editar/eliminar → modal de formulario con campos condicionales (daño solo si aplica, material_description solo si `comp_material`, etc.). Reutiliza `toast.js` y `modal.js`.
- [ ] Estética: tokens CSS del design system; color por escuela (paleta derivada de `--gold`/`--crimson`/semánticos); microinteracciones según `emil-design-eng`.

**Criterio de aceptación:** admin crea/edita/borra; jugador navega y filtra; `tail -5 frontend/pages/spells.js` confirma cierre correcto.

---

### Fase H4 — Servicio de conjuración + parámetros calculados (backend) 🎯

**Entregables**
- [ ] `api/services/spellcasting.py` (lógica de dominio pura, sin DB), con las funciones del documento §16:
  - `spellcasting_ability_for(char_class)` → INT/WIS/CHA (tabla §1).
  - `caster_type(char_class)` → `full|half|third|pact|none`.
  - `preparation_model(char_class)` → `prepared|known`.
  - `spell_save_dc(prof_bonus, ability_mod)` = 8 + PB + mod.
  - `spell_attack_bonus(prof_bonus, ability_mod)` = PB + mod.
  - `spell_slots_for(caster_type, level, ...)` → tablas §3.1–3.4 (full/half/third/pact) como constantes.
  - `max_cantrips / max_spells_known / max_spells_prepared / max_spell_level` por clase y nivel (tablas §14).
  - `can_learn(spell, char_class, char_level)` → valida disponibilidad: la clase está en `spell.classes` **y** `spell.level ≤ max_spell_level`.
  - `cantrip_dice_count(character_level)` (escalado §4).
- [ ] `GET /api/v1/characters/{id}/spellcasting` — devuelve estado derivado (no persiste): ability, tipo de lanzador, modelo, CD, ataque, ranuras totales sugeridas por nivel, límites (trucos/conocidos/preparados), nivel máx de hechizo.
- [ ] Sincronización opcional: endpoint/acción para "recalcular ranuras" que rellena `characters.spell_slots.total` según clase+nivel (respetando `used`).

**Criterio de aceptación:** casos de prueba unitarios (`pytest` o script): Mago N5 INT16 → CD 13, ataque +5, ranuras [4,3,2], máx nivel 3; Brujo N5 → 2 ranuras nivel 3 (pact); Paladín N1 → no lanza.

---

### Fase H5 — Equipar/preparar hechizos en el personaje (backend + ficha) 🎯

**Entregables backend** (`spells.py`, repertorio):
- [ ] `GET /api/v1/characters/{id}/spells` — repertorio del personaje (join con `spells`), agrupado por nivel, con flags `is_prepared`.
- [ ] `POST /api/v1/characters/{id}/spells` `{spell_id}` — **aprender/añadir** al repertorio. Valida con `spellcasting.py`:
  - Disponibilidad por lista de clase (`can_learn`).
  - Nivel máximo permitido.
  - Límite de conocidos (modelo "conocido") / de trucos.
  - Reglas de integridad del documento §17 (bloqueantes vs advertencias).
- [ ] `PUT /api/v1/characters/{id}/spells/{spell_id}` — `is_prepared` toggle. Valida límite de preparados (`mod + nivel` según clase; paladín `mod + nivel/2`). Trucos no cuentan.
- [ ] `DELETE /api/v1/characters/{id}/spells/{spell_id}` — quitar del repertorio.
- [ ] Autorización: dueño del personaje, DM o admin (mismo patrón que edición de personaje).
- [ ] Respetar propiedad del owner (patrón `characters.py`). `log_event` en cambios.

**Entregables frontend** (reescritura tab **Hechizos** en `characters.js`, ~907–945):
- [ ] Cabecera con **parámetros calculados** (de `/spellcasting`): característica mágica, CD de salvación, bonus de ataque, nivel máx de hechizo, contadores "Trucos X/Y", "Preparados X/Y" o "Conocidos X/Y".
- [ ] **Panel de ranuras** (se conserva el diseño de burbujas actual) con toggle usar/recuperar por ranura.
- [ ] **Lista del repertorio** agrupada por nivel (trucos aparte). Cada hechizo: nombre, escuela, insignias, y (modelo preparado) checkbox "Preparado" reactivo con validación de límite.
- [ ] Botón **"Añadir hechizo"** → modal que **busca en el catálogo filtrado a la clase/nivel del personaje** (solo muestra lo que `can_learn` permite), con feedback de límites. POST al repertorio.
- [ ] Click en un hechizo → modal de detalle reutilizado de H3 (toda la info de uso).
- [ ] Advertencias no bloqueantes (documento §17): p. ej. "este hechizo requiere concentración", "componente material con coste".

**Criterio de aceptación:** un jugador con Mago N3 solo puede añadir hechizos de mago de nivel ≤2; excederse en preparados se bloquea con mensaje; el detalle muestra todo el contenido del hechizo.

---

### Fase H6 — Refinamientos mecánicos + limpieza (posterior, no bloqueante)

Elementos de máxima fidelidad diferidos del alcance pragmático:
- [ ] **Concentración:** rastrear "concentrando en" (máx 1) en la ficha, con aviso al lanzar un segundo hechizo de concentración; helper `concentration_save_dc(daño)` (§7).
- [ ] **Upcasting asistido:** al "lanzar", elegir nivel de ranura ≥ nivel del hechizo y mostrar el efecto escalado (texto `higher_levels`) — cálculo automático de dados donde el patrón sea parseable (§9).
- [ ] **Rituales:** marcar lanzables como ritual (sin gastar ranura, +10 min) según clase (§8).
- [ ] **Pact Magic completo (Brujo):** pool separado, recuperación en descanso corto, Mystic Arcanum N6–N9 (§2.4, §3.4).
- [ ] **Puntos de hechicería (Hechicero):** pool y conversión (§14.4).
- [ ] **Componentes con coste:** verificar/descontar del inventario al lanzar (Revivify → diamante 300 po) (§6, §17.11).
- [ ] **Descansos:** acción "descanso corto/largo" que recupera ranuras/pact/puntos y permite recambio de preparados (§17 recuperación).
- [ ] **Kafka:** topic `dnd.spells.cast` / `dnd.characters.spell_learned` (opcional, coherente con eventos existentes).
- [ ] **Limpieza:** eliminar columnas deprecadas `spells_known` (JSONB) y `cantrips_known` (TEXT[]) de `characters` tras validar la migración de H1.

---

## 3. Resumen de archivos afectados

| Acción | Archivo | Fase |
|--------|---------|------|
| NUEVO | `db/migrations/004_spells.sql` | H1 |
| NUEVO | `api/models/spell_model.py` | H1 |
| NUEVO | `api/routers/spells.py` | H1/H5 |
| EDIT | `api/main.py` (registrar router) | H1 |
| NUEVO | `db/seed_spells.py` + `db/data/srd_spells.json` | H2 |
| NUEVO | `db/migrate_spells_known.py` (migración de datos) | H1/H6 |
| NUEVO | `frontend/pages/spells.js` | H3 |
| EDIT | `frontend/js/router.js` (ruta + NAV_GROUPS) | H3 |
| NUEVO | `api/services/spellcasting.py` | H4 |
| EDIT | `api/routers/characters.py` (endpoint `/spellcasting` o delegar a spells.py) | H4 |
| EDIT | `frontend/pages/characters.js` (reescritura tab Hechizos) | H5 |
| EDIT | `CLAUDE.md` (documentar fases, tablas, rutas) | cada fase |

---

## 4. Reglas de integridad a implementar (del documento §17)

**Bloqueantes** (H4/H5): ranura ≥ nivel del hechizo; trucos nunca gastan ranura; `used ≤ total`; solo lanzar lo del repertorio; límites de preparados/conocidos/trucos; nivel máx de hechizo por nivel de personaje; solo el Mago prepara desde su grimorio.

**Advertencias** (H5, no bloquean): segundo hechizo de concentración; componente material faltante sin foco; hechizo sin ranuras disponibles del nivel; regla de acción bonus + truco.

**Diferidas a H6:** recuperación por descanso (corto = Pact Magic; largo = todo); consumo de componentes con coste; upcasting automático.

---

## 5. Orden recomendado y dependencias

```
H1 (datos)  ──►  H2 (seed)  ──►  H3 (catálogo UI)
   │
   └──►  H4 (servicio/cálculos)  ──►  H5 (equipar en ficha)  ──►  H6 (refinamientos)
```

H2 y H4 pueden avanzar en paralelo tras H1. H3 entrega valor visible pronto (catálogo navegable). H5 es el núcleo funcional del pedido ("equipar hechizos según clase/nivel"). H6 es incremental.

---

## 6. Consideraciones de despliegue

- **Migración:** aplicar `004_spells.sql` con `psql "$DATABASE_URL" -f` (patrón existente).
- **Seed en Railway:** ejecutar `seed_spells.py` una vez tras migrar (idempotente, reejecutable).
- **Sin build step frontend:** `spells.js` como ES Module nativo, servido por GitHub Pages.
- **Commits (desde PowerShell si el sandbox falla el lock):** `db:` para migración/seed, `feat:` para router/servicio/UI, `docs:` para CLAUDE.md.
- **Anti-truncación:** `tail -5` en JS grandes; `ast.parse` en modelos Python.
```
