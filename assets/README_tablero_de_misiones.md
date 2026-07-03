# Handoff: Noticias — Tablón de Misiones del Gremio

## Overview
Rediseño de la página `#/noticias` (hoy deshabilitada en `router.js`) como **Tablón de
Misiones de un gremio de aventureros** (fantasía isekai): pergamino, chinchetas de latón,
sellos de cera con rareza, y las novedades reales de la app (feed del `event_log` +
misiones, eventos, salón de honor, aventureros y gremios). Reemplaza el frontend de esa
ruta. **Solo frontend + datos existentes — cero cambios de backend, cero migraciones.**

El plan funcional completo (endpoints, fases, despliegue) está en
[`PLAN_MEJORAS_NOTICIAS.md`](./PLAN_MEJORAS_NOTICIAS.md) — este README cubre el **diseño
visual, animaciones y tokens** para implementarlo.

## About the Design Files
Los archivos de este bundle son **referencias de diseño hechas en HTML** — prototipos que
muestran el look & feel y las interacciones buscadas, **no código de producción para copiar
tal cual**. El prototipo (`Tablero de Misiones.dc.html`) está construido en un runtime React
propio de la herramienta de diseño; **tu app usa JavaScript vanilla** (`frontend/pages/*.js`
con `export async function render(container)` y `<style>` inyectado una vez, como describe el
plan). La tarea es **recrear este diseño en tu entorno vanilla existente**, siguiendo las
fases N1–N5 del plan y los patrones ya usados en otras páginas (p. ej. `perfil`).

- `tablero_de_misiones_standalone.html` — **ábrelo en el navegador** para ver el diseño
  final animado, sin dependencias. Es la referencia visual canónica.
- `Tablero de Misiones.dc.html` — fuente del prototipo (markup + lógica). Útil para leer
  estructura exacta, estilos inline y la lógica de datos/animación. No es ejecutable fuera
  de la herramienta.
- `referencia_personajes.png` — captura de la página de Personajes existente, de donde se
  hereda nav, tipografía, color y florituras `+`.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado y animaciones son finales.
Recrear pixel-perfect con los patrones/estilos de la app. Los datos mostrados son de
ejemplo; deben reemplazarse por las llamadas reales (ver «Mapeo de datos»).

---

## Layout general

Ancho de contenido: `max-width: 1240px`, centrado, `padding: 44px 30px 0`. Todo sobre el
fondo pergamino actual. Estructura vertical:

1. **Nav** (sticky, idéntica a la app).
2. **Hero** — crestón `᛭`, título `+ Tablón de Misiones +`, subtítulo con fecha.
3. **Libro mayor** — 4 contadores con count-up.
4. **Switcher** de vista (segmented control) — 2 variaciones de layout del tablero.
5. **Crónica del Gremio** — feed del `event_log` como carteles clavados.
6. **Panel lateral** — 3 tarjetas: Misiones, Próximos Eventos, Salón de Honor.
7. **Nuevos Aventureros** — grid de fichas.
8. **Gremios** — tarjetas de clanes.
9. **Footer** — línea decorativa.

### Dos variaciones (el switcher alterna entre ambas)
- **Muro del Gremio** (`variant: 'muro'`, por defecto): tablero **sin marco**, masonry con
  CSS multi-columna (`columns: 280px; column-gap: 24px;`). Cada cartel: `break-inside:avoid;
  display:inline-block; width:100%; margin:0 0 24px;` con **rotación aleatoria** (±1.3°–2.6°).
- **Tablón Enmarcado** (`variant: 'tablon'`): panel enmarcado con doble borde dorado y
  **remaches de latón** en las 4 esquinas; carteles en grid
  `repeat(auto-fill, minmax(280px, 1fr))`, gap 22px, **sin rotación**.
  Estilo del panel: `background:linear-gradient(160deg,#ecdab5,#ddc79b); border:3px solid
  #8a6d2f; border-radius:12px; box-shadow:inset 0 0 70px rgba(90,66,25,.26),0 16px 38px
  rgba(74,63,46,.24); outline:6px solid rgba(138,109,47,.22); outline-offset:5px;`

> Implementación: puedes shippear **solo «Muro»** (recomendado por defecto) y dejar «Tablón»
> como opción, o exponer el switcher. Es una preferencia de layout, no dos páginas.

