/*
 * Noticias — Tablón de Misiones del Gremio  (#/noticias)
 * Fase N1: base + ruta + nav + hero + libro mayor + estructura/estilos del tablón.
 * El feed de la Crónica y los paneles laterales llegan en N2–N4 (ver PLAN_MEJORAS_NOTICIAS.md).
 *
 * Diseño recreado del prototipo assets/tablero_de_misiones_ (guild board isekai:
 * pergamino, chinchetas de latón, sellos de cera por rareza).
 */
import { api } from '../js/api.js';
import { auth } from '../js/auth.js';

const STYLE_ID = 'noticias-style';

/* Estilos del tablón inyectados una sola vez (tokens del prototipo). */
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
  .nt-wrap{--parch:#f2ebdd;--ink:#4a3f2e;--ink-soft:#6f6046;--gold:#8a6d2f;--gold-deep:#6f5620;--gold-lite:#b89441;--crimson:#8f1d1d;
    position:relative;max-width:1240px;margin:0 auto;padding:44px 30px 70px;color:var(--ink);
    font-family:'EB Garamond',Georgia,serif;}
  .nt-hero{text-align:center;}
  .nt-crest{font-size:34px;color:var(--gold-lite);animation:heroGlow 4s ease-in-out infinite;line-height:1;}
  .nt-title{font-family:'Cinzel',serif;font-weight:700;font-size:clamp(30px,4.4vw,46px);color:var(--gold-deep);
    letter-spacing:.05em;margin:6px 0 4px;text-shadow:0 2px 12px rgba(201,162,39,.28);}
  .nt-title .pl{color:var(--gold-lite);font-weight:500;}
  .nt-sub{font-style:italic;font-size:18px;color:var(--ink-soft);margin:0;}

  /* Libro mayor */
  .nt-ledger{display:flex;flex-wrap:wrap;max-width:840px;margin:26px auto 0;
    background:linear-gradient(180deg,#f4ead0,#e7d6ae);border:1px solid #c9b382;border-radius:12px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 10px 24px rgba(74,63,46,.14);}
  .nt-cell{flex:1;min-width:150px;padding:20px 14px;text-align:center;border-left:1px solid rgba(120,95,45,.18);}
  .nt-cell:first-child{border-left:none;}
  .nt-num{font-family:'Cinzel',serif;font-weight:700;font-size:clamp(28px,3.4vw,36px);color:var(--gold-deep);line-height:1;}
  .nt-lbl{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#9a8558;margin-top:8px;}

  /* Switcher */
  .nt-switch{display:flex;justify-content:center;margin:30px 0 6px;}
  .nt-seg{display:inline-flex;gap:4px;padding:4px;background:#ece0c4;border:1px solid #d3bf8f;border-radius:999px;}
  .nt-seg button{font-family:'Cinzel',serif;font-weight:600;font-size:13px;letter-spacing:.03em;padding:9px 18px;
    border:none;border-radius:999px;cursor:pointer;background:transparent;color:#8a7350;transition:all .25s;}
  .nt-seg button.on{background:linear-gradient(180deg,#8a6d2f,#6f5620);color:#f7efdb;box-shadow:0 3px 9px rgba(111,86,32,.4);}

  /* Sección */
  .nt-section{margin-top:44px;}
  .nt-sec-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap;}
  .nt-sec-title{font-family:'Cinzel',serif;font-weight:700;font-size:23px;color:var(--gold-deep);margin:0;}
  .nt-refresh{font-family:'Cinzel',serif;font-weight:600;font-size:13px;color:#f7efdb;cursor:pointer;border:none;
    background:linear-gradient(180deg,#8a6d2f,#6f5620);padding:9px 17px;border-radius:8px;box-shadow:0 4px 12px rgba(111,86,32,.34);
    transition:transform .15s;}
  .nt-refresh:active{transform:scale(.96);}

  /* Tablón enmarcado (variante) */
  .nt-board.tablon{background:linear-gradient(160deg,#ecdab5,#ddc79b);border:3px solid #8a6d2f;border-radius:12px;
    box-shadow:inset 0 0 70px rgba(90,66,25,.26),0 16px 38px rgba(74,63,46,.24);outline:6px solid rgba(138,109,47,.22);
    outline-offset:5px;padding:26px;position:relative;}
  .nt-board.tablon .nt-rivet{position:absolute;width:14px;height:14px;border-radius:50%;
    background:radial-gradient(circle at 34% 30%,#f8e9ad,#bd952f 58%,#7a5d16);box-shadow:0 2px 4px rgba(0,0,0,.4);}
  .nt-board.tablon .nt-rivet.tl{top:10px;left:10px}.nt-board.tablon .nt-rivet.tr{top:10px;right:10px}
  .nt-board.tablon .nt-rivet.bl{bottom:10px;left:10px}.nt-board.tablon .nt-rivet.br{bottom:10px;right:10px}
  .nt-board.tablon .nt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:22px;}

  /* Muro (variante por defecto): masonry */
  .nt-board.muro .nt-grid{columns:280px;column-gap:24px;}
  .nt-board.muro .nt-note{break-inside:avoid;display:inline-block;width:100%;margin:0 0 24px;}

  /* Placeholder N1 (hasta N2) */
  .nt-placeholder{text-align:center;color:var(--ink-soft);font-style:italic;font-size:16px;
    padding:60px 20px;border:1px dashed #cdb888;border-radius:10px;background:linear-gradient(158deg,#fdf8ec,#f0e6cc);}

  @keyframes dropPin{0%{opacity:0;transform:translateY(-52px) rotate(-8deg) scale(.94)}55%{opacity:1}72%{transform:translateY(7px) rotate(1.4deg) scale(1.012)}100%{opacity:1;transform:translateY(0) rotate(0) scale(1)}}
  @keyframes sealPop{0%{transform:scale(0) rotate(-24deg);opacity:0}60%{transform:scale(1.2) rotate(7deg)}100%{transform:scale(1) rotate(0);opacity:1}}
  @keyframes glowPulse{0%,100%{box-shadow:inset 0 0 40px rgba(201,162,39,.16),0 12px 30px rgba(74,63,46,.2),0 0 0 rgba(201,162,39,0)}50%{box-shadow:inset 0 0 44px rgba(201,162,39,.28),0 12px 30px rgba(74,63,46,.2),0 0 26px rgba(201,162,39,.5)}}
  @keyframes heroGlow{0%,100%{text-shadow:0 2px 10px rgba(201,162,39,.25)}50%{text-shadow:0 2px 22px rgba(201,162,39,.55)}}
  @media (prefers-reduced-motion:reduce){.nt-wrap *{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(st);
}

/* Count-up de 0 al valor (~1150ms, ease-out cúbico), respeta reduced-motion. */
function countUp(el, target) {
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const fmt = n => Number(n).toLocaleString('es');
  if (reduce || !target) { el.textContent = fmt(target || 0); return; }
  const dur = 1150, t0 = performance.now();
  function step(now) {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(target * e));
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export async function render(container) {
  if (!auth.requireAuth()) return;
  injectStyle();
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'nt-wrap';

  const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  wrap.innerHTML = `
    <div class="nt-hero">
      <div class="nt-crest">᛭</div>
      <h1 class="nt-title"><span class="pl">+</span> Tablón de Misiones <span class="pl">+</span></h1>
      <p class="nt-sub">Gremio de Aventureros · ${hoy}</p>
    </div>

    <div class="nt-ledger" id="nt-ledger">
      ${['Miembros', 'Campañas', 'Sesiones', 'Personajes'].map(l => `
        <div class="nt-cell"><div class="nt-num" data-k="${l}">—</div><div class="nt-lbl">${l}</div></div>
      `).join('')}
    </div>

    <div class="nt-switch">
      <div class="nt-seg" id="nt-seg">
        <button data-v="muro" class="on">Muro del Gremio</button>
        <button data-v="tablon">Tablón Enmarcado</button>
      </div>
    </div>

    <div class="nt-section">
      <div class="nt-sec-head">
        <h2 class="nt-sec-title">⚔ Crónica del Gremio</h2>
        <button class="nt-refresh" id="nt-refresh">↻ Actualizar</button>
      </div>
      <div class="nt-board muro" id="nt-board">
        <span class="nt-rivet tl"></span><span class="nt-rivet tr"></span>
        <span class="nt-rivet bl"></span><span class="nt-rivet br"></span>
        <div class="nt-grid" id="nt-feed">
          <div class="nt-placeholder">La crónica del gremio se está preparando… (las gestas aparecerán aquí)</div>
        </div>
      </div>
    </div>
  `;

  container.appendChild(wrap);

  /* Switcher muro/tablon */
  const board = wrap.querySelector('#nt-board');
  wrap.querySelector('#nt-seg').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-v]');
    if (!btn) return;
    wrap.querySelectorAll('#nt-seg button').forEach(b => b.classList.toggle('on', b === btn));
    board.classList.toggle('muro', btn.dataset.v === 'muro');
    board.classList.toggle('tablon', btn.dataset.v === 'tablon');
  });

  /* Botón actualizar (N1: recarga contadores; el feed se conecta en N2) */
  wrap.querySelector('#nt-refresh').addEventListener('click', loadLedger);

  await loadLedger();

  /* ── Libro mayor: contadores reales vía meta.total ── */
  async function loadLedger() {
    const defs = [
      ['Miembros', '/members?per_page=1'],
      ['Campañas', '/campaigns?per_page=1'],
      ['Sesiones', '/sessions?per_page=1'],
      ['Personajes', '/characters?per_page=1'],
    ];
    await Promise.allSettled(defs.map(async ([label, ep]) => {
      const el = wrap.querySelector(`.nt-num[data-k="${label}"]`);
      if (!el) return;
      try {
        const res = await api.get(ep);
        const total = res.meta?.total ?? (Array.isArray(res.data) ? res.data.length : 0);
        countUp(el, total);
      } catch { el.textContent = '—'; }
    }));
  }
}
