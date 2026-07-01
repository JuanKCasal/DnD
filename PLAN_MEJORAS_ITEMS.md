# Plan de Implementación — Mejoras Globales al Manejo de Ítems

> **Estado:** Propuesta · **Fecha:** 2026-06-30
> **Base:** Análisis de `dnd5e_equipment_guide.md` contra el código actual (schema v2.0, `api/`, `frontend/`).
> **Objetivo:** Llevar el subsistema de ítems desde un catálogo plano CRUD hasta un sistema completo de equipamiento, sintonía, economía e integración mecánica con la ficha de personaje, alineado con D&D 5e.

---

## 0. Diagnóstico — estado actual vs. lo que falta

El hallazgo central es que **el schema de la base de datos ya es rico, pero la capa de modelos, el router y el frontend solo exponen una fracción**. La tabla `items` (migración `001`, líneas 375–424) ya tiene columnas para armas, armaduras, cargas, objetos sintientes/malditos, `magical_properties JSONB` y referencias SRD — pero casi nada de eso se puede crear, leer ni editar desde la app.

### 0.1 Inconsistencias y bugs confirmados (deuda técnica)

| # | Problema | Ubicación | Impacto |
|---|----------|-----------|---------|
| B1 | **`ItemCreate` duplicado y divergente.** Existe en `api/models/item.py` (usa `item_type`, incluye `icon_url`, campos de arma/armadura) y en `api/models/inventory_model.py` (usa `type`, sin esos campos). El router importa el de `inventory_model.py`; el de `item.py` está **muerto y es inconsistente**. | `models/item.py` vs `models/inventory_model.py` | Confusión, riesgo de bug al editar el modelo equivocado |
| B2 | **`icon_url` no existe en la tabla `items`.** `item.py::ItemCreate` lo declara; si se usara, el INSERT fallaría. | `models/item.py` | Modelo inválido contra el schema |
| B3 | **El modelo activo omite ~25 columnas existentes.** `inventory_model.py::ItemCreate/ItemUpdate` no exponen: `charges_max`, `charges_recharge`, `sentient`, `cursed`, todos los campos de arma (`weapon_category`, `damage_dice`, `damage_type`, `damage_dice_versatile`, `range_*`, `throw_range_*`, `weapon_properties`, `bonus_attack`), todos los de armadura (`armor_category`, `ac_base`, `ac_dex_bonus`, `ac_max_dex_bonus`, `str_minimum`, `stealth_disadvantage`, `bonus_ac`), `magical_properties`, `dnd5eapi_index`, `open5e_key`. | `models/inventory_model.py` | Imposible registrar datos mecánicos de armas/armaduras |
| B4 | **`create_item` INSERT solo escribe 12 columnas básicas.** | `routers/inventory.py` L80–94 | Las columnas mecánicas nunca se pueblan |
| B5 | **`list_items` SELECT no devuelve campos de arma/armadura.** `get_item` devuelve cargas/sentient/cursed pero tampoco arma/armadura/`magical_properties`. | `routers/inventory.py` L57–67, L106–118 | El frontend no puede mostrar daño/CA/propiedades |
| B6 | **No hay endpoint de moneda del personaje.** Existe la tabla `character_currency` y la UI de moneda de campaña, pero el jugador no puede ver ni editar su propio dinero. | `routers/inventory.py` | Funcionalidad ausente |
| B7 | **Filtro de tipos del catálogo incompleto.** El `select` del frontend omite `rod`, `staff`, `wand`, `ammunition`, `vehicle` (sí existen en el enum `item_type`). | `frontend/pages/inventory.js` L285–290 | Items inalcanzables por filtro |
| B8 | **Sin modal de detalle ni de edición de ítem.** El catálogo solo permite crear y borrar; no se puede ver la ficha completa ni editar un ítem existente. | `frontend/pages/inventory.js` | UX limitada |

### 0.2 Capacidades de dominio ausentes (vs. la guía)