---

## Componentes (detalle)

### Nav (sticky top)
`display:flex; align-items:center; gap:26px; flex-wrap:wrap; padding:14px 34px;
background:rgba(244,237,222,.82); backdrop-filter:blur(9px); border-bottom:1px solid
rgba(138,109,47,.32);`
- Logo: `+ DnD +` en Cinzel 700, 20px, color `#6f5620`; los `+` en `#b89441` peso 500.
- Links: "Noticias" **activo** (`#6f5620`, peso 600, `border-bottom:2px solid #8a6d2f`), el
  resto `#8a7a5e` con `▾` en los que tienen submenú.
- Derecha: selector de personaje (pill `#efe5cd`, borde `#d3bf8f`, "🐉 MyMarLa ▾"), chip de
  usuario (avatar circular con inicial + nombre/rol), botón "Salir".

### Hero
- Crestón `᛭` 34px `#b89441`, `animation: heroGlow 4s ease-in-out infinite`.
- H1 Cinzel 700, `clamp(30px,4.4vw,46px)`, `#6f5620`, `letter-spacing:.05em`,
  `text-shadow:0 2px 12px rgba(201,162,39,.28)`. Flourishes `+` en `#b89441` peso 500.
- Subtítulo EB Garamond italic 18px `#6f6046`: `Gremio de Aventureros · {fecha larga es-ES}`.

### Libro mayor (contadores)
Placa `display:flex; flex-wrap:wrap; max-width:840px; margin:26px auto 0;
background:linear-gradient(180deg,#f4ead0,#e7d6ae); border:1px solid #c9b382;
border-radius:12px; box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 10px 24px
rgba(74,63,46,.14);`. Cada celda `flex:1; min-width:150px; padding:20px 14px; text-align:center;`
con `border-left:1px solid rgba(120,95,45,.18)` salvo la primera.
- Número: Cinzel 700, `clamp(28px,3.4vw,36px)`, `#6f5620`. **Count-up** de 0 al valor.
- Etiqueta: 12px, `letter-spacing:.16em; text-transform:uppercase; color:#9a8558`.
- Valores de ejemplo: Miembros 128 · Campañas 12 · Sesiones 87 · Personajes 46.

### Switcher (segmented control)
Contenedor pill `#ece0c4`, borde `#d3bf8f`, `border-radius:999px; padding:4px; gap:4px`.
Botón activo: `background:linear-gradient(180deg,#8a6d2f,#6f5620); color:#f7efdb;
box-shadow:0 3px 9px rgba(111,86,32,.4);` Inactivo: `background:transparent; color:#8a7350;`.
Ambos Cinzel 600, 13px, `letter-spacing:.03em`, `padding:9px 18px`, `transition:all .25s`.

### Cartel de noticia (item del feed) — el componente clave
Cada noticia del `event_log` es un cartel clavado. Estructura (de fuera a dentro):
1. **Wrapper de entrada** — lleva la animación `dropPin` (ver Animaciones).
2. **Cuerpo** — `transform:rotate(<rot>); transition:transform .4s cubic-bezier(.2,.85,.25,1),
   box-shadow .4s;`. En **hover**: `transform:rotate(0deg) translateY(-12px) scale(1.035);
   box-shadow:0 24px 48px rgba(74,63,46,.30),0 0 30px rgba(201,162,39,.5);` (se endereza,
   se levanta y brilla).
3. **Chincheta** (arriba, centrada): círculo 16px, `top:-9px; left:50%; margin-left:-8px;
   background:radial-gradient(circle at 34% 30%,#f8e9ad,#bd952f 58%,#7a5d16);
   box-shadow:0 3px 5px rgba(0,0,0,.36),inset 0 1px 1px rgba(255,255,255,.65);`
4. **Papel**: `background:linear-gradient(158deg,#fdf8ec,#f0e6cc); border:<border>;
   border-radius:6px; padding:17px 17px 15px; box-shadow:inset 0 0 34px rgba(120,95,45,.09),
   0 10px 24px rgba(74,63,46,.16);`. Borde normal `1px solid #d8c79b`; **legendaria**
   `2px solid #c9a227` + glow (ver abajo).
