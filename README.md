# DnD Community Manager

Aplicación web de gestión para una comunidad de **Dungeons & Dragons 5e**: personajes, campañas, sesiones, inventario/economía, **hechizos** y comunidad, con mecánicas fieles al PHB.

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
6. [Sesiones y botín](#6-sesiones-y-botín)
7. [Sistema de ítems e inventario](#7-sistema-de-ítems-e-inventario)
8. [Economía](#8-economía)
9. [Sistema de hechizos y magia](#9-sistema-de-hechizos-y-magia)
10. [Navegación de la app](#10-navegación-de-la-app)
11. [Referencia de API](#11-referencia-de-api)
12. [Desarrollo local y despliegue](#12-desarrollo-local-y-despliegue)
13. [Estado del proyecto](#13-estado-del-proyecto)

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
- Campos: nombre, DM, sistema, estado (activa/pausada/completada/archivada), descripción, lore, mundo/ambientación, fechas.
- Miembros de campaña.
- Cada campaña tiene su **tesoro** (ítems + monedas) — ver §7–8.

---

## 5. Personajes

Ficha completa de D&D 5e con creación/edición en un **modal de 5 pestañas**:

- **General:** identidad (raza, subraza dinámica, clase, trasfondo, alineamiento, deidad, nivel, campaña, retrato), combate (HP, CA, velocidad…), 6 puntuaciones de característica, personalidad e historia.
- **Habilidades:** tiradas de salvación deterministas por clase (PHB) y 18 habilidades con competencias (trasfondo/raza bloqueadas, clase con checkboxes limitados).
- **Hechizos:** parámetros de conjuración, ranuras y repertorio completo — ver §9.
- **Rasgos:** personalidad, ideales, vínculos, defectos, trasfondo, notas, dotes.
- **🎒 Inventario:** ítems del personaje con equipar/desequipar y quitar (ver §7).

Funciones adicionales de la ficha:

- **Tarjetas con el retrato a pantalla completa** y un panel de datos (nombre, clase, HP, características) con **desenfoque (glassmorphism)** para mantener la legibilidad sobre la imagen.
- **Editar/eliminar** desde las tarjetas (admin, DM y dueño). Eliminar es *soft-delete*.
- **Subir de nivel** → evento Kafka `dnd.characters.leveled_up` + toast.
- **Editar HP** directamente.
- **Panel "Combate según equipo" (calculado, Fase I4):** CA efectiva con desglose, velocidad con penalización por carga/FUE, indicador de sigilo y lista de **ataques** (bono y daño según FUE/DES, *finesse*, distancia, competencia y bonos mágicos). Se calcula bajo demanda vía `GET /characters/{id}/combat` y nunca se persiste.

---

## 6. Sesiones y botín

- **CRUD de sesiones** con numeración automática por campaña y eliminación.
- Vista **timeline** con tarjetas y filtro por campaña.
- Detalle en **modal con pestañas**:
  - **📖 Crónica** en markdown (render con marked.js).
  - **⭐ Highlights**.
  - **👥 Asistencia** — registro de presentes/ausentes y XP por miembro.
  - **💎 Botín** — listado del botín de la sesión; el DM/admin puede **añadir** ítems del catálogo, **otorgarlos a un personaje o al tesoro** de campaña, y **eliminarlos**. Al otorgar, el ítem se transfiere realmente al inventario del PJ o al tesoro.
- Evento Kafka `dnd.sessions.created` al crear una sesión.

---

## 7. Sistema de ítems e inventario

Catálogo SRD completo y mecánicas de equipo fieles a 5e. El catálogo se puebla con **216 ítems** mediante `db/seed_items.py` (armas, armaduras, munición, herramientas, equipo de aventurero, pociones, pergaminos, venenos, monturas/vehículos y una selección de objetos mágicos).

La página de inventario tiene **tres modos** según la ruta:

### `#/inventory` — Inventario del jugador
- Selector de personaje + su **cartera** y **barra de carga** (ver §8).
- Lista de ítems separada en **Equipado / Mochila**.
- **Equipar** con selector de **ranura** (cabeza, cuello, cuerpo, capa, manos, 2 anillos, cintura, pies, mano principal/secundaria, espalda) y reglas: 1 ítem por ranura, arma a dos manos bloquea la mano secundaria, escudo incompatible con arma a dos manos.
- **Sintonía**: botón para objetos que la requieren, con **límite de 3** y contador "🔮 X/3".
- **Usar** consumibles (las pociones de curación aplican PG con tirada de dados).
- **Cargas**: botón "⚡ actual/máx" (clic = usar carga, clic derecho = recargar).
- **Vender** ítems (50% del valor) y **comprar** desde el catálogo descontando oro.
- **🎒 Packs de aventurero**: añaden en un clic un conjunto predefinido (explorador, mazmorrero, ladrón, sacerdote).
- La fila muestra ranura equipada, daño del arma y CA de la armadura.

### `#/treasury` — Tesoros de campaña (DM/admin)
- Ítems y **monedas** del grupo por campaña; añadir/quitar ítems y editar monedas.

### `#/catalogue` — Catálogo de la comunidad (admin)
- Búsqueda y filtros por tipo y rareza.
- **Detalle** de ítem con toda la ficha mecánica (daño, propiedades, CA, DES/FUE, cargas, sintonía, fuente).
- **Crear/editar/eliminar** ítems con campos condicionales según el tipo (aparecen campos de arma o de armadura).

Cada ítem soporta: tipo, rareza, peso, valor, flags (mágico/consumible/sintonía), cargas, bloque de arma (categoría, alcance, dado de daño, tipo, versátil, rangos, propiedades, bono), bloque de armadura (categoría, CA base, DES, FUE mínima, sigilo, bono CA), `magical_properties` (JSONB) y referencias SRD.

---

## 8. Economía

- **Moneda del personaje** (pp/po/pe/pa/pc) editable, con conversión interna en piezas de cobre.
- **Peso de monedas** (50 monedas = 1 lb) y **capacidad de carga** (FUE × 15) con estado de **encumbramiento** (normal / cargado −10 ft / muy cargado −20 ft / sobrecargado), mostrado como barra.
- **Tienda:** comprar (descuenta oro, valida fondos) y vender (50% del valor) de forma **transaccional**.
- **Moneda de campaña** en el tesoro.

---

## 9. Sistema de hechizos y magia

Sistema completo de conjuración D&D 5e (Fases H1–H6), fiel al PHB.

### Catálogo de hechizos — `#/spellbook` (menú Configuración)
- **319 hechizos de la SRD 5.1** poblados con `db/seed_spells.py` (seeder idempotente que cachea la fuente en `db/data/srd_spells.json`). Nombres **en español** para los 319; descripciones en inglés oficial (SRD/OGL), editables.
- Grid de tarjetas con color/ícono por **escuela**, meta rápida (tiempo/alcance/componentes) e insignias (concentración, ritual, ataque, salvación, daño).
- **Filtros:** búsqueda por nombre (ES/EN), nivel (0–9), escuela, clase, ritual/concentración.
- **Detalle** con toda la información de uso: nivel/escuela, tiempo de lanzamiento, alcance, componentes V/S/M (+ material y coste), duración, concentración, ritual, descripción, "a niveles superiores" (upcasting) y clases.
- **CRUD admin:** crear/editar/eliminar hechizos, incluido el **enlace a un ítem consumible** como componente material y su coste.

### Parámetros y repertorio en la ficha (pestaña Hechizos)
- Estado de conjuración **calculado por clase y nivel** (`GET /characters/{id}/spellcasting`): característica mágica, **CD de salvación**, **bonus de ataque**, nivel máximo de hechizo y contadores de **trucos/preparados/conocidos**.
- **Espacios de conjuro** (o **Pact Magic** para el brujo) con recuento disponible/total.
- **Repertorio** agrupado por nivel; cada hechizo se expande con su ficha completa.
- **Añadir hechizos** desde el catálogo **filtrado por la clase y el nivel** del personaje (validación de disponibilidad y límites según el PHB).
- **Preparar** hechizos (clases de preparación) con control del límite diario.

### Lanzamiento y estado (Fase H6)
- **✦ Lanzar**: gasta la ranura correspondiente; **upcasting asistido** (elegir el nivel de ranura y ver el efecto escalado); **rituales** sin gastar ranura (clases que lo permiten).
- **Concentración**: se rastrea el hechizo activo (máx. 1), con aviso al reemplazarlo.
- **Descansos**: corto (recupera Pact Magic) y largo (recupera todo y termina la concentración); recuperación manual de ranuras.
- **Coste de componentes**: si un hechizo tiene enlazado un ítem consumible, **no puede lanzarse sin tenerlo** en el inventario y **se consume** al lanzarlo.

Las reglas viven en `api/services/spellcasting.py` (tablas de ranuras full/half/third/pact, CD/ataque, límites, disponibilidad); el catálogo y el repertorio en `api/routers/spells.py`.

---

## 10. Navegación de la app

Barra superior horizontal con mega-menú (`max-width: 1300px`):

- **Dashboard** → `#/dashboard`
- **Mi DnD:** Personajes `#/characters`, Inventario del jugador `#/inventory`
- **Juego:** Campañas `#/campaigns`, Sesiones `#/sessions`, Tesoros `#/treasury`
- **Configuración:** Miembros `#/members`, Catálogo `#/catalogue`, Catálogo de Hechizos `#/spellbook`
- *Próximamente (deshabilitados):* Noticias, Perfil, Misiones, Clanes, Salón de la Fama, Chat, Calendario, Event Log.

---

## 11. Referencia de API

Base: `/api/v1`. Respuestas: lista `{"data":[...], "meta":{...}}`, ítem `{"data":{...}}`, error `{"error":{"code","message"}}`.

| Recurso | Endpoints principales |
|--------|----------------------|
| Auth | `POST /auth/login`, `POST /auth/register` |
| Members | `GET/POST/PUT /members` |
| Campaigns | `GET/POST/PUT/DELETE /campaigns` + `/campaigns/{id}/treasury` (ítems y `currency`) |
| Characters | `GET/POST/PUT/DELETE /characters`, `/hp`, `/conditions`, `/spell-slots`, **`/combat`**, **`/spellcasting`** |
| Char. inventory | `GET/POST/PUT/DELETE /characters/{id}/inventory` (con `slot`, `attuned`) |
| Char. economía | `GET/PUT /characters/{id}/currency`, `POST /shop/buy`, `POST /shop/sell` |
| Consumibles/packs | `POST /inventory/{item_id}/use` · `/use-charge` · `/recharge`; `GET /packs`, `POST /characters/{id}/packs/{key}` |
| Sessions | `GET/POST/PUT/DELETE /sessions` + `/attendance` |
| Session loot | `GET/POST/DELETE /sessions/{id}/loot`, `POST /sessions/{id}/loot/{loot}/award` |
| Items (catálogo) | `GET/POST/PUT/DELETE /items` |
| Spells (catálogo) | `GET/POST/PUT/DELETE /spells` (mutaciones admin) |
| Repertorio del PJ | `GET/POST/PUT/DELETE /characters/{id}/spells` |
| Conjuración | `POST /characters/{id}/cast`, `POST /characters/{id}/rest`, `PUT /characters/{id}/concentration`, `POST /characters/{id}/spell-slots/restore` |
| Otros (backend listo) | `/ranks`, `/clans`, `/chat`, `/events` |

Docs interactivas: `/api/docs`.

---

## 12. Desarrollo local y despliegue

```bash
# Backend
cd api && uvicorn api.main:app --reload --port 8000     # http://localhost:8000/api/docs

# Frontend
cd frontend && python -m http.server 3000

# Migraciones (requiere .env con DATABASE_URL y certs/ca.pem)
python db/migrate.py                        # schema inicial
python db/migrate.py 003_equipment_slots
python db/migrate.py 004_spells             # enum spell_school + spells/character_spells
python db/migrate.py 005_spellcasting_state # concentración + material_item_id
python db/migrate.py 006_drop_deprecated_spell_columns

# Seeds (idempotentes)
python db/seed_items.py      # 216 ítems SRD
python db/seed_spells.py     # 319 hechizos SRD (cachea db/data/srd_spells.json)

# Utilidades
python reset_admin.py        # resetear password de admin
python fix_alignments.py     # normalizar alignment a enums (one-off)
```

> En Windows/PowerShell, usar la ruta completa del intérprete, p. ej.:
> `C:\Users\casal\AppData\Local\Programs\Python\Python312\python.exe db/migrate.py 004_spells`

**Despliegue:** frontend por GitHub Actions a GitHub Pages (`deploy-frontend.yml`); backend en Railway vía Docker.

> ⚠️ Existen dos Dockerfiles (`Dockerfile` en raíz y `api/Dockerfile`) que hacen casi lo mismo. Conviene conservar solo el que use Railway.

Los secretos (`.env`, `certs/`) están en `.gitignore` y **no se versionan**.

---

## 13. Estado del proyecto

**Completado:** Auth, Dashboard, Miembros, Campañas, Personajes (ficha completa + combate calculado + tarjetas con retrato a pantalla completa), Sesiones (crónica/highlights/asistencia/botín), el **sistema de ítems integral (Fases I1–I6)** y el **sistema de hechizos integral (Fases H1–H6)**: catálogo SRD de 319 hechizos, servicio de reglas de conjuración, equipar/preparar por clase/nivel/disponibilidad, lanzamiento con upcasting/ritual, concentración, descansos y coste de componentes.

**Backend listo, frontend pendiente:** Rangos, Clanes, Chat/DMs, Event Log.

**Pendiente:** NPCs/Locations/Quests, Salón de la Fama, Calendario & Eventos, perfil de usuario, dice roller flotante, consumer Kafka → Discord.

Ver `CLAUDE.md` para detalles técnicos, `PLAN_MEJORAS_ITEMS.md` (sistema de ítems) y `PLAN_MEJORAS_HECHIZOS.md` (sistema de hechizos).