| # | Capacidad de la guía | ¿Existe hoy? |
|---|----------------------|--------------|
| G1 | **Slots de equipo** (cabeza, cuello, cuerpo, manos, anillos×2, etc. — guía §1) | No. `character_inventory` solo tiene `equipped BOOLEAN`, sin slot |
| G2 | **Regla de manos** (arma a 2 manos bloquea off-hand; escudo incompatible) | No |
| G3 | **Límite de sintonía = 3 objetos** (guía §1) | No se valida; `attuned` es un booleano libre |
| G4 | **Integración mecánica con la ficha:** armadura → CA; arma → daño/ataque; `str_minimum` → −10 ft velocidad; desventaja Sigilo | No. Equipar no afecta stats del personaje |
| G5 | **Capacidad de carga / encumbramiento** (FUE×15; peso de monedas: 50 = 1 lb — guía §13) | No |
| G6 | **Economía / tienda:** comprar, vender, precio de referencia, conversión de moneda | No |
| G7 | **Consumibles funcionales:** "usar poción" → −1 cantidad y aplicar efecto; cargas y recarga | No (cantidad solo manual) |
| G8 | **Catálogo SRD precargado** (la guía ES esencialmente el dataset: armas, armaduras, herramientas, gear, pociones, venenos, monturas) | No. Items se crean a mano uno por uno |
| G9 | **Reparto de botín** — tabla `session_loot` existe sin router ni UI | No |
| G10 | **Packs de aventurero** (guía §8) como conjuntos predefinidos | No |

---

## 1. Principios de diseño del plan

1. **Aprovechar el schema existente antes de migrar.** La mayoría de la Fase I1 es exponer columnas que ya existen, no crear nuevas.
2. **El cobre es la unidad base.** Internamente toda conversión de moneda se hace en `cp` (guía §2); las columnas por denominación se mantienen para almacenamiento pero los cálculos usan un helper `to_copper()/from_copper()`.
3. **Cálculo mecánico derivado, no duplicado.** CA efectiva, capacidad de carga y bonos de ataque se **calculan** a partir de ítems equipados + stats; no se almacenan denormalizados (evita desincronización).
4. **Backward-compatible.** Migraciones aditivas (`ADD COLUMN ... DEFAULT`), sin romper datos existentes.
5. **Seguir convenciones del repo:** respuestas `list_response`/`item_response`, `log_event`, eventos Kafka, ES Modules sin build, tokens CSS, anti-truncación.

---

## 2. Fases de implementación (ordenadas por prioridad)

### Fase I1 — Saneamiento del modelo de datos de ítems  ⭐ *prioridad máxima, base de todo*

**Meta:** un único modelo de ítem coherente que exponga todas las columnas del schema. Sin esto, ninguna fase posterior tiene datos que mostrar.

- **Eliminar `api/models/item.py`** (modelo muerto B1/B2) o convertirlo en re-export del modelo canónico. Dejar `inventory_model.py` como única fuente.
- **Ampliar `ItemCreate` / `ItemUpdate` / `ItemOut`** con todos los campos: cargas (`charges_max`, `charges_recharge`), flags (`sentient`, `cursed`), bloque de arma, bloque de armadura, `magical_properties: dict`, refs SRD. Tipado correcto (`weapon_properties: list[str]`, `magical_properties: dict`).
- **Reescribir `create_item` / `update_item`** para INSERT/UPDATE dinámico de todas las columnas, con cast de enums (`type`, `rarity`) y de array (`weapon_properties`) y JSONB (`magical_properties`).
- **Ampliar SELECTs** de `list_items` y `get_item` para devolver el conjunto completo (B5). Mantener `list_items` con proyección "ligera" + `get_item` "completa" para no inflar listados.
- **Validación Pydantic:** `weapon_category ∈ {Simple, Martial}`, `armor_category ∈ {Light, Medium, Heavy, Shield}`, `rarity`/`type` contra enums.
- **Verificación:** `python3 -c "import ast; ast.parse(...)"` sobre los modelos; smoke test de POST/GET/PUT `/items` en `/api/docs`.

**Entregables:** `models/inventory_model.py`, `routers/inventory.py`. **Sin migración DB.**

---

### Fase I2 — Catálogo SRD precargado + UI de ítem completa

**Meta:** que el catálogo nazca lleno con el contenido de la guía y que la UI muestre/edite la riqueza del modelo.

