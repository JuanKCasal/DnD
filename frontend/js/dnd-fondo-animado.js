/*
 * Fondo animado D&D — motas de polvo + constelaciones y runas nórdicas (Futhark)
 * con brillo cálido tipo vela en los laterales.
 *
 * Vanilla JS, sin dependencias. Dibuja sobre un <canvas> que se coloca
 * DETRÁS de tu contenido. El movimiento se concentra en los laterales y
 * casi desaparece en el centro para no competir con la interfaz.
 *
 * USO RÁPIDO (fondo de toda la página):
 *   <script src="dnd-fondo-animado.js"></script>
 *   <script>DnDFondo.montarPantalla();</script>
 *
 * USO EN UN CONTENEDOR (ej. el <main> de tu app):
 *   <div id="mi-seccion" style="position:relative">...tu contenido...</div>
 *   <script>DnDFondo.montar(document.getElementById('mi-seccion'));</script>
 *
 * El color de fondo (#F5F3EE) lo pones tú en el contenedor/body; este script
 * solo dibuja la animación con transparencia encima de ese color.
 */
(function (global) {
  'use strict';

  var COLOR_VELA = '232,172,100';   // glow cálido de vela (RGB)
  var COLOR_MOTA_CALIDA = '204,146,76';
  var COLOR_MOTA_NEUTRA = '108,96,72';
  var COLOR_ESTRELLA = '206,168,96';
  var COLOR_LINEA = '150,132,86';
  var COLOR_RUNA = '176,138,70';

  // Runas del Futhark antiguo como segmentos rectos (normalizados a un asta -1..1)
  var RUNAS = [
    [[0,-1,0,1],[0,-0.55,0.5,-0.82],[0,-0.15,0.5,-0.42]],                                   // Fehu
    [[0,-1,0,1],[0,-1,0.5,-0.7],[0,-0.55,0.5,-0.25]],                                        // Ansuz
    [[0,-1,0,1],[0,-1,0.45,-0.68],[0.45,-0.68,0,-0.35],[0,-0.35,0.45,0.15]],                 // Raidho
    [[0.4,-1,-0.15,0],[-0.15,0,0.4,1]],                                                      // Kaunan
    [[-0.45,-1,0.45,1],[0.45,-1,-0.45,1]],                                                   // Gebo
    [[0,-1,0,1],[0,-1,0.45,-0.65],[0.45,-0.65,0,-0.3]],                                      // Wunjo
    [[-0.4,-1,-0.4,1],[0.4,-1,0.4,1],[-0.4,-0.12,0.4,0.12]],                                 // Hagalaz
    [[0,-1,0,1]],                                                                            // Isaz
    [[0.35,-1,-0.15,-0.2],[-0.15,-0.2,0.35,0.3],[0.35,0.3,-0.15,1]],                         // Sowilo
    [[0,-1,0,1],[0,-1,0.42,-0.6],[0,-1,-0.42,-0.6]],                                         // Tiwaz
    [[0,-1,0,1],[0,-1,0.42,-0.75],[0.42,-0.75,0,-0.5],[0,-0.5,0.42,-0.25],[0.42,-0.25,0,0]], // Berkanan
    [[0,-1,0,1],[0,-0.5,0.45,-1],[0,-0.5,-0.45,-1]],                                         // Algiz
    [[0,-1,0,1],[0,-0.6,0.42,-0.3],[0.42,-0.3,0,0]],                                         // Thurisaz
    [[-0.4,0.9,0,-0.4],[0,-0.4,0.4,0.9],[0,-0.4,0,-1]]                                       // Mannaz (cuña)
  ];

  // Dados de rol en wireframe (proyecciones 2D, normalizadas a -1..1): D4, D8, D20
  var DADOS = [
    // D4 — tetraedro
    [[0,-1,-0.87,0.55],[0,-1,0.87,0.55],[-0.87,0.55,0.87,0.55],[0,-1,0,0.2],[-0.87,0.55,0,0.2],[0.87,0.55,0,0.2]],
    // D8 — octaedro
    [[0,-1,0.9,0],[0.9,0,0,1],[0,1,-0.9,0],[-0.9,0,0,-1],[-0.9,0,0.9,0],[0,-1,0,1]],
    // D20 — icosaedro
    [[0,-1,0.87,-0.5],[0.87,-0.5,0.87,0.5],[0.87,0.5,0,1],[0,1,-0.87,0.5],[-0.87,0.5,-0.87,-0.5],[-0.87,-0.5,0,-1],
     [0.52,-0.3,-0.52,-0.3],[-0.52,-0.3,0,0.6],[0,0.6,0.52,-0.3],
     [0,-1,0.52,-0.3],[0,-1,-0.52,-0.3],[0.87,-0.5,0.52,-0.3],[-0.87,-0.5,-0.52,-0.3],
     [0.87,0.5,0.52,-0.3],[0.87,0.5,0,0.6],[-0.87,0.5,-0.52,-0.3],[-0.87,0.5,0,0.6],[0,1,0,0.6]]
  ];

  function crearInstancia(canvas, opciones) {
    opciones = opciones || {};
    var intensidad = opciones.intensidad != null ? opciones.intensidad : 1; // 0..~1.5
    var ctx = canvas.getContext('2d');
    var estado = { w: 0, h: 0, parts: [], stars: [], runes: [], t0: performance.now(), raf: 0 };

    // 0.07 en el centro -> 1 en los bordes laterales (centro muy atenuado)
    function edge(x, w) {
      var n = Math.min(1, Math.abs(x - w / 2) / (w / 2));
      return 0.07 + 0.93 * Math.pow(n, 1.9);
    }
    // parpadeo cálido de vela, 0..1
    function flick(x) {
      return 0.5 + 0.5 * (Math.sin(x) * 0.6 + Math.sin(x * 2.3 + 1.7) * 0.3 + Math.sin(x * 5.1) * 0.1);
    }

    function medir() {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      var dpr = Math.min(2, global.devicePixelRatio || 1);
      estado.w = r.width; estado.h = r.height;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }

    function sembrar() {
      var w = estado.w, h = estado.h;
      // motas de polvo
      var nd = Math.max(38, Math.round(w * h / 6400));
      estado.parts = [];
      for (var i = 0; i < nd; i++) {
        estado.parts.push({
          x: Math.random() * w, y: Math.random() * h,
          r: 0.9 + Math.random() * 2.1, a: 0.26 + Math.random() * 0.4,
          vy: -(0.03 + Math.random() * 0.11), vx: (Math.random() - 0.5) * 0.05,
          ph: Math.random() * Math.PI * 2, ts: 0.4 + Math.random() * 0.8,
          warm: Math.random() < 0.45
        });
      }
      // estrellas (concentradas en laterales)
      var ns = Math.max(24, Math.round(w * h / 15000));
      estado.stars = [];
      var guard = 0;
      while (estado.stars.length < ns && guard < ns * 24) {
        guard++;
        var x = Math.random() * w, y = Math.random() * h;
        if (Math.random() < edge(x, w)) {
          estado.stars.push({ x: x, y: y, r: 0.7 + Math.random() * 1.5, a: 0.3 + Math.random() * 0.42, ph: Math.random() * 7, ts: 0.3 + Math.random() * 0.9 });
        }
      }
      // Regla anti-superposición SOLO entre dados y runas.
      // Las motas de polvo y las constelaciones NO participan de esta regla.
      var occupied = [];
      function place(radius, zoneX, yFn, tries) {
        var best = { x: zoneX(), y: yFn() }, bestGap = -Infinity;
        for (var i = 0; i < tries; i++) {
          var x = zoneX(), y = yFn(), gap = Infinity;
          for (var q = 0; q < occupied.length; q++) {
            var oc = occupied[q];
            var d = Math.hypot(x - oc.x, y - oc.y) - oc.r - radius;
            if (d < gap) gap = d;
          }
          if (gap > 8) { best = { x: x, y: y }; break; }
          if (gap > bestGap) { bestGap = gap; best = { x: x, y: y }; }
        }
        occupied.push({ x: best.x, y: best.y, r: radius });
        return best;
      }
      var dadoX = function () { return Math.random() < 0.5 ? w * (0.04 + Math.random() * 0.14) : w * (0.82 + Math.random() * 0.14); };
      var dadoY = function () { return h * (0.14 + Math.random() * 0.72); };
      var runaX = function () { return Math.random() < 0.5 ? Math.random() * w * 0.2 : w * (0.8 + Math.random() * 0.2); };
      var runaY = function () { return h * (0.1 + Math.random() * 0.8); };

      // dados de rol (uno de cada tipo) primero — mayor prioridad de espacio
      estado.dice = [0, 1, 2].map(function (type, i) {
        var s = 24 + Math.random() * 12;
        var p = place(s * 1.05, dadoX, dadoY, 40);
        return {
          type: type, x: p.x, y: p.y, s: s, rot0: Math.random() * Math.PI * 2,
          rotSpeed: (i % 2 ? 1 : -1) * (0.08 + Math.random() * 0.12),
          ph: Math.random() * Math.PI * 2, ts: 0.12 + Math.random() * 0.1
        };
      });
      // runas nórdicas, evitando los dados y entre sí
      estado.runes = [];
      for (var k = 0; k < 9; k++) {
        var rs = 12 + Math.random() * 12;
        var rp = place(rs * 0.95, runaX, runaY, 40);
        estado.runes.push({
          x: rp.x, y: rp.y, s: rs, type: Math.floor(Math.random() * RUNAS.length),
          rot: (Math.random() - 0.5) * 0.4, ph: Math.random() * Math.PI * 2, ts: 0.1 + Math.random() * 0.12
        });
      }
    }

    function glows(t) {
      var w = estado.w, h = estado.h;
      [{ cx: 0, ph: 0 }, { cx: w, ph: 3.0 }].forEach(function (s) {
        var f = flick(t * 0.8 + s.ph);
        var base = (0.17 + 0.12 * f) * intensidad;
        var R = Math.max(w * 0.5, 320);
        var g = ctx.createRadialGradient(s.cx, h * 0.52, 0, s.cx, h * 0.52, R);
        g.addColorStop(0, 'rgba(' + COLOR_VELA + ',' + base + ')');
        g.addColorStop(1, 'rgba(' + COLOR_VELA + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });
    }

    function dibujarRuna(rn, al) {
      var s = rn.s, segs = RUNAS[rn.type % RUNAS.length];
      ctx.save();
      ctx.translate(rn.x, rn.y);
      ctx.rotate(rn.rot);
      ctx.strokeStyle = 'rgba(' + COLOR_RUNA + ',' + al + ')';
      ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (var i = 0; i < segs.length; i++) {
        var gsg = segs[i];
        ctx.moveTo(gsg[0] * s, gsg[1] * s);
        ctx.lineTo(gsg[2] * s, gsg[3] * s);
      }
      ctx.stroke();
      ctx.restore();
    }

    function dibujarDado(dd, al, t) {
      var s = dd.s, segs = DADOS[dd.type];
      var floatY = Math.sin(t * 0.4 + dd.ph) * s * 0.12;
      ctx.save();
      ctx.translate(dd.x, dd.y + floatY);
      ctx.rotate(dd.rot0 + t * dd.rotSpeed);
      ctx.strokeStyle = 'rgba(150,116,58,' + al + ')';
      ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (var i = 0; i < segs.length; i++) {
        var gsg = segs[i];
        ctx.moveTo(gsg[0] * s, gsg[1] * s);
        ctx.lineTo(gsg[2] * s, gsg[3] * s);
      }
      ctx.stroke();
      ctx.restore();
    }

    function frame() {
      var t = (performance.now() - estado.t0) / 1000;
      var w = estado.w, h = estado.h;
      if (!w) { if (!medir()) { estado.raf = requestAnimationFrame(frame); return; } sembrar(); }
      ctx.clearRect(0, 0, w, h);
      glows(t);

      // líneas de constelación
      ctx.lineWidth = 0.6;
      for (var i = 0; i < estado.stars.length; i++) {
        for (var j = i + 1; j < estado.stars.length; j++) {
          var a = estado.stars[i], b = estado.stars[j];
          var d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 82) {
            var ef = Math.min(edge(a.x, w), edge(b.x, w));
            var al = 0.13 * ef * (1 - d / 82) * intensidad;
            if (al > 0.004) {
              ctx.strokeStyle = 'rgba(' + COLOR_LINEA + ',' + al + ')';
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
          }
        }
      }
      // estrellas
      for (var si = 0; si < estado.stars.length; si++) {
        var s0 = estado.stars[si];
        var tw = 0.5 + 0.5 * Math.sin(t * s0.ts + s0.ph);
        var sa = s0.a * edge(s0.x, w) * tw * intensidad;
        if (sa <= 0.004) continue;
        ctx.beginPath(); ctx.arc(s0.x, s0.y, s0.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(' + COLOR_ESTRELLA + ',' + sa + ')'; ctx.fill();
      }
      // motas de polvo
      for (var pi = 0; pi < estado.parts.length; pi++) {
        var p = estado.parts[pi];
        p.y += p.vy; p.x += p.vx + Math.sin(t * 0.3 + p.ph) * 0.06;
        if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
        if (p.x < -4) p.x = w + 4; else if (p.x > w + 4) p.x = -4;
        var ptw = 0.55 + 0.45 * Math.sin(t * p.ts + p.ph);
        var pa = p.a * edge(p.x, w) * ptw * intensidad;
        if (pa <= 0.003) continue;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fillStyle = p.warm ? 'rgba(' + COLOR_MOTA_CALIDA + ',' + pa + ')' : 'rgba(' + COLOR_MOTA_NEUTRA + ',' + (pa * 0.85) + ')';
        ctx.fill();
      }
      // runas encima
      for (var ri = 0; ri < estado.runes.length; ri++) {
        var rn = estado.runes[ri];
        var cyc = 0.5 + 0.5 * Math.sin(t * rn.ts + rn.ph);
        var ra = 0.55 * edge(rn.x, w) * (0.32 + 0.68 * cyc) * intensidad;
        if (ra > 0.01) dibujarRuna(rn, ra);
      }

      // dados en wireframe, flotando y girando lento
      for (var di = 0; di < estado.dice.length; di++) {
        var dd = estado.dice[di];
        var dcyc = 0.5 + 0.5 * Math.sin(t * dd.ts + dd.ph);
        var da = 0.5 * edge(dd.x, w) * (0.4 + 0.6 * dcyc) * intensidad;
        if (da > 0.01) dibujarDado(dd, da, t);
      }

      estado.raf = requestAnimationFrame(frame);
    }

    function onResize() { if (medir()) sembrar(); }
    global.addEventListener('resize', onResize);
    if (medir()) sembrar();
    estado.raf = requestAnimationFrame(frame);

    return {
      destruir: function () {
        cancelAnimationFrame(estado.raf);
        global.removeEventListener('resize', onResize);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  var DnDFondo = {
    /* Monta la animación dentro de un contenedor existente (se recomienda
       que el contenedor tenga position: relative). Devuelve {destruir}. */
    montar: function (contenedor, opciones) {
      if (!contenedor) throw new Error('DnDFondo.montar: contenedor no encontrado');
      var cs = getComputedStyle(contenedor);
      if (cs.position === 'static') contenedor.style.position = 'relative';
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
      contenedor.insertBefore(canvas, contenedor.firstChild);
      return crearInstancia(canvas, opciones);
    },
    /* Monta la animación como fondo fijo de toda la ventana (detrás de todo). */
    montarPantalla: function (opciones) {
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:0;';
      document.body.insertBefore(canvas, document.body.firstChild);
      return crearInstancia(canvas, opciones);
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DnDFondo;
  else global.DnDFondo = DnDFondo;
})(typeof window !== 'undefined' ? window : this);
