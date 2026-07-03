# PLAN DE MEJORAS — NOTICIAS (Tablón de Misiones del Gremio)

> Página `#/noticias` (grupo raíz **Noticias**, hoy deshabilitado en `router.js`).
> Objetivo: convertir la entrada muerta de la nav en la **portada viva de la comunidad**,
> con estética de **tablón de misiones de un gremio de aventureros** (fantasía medieval /
> isekai): pergamino, sellos de cera, chinchetas, rangos de misión S/A/B/C/D, y las
> últimas novedades reales de la app en tiempo (casi) real.

---

## 1. Análisis — ¿qué "novedades" tenemos ya en el backend?

No requiere **ningún endpoint nuevo**. Todo sale de datos que ya existen:

### 1.1 Feed de gestas — `GET /api/v1/events?per_page=40` (event_log público)
Acciones registradas con `is_public=TRUE` (verificadas en los routers):

| Acción                  | Origen              | En el tablón            | Rango sugerido |
|-------------------------|---------------------|-------------------------|----------------|
| `member.registered`     | auth.register       | "se unió al gremio"     | D              |
| `character.created`     | characters.create   | "nuevo aventurero"      | C              |
| `character.leveled_up`  | characters.update   | "alcanzó el nivel N"    | A              |
| `clan.created`          | clans.create        | "fundó el gremio «…»"   | A              |
| `clan.member_joined`    | clans.join/accept   | "se unió a un gremio"   | C              |
| `session.created`       | sessions.create     | "nueva crónica «…»"     | B              |
| `award.granted`         | hall.grant_award    | "condecoración «…»"     | S              |

`GET /events` devuelve: `id, occurred_at, actor_member_id, actor_character_id, action,
target_type, target_id, target_name, metadata, is_public`.
Notas: no trae nombres de actor (solo IDs) → se resuelven con un mapa de `GET /members`.
`metadata` puede llegar como string JSON (sin codec JSONB) → parsear defensivamente;
el nivel de `character.leveled_up` está en `metadata.after.level`. El tiempo es
`occurred_at` (no `created_at`).

### 1.2 Secciones enriquecidas (listas dedicadas, todas ya existentes)
- **Contadores del gremio** — `meta.total` de `/members`, `/campaigns`, `/sessions`, `/characters`.
- **Misiones** — `GET /campaigns/{id}/quests` por campaña (el backend ya filtra
  `visible_to_players` y oculta `dm_notes`). Se recorren las campañas de
  `GET /campaigns` (máx. ~8, en paralelo) y se agrupan en **abiertas** y **cumplidas**
  (`status`, `reward_xp`, `reward_gp`, `completed_at`, `quest_type`).
- **Crónicas recientes** — `GET /sessions?per_page=6` (`session_number`, `title`, `date`, `xp_awarded`).
- **Nuevos aventureros** — `GET /characters?per_page=8` (`name`, `race`, `class`, `level`, `portrait_url`).
- **Gremios** — `GET /clans?per_page=8` (`name`, `emblem_url`, `color_hex`, `motto`, `member_count`).
- **Salón de honor** — `GET /hall/leaderboard` (top por XP) y `GET /hall/awards` (últimas medallas).
- **Próximos eventos** — `GET /community/posts?board=events` (`title`, `body`, `event_date`, `pinned`).

Todas las llamadas van con `Promise.allSettled`: cada sección **degrada con gracia**
(muestra vacío/omite) si su endpoint falla o no está desplegado.

---

## 2. Diseño visual — "Adventurer's Guild Board"

Dentro del design system vigente (tema pergamino claro; tokens `--void/--gold/--crimson/…`),
sin librerías ni imágenes externas (solo CSS + emoji), respetando `emil-design-eng`,
`design-taste-frontend` y `high-end-visual-design`.

- **Hero del gremio**: crestón `᛭`, título *"Gremio de Aventureros — Tablón de Misiones"*,
  subtítulo con la fecha, y **libro mayor** con 4 contadores grabados (miembros/campañas/
  sesiones/personajes) con animación de conteo.
- **Tablón**: panel tipo pergamino con doble borde dorado, sombra interior y **clavos**
  en las esquinas. Las notas se ven como **papeles clavados** (ligera rotación, punto de
  chincheta arriba, hover que endereza + realce dorado).
- **Rango de misión**: sello circular con letra **S/A/B/C/D** y color (S carmesí-dorado
  legendario → D tenue), guiño a los rangos de gremio de anime.
- **Motion**: entradas `fadeSlideIn` escalonadas; hover `scale`/enderezado con
  `--ease-spring`; respeta `prefers-reduced-motion`.
- **Responsivo**: 2 columnas en desktop (≤1300px) → 1 columna apilada en móvil (375px).

### Estructura de la página
1. **Hero + libro mayor** (contadores en vivo).
2. **Crónica del Gremio** (columna principal) — feed fusionado de `event_log`, cada ítem
   con icono, sello de rango, texto legible y tiempo relativo. Botón "Actualizar".