- **Migración de datos `db/migrations/002_seed_srd_items.sql`** (o script Python idempotente `db/seed_items.py`): poblar `items` desde las tablas de la guía — armaduras (§4), armas simples/marciales + munición (§5–5.6), herramientas/kits/instrumentos (§6), adventuring gear (§7), consumibles: pociones/pergaminos/venenos (§9), monturas y vehículos (§10), una muestra representativa de objetos mágicos (§11). Usar `ON CONFLICT (dnd5eapi_index) DO NOTHING` para idempotencia (requiere índice único en `dnd5eapi_index`).
- **Frontend — modal de detalle de ítem** (`buildItemDetailModal`): al click en una card del catálogo, mostrar ficha completa — daño/tipo/propiedades de arma, CA/DES/FUE-mín/Sigilo de armadura, cargas, sintonía/restricción, peso, valor con denominación, fuente.
- **Frontend — modal de edición** (reusar/extender `openCreateItemModal` → `openItemModal(mode)`) con campos condicionales según `type` (mostrar bloque de arma solo si `weapon`, etc.).
- **Fix B7:** completar el filtro de tipos con `rod`, `staff`, `wand`, `ammunition`, `vehicle`.
- **Verificación:** contar filas sembradas por categoría; revisar que las cards rendericen daño/CA; probar 375px y 1280px.

**Entregables:** `db/migrations/002_*.sql` o `db/seed_items.py`, `frontend/pages/inventory.js`. **Migración:** índice único + seed.

---

### Fase I3 — Slots de equipo, sintonía y reglas de manos

**Meta:** equipar deja de ser un booleano y pasa a ser un sistema de slots con reglas D&D.

- **Migración `003_equipment_slots.sql`:** `ALTER TABLE character_inventory ADD COLUMN slot VARCHAR(12)` (NULL = en mochila). Opcional: enum `equip_slot` (`head, neck, body, cloak, hands, ring_left, ring_right, waist, feet, main_hand, off_hand, back`).
- **Reglas en el backend** (al hacer PUT equip):
  - Un slot acepta 1 ítem (salvo anillos: 2 dedos).
  - Arma `two_handed` ocupa `main_hand` + bloquea `off_hand`; escudo en `off_hand` incompatible con arma a 2 manos.
  - **Límite de sintonía = 3** por personaje: validar antes de poner `attuned = TRUE`; error `ATTUNEMENT_LIMIT_REACHED` si se excede.
  - Solo ítems con `requires_attunement` pueden sintonizarse.
- **Frontend:** vista de "muñeco"/paper-doll o lista agrupada por slot; selector de slot al equipar; contador de sintonía "X/3".
- **Verificación:** tests de los casos límite (2-handed + escudo, 4º sintonizado, 3 anillos).

**Entregables:** `db/migrations/003_*.sql`, `routers/inventory.py`, `models/inventory_model.py`, `frontend/pages/inventory.js` + `frontend/pages/characters.js` (tab Inventario).

---

### Fase I4 — Integración mecánica con la ficha de personaje

**Meta:** el equipo afecta los stats. Es la fase de mayor valor percibido.

- **Helper de cálculo** `api/services/character_mechanics.py` (o en el router de characters):
  - **CA efectiva** = `base_ac` de la armadura equipada + aplicación de DES según `ac_dex_bonus`/`ac_max_dex_bonus` + `bonus_ac` de escudo/ítems mágicos + bonos de `magical_properties` (guía §4, §12). Sin armadura: 10 + DES (o fórmulas de clase, ya contempladas en la skill `dnd`).
  - **Penalización de velocidad** −10 ft si `str_score < str_minimum` de la armadura pesada equipada (guía §4.3).
  - **Desventaja en Sigilo** si la armadura equipada tiene `stealth_disadvantage` (flag a mostrar en la ficha).
  - **Ataques de arma:** listar armas equipadas con bono de ataque (mod + BPC + `bonus_attack`) y daño (`damage_dice` + mod), respetando `finesse`/`versatile`/`thrown`.
- **Exponer** estos derivados en `GET /characters/{id}` (o endpoint `/characters/{id}/combat`) sin persistirlos.
- **Frontend (`characters.js`):** la ficha muestra CA calculada con desglose, indicador de Sigilo/velocidad, y un bloque "Ataques" derivado del equipo.
- **Consultar skill `dnd`** para valores canónicos y fórmulas; **`emil-design-eng`/`design-taste-frontend`** para el bloque de combate.
- **Verificación:** casos de prueba contra ejemplos PHB (p. ej. Cota de placas FUE 13 → −10 ft; cuero + DES alta; coraza máx +2).

**Entregables:** servicio de cálculo, `routers/characters.py`, `frontend/pages/characters.js`.

---

### Fase I5 — Economía: moneda del personaje, carga y tienda

