# Fondo mágico — DND Community Manager

Fondo animado (sello del gremio girando, dos anillos de runas en sentidos
opuestos, chispas doradas y runas flotantes) para colocar detrás de tu login.

## Archivos
- `fondo-magico.html` — página completa y autónoma (sin dependencias ni build).
  Ábrela en el navegador para verla. Contiene 3 bloques comentados:
  1. `<style>` con el CSS del fondo + la tarjeta de login.
  2. El HTML de la escena (canvas, sello SVG, runas, tarjeta).
  3. El `<script>` de las chispas doradas.

## Cómo integrarlo en tu app

Solo necesitas **el fondo**; tu login ya lo tienes. Pasos:

1. **CSS** — copia el bloque `<style>` marcado como "FONDO MÁGICO" (las clases
   `.dnd-scene`, `.dnd-canvas`, `.dnd-glow`, `.dnd-seal`, `.dnd-rot`, `.dnd-rune`
   y todos los `@keyframes dnd-*`). Puedes ponerlo en tu hoja de estilos global.

2. **HTML** — envuelve tu pantalla de login con `<div class="dnd-scene">` y pega
   dentro los elementos 1–4 (canvas, `.dnd-glow`, `.dnd-seal` con su SVG, y los
   `<span class="dnd-rune">`). Coloca **tu** formulario de login como último hijo
   y asegúrate de que tenga `position: relative; z-index: 2;` para que quede por
   encima del fondo.

3. **JS** — copia el `<script>` de las chispas. Busca el canvas por
   `id="dndCanvas"`; si usas otro id, cámbialo en el script.

### React / Vue / Angular
- Pega el CSS en tu stylesheet (o CSS module).
- Convierte el HTML de la escena en un componente `<FondoMagico>` que renderiza
  el canvas + SVG + runas, y pon tu `<Login />` dentro como children.
- Ejecuta el script de partículas en `useEffect` / `onMounted` (envuélvelo en la
  función que hay en el archivo) y limpia el `requestAnimationFrame` y el
  listener de `resize` al desmontar.

## Personalización rápida
- **Color dorado:** busca y reemplaza `#8a6a12`, `#6f5209`, `#b8923a`, `#cba650`.
- **Fondo crema:** el `background` de `.dnd-scene`.
- **Velocidad de giro:** clases `.dnd-cw70 / .dnd-ccw96 / .dnd-cw74 / .dnd-cw52`
  (el número son los segundos por vuelta; mayor = más lento).
- **Cantidad de chispas:** el divisor `(w * h) / 11000` en el script
  (número menor = más partículas) y los topes `85` / `180`.
- **Cantidad de runas flotantes:** añade o quita `<span class="dnd-rune">`.
- **Accesibilidad:** ya respeta `prefers-reduced-motion` (desactiva el movimiento).

## Notas
- Requiere la fuente **Cinzel** (Google Fonts, ya enlazada) para el logo y las
  runas. Si tu app ya tiene su propia fuente, puedes quitar el `<link>`.
- Las animaciones se pausan solas cuando la pestaña no está visible (comportamiento
  normal del navegador); reanudan al volver.
