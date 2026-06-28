import { api } from '../js/api.js';
import { toast } from '../js/components/toast.js';
import { auth } from '../js/auth.js';

/* ─── D&D 5e DEFAULTS ───────────────────────────────────────────── */
const CLASSES = ['Bárbaro','Bardo','Brujo','Clérigo','Druida','Explorador','Guerrero','Hechicero','Mago','Monje','Paladín','Pícaro'];
const RACES   = ['Humano','Elfo','Enano','Mediano','Gnomo','Semielfo','Semiorco','Tiefling','Dracónido','Aasimar','Genasi'];

function modifier(score) { return Math.floor((score - 10) / 2); }
function modStr(score)   { const m = modifier(score); return (m >= 0 ? '+' : '') + m; }

const STAT_LABELS = {
  str_score: 'FUE', dex_score: 'DES', con_score: 'CON',
  int_score: 'INT', wis_score: 'SAB', cha_score: 'CAR',
};

/* ─── MAIN RENDER ───────────────────────────────────────────────── */
export async function render(container) {
  container.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'page-characters fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:1200px;';

  /* Header */
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;';

  const titleBlock = document.createElement('div');
  const title = document.createElement('h2');
  title.style.cssText = 'font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;';
  title.textContent = '᛭ Personajes ᛭';
  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'color:var(--ink-muted);font-size:14px;margin:0;';
  subtitle.textContent = 'Héroes y aventureros del gremio';
  titleBlock.appendChild(title);
  titleBlock.appendChild(subtitle);

  const createBtn = document.createElement('button');
  createBtn.className = 'btn btn-primary';
  createBtn.style.cssText = 'display:flex;align-items:center;gap:8px;';
  createBtn.innerHTML = '<span style="font-size:18px;">+</span> Nuevo Personaje';
  createBtn.addEventListener('click', () => openCreateModal());

  header.appendChild(titleBlock);
  header.appendChild(createBtn);

  /* Grid */
  const grid = document.createElement('div');
  grid.id = 'characters-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;';

  page.appendChild(header);
  page.appendChild(grid);
  container.appendChild(page);

  /* ── Load characters ── */
  async function loadCharacters() {
    grid.innerHTML = '<div style="color:var(--ink-muted);padding:40px;text-align:center;">Cargando personajes...</div>';
    try {
      const user = auth.getUser();
      const params = user?.role === 'player' ? `?member_id=${user.id}` : '';
      const res = await api.get(`/characters${params}`);
      const chars = res.data ?? [];

      grid.innerHTML = '';
      if (!chars.length) {
        grid.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:80px 20px;color:var(--ink-muted);">
            <div style="font-size:40px;margin-bottom:16px;">🧙</div>
            <div style="font-family:var(--font-display);font-size:18px;color:var(--ink);">No hay personajes aún</div>
            <div style="margin-top:8px;font-size:13px;">Crea tu primer aventurero</div>
          </div>`;
        return;
      }
      chars.forEach((c, i) => grid.appendChild(buildCard(c, i)));
    } catch (err) {
      grid.innerHTML = `<div style="color:var(--crimson);padding:40px;">Error: ${err.message}</div>`;
    }
  }

  loadCharacters();

  /* ── Build character card ── */
  function buildCard(c, index) {
    const hpPct = c.max_hp > 0 ? Math.max(0, Math.min(100, (c.hp / c.max_hp) * 100)) : 0;
    const hpColor = hpPct > 50 ? 'var(--success)' : hpPct > 25 ? 'var(--warning)' : 'var(--crimson)';

    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-radius:10px;
      padding:0;overflow:hidden;cursor:pointer;
      transition:transform var(--dur-fast) var(--ease-spring),box-shadow var(--dur-fast) var(--ease-spring);
      animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${index * 60}ms both;
    `;
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-3px)';
      card.style.boxShadow = '0 0 0 1px var(--gold-dim), 0 0 24px var(--gold-glow)';
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; card.style.boxShadow = ''; });
    card.addEventListener('click', () => openDetailSheet(c.id));

    /* Portrait bar */
    const portrait = document.createElement('div');
    portrait.style.cssText = `
      height:80px;background:linear-gradient(135deg,var(--stone-light),var(--border));
      display:flex;align-items:center;justify-content:center;
      font-size:36px;position:relative;
    `;
    portrait.textContent = c.portrait_url ? '' : '🧙';
    if (c.portrait_url) {
      const img = document.createElement('img');
      img.src = c.portrait_url;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      portrait.appendChild(img);
    }

    /* Level badge */
    const lvlBadge = document.createElement('div');
    lvlBadge.style.cssText = `
      position:absolute;top:8px;right:8px;
      background:var(--gold);color:var(--void);
      width:28px;height:28px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:700;font-family:var(--font-ui);
    `;
    lvlBadge.textContent = c.level || 1;
    portrait.appendChild(lvlBadge);

    /* Body */
    const body = document.createElement('div');
    body.style.cssText = 'padding:16px;';

    const name = document.createElement('div');
    name.style.cssText = 'font-family:var(--font-display);font-size:16px;color:var(--ink);margin-bottom:4px;';
    name.textContent = c.name;

    const meta = document.createElement('div');
    meta.style.cssText = 'font-size:12px;color:var(--ink-muted);margin-bottom:12px;';
    meta.textContent = [c.race, c.char_class || c.class].filter(Boolean).join(' · ');

    /* HP bar */
    const hpLabel = document.createElement('div');
    hpLabel.style.cssText = 'display:flex;justify-content:space-between;font-size:11px;color:var(--ink-muted);margin-bottom:4px;';
    hpLabel.innerHTML = `<span>HP</span><span style="color:var(--ink);font-weight:600;">${c.hp ?? '—'}/${c.max_hp ?? '—'}</span>`;

    const hpTrack = document.createElement('div');
    hpTrack.style.cssText = 'height:4px;background:var(--border);border-radius:2px;overflow:hidden;';
    const hpFill = document.createElement('div');
    hpFill.style.cssText = `height:100%;width:0%;background:${hpColor};border-radius:2px;transition:width 0.8s var(--ease-out-expo);`;
    hpTrack.appendChild(hpFill);

    /* Mini stats */
    const statsRow = document.createElement('div');
    statsRow.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:12px;';
    ['str_score','dex_score','con_score'].forEach(k => {
      const val = c[k] ?? 10;
      const cell = document.createElement('div');
      cell.style.cssText = 'text-align:center;background:var(--stone-light);border-radius:6px;padding:6px 4px;';
      cell.innerHTML = `<div style="font-size:16px;font-weight:700;color:var(--ink);font-family:var(--font-mono);">${val}</div>
                        <div style="font-size:9px;color:var(--gold-dim);letter-spacing:0.06em;">${STAT_LABELS[k]}</div>
                        <div style="font-size:10px;color:var(--ink-muted);">${modStr(val)}</div>`;
      statsRow.appendChild(cell);
    });

    body.appendChild(name);
    body.appendChild(meta);
    body.appendChild(hpLabel);
    body.appendChild(hpTrack);
    body.appendChild(statsRow);

    card.appendChild(portrait);
    card.appendChild(body);

    /* Animate HP bar after mount */
    requestAnimationFrame(() => requestAnimationFrame(() => { hpFill.style.width = hpPct + '%'; }));

    return card;
  }

  /* ── Detail Sheet (full character) ── */
  async function openDetailSheet(charId) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(9,8,10,0.85);
      backdrop-filter:blur(8px);z-index:1000;
      display:flex;align-items:flex-start;justify-content:center;
      overflow-y:auto;padding:32px 16px;
      animation:fadeIn var(--dur-normal) var(--ease-smooth);
    `;

    const sheet = document.createElement('div');
    sheet.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-radius:14px;
      width:100%;max-width:760px;
      animation:modalIn var(--dur-normal) var(--ease-spring);
      overflow:hidden;
    `;
    sheet.innerHTML = '<div style="padding:40px;text-align:center;color:var(--ink-muted);">Cargando ficha...</div>';

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); }
    });

    try {
      const res = await api.get(`/characters/${charId}`);
      const c = res.data;
      sheet.innerHTML = '';
      sheet.appendChild(buildFullSheet(c, overlay));
    } catch (err) {
      sheet.innerHTML = `<div style="padding:40px;color:var(--crimson);">Error: ${err.message}</div>`;
    }
  }

  function buildFullSheet(c, overlay) {
    const wrap = document.createElement('div');

    /* ── Header ── */
    const shHeader = document.createElement('div');
    shHeader.style.cssText = `
      background:linear-gradient(135deg,var(--stone-light),var(--stone));
      padding:28px 32px;border-bottom:1px solid var(--border);
      display:flex;align-items:flex-start;gap:20px;
    `;

    const avatar = document.createElement('div');
    avatar.style.cssText = 'width:72px;height:72px;border-radius:50%;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:32px;flex-shrink:0;border:2px solid var(--gold-dim);';
    avatar.textContent = '🧙';

    const headerInfo = document.createElement('div');
    headerInfo.style.cssText = 'flex:1;';

    const charName = document.createElement('h2');
    charName.style.cssText = 'font-family:var(--font-display);font-size:26px;color:var(--ink);margin:0 0 4px;';
    charName.textContent = c.name;

    const charMeta = document.createElement('div');
    charMeta.style.cssText = 'font-size:13px;color:var(--ink-muted);display:flex;gap:12px;flex-wrap:wrap;';
    charMeta.innerHTML = [
      c.race && `<span>🌿 ${c.race}${c.subrace ? ' ('+c.subrace+')' : ''}</span>`,
      c.char_class && `<span>⚔️ ${c.char_class}${c.subclass ? ' — '+c.subclass : ''}</span>`,
      c.background && `<span>📖 ${c.background}</span>`,
      c.alignment && `<span>⚖️ ${c.alignment}</span>`,
    ].filter(Boolean).join('');

    const lvlRow = document.createElement('div');
    lvlRow.style.cssText = 'margin-top:10px;display:flex;gap:16px;flex-wrap:wrap;';
    [
      { label: 'Nivel', val: c.level ?? 1, icon: '🎖️' },
      { label: 'CA',    val: c.ac ?? 10,   icon: '🛡️' },
      { label: 'Vel',   val: (c.speed ?? 30) + ' ft', icon: '💨' },
      { label: 'IBC',   val: modStr(c.initiative_bonus ?? c.dex_score ?? 10), icon: '⚡' },
      { label: 'Perc',  val: c.passive_perception ?? 10, icon: '👁️' },
    ].forEach(item => {
      const badge = document.createElement('div');
      badge.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:8px;padding:6px 12px;text-align:center;min-width:56px;';
      badge.innerHTML = `<div style="font-size:16px;font-weight:700;color:var(--gold);font-family:var(--font-mono);">${item.val}</div>
                         <div style="font-size:9px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.06em;">${item.label}</div>`;
      lvlRow.appendChild(badge);
    });

    headerInfo.appendChild(charName);
    headerInfo.appendChild(charMeta);
    headerInfo.appendChild(lvlRow);
    shHeader.appendChild(avatar);
    shHeader.appendChild(headerInfo);

    /* Close button */
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'position:absolute;top:16px;right:16px;background:transparent;border:none;color:var(--ink-muted);font-size:20px;cursor:pointer;';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => overlay.remove());
    shHeader.style.position = 'relative';
    shHeader.appendChild(closeBtn);

    /* ── Level-up action bar ── */
    const isSelf = String(c.member_id) === String(user?.id);
    const canLevelUp = isSelf || user?.role === 'admin' || user?.role === 'dm';
    if (canLevelUp && (c.level ?? 1) < 20) {
      const actionBar = document.createElement('div');
      actionBar.style.cssText = 'padding:12px 32px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;';

      const lvlUpBtn = document.createElement('button');
      lvlUpBtn.className = 'btn btn-primary';
      lvlUpBtn.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;';
      lvlUpBtn.innerHTML = '<span style="font-size:16px;">⬆️</span> Subir a Nivel ' + ((c.level ?? 1) + 1);
      lvlUpBtn.addEventListener('click', async () => {
        const newLevel = (c.level ?? 1) + 1;
        if (!confirm(`¿Subir a ${c.name} al Nivel ${newLevel}?`)) return;
        lvlUpBtn.disabled = true;
        try {
          await api.put('/characters/' + c.id, { level: newLevel });
          toast.success('🎉 ¡' + c.name + ' ha alcanzado el Nivel ' + newLevel + '!');
          c.level = newLevel;
          lvlUpBtn.innerHTML = '<span style="font-size:16px;">⬆️</span> Subir a Nivel ' + (newLevel + 1);
          lvlUpBtn.disabled = newLevel >= 20;
          // Update level badge on card
          const badge = document.querySelector(`[data-char-id="${c.id}"] .lvl-badge`);
          if (badge) badge.textContent = '#' + newLevel;
        } catch (e) { toast.error(e.message); lvlUpBtn.disabled = false; }
      });

      actionBar.appendChild(lvlUpBtn);

      const hpBtn = document.createElement('button');
      hpBtn.className = 'btn';
      hpBtn.style.cssText = 'font-size:13px;';
      hpBtn.textContent = '❤️ Editar HP';
      hpBtn.addEventListener('click', () => {
        const newHp = prompt(`HP actual: ${c.hp}/${c.max_hp}\nNuevo HP:`, c.hp);
        if (newHp === null) return;
        const val = parseInt(newHp);
        if (isNaN(val)) return;
        api.patch('/characters/' + c.id + '/hp', { hp: val }).then(() => {
          c.hp = val;
          toast.success('HP actualizado');
          const bar = wrap.querySelector('#hp-bar');
          if (bar && c.max_hp > 0) {
            const pct = Math.max(0, Math.min(100, (val / c.max_hp) * 100));
            bar.style.width = pct + '%';
          }
          const hpSpan = wrap.querySelector('#hp-display');
          if (hpSpan) hpSpan.textContent = val + ' / ' + c.max_hp;
        }).catch(e => toast.error(e.message));
      });
      actionBar.appendChild(hpBtn);

      wrap.appendChild(actionBar);
    }

    /* ── HP Bar full ── */
    const hpPct = c.max_hp > 0 ? Math.max(0, Math.min(100, (c.hp / c.max_hp) * 100)) : 0;
    const hpColor = hpPct > 50 ? 'var(--success)' : hpPct > 25 ? 'var(--warning)' : 'var(--crimson)';

    const hpSection = document.createElement('div');
    hpSection.style.cssText = 'padding:16px 32px;border-bottom:1px solid var(--border);';
    hpSection.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.06em;">Puntos de Golpe</span>
        <span style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--ink);">${c.hp ?? 0} / ${c.max_hp ?? 0}${c.temp_hp ? ' <span style="color:var(--success);font-size:13px;">(+'+c.temp_hp+' temp)</span>' : ''}</span>
      </div>
      <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
        <div id="hp-bar" style="height:100%;width:0%;background:linear-gradient(90deg,${hpColor},${hpColor}88);border-radius:4px;transition:width 1s var(--ease-out-expo);"></div>
      </div>`;

    /* ── Ability Scores grid ── */
    const statsSection = document.createElement('div');
    statsSection.style.cssText = 'padding:24px 32px;border-bottom:1px solid var(--border);';

    const statsTitle = document.createElement('div');
    statsTitle.style.cssText = 'font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:16px;';
    statsTitle.textContent = 'Puntuaciones de Característica';

    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:8px;';

    Object.entries(STAT_LABELS).forEach(([key, label]) => {
      const val = c[key] ?? 10;
      const mod = modStr(val);
      const cell = document.createElement('div');
      cell.style.cssText = `
        background:var(--stone-light);border:1px solid var(--border);border-radius:8px;
        padding:12px 8px;text-align:center;
        transition:border-color var(--dur-fast);
      `;
      cell.innerHTML = `
        <div style="font-size:11px;font-weight:600;color:var(--gold-dim);letter-spacing:0.06em;margin-bottom:6px;">${label}</div>
        <div class="stat-val" style="font-size:26px;font-weight:700;color:var(--ink);font-family:var(--font-mono);">0</div>
        <div style="font-size:13px;color:var(--ink-muted);margin-top:2px;">${mod}</div>
      `;
      cell.addEventListener('mouseenter', () => { cell.style.borderColor = 'var(--gold-dim)'; });
      cell.addEventListener('mouseleave', () => { cell.style.borderColor = 'var(--border)'; });
      statsGrid.appendChild(cell);

      /* Animate counter */
      animateCounter(cell.querySelector('.stat-val'), val);
    });

    statsSection.appendChild(statsTitle);
    statsSection.appendChild(statsGrid);

    /* ── Proficiency + skills ── */
    const combatSection = document.createElement('div');
    combatSection.style.cssText = 'padding:24px 32px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr;gap:24px;';

    const profBlock = document.createElement('div');
    profBlock.innerHTML = `
      <div style="font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Competencia</div>
      <div style="font-family:var(--font-mono);font-size:28px;color:var(--gold);font-weight:700;">+${c.prof_bonus ?? 2}</div>
      <div style="font-size:12px;color:var(--ink-muted);margin-top:4px;">Bonus de Competencia</div>
    `;

    const inspBlock = document.createElement('div');
    inspBlock.innerHTML = `
      <div style="font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Inspiración</div>
      <div style="font-size:28px;">${c.inspiration ? '✨' : '○'}</div>
      <div style="font-size:12px;color:var(--ink-muted);margin-top:4px;">${c.inspiration ? 'Activa' : 'Sin inspiración'}</div>
    `;

    combatSection.appendChild(profBlock);
    combatSection.appendChild(inspBlock);

    /* ── Backstory ── */
    let backstorySection = null;
    if (c.backstory || c.personality_traits || c.ideals || c.bonds || c.flaws) {
      backstorySection = document.createElement('div');
      backstorySection.style.cssText = 'padding:24px 32px;';

      const bsTitle = document.createElement('div');
      bsTitle.style.cssText = 'font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:16px;';
      bsTitle.textContent = 'Trasfondo';

      const bsGrid = document.createElement('div');
      bsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';

      const traitFields = [
        { key: 'personality_traits', label: 'Rasgos de Personalidad' },
        { key: 'ideals', label: 'Ideales' },
        { key: 'bonds', label: 'Vínculos' },
        { key: 'flaws', label: 'Defectos' },
      ];
      traitFields.forEach(f => {
        if (!c[f.key]) return;
        const block = document.createElement('div');
        block.style.cssText = 'background:var(--stone-light);border-radius:8px;padding:12px;';
        block.innerHTML = `<div style="font-size:10px;color:var(--gold-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">${f.label}</div>
                           <div style="font-size:13px;color:var(--ink-muted);line-height:1.5;">${c[f.key]}</div>`;
        bsGrid.appendChild(block);
      });

      if (c.backstory) {
        const bsFull = document.createElement('div');
        bsFull.style.cssText = 'background:var(--stone-light);border-radius:8px;padding:12px;grid-column:1/-1;margin-top:4px;';
        bsFull.innerHTML = `<div style="font-size:10px;color:var(--gold-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Historia</div>
                            <div style="font-size:13px;color:var(--ink-muted);line-height:1.6;">${c.backstory}</div>`;
        bsGrid.appendChild(bsFull);
      }

      backstorySection.appendChild(bsTitle);
      backstorySection.appendChild(bsGrid);
    }

    wrap.appendChild(shHeader);
    wrap.appendChild(hpSection);
    wrap.appendChild(statsSection);
    wrap.appendChild(combatSection);
    if (backstorySection) wrap.appendChild(backstorySection);

    /* Animate HP and stats after mount */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const bar = wrap.querySelector('#hp-bar');
      if (bar) bar.style.width = hpPct + '%';
    }));

    return wrap;
  }

  /* ── Counter animation ── */
  function animateCounter(el, target) {
    let start = 0;
    const duration = 600;
    const startTime = performance.now();
    function step(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(ease * target);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ── Create Character Modal ── */
  async function openCreateModal() {
    /* Load campaigns for the dropdown */
    let campaigns = [];
    try {
      const res = await api.get('/campaigns?status=active');
      campaigns = res.data ?? [];
    } catch (_) {}

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(9,8,10,0.85);
      backdrop-filter:blur(8px);z-index:1000;
      display:flex;align-items:flex-start;justify-content:center;
      overflow-y:auto;padding:32px 16px;
      animation:fadeIn var(--dur-normal) var(--ease-smooth);
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background:var(--stone);border:1px solid var(--border);
      border-radius:12px;padding:32px;width:100%;max-width:560px;
      animation:modalIn var(--dur-normal) var(--ease-spring);
    `;

    const modalTitle = document.createElement('h3');
    modalTitle.style.cssText = 'font-family:var(--font-display);color:var(--gold);margin:0 0 24px;font-size:20px;';
    modalTitle.textContent = 'Nuevo Personaje';

    const form = document.createElement('div');
    form.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

    /* Helper to build form row */
    function row(label, el) {
      const g = document.createElement('div');
      const l = document.createElement('label');
      l.style.cssText = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;';
      l.textContent = label;
      g.appendChild(l);
      g.appendChild(el);
      return g;
    }

    function input(id, placeholder, value = '') {
      const el = document.createElement('input');
      el.type = 'text'; el.id = id; el.placeholder = placeholder; el.value = value;
      el.className = 'input';
      return el;
    }

    function numInput(id, value, min = 1, max = 30) {
      const el = document.createElement('input');
      el.type = 'number'; el.id = id; el.value = value; el.min = min; el.max = max;
      el.className = 'input';
      return el;
    }

    function select(id, options, selectedVal = '') {
      const el = document.createElement('select');
      el.id = id; el.className = 'input';
      options.forEach(o => {
        const opt = document.createElement('option');
        const val = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        opt.value = val; opt.textContent = label;
        if (val === selectedVal) opt.selected = true;
        el.appendChild(opt);
      });
      return el;
    }

    /* Two-column grid for stats */
    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';

    const statFields = [
      { id: 'f-str', label: 'Fuerza',        min: 1, max: 30, def: 10 },
      { id: 'f-dex', label: 'Destreza',       min: 1, max: 30, def: 10 },
      { id: 'f-con', label: 'Constitución',   min: 1, max: 30, def: 10 },
      { id: 'f-int', label: 'Inteligencia',   min: 1, max: 30, def: 10 },
      { id: 'f-wis', label: 'Sabiduría',      min: 1, max: 30, def: 10 },
      { id: 'f-cha', label: 'Carisma',        min: 1, max: 30, def: 10 },
    ];
    statFields.forEach(sf => {
      const el = numInput(sf.id, sf.def, sf.min, sf.max);
      statsGrid.appendChild(row(sf.label, el));
    });

    /* Campaign select */
    const campOptions = [
      { value: '', label: '— Ninguna —' },
      ...campaigns.map(c => ({ value: c.id, label: c.name })),
    ];

    form.appendChild(row('Nombre *', input('f-name', 'Aragorn el Montaraz')));

    const twoCol = document.createElement('div');
    twoCol.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
    twoCol.appendChild(row('Raza', select('f-race', RACES)));
    twoCol.appendChild(row('Clase', select('f-class', CLASSES)));
    form.appendChild(twoCol);

    const twoCol2 = document.createElement('div');
    twoCol2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
    twoCol2.appendChild(row('HP Máx *', numInput('f-maxhp', 10, 1, 999)));
    twoCol2.appendChild(row('Nivel', numInput('f-level', 1, 1, 20)));
    form.appendChild(twoCol2);

    const twoCol3 = document.createElement('div');
    twoCol3.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
    twoCol3.appendChild(row('CA', numInput('f-ac', 10, 0, 30)));
    twoCol3.appendChild(row('Velocidad (ft)', numInput('f-speed', 30, 0, 120)));
    form.appendChild(twoCol3);

    form.appendChild(row('Campaña', select('f-campaign', campOptions)));

    const statsLabel = document.createElement('div');
    statsLabel.style.cssText = 'font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-top:4px;';
    statsLabel.textContent = 'Puntuaciones (Ability Scores)';
    form.appendChild(statsLabel);
    form.appendChild(statsGrid);

    /* Buttons */
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;margin-top:8px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.style.cssText = 'flex:1;background:transparent;border:1px solid var(--border);color:var(--ink-muted);';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.addEventListener('click', () => overlay.remove());

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.style.cssText = 'flex:2;';
    saveBtn.textContent = 'Crear personaje';

    saveBtn.addEventListener('click', async () => {
      const name  = form.querySelector('#f-name').value.trim();
      const maxhp = parseInt(form.querySelector('#f-maxhp').value) || 10;
      const campId = form.querySelector('#f-campaign').value;

      if (!name) { toast.error('Campo requerido', 'El nombre es obligatorio'); return; }
      if (!campId) { toast.error('Campo requerido', 'Selecciona una campaña'); return; }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Creando...';

      try {
        await api.post('/characters', {
          name,
          race:         form.querySelector('#f-race').value,
          char_class:   form.querySelector('#f-class').value,
          level:        parseInt(form.querySelector('#f-level').value) || 1,
          hp:           maxhp,
          max_hp:       maxhp,
          ac:           parseInt(form.querySelector('#f-ac').value) || 10,
          speed:        parseInt(form.querySelector('#f-speed').value) || 30,
          campaign_id:  campId,
          str_score:    parseInt(form.querySelector('#f-str').value) || 10,
          dex_score:    parseInt(form.querySelector('#f-dex').value) || 10,
          con_score:    parseInt(form.querySelector('#f-con').value) || 10,
          int_score:    parseInt(form.querySelector('#f-int').value) || 10,
          wis_score:    parseInt(form.querySelector('#f-wis').value) || 10,
          cha_score:    parseInt(form.querySelector('#f-cha').value) || 10,
        });
        toast.success('¡Personaje creado!', name);
        overlay.remove();
        loadCharacters();
      } catch (err) {
        toast.error('Error', err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Crear personaje';
      }
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    modal.appendChild(modalTitle);
    modal.appendChild(form);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); }
    });

    setTimeout(() => form.querySelector('#f-name')?.focus(), 50);
  }
}