3. **Panel lateral** (chinchetas):
   - **Misiones** — abiertas + cumplidas, con recompensa (XP/oro) y rango de dificultad.
   - **Próximos Eventos** — con fecha.
   - **Salón de Honor** — top 5 del leaderboard + últimas condecoraciones.
4. **Nuevos Aventureros** — fila de fichas estilo "cartel de recluta".
5. **Gremios** — clanes fundados con emblema/lema/nº de miembros.

Enlaces cruzados: cada tarjeta enruta a su sección (`#/sessions`, `#/quests`, `#/clanes`,
`#/fama`, `#/characters`, `#/calendario`).

---

## 3. Fases

> **Nota de diseño (acordado):** el frontend NO usa el diseño propuesto originalmente en
> este plan, sino el **prototipo `assets/tablero_de_misiones_`** (README de diseño hifi:
> pergamino, chinchetas de latón, sellos de cera por rareza, keyframes `dropPin`/`sealPop`/
> `glowPulse`/`heroGlow`, switcher muro/tablón). Se recrea en vanilla JS.

### Fase N1 — Página base + ruta + nav ✅ COMPLETADA
- [x] `frontend/pages/noticias.js` con `export async function render(container)`.
- [x] Registrar `#/noticias` en `routes` de `router.js` (y **Dashboard eliminado**: default,
  brand y fallback ahora apuntan a `#/noticias`; `dashboard.js` borrado; redirects de login).
- [x] Quitar `disabled: true` del grupo **Noticias** en `NAV_GROUPS` (link directo).
- [x] Estructura/estilos del **tablón** (prototipo) inyectados una vez: hero con crestón +
  `heroGlow`, **libro mayor con contadores reales** (`meta.total`, count-up), **switcher
  muro/tablón** funcional, tablón pergamino con remaches y placeholder de la Crónica.
- [x] Fondo animado global actualizado (nueva versión con dados D4/D8/D20 en `frontend/js/`).
- [x] Verificado: `node --check pages/noticias.js`; `router.js` íntegro (file-tool).

### Fase N2 — Crónica del Gremio (feed en vivo) ✅ COMPLETADA
- [x] Cargar `/events?per_page=40` + mapa de nombres de `/members` (`Promise.allSettled`).
- [x] `FEED` (icono, **rareza C/R/E/L**, texto legible) por acción; parseo seguro de
  `metadata` (string→JSON) para el nivel de `character.leveled_up`; tiempo relativo en español
  desde `occurred_at`.
- [x] Render de **carteles clavados** con chincheta de latón, **sello de cera por rareza**
  (color radial c→d), texto (icono + actor en negrita + resaltado) y meta (rareza + tiempo);
  entrada escalonada `dropPin`/`sealPop`; legendaria con borde dorado + `glowPulse`.
- [x] Rotación aleatoria en variante **Muro** (se endereza en hover); sin rotación en **Tablón**.
- [x] Estado vacío elegante ("El tablón está en calma…").
- [x] Botón **↻ Actualizar** re-monta el feed (re-dispara la caída) + recarga contadores.
- [x] Verificado (integridad y balance vía file-tool; el mount del sandbox tuvo glitches de
  sincronización, ajenos al archivo real).

### Fase N3 — Panel lateral (misiones, eventos, honor) ⏳
- [ ] **Misiones**: recorrer campañas → quests; agrupar abiertas/cumplidas; recompensas y rango.
- [ ] **Próximos Eventos**: `/community/posts?board=events` ordenados por `event_date`.
- [ ] **Salón de Honor**: `/hall/leaderboard` (top 5) + `/hall/awards` (medallas).

### Fase N4 — Aventureros y Gremios ⏳
- [ ] **Nuevos Aventureros**: fichas desde `/characters` (retrato o emoji de clase).
- [ ] **Gremios**: tarjetas desde `/clans` (emblema/color/lema/miembros).
- [ ] Enlaces cruzados a las secciones correspondientes.

### Fase N5 — Pulido + verificación ⏳
- [ ] `Promise.allSettled` en todas las cargas; cada sección degrada sola.
- [ ] Responsivo 375/1280; `prefers-reduced-motion`.
- [ ] `node --check frontend/pages/noticias.js` y `router.js`; anti-truncación (`tail -5`).
- [ ] Cache-bust en `index.html`; actualizar `CLAUDE.md` (nav + página nueva).

---

## 4. Alcance / no-alcance

- **En alcance**: solo frontend + datos existentes. **Cero cambios de backend, cero migraciones.**
- **Fuera de alcance (posible iteración futura)**:
  - Auto-refresco por *polling* del feed (ahora: botón manual).
  - Que un admin "fije" noticias propias (requeriría un board `news` en `community_posts`).
  - Puente Kafka → feed en vivo por websocket.

---

## 5. Despliegue

Sin migraciones. Al terminar, commit desde PowerShell y GitHub Pages redepliega:
```
git add -A; git commit -m "feat: Noticias — Tablón de Misiones del gremio (feed + misiones + honor)"; git push origin main
```
> Nota de caché: como con Perfil, el CDN de GitHub Pages puede tardar unos minutos en
> refrescar el `index.html`; si no aparece de inmediato, esperar el TTL del edge.