5. **Sello de cera de rareza** (izquierda, 46×46): forma de blob de cera
   `border-radius:52% 48% 50% 50%/50% 52% 48% 50%;`
   `background:radial-gradient(circle at 34% 30%,rgba(255,255,255,.5),transparent 52%),
   radial-gradient(circle at 50% 55%,<color>,<colorDark> 80%); color:#fdf6e3;` Cinzel 700
   21px, `text-shadow:0 1px 2px rgba(0,0,0,.45); box-shadow:inset 0 2px 5px rgba(255,255,255,.35),
   inset 0 -3px 6px rgba(0,0,0,.35),0 3px 7px rgba(0,0,0,.28);` Anima con `sealPop`.
   **La letra del sello es la inicial de la rareza** (C/R/E/L).
6. **Texto**: 16px, `line-height:1.42`, `#4a3f2e`. Icono (emoji) 18px + `<b #33291a>` actor +
   verbo + `<span #6f5620 peso 600>` resaltado (nivel, «título», etc.).
7. **Meta** (bajo el texto): 11px uppercase `letter-spacing:.1em`. Rareza con **color del
   sello** (peso 700) · `#a08c5e` tiempo relativo en español.

### Rarezas (mapeo letra + color) — IMPORTANTE
El sello muestra la inicial de la rareza, con su color:

| Letra | Rareza      | Color claro (`c`) | Color oscuro (`d`) |
|-------|-------------|-------------------|--------------------|
| **C** | Común       | `#5a8a63` (verde) | `#37623f`          |
| **R** | Rara        | `#3f7fbf` (azul)  | `#204e78`          |
| **E** | Épica       | `#8058b0` (violeta)| `#4c2f74`         |
| **L** | Legendaria  | `#c9a227` (dorado)| `#8f1d1d` (carmesí)|

El sello usa `radial-gradient` de `c`→`d`. La palabra de rareza en la meta usa `c`.
Solo **Legendaria** recibe borde dorado 2px + `animation: glowPulse 3.6s ease-in-out
infinite 1.3s`.

### Panel lateral (3 tarjetas)
Grid `repeat(auto-fit, minmax(280px,1fr))`, gap 24px, margin-top 44px. Cada tarjeta:
`background:linear-gradient(160deg,#f6efdc,#ece0c2); border:1px solid #cdb888;
border-radius:10px; box-shadow:0 8px 22px rgba(74,63,46,.13); padding:22px`. Título Cinzel
700 18px `#6f5620`.
- **⚔ Misiones**: filas con mini-sello de rareza (34px), nombre (15px peso 600), y
  `✦ {xp} XP · {gp} oro · {estado}`. Estado "Abierta" en `#5a8a63`, "Cumplida" en `#a08c5e`
  con la fila a `opacity:.62`.
- **🗓 Próximos Eventos**: badge de fecha (46×46, gradiente dorado `#8a6d2f→#6f5620`, día en
  Cinzel 18px + mes 9px uppercase) + título.
- **🏆 Salón de Honor**: top 5 (posición coloreada: 1º `#c9a227`, 2º `#9a8a66`, 3º `#a9743a`,
  resto `#b6a276`), nombre, `{xp} XP` en `#6f5620` tabular. Separador `dashed` + última
  condecoración: `🎖️ «Nombre» → Personaje`.

### Nuevos Aventureros
Grid `repeat(auto-fill, minmax(210px,1fr))`, gap 18px. Ficha centrada, papel
`linear-gradient(158deg,#fdf8ec,#f0e6cc)`, borde `#d8c79b`, radius 10px. Avatar 66px circular
con `radial-gradient` de color de rareza + emoji de clase 30px. Nombre Cinzel 600 17px, raza·clase
`#9a8558` 13.5px, badge "Nivel N" (pill `#efe5cd`). Hover: `translateY(-6px)` + sombra.

### Gremios
Grid `repeat(auto-fill, minmax(300px,1fr))`, gap 20px. Tarjeta horizontal, papel igual que
fichas, `border-left:5px solid {color del clan}`. Emblema 56px cuadrado redondeado con inicial
en Cinzel 700. Nombre Cinzel 600 18px, lema italic `#6f6046`, `👥 N miembros`.

