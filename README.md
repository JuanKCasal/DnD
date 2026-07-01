# DnD Community Manager

Aplicación web de gestión para una comunidad de **Dungeons & Dragons 5e**: personajes, campañas, sesiones, inventario/economía y comunidad, con mecánicas fieles al PHB.

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
9. [Navegación de la app](#9-navegación-de-la-app)
10. [Referencia de API](#10-referencia-de-api)
11. [Desarrollo local y despliegue](#11-desarrollo-local-y-despliegue)
12. [Estado del proyecto](#12-estado-del-proyecto)

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
- **Hechizos:** espacios de conjuro.
- **Rasgos:** personalidad, ideales, vínculos, defectos, trasfondo, notas, dotes.
- **🎒 Inventario:** ítems del personaje con equipar/desequipar y quitar (ver §7).

Funciones adicionales de la ficha:

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

## 9. Navegación de la app

Barra superior horizontal con mega-menú (`max-width: 1300px`):

- **Dashboard** → `#/dashboard`
- **Mi DnD:** Personajes `#/characters`, Inventario del jugador `#/inventory`
- **Juego:** Campañas `#/campaigns`, Sesiones `#/sessions`, Tesoros `#/treasury`
- **Configuración:** Miembros `#/members`, Catálogo `#/catalogue`
- *Próximamente (deshabilitados):* Noticias, Perfil, Misiones, Clanes, Salón de la Fama, Chat, Calendario, Event Log.

---

## 10. Referencia de API

Base: `/api/v1`. Respuestas: lista `{"data":[...], "meta":{...}}`, ítem `{"data":{...}}`, error `{"error":{"code","message"}}`.

| Recurso | Endpoints principales |
|--------|----------------------|
| Auth | `POST /auth/login`, `POST /auth/register` |
| Members | `GET/POST/PUT /members` |
| Campaigns | `GET/POST/PUT/DELETE /campaigns` + `/campaigns/{id}/treasury` (ítems y `currency`) |
| Characters | `GET/POST/PUT/DELETE /characters`, `/hp`, `/conditions`, `/spell-slots`, **`/combat`** |
| Char. inventory | `GET/POST/PUT/DELETE /characters/{id}/inventory` (con `slot`, `attuned`) |
| Char. economía | `GET/PUT /characters/{id}/currency`, `POST /shop/buy`, `POST /shop/sell` |
| Consumibles/packs | `POST /inventory/{item_id}/use` · `/use-charge` · `/recharge`; `GET /packs`, `POST /characters/{id}/packs/{key}` |
| Sessions | `GET/POST/PUT/DELETE /sessions` + `/attendance` |
| Session loot | `GET/POST/DELETE /sessions/{id}/loot`, `POST /sessions/{id}/loot/{loot}/award` |
| Items (catálogo) | `GET/POST/PUT/DELETE /items` |
| Otros (backend listo) | `/ranks`, `/clans`, `/chat`, `/events` |

Docs interactivas: `/api/docs`.

---

## 11. Desarrollo local y despliegue

```bash
# Backend
cd api && uvicorn api.main:app --reload --port 8000     # http://localhost:8000/api/docs

# Frontend
cd frontend && python -m http.server 3000

# Migraciones (requiere .env con DATABASE_URL y certs/ca.pem)
python db/migrate.py                       # schema inicial
python db/migrate.py 003_equipment_slots.sql

# Seed del catálogo de ítems (216 ítems, idempotente)
python db/seed_items.py

# Utilidades
python reset_admin.py        # resetear password de admin
python fix_alignments.py     # normalizar alignment a enums (one-off)
```

**Despliegue:** frontend por GitHub Actions a GitHub Pages (`deploy-frontend.yml`); backend en Railway vía Docker.

> ⚠️ Existen dos Dockerfiles (`Dockerfile` en raíz y `api/Dockerfile`) que hacen casi lo mismo. Conviene conservar solo el que use Railway.

Los secretos (`.env`, `certs/`) están en `.gitignore` y **no se versionan**.

---

## 12. Estado del proyecto

**Completado:** Auth, Dashboard, Miembros, Campañas, Personajes (ficha completa + combate calculado), Sesiones (crónica/highlights/asistencia/botín) y el **sistema de ítems integral (Fases I1–I6)**: catálogo SRD, slots de equipo, sintonía, integración mecánica, economía/tienda, consumibles, packs y botín de sesión.

**Backend listo, frontend pendiente:** Rangos, Clanes, Chat/DMs, Event Log.

**Pendiente:** NPCs/Locations/Quests, Salón de la Fama, Calendario & Eventos, perfil de usuario, dice roller flotante, consumer Kafka → Discord.

Ver `CLAUDE.md` para detalles técnicos y `PLAN_MEJORAS_ITEMS.md` para el plan del sistema de ítems.
