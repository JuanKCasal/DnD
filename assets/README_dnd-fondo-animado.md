# Fondo animado D&D

Fondo animado sutil para tu app de calabozos y dragones: **motas de polvo**
flotando + **constelaciones** y **runas nórdicas del Futhark** que titilan, con
un **brillo cálido tipo vela** en los laterales. El movimiento se concentra en
los bordes y casi desaparece en el centro para no competir con tu interfaz.

Es JavaScript puro, sin dependencias ni build.

## Archivos

- `dnd-fondo-animado.js` — el script del fondo (lo único que necesitas copiar).
- `ejemplo.html` — página de demostración con instrucciones.

## Uso

### Opción A — Fondo de toda la página

```html
<script src="dnd-fondo-animado.js"></script>
<script>DnDFondo.montarPantalla();</script>
```

Tu contenido debe ir por encima: dale `position: relative` y `z-index: 1`
(o mayor) al contenedor principal.

### Opción B — Dentro de una sección concreta

```html
<div id="mi-seccion" style="position: relative;">
  ... tu contenido ...
</div>
<script src="dnd-fondo-animado.js"></script>
<script>
  DnDFondo.montar(document.getElementById('mi-seccion'));
</script>
```

El canvas se inserta como primer hijo del contenedor con `position: absolute`,
detrás del resto del contenido.

## Color de fondo

El script **solo dibuja la animación** (con transparencia); el color plano
`#F5F3EE` lo defines tú en el `body` o en el contenedor, igual que ahora.

## Ajustar la intensidad

Ambos métodos aceptan `{ intensidad }` (por defecto `1`):

```js
DnDFondo.montarPantalla({ intensidad: 1.3 }); // más notorio
DnDFondo.montar(el, { intensidad: 0.7 });     // más sutil
```

## Limpieza

Ambos métodos devuelven un objeto con `.destruir()` para quitar la animación
y sus listeners (útil en apps SPA al desmontar una vista):

```js
const fondo = DnDFondo.montarPantalla();
// ...más tarde:
fondo.destruir();
```

## Rendimiento

Usa un solo `<canvas>` y `requestAnimationFrame`. La cantidad de partículas se
calcula según el tamaño del área. Se redibuja en cada frame con transparencia
baja, por lo que el costo es muy ligero.