### Botón "↻ Actualizar" (junto al título de la Crónica)
`background:linear-gradient(180deg,#8a6d2f,#6f5620); color:#f7efdb;` Cinzel 600 13px,
`padding:9px 17px; border-radius:8px; box-shadow:0 4px 12px rgba(111,86,32,.34)`. Al hacer
click **re-lanza la animación de caída** del feed (re-fetch sin recargar la página).

---

## Interactions & Behavior
- **Entrada (al cargar el feed)**: cada cartel cae y se clava, escalonado. `dropPin .74s
  cubic-bezier(.2,.85,.25,1)` con `animation-delay = 0.1 + índice*0.09 s`.
- **Sello**: aparece con `sealPop .5s cubic-bezier(.2,1.5,.4,1)`, delay `0.45 + índice*0.09 s`.
- **Hover en cartel**: se endereza (`rotate(0)`), sube 12px, escala 1.035 y brilla (glow
  dorado). `transition .4s`.
- **Count-up**: los 4 contadores animan de 0 al valor en ~1150ms (ease-out cúbico),
  `toLocaleString('es')`. Ejecutar una sola vez al montar.
- **Actualizar**: re-renderiza el feed forzando re-montaje (re-dispara `dropPin`).
- **Fondo ambiente**: runas rúnicas a la deriva (`runeDrift`) y motas de polvo dorado
  ascendentes (`dustRise`) — capas absolutas `pointer-events:none`, z-index 0. Contenido en
  z-index 1. Deben poder desactivarse (ver Estado/tweaks).
- **`prefers-reduced-motion: reduce`**: `* { animation:none!important; transition:none!important }`
  y el count-up salta directo al valor final.
- **Responsive** (sin media queries): masonry y grids usan `columns`/`auto-fill minmax`, la
  nav usa `flex-wrap`. 2 columnas en desktop → 1 apilada en móvil de forma intrínseca.

## State Management
- `variant`: `'muro' | 'tablon'` (preferencia de layout del tablero).
- `feedKey`: contador que, al incrementarse, fuerza el re-montaje del feed (botón Actualizar).
- `backgroundFx`: `'runas+polvo' | 'solo runas' | 'ninguno'` (ambiente de fondo).
- `straighten`: boolean (endereza todos los carteles, rotación 0).
- Contador de count-up: bandera de "ya animado" para no repetir.
- **Datos**: cargar con `Promise.allSettled` para que cada sección degrade sola si su
  endpoint falla (ver plan §1 y §5).

---

## Design Tokens

### Colores
```
--parch      #f2ebdd   pergamino base
--ink        #4a3f2e   texto principal
--ink-soft   #6f6046   texto secundario / italic
--gold       #8a6d2f   dorado (bordes, acento)
--gold-deep  #6f5620   dorado profundo (títulos, botones)
--gold-lite  #b89441   dorado claro (flourishes, crestón)
--crimson    #8f1d1d   carmesí (legendaria, clan Ceniza)

Fondo body   radial-gradient(1300px 900px at 22% -5%,#f8f2e7,#f1e9d8 42%,#e8ddc5 100%) fixed
Papel cartel linear-gradient(158deg,#fdf8ec,#f0e6cc)
Papel panel  linear-gradient(160deg,#f6efdc,#ece0c2)
Bordes       #d8c79b (cartel) · #cdb888 / #c9b382 (paneles/placa) · #d3bf8f (pills)
Latón        radial-gradient(circle at 34% 30%,#f8e9ad,#bd952f 58%,#7a5d16)

Rarezas:  C #5a8a63/#37623f · R #3f7fbf/#204e78 · E #8058b0/#4c2f74 · L #c9a227/#8f1d1d
Honor pos: 1 #c9a227 · 2 #9a8a66 · 3 #a9743a · resto #b6a276
```

### Tipografía
- **Display / títulos / números**: `Cinzel` (500/600/700). Google Fonts.
- **Cuerpo / texto**: `EB Garamond` (400/500/600, italic 400). Google Fonts.
- Import: `https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap`
- Escala: hero `clamp(30px,4.4vw,46px)` · números `clamp(28px,3.4vw,36px)` · secciones 23px ·
  paneles 18px · cuerpo cartel 16px · meta/etiquetas 11–12px.