**Meta:** cerrar el ciclo económico y de supervivencia.

- **Moneda del personaje (fix B6):** endpoints `GET/PUT /characters/{id}/currency`; helpers `to_copper()/from_copper()` y `format_currency()` (denominación más significativa, guía §2). UI de monedas en el tab Inventario del personaje (reusar componente de monedas del tesoro).
- **Capacidad de carga (guía §13):** calcular `peso_total = Σ(item.weight × qty) + peso_monedas (Σmonedas/50)`; capacidad = `FUE × 15`; estados *normal / sobrecargado / muy sobrecargado*. Mostrar barra de carga en la ficha (cálculo derivado, no persistido).
- **Tienda / compra-venta (guía §14):** flujo "comprar" (descuenta moneda del personaje, añade al inventario) y "vender" (suele 50% del valor; mover ítem a moneda). Endpoint transaccional `POST /characters/{id}/shop/buy|sell`. Precios desde `value_gp`/`cost`.
- **Transferencias tesoro ↔ personaje** (repartir botín de campaña a un PJ).
- **Verificación:** transacción atómica (no dejar moneda negativa ni ítem duplicado); conversión cp↔denominaciones round-trip.

**Entregables:** `routers/inventory.py` (+ posible `routers/economy.py`), `models`, `frontend`.

---

### Fase I6 — Consumibles, cargas, botín y packs *(mejoras finales)*

**Meta:** pulir interacciones de uso y flujos de DM.

- **Usar consumible:** acción "Usar" en ítems `is_consumable` → decrementa cantidad; para pociones de curación, opción de aplicar HP (integra con `/characters/{id}/hp`, guía §9.1). Evento Kafka `dnd.inventory.updated`.
- **Cargas y recarga:** UI de `charges_current/charges_max`; lógica de recarga (`dawn/short_rest/long_rest`) manual o por evento.
- **Reparto de botín (`session_loot`, G9):** router + UI para que el DM registre botín por sesión y lo asigne a personajes o al tesoro.
- **Packs de aventurero (G10):** definir packs (guía §8) como plantillas que añaden su contenido al inventario en un click.
- **Veneno aplicado a arma** y **antitoxina** como casos especiales de consumible (guía §9.3) — opcional.

**Entregables:** `routers/`, `models/`, `frontend/`, posible `db/migrations/004_*.sql` para packs.

---

## 3. Resumen de migraciones DB

| Migración | Contenido | Fase |
|-----------|-----------|------|
| *(ninguna)* | I1 solo toca modelos/router | I1 |
| `002_seed_srd_items.sql` | Índice único `dnd5eapi_index` + seed SRD | I2 |
| `003_equipment_slots.sql` | `character_inventory.slot` (+ enum opcional) | I3 |
| `004_packs.sql` *(opc.)* | Tablas de packs de aventurero | I6 |

Moneda en `cp` se maneja por **helper de aplicación**, no requiere cambio de columnas.

---

## 4. Orden recomendado y dependencias

```
I1 (modelo)  ──►  I2 (catálogo+UI)  ──►  I3 (slots/sintonía)  ──►  I4 (mecánica ficha)
                                                 └──►  I5 (economía)  ──►  I6 (consumibles/botín)
```

- **I1 es bloqueante de todo.** Es además la de menor esfuerzo (sin migración).
- **I2** da valor inmediato (catálogo deja de estar vacío) y es independiente de I3+.
- **I4** depende de I3 (necesita saber qué está equipado por slot).
- **I5/I6** pueden solaparse una vez I3 está listo.

---

## 5. Riesgos y mitigaciones

- **Desincronización de stats derivados** → calcular siempre on-read; no persistir CA/carga.
- **Seed SRD voluminoso/erróneo** → script idempotente con `ON CONFLICT`; sembrar por lotes y verificar conteos.
- **Git lock desde el sandbox** (ver CLAUDE.md) → commits/push desde PowerShell en Windows.
- **Truncación de `inventory.js`/`characters.js`** (archivos grandes) → verificar con `tail -5` tras cada edición.
- **Compatibilidad de datos existentes** → migraciones aditivas con `DEFAULT`.

---

## 6. Próximo paso sugerido

Comenzar por **Fase I1** (saneamiento del modelo) por ser la base sin migración y de bajo riesgo, seguida de **I2** para llenar el catálogo. ¿Avanzo con la implementación de I1?
