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

  /* Placeholder / estado vacío */
  .nt-placeholder{text-align:center;color:var(--ink-soft);font-style:italic;font-size:16px;
    padding:60px 20px;border:1px dashed #cdb888;border-radius:10px;background:linear-gradient(158deg,#fdf8ec,#f0e6cc);}

  /* Cartel de noticia (Crónica) */
  .nt-note{position:relative;animation:dropPin .74s cubic-bezier(.2,.85,.25,1) both;}
  .nt-note-body{position:relative;background:linear-gradient(158deg,#fdf8ec,#f0e6cc);border:1px solid #d8c79b;
    border-radius:6px;padding:18px 17px 15px;box-shadow:inset 0 0 34px rgba(120,95,45,.09),0 10px 24px rgba(74,63,46,.16);
    transition:transform .4s cubic-bezier(.2,.85,.25,1),box-shadow .4s;}
  .nt-board.muro .nt-note-body{transform:rotate(var(--rot,0deg));}
  .nt-board.tablon .nt-note-body{transform:none;}
  .nt-note-body:hover{transform:rotate(0deg) translateY(-12px) scale(1.035)!important;
    box-shadow:0 24px 48px rgba(74,63,46,.30),0 0 30px rgba(201,162,39,.5);}
  .nt-note.leg .nt-note-body{border:2px solid #c9a227;animation:glowPulse 3.6s ease-in-out infinite 1.3s;}
  .nt-pin{position:absolute;top:-9px;left:50%;margin-left:-8px;width:16px;height:16px;border-radius:50%;z-index:2;
    background:radial-gradient(circle at 34% 30%,#f8e9ad,#bd952f 58%,#7a5d16);
    box-shadow:0 3px 5px rgba(0,0,0,.36),inset 0 1px 1px rgba(255,255,255,.65);}
  .nt-note-head{display:flex;gap:12px;align-items:flex-start;}
  .nt-seal{width:46px;height:46px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
    border-radius:52% 48% 50% 50%/50% 52% 48% 50%;font-family:'Cinzel',serif;font-weight:700;font-size:21px;
    color:#fdf6e3;text-shadow:0 1px 2px rgba(0,0,0,.45);animation:sealPop .5s cubic-bezier(.2,1.5,.4,1) both;
    box-shadow:inset 0 2px 5px rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.35),0 3px 7px rgba(0,0,0,.28);}
  .nt-text{font-size:16px;line-height:1.42;color:#4a3f2e;}
  .nt-text .ic{font-size:18px;margin-right:2px;}
  .nt-text b{color:#33291a;}
  .nt-text .hl{color:#6f5620;font-weight:600;}
  .nt-meta{margin-top:8px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;}
  .nt-meta .rar{font-weight:700;}
  .nt-meta .time{color:#a08c5e;}

  /* Panel lateral (Misiones / Eventos / Honor) */
  .nt-panel{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;margin-top:44px;}
  .nt-card{background:linear-gradient(160deg,#f6efdc,#ece0c2);border:1px solid #cdb888;border-radius:10px;
    box-shadow:0 8px 22px rgba(74,63,46,.13);padding:22px;}
  .nt-card-title{font-family:'Cinzel',serif;font-weight:700;font-size:18px;color:#6f5620;margin:0 0 12px;}
  .nt-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid rgba(120,95,45,.14);}
  .nt-row:first-of-type{border-top:none;}
  .nt-row.done{opacity:.62;}
  .nt-row-main{flex:1;min-width:0;}
  .nt-row-name{font-size:15px;font-weight:600;color:#4a3f2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .nt-row-sub{font-size:12px;color:#9a8558;margin-top:1px;}
  .nt-est-open{color:#5a8a63;font-weight:600;}
  .nt-est-done{color:#a08c5e;font-weight:600;}
  .nt-mini-seal{width:34px;height:34px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
    border-radius:52% 48% 50% 50%/50% 52% 48% 50%;font-family:'Cinzel',serif;font-weight:700;font-size:15px;color:#fdf6e3;
    text-shadow:0 1px 2px rgba(0,0,0,.4);box-shadow:inset 0 1px 3px rgba(255,255,255,.3),inset 0 -2px 4px rgba(0,0,0,.3),0 2px 4px rgba(0,0,0,.24);}
  .nt-date{width:46px;height:46px;flex-shrink:0;border-radius:8px;display:flex;flex-direction:column;align-items:center;
    justify-content:center;background:linear-gradient(180deg,#8a6d2f,#6f5620);color:#f7efdb;}
  .nt-date .d{font-family:'Cinzel',serif;font-weight:700;font-size:18px;line-height:1;}
  .nt-date .m{font-size:9px;text-transform:uppercase;letter-spacing:.08em;margin-top:2px;}
  .nt-pos{width:24px;flex-shrink:0;text-align:center;font-family:'Cinzel',serif;font-weight:700;font-size:16px;}
  .nt-honor-xp{font-family:'JetBrains Mono',monospace;font-size:12px;color:#6f5620;}
  .nt-divider{border-top:1px dashed #c9b382;margin:14px 0 10px;}
  .nt-award{font-size:13px;color:#6f6046;}
  .nt-empty-sm{font-size:13px;color:#9a8558;font-style:italic;padding:8px 0;}

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

/* Rarezas (letra del sello + colores) — según el prototipo. */
const RARITY = {
  C: { c: '#5a8a63', d: '#37623f', word: 'Común' },
  R: { c: '#3f7fbf', d: '#204e78', word: 'Rara' },
  E: { c: '#8058b0', d: '#4c2f74', word: 'Épica' },
  L: { c: '#c9a227', d: '#8f1d1d', word: 'Legendaria' },
};

/* Mapa de acciones del event_log → icono, rareza y texto legible. */
const FEED = {
  'award.granted':        { icon: '🏅', rar: 'L', text: (e, a) => `<b>${a}</b> otorgó la condecoración <span class="hl">«${ntEsc(e.target_name || '—')}»</span>` },
  'character.leveled_up': { icon: '⬆️', rar: 'E', text: (e, a) => `<b>${a}</b> alcanzó el <span class="hl">nivel ${ntLevel(e)}</span>` },
  'clan.created':         { icon: '🛡️', rar: 'E', text: (e, a) => `<b>${a}</b> fundó el gremio <span class="hl">«${ntEsc(e.target_name || '—')}»</span>` },
  'session.created':      { icon: '📜', rar: 'R', text: (e, a) => `<b>${a}</b> registró la crónica <span class="hl">«${ntEsc(e.target_name || 'una sesión')}»</span>` },
  'clan.member_joined':   { icon: '🤝', rar: 'C', text: (e, a) => `<b>${a}</b> se unió a un gremio` },
  'character.created':    { icon: '🧙', rar: 'C', text: (e, a) => `<b>${a}</b> dio vida a <span class="hl">«${ntEsc(e.target_name || 'un aventurero')}»</span>` },
  'member.registered':    { icon: '🎉', rar: 'C', text: (e, a) => `<b>${a}</b> se unió al gremio` },
};

function ntEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function ntMeta(x) {
  if (!x) return null;
  if (typeof x === 'object') return x;
  try { return JSON.parse(x); } catch { return null; }
}
function ntLevel(e) {
  const m = ntMeta(e.metadata);
  return (m && m.after && m.after.level != null) ? m.after.level : '?';
}
function ntRel(v) {
  if (!v) return '';
  const d = new Date(v);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 2592000) return `hace ${Math.floor(s / 86400)} d`;
  return d.toLocaleDateString('es');
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

    <div class="nt-panel" id="nt-panel">
      <div class="nt-card">
        <h3 class="nt-card-title">⚔ Misiones</h3>
        <div id="nt-quests"><div class="nt-empty-sm">Cargando…</div></div>
      </div>
      <div class="nt-card">
        <h3 class="nt-card-title">🗓 Próximos Eventos</h3>
        <div id="nt-events"><div class="nt-empty-sm">Cargando…</div></div>
      </div>
      <div class="nt-card">
        <h3 class="nt-card-title">🏆 Salón de Honor</h3>
        <div id="nt-honor"><div class="nt-empty-sm">Cargando…</div></div>
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

  /* Botón actualizar: recarga contadores, feed y panel; re-dispara la caída de los carteles */
  wrap.querySelector('#nt-refresh').addEventListener('click', () => {
    loadLedger(); loadFeed(); loadQuests(); loadEvents(); loadHonor();
  });

  await Promise.allSettled([loadLedger(), loadFeed(), loadQuests(), loadEvents(), loadHonor()]);

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

  /* ── Crónica del Gremio: feed real desde /events (N2) ── */
  async function loadFeed() {
    const feed = wrap.querySelector('#nt-feed');
    if (!feed) return;
    feed.innerHTML = '<div class="nt-placeholder">Consultando el tablón del gremio…</div>';

    let events = [], members = [];
    const [evRes, memRes] = await Promise.allSettled([
      api.get('/events?per_page=40'),
      api.get('/members?per_page=200'),
    ]);
    if (evRes.status === 'fulfilled') events = evRes.value.data ?? [];
    if (memRes.status === 'fulfilled') members = memRes.value.data ?? [];

    const nameOf = {};
    members.forEach(m => { nameOf[m.id] = m.display_name || m.username; });

    const nodes = [];
    events.forEach(e => {
      const cfg = FEED[e.action];
      if (!cfg) return;
      const rar = RARITY[cfg.rar];
      const actor = ntEsc(nameOf[e.actor_member_id] || e.target_name || 'Alguien');
      const note = document.createElement('div');
      note.className = 'nt-note' + (cfg.rar === 'L' ? ' leg' : '');
      const rot = (Math.random() < 0.5 ? -1 : 1) * (1.3 + Math.random() * 1.3);
      note.style.setProperty('--rot', rot.toFixed(2) + 'deg');
      note.innerHTML = `
        <div class="nt-note-body">
          <span class="nt-pin"></span>
          <div class="nt-note-head">
            <div class="nt-seal" style="background:radial-gradient(circle at 34% 30%,rgba(255,255,255,.5),transparent 52%),radial-gradient(circle at 50% 55%,${rar.c},${rar.d} 80%)">${cfg.rar}</div>
            <div>
              <div class="nt-text"><span class="ic">${cfg.icon}</span>${cfg.text(e, actor)}</div>
              <div class="nt-meta"><span class="rar" style="color:${rar.c}">${rar.word}</span> · <span class="time">${ntRel(e.occurred_at)}</span></div>
            </div>
          </div>
        </div>`;
      nodes.push(note);
    });

    if (!nodes.length) {
      feed.innerHTML = '<div class="nt-placeholder">El tablón está en calma… aún no hay gestas que anunciar.</div>';
      return;
    }

    feed.innerHTML = '';
    nodes.forEach((note, i) => {
      note.style.animationDelay = (0.1 + i * 0.09) + 's';
      const seal = note.querySelector('.nt-seal');
      if (seal) seal.style.animationDelay = (0.45 + i * 0.09) + 's';
      feed.appendChild(note);
    });
  }

  /* ── Misiones: recorre campañas → quests, agrupa abiertas/cumplidas (N3) ── */
  async function loadQuests() {
    const box = wrap.querySelector('#nt-quests');
    if (!box) return;
    let campaigns = [];
    try { campaigns = (await api.get('/campaigns?per_page=12')).data ?? []; } catch { /* ignore */ }
    if (!campaigns.length) { box.innerHTML = '<div class="nt-empty-sm">Sin campañas todavía.</div>'; return; }

    const results = await Promise.allSettled(
      campaigns.slice(0, 8).map(c => api.get(`/campaigns/${c.id}/quests`))
    );
    const quests = [];
    results.forEach(res => { if (res.status === 'fulfilled') (res.value.data ?? []).forEach(q => quests.push(q)); });
    if (!quests.length) { box.innerHTML = '<div class="nt-empty-sm">No hay misiones publicadas.</div>'; return; }

    const open = quests.filter(q => q.status === 'active');
    const done = quests.filter(q => q.status === 'completed');
    const list = [...open, ...done].slice(0, 6);

    box.innerHTML = '';
    list.forEach(q => {
      const xp = q.reward_xp || 0, gp = Number(q.reward_gp || 0);
      const rar = xp >= 1000 ? 'L' : xp >= 500 ? 'E' : xp >= 100 ? 'R' : 'C';
      const rc = RARITY[rar];
      const isDone = q.status === 'completed';
      const estado = isDone ? '<span class="nt-est-done">Cumplida</span>' : '<span class="nt-est-open">Abierta</span>';
      const row = document.createElement('div');
      row.className = 'nt-row' + (isDone ? ' done' : '');
      row.innerHTML = `
        <div class="nt-mini-seal" style="background:radial-gradient(circle at 34% 30%,rgba(255,255,255,.45),transparent 52%),radial-gradient(circle at 50% 55%,${rc.c},${rc.d} 80%)">${rar}</div>
        <div class="nt-row-main">
          <div class="nt-row-name">${ntEsc(q.title || 'Misión')}</div>
          <div class="nt-row-sub">✦ ${xp} XP · ${gp} oro · ${estado}</div>
        </div>`;
      box.appendChild(row);
    });
  }

  /* ── Próximos Eventos: /community/posts?board=events (N3) ── */
  async function loadEvents() {
    const box = wrap.querySelector('#nt-events');
    if (!box) return;
    let posts = [];
    try { posts = (await api.get('/community/posts?board=events')).data ?? []; } catch { /* ignore */ }

    const withDate = posts.filter(p => p.event_date);
    withDate.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
    const now = Date.now();
    const upcoming = withDate.filter(p => new Date(p.event_date).getTime() >= now - 86400000);
    const list = (upcoming.length ? upcoming : withDate).slice(0, 5);

    if (!list.length) { box.innerHTML = '<div class="nt-empty-sm">No hay eventos próximos.</div>'; return; }

    box.innerHTML = '';
    list.forEach(p => {
      const d = new Date(p.event_date);
      const valid = !isNaN(d.getTime());
      const day = valid ? d.getDate() : '—';
      const mon = valid ? d.toLocaleDateString('es', { month: 'short' }).replace('.', '').toUpperCase() : '';
      const row = document.createElement('div');
      row.className = 'nt-row';
      row.innerHTML = `
        <div class="nt-date"><span class="d">${day}</span><span class="m">${mon}</span></div>
        <div class="nt-row-main">
          <div class="nt-row-name">${ntEsc(p.title || 'Evento')}</div>
          ${valid ? `<div class="nt-row-sub">${d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</div>` : ''}
        </div>`;
      box.appendChild(row);
    });
  }

  /* ── Salón de Honor: leaderboard top 5 + última condecoración (N3) ── */
  async function loadHonor() {
    const box = wrap.querySelector('#nt-honor');
    if (!box) return;
    const [lbRes, awRes] = await Promise.allSettled([
      api.get('/hall/leaderboard'),
      api.get('/hall/awards'),
    ]);
    const board = lbRes.status === 'fulfilled' ? (lbRes.value.data ?? []) : [];
    const awards = awRes.status === 'fulfilled' ? (awRes.value.data ?? []) : [];

    box.innerHTML = '';
    if (!board.length) {
      box.innerHTML = '<div class="nt-empty-sm">Aún no hay ranking.</div>';
    } else {
      board.slice(0, 5).forEach((m, i) => {
        const pos = i + 1;
        const col = pos === 1 ? '#c9a227' : pos === 2 ? '#9a8a66' : pos === 3 ? '#a9743a' : '#b6a276';
        const row = document.createElement('div');
        row.className = 'nt-row';
        row.innerHTML = `
          <div class="nt-pos" style="color:${col}">${pos}</div>
          <div class="nt-row-main"><div class="nt-row-name">${ntEsc(m.display_name || m.username || '—')}</div></div>
          <div class="nt-honor-xp">${Number(m.total_xp || 0).toLocaleString('es')} XP</div>`;
        box.appendChild(row);
      });
    }

    if (awards.length) {
      const a = awards[0];
      const div = document.createElement('div');
      div.className = 'nt-divider';
      box.appendChild(div);
      const aw = document.createElement('div');
      aw.className = 'nt-award';
      aw.innerHTML = `🎖️ <b>«${ntEsc(a.title || '—')}»</b> → ${ntEsc(a.character_name || '—')}`;
      box.appendChild(aw);
    }
  }
}