### Radios / sombras / espaciado
```
radius:  6px cartel · 8px botones/pills/eventos · 10px paneles/fichas · 12px placa/tablón · 999px switcher
sombras: cartel 0 10px 24px rgba(74,63,46,.16) · panel 0 8px 22px rgba(74,63,46,.13)
         hover 0 24px 48px rgba(74,63,46,.30),0 0 30px rgba(201,162,39,.5)
gaps:    secciones margin-top 44px · grid gaps 18–24px · nav gap 26px
```

### Keyframes (copiar tal cual desde el prototipo)
`dropPin`, `sealPop`, `runeDrift`, `dustRise`, `glowPulse`, `heroGlow`. Definiciones exactas
en el `<style>` de `Tablero de Misiones.dc.html` (líneas del `<helmet>`).

---

## Mapeo de datos (reemplazar los datos de ejemplo)
Ver `PLAN_MEJORAS_NOTICIAS.md` §1 para los endpoints. Correspondencia con el diseño:

- **Feed / Crónica** ← `GET /events?per_page=40` (resolver nombres con `/members`). Cada
  `action` mapea a icono, verbo legible y **rareza**:
  | action | texto | rareza (letra) |
  |---|---|---|
  | `award.granted` | "recibió la condecoración «…»" | **L** |
  | `character.leveled_up` | "alcanzó el nivel N" (`metadata.after.level`) | **E** |
  | `clan.created` | "fundó el gremio «…»" | **E** |
  | `session.created` | "registró la crónica «…»" | **R** |
  | `clan.member_joined` | "se unió a «…»" | **C** |
  | `character.created` | "se unió como Raza · Clase" | **C** |
  | `member.registered` | "se unió al gremio" | **C** |
  Tiempo relativo desde `occurred_at`. Parsear `metadata` defensivamente (puede llegar como string).
- **Libro mayor** ← `meta.total` de `/members`, `/campaigns`, `/sessions`, `/characters`.
- **Misiones** ← recorrer `/campaigns` → `/campaigns/{id}/quests`; agrupar abiertas/cumplidas;
  `reward_xp`, `reward_gp`, `status`, y rango de dificultad → mapear a letra de rareza.
- **Próximos Eventos** ← `/community/posts?board=events` (`title`, `event_date`).
- **Salón de Honor** ← `/hall/leaderboard` (top 5) + `/hall/awards` (última medalla).
- **Nuevos Aventureros** ← `/characters?per_page=8` (`name`, `race`, `class`, `level`,
  `portrait_url` o emoji de clase).
- **Gremios** ← `/clans?per_page=8` (`name`, `emblem_url`, `color_hex`, `motto`, `member_count`).

> Nota: el prototipo usa emoji para iconos y avatares (sin imágenes externas), acorde al
> plan ("solo CSS + emoji"). Si hay `portrait_url`/`emblem_url` reales, úsalos en su lugar.

---

## Assets
- Sin imágenes ni iconos externos: todo es CSS + emoji + glyphs rúnicos Unicode
  (`᛭ ᚠ ᚢ ᚦ ᚨ ᚱ ᚷ ᚹ ᚺ ᛁ ᛃ ᛚ ᛟ`). Solo se cargan las 2 familias de Google Fonts.
- `referencia_personajes.png`: captura de la página existente para heredar nav/tono/tipografía.

## Files (en este bundle)
- `tablero_de_misiones_standalone.html` — **referencia visual** (abrir en navegador).
- `Tablero de Misiones.dc.html` — fuente del prototipo (estructura + estilos inline + lógica).
- `PLAN_MEJORAS_NOTICIAS.md` — plan funcional (endpoints, fases N1–N5, despliegue).
- `referencia_personajes.png` — captura de la página de Personajes actual.

## Destino en tu repo (según el plan)
- Crear `frontend/pages/noticias.js` con `export async function render(container)`.
- Registrar `#/noticias` en `routes` de `router.js` y quitar `disabled:true` del grupo
  **Noticias** en `NAV_GROUPS`.
- Inyectar el `<style>` una sola vez; cargas con `Promise.allSettled`; respetar
  `prefers-reduced-motion`; cache-bust en `index.html`.
