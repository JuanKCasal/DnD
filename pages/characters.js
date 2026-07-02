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

/* ─── D&D 5e SRD RACE DATA (2014) — Razas con subrazas, bonos y velocidad ── */
const RACE_DATA = {
  'Humano':    { speed:30, bonuses:{ str:1,dex:1,con:1,int:1,wis:1,cha:1 }, subraces:null },
  'Elfo':      { speed:30, bonuses:{}, subraces:{
    'Alto':          { bonuses:{ dex:2,int:1 }, speed:30 },
    'Del Bosque':    { bonuses:{ dex:2,wis:1 }, speed:35 },
    'Oscuro (Drow)': { bonuses:{ dex:2,cha:1 }, speed:30 },
  }},
  'Enano':     { speed:25, bonuses:{}, subraces:{
    'De las Colinas':  { bonuses:{ con:2,wis:1 } },
    'De las Montañas': { bonuses:{ con:2,str:2 } },
  }},
  'Mediano':   { speed:25, bonuses:{}, subraces:{
    'Pie Ligero': { bonuses:{ dex:2,cha:1 } },
    'Fornido':    { bonuses:{ dex:2,con:1 } },
  }},
  'Gnomo':     { speed:25, bonuses:{}, subraces:{
    'De las Rocas': { bonuses:{ int:2,con:1 } },
    'Del Bosque':   { bonuses:{ int:2,dex:1 } },
  }},
  'Semielfo':  { speed:30, bonuses:{ cha:2 }, subraces:null, special:'choice2' },
  'Semiorco':  { speed:30, bonuses:{ str:2,con:1 }, subraces:null },
  'Tiefling':  { speed:30, bonuses:{ int:1,cha:2 }, subraces:null },
  'Dracónido': { speed:30, bonuses:{ str:2,cha:1 }, subraces:null },
  'Aasimar':   { speed:30, bonuses:{ wis:1,cha:2 }, subraces:null },
  'Genasi':    { speed:30, bonuses:{}, subraces:{
    'De Fuego': { bonuses:{ con:2,int:1 } },
    'De Agua':  { bonuses:{ con:2,wis:1 } },
    'De Tierra':{ bonuses:{ con:2,str:1 } },
    'De Aire':  { bonuses:{ con:2,dex:1 } },
  }},
};

/* ─── Competencias de habilidad por Trasfondo (PHB) ─────────────────── */
const BACKGROUND_SKILLS = {
  'Acólito':          ['Perspicacia','Religión'],
  'Artesano Gremial': ['Perspicacia','Persuasión'],
  'Criminal':         ['Engaño','Sigilo'],
  'Ermitaño':         ['Medicina','Religión'],
  'Forajido':         ['Atletismo','Supervivencia'],
  'Héroe Popular':    ['Trato con Animales','Supervivencia'],
  'Marinero':         ['Atletismo','Percepción'],
  'Mercader':         ['Perspicacia','Persuasión'],
  'Militar':          ['Atletismo','Intimidación'],
  'Noble':            ['Historia','Persuasión'],
  'Sabio':            ['Arcanos','Historia'],
  'Siervo':           ['Historia','Perspicacia'],
};

/* ─── Tiradas de salvación con competencia por Clase (PHB) ──────────── */
const CLASS_SAVES = {
  'Bárbaro':['FUE','CON'],'Bardo':['DES','CAR'],'Clérigo':['SAB','CAR'],
  'Druida':['INT','SAB'],'Guerrero':['FUE','CON'],'Monje':['FUE','DES'],
  'Paladín':['SAB','CAR'],'Explorador':['FUE','DES'],'Pícaro':['DES','INT'],
  'Hechicero':['CON','CAR'],'Brujo':['SAB','CAR'],'Mago':['INT','SAB'],
};

/* ─── Dado de golpe por Clase ────────────────────────────────────────── */
const CLASS_HIT_DIE = {
  'Bárbaro':12,'Bardo':8,'Brujo':8,'Clérigo':8,'Druida':8,
  'Explorador':10,'Guerrero':10,'Hechicero':6,'Mago':6,'Monje':8,'Paladín':10,'Pícaro':8,
};

/* BPC = floor((nivel-1)/4) + 2  →  +2(N1-4), +3(N5-8), +4(N9-12), +5(N13-16), +6(N17-20) */
function profBonusByLevel(lvl) { return Math.floor((lvl - 1) / 4) + 2; }

/* ─── Claves de salvación por Clase — claves DB (PHB) ──────────────── */
const CLASS_SAVES_KEYS = {
  'Bárbaro':['str','con'],'Bardo':['dex','cha'],'Clérigo':['wis','cha'],
  'Druida':['int','wis'],'Guerrero':['str','con'],'Monje':['str','dex'],
  'Paladín':['wis','cha'],'Explorador':['str','dex'],'Pícaro':['dex','int'],
  'Hechicero':['con','cha'],'Brujo':['wis','cha'],'Mago':['int','wis'],
};

/* ─── Habilidades fijas por Raza (PHB) ──────────────────────────────── */
const RACE_SKILLS = {
  'Elfo':    ['perception'],
  'Semiorco':['intimidation'],
};

/* ─── Nombre español → clave DB ─────────────────────────────────────── */
const SKILL_NAME_TO_KEY = {
  'Acrobacias':'acrobatics','Trato con Animales':'animal_handling','Arcanos':'arcana',
  'Atletismo':'athletics','Engaño':'deception','Historia':'history',
  'Perspicacia':'insight','Intimidación':'intimidation','Investigación':'investigation',
  'Medicina':'medicine','Naturaleza':'nature','Percepción':'perception',
  'Actuación':'performance','Persuasión':'persuasion','Religión':'religion',
  'Juego de Manos':'sleight_of_hand','Sigilo':'stealth','Supervivencia':'survival',
};

/* ─── Clave DB → Nombre español ─────────────────────────────────────── */
const SKILL_KEY_TO_NAME = Object.fromEntries(Object.entries(SKILL_NAME_TO_KEY).map(([n,k]) => [k,n]));

/* ─── Competencias de habilidad por Clase (PHB 2014) ────────────────── */
const CLASS_SKILLS = {
  'Bárbaro':   { count:2, options:['animal_handling','athletics','intimidation','nature','perception','survival'] },
  'Bardo':     { count:3, options:['acrobatics','animal_handling','arcana','athletics','deception','history','insight','intimidation','investigation','medicine','nature','perception','performance','persuasion','religion','sleight_of_hand','stealth','survival'] },
  'Clérigo':   { count:2, options:['history','insight','medicine','persuasion','religion'] },
  'Druida':    { count:2, options:['arcana','animal_handling','insight','medicine','nature','perception','religion','survival'] },
  'Guerrero':  { count:2, options:['acrobatics','animal_handling','athletics','history','insight','intimidation','perception','survival'] },
  'Monje':     { count:2, options:['acrobatics','athletics','history','insight','religion','stealth'] },
  'Paladín':   { count:2, options:['athletics','insight','intimidation','medicine','persuasion','religion'] },
  'Explorador':{ count:3, options:['animal_handling','athletics','insight','investigation','nature','perception','stealth','survival'] },
  'Pícaro':    { count:4, options:['acrobatics','athletics','deception','insight','intimidation','investigation','sleight_of_hand','perception','performance','persuasion','stealth'] },
  'Hechicero': { count:2, options:['arcana','deception','insight','intimidation','persuasion','religion'] },
  'Brujo':     { count:2, options:['arcana','deception','history','intimidation','nature','religion'] },
  'Mago':      { count:2, options:['arcana','history','insight','investigation','medicine','religion'] },
};

/* ─── MAIN RENDER ───────────────────────────────────────────────── */
export async function render(container) {
  container.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'page-characters fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:1300px;';

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
    const user = auth.getUser();
    const canEdit = user && (user.role === 'admin' || user.role === 'dm' || String(user.id) === String(c.member_id));
    const hpPct = c.max_hp > 0 ? Math.max(0, Math.min(100, (c.hp / c.max_hp) * 100)) : 0;
    const hpColor = hpPct > 50 ? 'var(--success)' : hpPct > 25 ? 'var(--warning)' : 'var(--crimson)';

    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-radius:10px;
      padding:0;overflow:hidden;cursor:pointer;position:relative;
      transition:transform var(--dur-fast) var(--ease-spring),box-shadow var(--dur-fast) var(--ease-spring);
      animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${index * 60}ms both;
    `;

    /* Action bar — declared early so mouseenter/leave can reference it */
    const actionBar = document.createElement('div');
    actionBar.style.cssText = 'position:absolute;top:8px;left:8px;display:flex;gap:4px;opacity:0;transition:opacity var(--dur-fast) var(--ease-smooth);z-index:2;';

    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-3px)';
      card.style.boxShadow = '0 0 0 1px var(--gold-dim), 0 0 24px var(--gold-glow)';
      if (canEdit) actionBar.style.opacity = '1';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
      if (canEdit) actionBar.style.opacity = '0';
    });
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.card-action-btn')) openDetailSheet(c.id);
    });

    /* Portrait bar */
    const portrait = document.createElement('div');
    portrait.style.cssText = `
      height:90px;background:linear-gradient(135deg,var(--stone-light),var(--border));
      display:flex;align-items:center;justify-content:center;
      font-size:36px;position:relative;overflow:hidden;
    `;
    if (c.portrait_url) {
      const img = document.createElement('img');
      img.src = c.portrait_url;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      portrait.appendChild(img);
    } else {
      portrait.textContent = '🧙';
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

    /* Edit/delete action buttons */
    if (canEdit) {
      const editBtn = document.createElement('button');
      editBtn.className = 'card-action-btn';
      editBtn.title = 'Editar personaje';
      editBtn.style.cssText = 'width:26px;height:26px;border-radius:6px;border:none;cursor:pointer;background:rgba(9,8,10,0.75);color:var(--gold);font-size:13px;display:flex;align-items:center;justify-content:center;';
      editBtn.textContent = '✏️';
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(c.id); });

      const delBtn = document.createElement('button');
      delBtn.className = 'card-action-btn';
      delBtn.title = 'Eliminar personaje';
      delBtn.style.cssText = 'width:26px;height:26px;border-radius:6px;border:none;cursor:pointer;background:rgba(9,8,10,0.75);color:var(--crimson);font-size:13px;display:flex;align-items:center;justify-content:center;';
      delBtn.textContent = '🗑';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`¿Eliminar a "${c.name}"? Esta acción no se puede deshacer.`)) return;
        try {
          await api.del(`/characters/${c.id}`);
          toast.success('Personaje eliminado', c.name);
          loadCharacters();
        } catch (err) {
          toast.error('Error', err.message);
        }
      });

      actionBar.appendChild(editBtn);
      actionBar.appendChild(delBtn);
      portrait.appendChild(actionBar);
    }

    /* Body */
    const body = document.createElement('div');
    body.style.cssText = 'padding:16px;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-family:var(--font-display);font-size:16px;color:var(--ink);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    nameEl.textContent = c.name;

    const meta = document.createElement('div');
    meta.style.cssText = 'font-size:12px;color:var(--ink-muted);margin-bottom:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
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

    /* Mini stats — all 6 ability scores in a compact row */
    const statsRow = document.createElement('div');
    statsRow.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-top:12px;';
    ['str_score','dex_score','con_score','int_score','wis_score','cha_score'].forEach(k => {
      const val = c[k] ?? 10;
      const cell = document.createElement('div');
      cell.style.cssText = 'text-align:center;background:var(--stone-light);border-radius:5px;padding:5px 2px;';
      cell.innerHTML = `<div style="font-size:13px;font-weight:700;color:var(--ink);font-family:var(--font-mono);line-height:1;">${val}</div>
                        <div style="font-size:8px;color:var(--gold-dim);letter-spacing:0.03em;margin-top:2px;">${STAT_LABELS[k]}</div>
                        <div style="font-size:9px;color:var(--ink-muted);">${modStr(val)}</div>`;
      statsRow.appendChild(cell);
    });

    body.appendChild(nameEl);
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
    const user = auth.getUser();
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
      sheet.appendChild(buildFullSheet(c, overlay, user));
    } catch (err) {
      sheet.innerHTML = `<div style="padding:40px;color:var(--crimson);">Error: ${err.message}</div>`;
    }
  }

  function buildFullSheet(c, overlay, user) {
    /* ── Helpers ── */
    function mod(score) { return Math.floor(((score || 10) - 10) / 2); }
    function ms(score)  { const m = mod(score); return (m >= 0 ? '+' : '') + m; }
    function safeJson(val, fallback) {
      if (!val) return fallback;
      if (typeof val === 'object') return val;
      try { return JSON.parse(val); } catch (_) { return fallback; }
    }
    function sectionTitle(text) {
      const d = document.createElement('div');
      d.style.cssText = 'font-size:10px;font-weight:700;color:var(--gold-dim);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--border);';
      d.textContent = text;
      return d;
    }
    function textBlock(label, value) {
      const d = document.createElement('div');
      d.style.cssText = 'background:var(--stone-light);border:1px solid var(--border);border-radius:8px;padding:12px;';
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:9px;font-weight:700;color:var(--gold-dim);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;';
      lbl.textContent = label;
      const val = document.createElement('div');
      val.style.cssText = 'font-size:13px;color:var(--ink-muted);line-height:1.6;white-space:pre-wrap;';
      val.textContent = value || '—';
      d.appendChild(lbl); d.appendChild(val);
      return d;
    }

    const prof        = c.prof_bonus ?? 2;
    const skills_data = safeJson(c.skills, {});
    const saves_data  = safeJson(c.saving_throws, {});
    const spell_slots = safeJson(c.spell_slots, {});
    const conditions  = safeJson(c.conditions, []);
    const feats       = safeJson(c.feats, []);
    const lvl         = c.level ?? 1;

    const wrap = document.createElement('div');

    /* HEADER */
    const shHeader = document.createElement('div');
    shHeader.style.cssText = 'background:linear-gradient(135deg,var(--stone-light),var(--stone));padding:22px 32px 18px;border-bottom:1px solid var(--border);position:relative;';

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'position:absolute;top:14px;right:16px;background:transparent;border:none;color:var(--ink-muted);font-size:22px;cursor:pointer;line-height:1;';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => overlay.remove());
    shHeader.appendChild(closeBtn);

    const hTop = document.createElement('div');
    hTop.style.cssText = 'display:flex;align-items:flex-start;gap:16px;';

    const avatar = document.createElement('div');
    avatar.style.cssText = 'width:60px;height:60px;border-radius:50%;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;border:2px solid var(--gold-dim);';
    avatar.textContent = '🧙';

    const hInfo = document.createElement('div');
    hInfo.style.cssText = 'flex:1;min-width:0;';

    const charName = document.createElement('h2');
    charName.style.cssText = 'font-family:var(--font-display);font-size:22px;color:var(--ink);margin:0 0 4px;';
    charName.textContent = c.name;

    const charMeta = document.createElement('div');
    charMeta.style.cssText = 'font-size:12px;color:var(--ink-muted);display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;';
    [
      c.race       && ('🌿 ' + c.race + (c.subrace ? ' ('+c.subrace+')' : '')),
      c.char_class && ('⚔️ ' + c.char_class + (c.subclass ? ' — '+c.subclass : '')),
      c.background && ('📖 ' + c.background),
      c.alignment  && ('⚖️ ' + c.alignment),
      c.deity      && ('🙏 ' + c.deity),
    ].filter(Boolean).forEach(t => {
      const s = document.createElement('span'); s.textContent = t; charMeta.appendChild(s);
    });

    /* XP bar */
    const XP_THRESHOLDS = [0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
    const xp     = c.xp ?? 0;
    const xpNext = XP_THRESHOLDS[Math.min(lvl, 19)] ?? XP_THRESHOLDS[19];
    const xpCurr = XP_THRESHOLDS[Math.min(lvl - 1, 19)] ?? 0;
    const xpPct  = lvl >= 20 ? 100 : Math.min(100, ((xp - xpCurr) / (xpNext - xpCurr)) * 100);

    const xpRow = document.createElement('div');
    xpRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
    const xpLbl = document.createElement('span');
    xpLbl.style.cssText = 'font-size:11px;color:var(--ink-muted);white-space:nowrap;';
    xpLbl.textContent = 'Nivel ' + lvl + '  ·  ' + xp.toLocaleString() + ' XP';
    const xpTrack = document.createElement('div');
    xpTrack.style.cssText = 'flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden;';
    const xpFill = document.createElement('div');
    xpFill.id = 'sh-xp-fill';
    xpFill.style.cssText = 'height:100%;width:0%;background:var(--gold);border-radius:2px;transition:width 1.2s var(--ease-out-expo);';
    xpTrack.appendChild(xpFill);
    xpRow.appendChild(xpLbl);
    if (lvl < 20) {
      xpRow.appendChild(xpTrack);
      const xpNext2 = document.createElement('span');
      xpNext2.style.cssText = 'font-size:10px;color:var(--ink-faint);white-space:nowrap;';
      xpNext2.textContent = '→ ' + xpNext.toLocaleString();
      xpRow.appendChild(xpNext2);
    }

    hInfo.appendChild(charName); hInfo.appendChild(charMeta); hInfo.appendChild(xpRow);
    hTop.appendChild(avatar); hTop.appendChild(hInfo);
    shHeader.appendChild(hTop);
    wrap.appendChild(shHeader);

    /* ACTION BAR */
    const isSelf  = String(c.member_id) === String(user?.id);
    const canEdit = isSelf || user?.role === 'admin' || user?.role === 'dm';

    if (canEdit) {
      const actionBar = document.createElement('div');
      actionBar.style.cssText = 'padding:10px 32px;border-bottom:1px solid var(--border);display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:var(--stone-light);';

      if (lvl < 20) {
        const lvlUpBtn = document.createElement('button');
        lvlUpBtn.className = 'btn btn-primary';
        lvlUpBtn.style.cssText = 'font-size:12px;display:flex;align-items:center;gap:6px;';
        lvlUpBtn.textContent = '⬆️ Subir a Nivel ' + (lvl + 1);
        lvlUpBtn.addEventListener('click', async () => {
          const newLevel = lvl + 1;
          if (!confirm('¿Subir a ' + c.name + ' al Nivel ' + newLevel + '?')) return;
          lvlUpBtn.disabled = true;
          try {
            await api.put('/characters/' + c.id, { level: newLevel });
            toast.success('🎉 ¡' + c.name + ' ha alcanzado el Nivel ' + newLevel + '!');
            overlay.remove();
          } catch (e) { toast.error(e.message); lvlUpBtn.disabled = false; }
        });
        actionBar.appendChild(lvlUpBtn);
      }

      const hpBtn = document.createElement('button');
      hpBtn.className = 'btn';
      hpBtn.style.cssText = 'font-size:12px;';
      hpBtn.textContent = '❤️ Editar HP';
      hpBtn.addEventListener('click', () => {
        const newHp = prompt('HP actual: ' + c.hp + '/' + c.max_hp + '\nNuevo HP:', c.hp);
        if (newHp === null) return;
        const val = parseInt(newHp);
        if (isNaN(val)) return;
        api.patch('/characters/' + c.id + '/hp', { hp: val }).then(() => {
          c.hp = val;
          toast.success('HP actualizado');
          const hpBar  = wrap.querySelector('#sh-hp-bar');
          const hpDisp = wrap.querySelector('#sh-hp-display');
          if (hpBar && c.max_hp > 0) {
            const pct = Math.max(0, Math.min(100, (val / c.max_hp) * 100));
            hpBar.style.width = pct + '%';
          }
          if (hpDisp) hpDisp.textContent = val + ' / ' + c.max_hp;
        }).catch(e => toast.error(e.message));
      });
      actionBar.appendChild(hpBtn);
      wrap.appendChild(actionBar);
    }

    /* TABS */
    const tabDefs = [
      { id: 'general',     label: 'General' },
      { id: 'habilidades', label: 'Habilidades' },
      { id: 'hechizos',    label: 'Hechizos' },
      { id: 'rasgos',      label: 'Rasgos' },
      { id: 'inventario',  label: '🎒 Inventario' },
    ];

    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;border-bottom:1px solid var(--border);background:var(--stone);overflow-x:auto;';

    const panels = {};
    tabDefs.forEach(t => {
      const btn = document.createElement('button');
      btn.style.cssText = 'padding:12px 18px;border:none;background:transparent;cursor:pointer;font-size:12px;font-weight:600;color:var(--ink-muted);border-bottom:2px solid transparent;transition:all 150ms;font-family:var(--font-ui);white-space:nowrap;';
      btn.textContent = t.label;
      btn.dataset.tab = t.id;
      btn.addEventListener('click', () => {
        tabBar.querySelectorAll('button').forEach(b => { b.style.color='var(--ink-muted)'; b.style.borderBottomColor='transparent'; });
        btn.style.color = 'var(--gold)';
        btn.style.borderBottomColor = 'var(--gold)';
        Object.values(panels).forEach(p => { p.style.display = 'none'; });
        panels[t.id].style.display = 'block';
      });
      tabBar.appendChild(btn);

      const panel = document.createElement('div');
      panel.style.cssText = 'padding:24px 32px;display:none;';
      panels[t.id] = panel;
    });

    wrap.appendChild(tabBar);
    Object.values(panels).forEach(p => wrap.appendChild(p));
    tabBar.querySelector('button').click();

    /* ─── Lazy-load TAB: INVENTARIO ─── */
    {
      let invLoaded = false;
      const invBtn = tabBar.querySelector('[data-tab="inventario"]');
      if (invBtn) {
        invBtn.addEventListener('click', () => {
          if (!invLoaded) { invLoaded = true; renderShInventario(panels['inventario']); }
        });
      }
    }

    /* ─── TAB 1: GENERAL ─── */
    const p1 = panels['general'];

    /* HP */
    const hpPct   = c.max_hp > 0 ? Math.max(0, Math.min(100, (c.hp / c.max_hp) * 100)) : 0;
    const hpColor = hpPct > 50 ? 'var(--success)' : hpPct > 25 ? 'var(--warning)' : 'var(--crimson)';

    const hpWrap = document.createElement('div');
    hpWrap.style.cssText = 'margin-bottom:24px;';
    hpWrap.appendChild(sectionTitle('Puntos de Golpe'));

    const hpRow = document.createElement('div');
    hpRow.style.cssText = 'display:flex;align-items:center;gap:16px;margin-bottom:8px;flex-wrap:wrap;';

    const hpNum = document.createElement('span');
    hpNum.id = 'sh-hp-display';
    hpNum.style.cssText = 'font-family:var(--font-mono);font-size:28px;font-weight:700;color:var(--ink);';
    hpNum.textContent = (c.hp ?? 0) + ' / ' + (c.max_hp ?? 0);
    const hpLabel = document.createElement('span');
    hpLabel.style.cssText = 'font-size:11px;color:var(--ink-muted);';
    hpLabel.textContent = 'HP';
    const hpMain = document.createElement('div');
    hpMain.style.cssText = 'display:flex;align-items:baseline;gap:6px;';
    hpMain.appendChild(hpNum); hpMain.appendChild(hpLabel);
    hpRow.appendChild(hpMain);

    if (c.temp_hp) {
      const tempBadge = document.createElement('div');
      tempBadge.style.cssText = 'background:rgba(61,107,79,0.2);border:1px solid var(--success);border-radius:6px;padding:4px 10px;font-size:12px;color:var(--success);font-family:var(--font-mono);';
      tempBadge.textContent = '+' + c.temp_hp + ' temp';
      hpRow.appendChild(tempBadge);
    }

    const dieMap = { 'Bárbaro':'d12','Bardo':'d8','Brujo':'d8','Clérigo':'d8','Druida':'d8','Explorador':'d10','Guerrero':'d10','Hechicero':'d6','Mago':'d6','Monje':'d8','Paladín':'d10','Pícaro':'d8' };
    if (c.char_class) {
      const hdBadge = document.createElement('div');
      hdBadge.style.cssText = 'margin-left:auto;background:var(--stone-light);border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:11px;color:var(--ink-muted);';
      hdBadge.textContent = lvl + (dieMap[c.char_class] ?? 'd8') + ' Dados de Golpe';
      hpRow.appendChild(hdBadge);
    }
    hpWrap.appendChild(hpRow);

    const hpTrack = document.createElement('div');
    hpTrack.style.cssText = 'height:10px;background:var(--border);border-radius:5px;overflow:hidden;margin-bottom:14px;';
    const hpFill = document.createElement('div');
    hpFill.id = 'sh-hp-bar';
    hpFill.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,' + hpColor + ',' + hpColor + 'aa);border-radius:5px;transition:width 1s var(--ease-out-expo);';
    hpTrack.appendChild(hpFill);
    hpWrap.appendChild(hpTrack);

    /* Death saves */
    const deathRow = document.createElement('div');
    deathRow.style.cssText = 'display:flex;gap:20px;flex-wrap:wrap;';
    [['Éxitos', 'var(--success)'], ['Fallos', 'var(--crimson)']].forEach(([label, color]) => {
      const g = document.createElement('div');
      g.style.cssText = 'display:flex;align-items:center;gap:8px;';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:11px;color:var(--ink-muted);';
      lbl.textContent = label;
      const dots = document.createElement('div');
      dots.style.cssText = 'display:flex;gap:5px;';
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.style.cssText = 'width:14px;height:14px;border-radius:50%;border:1.5px solid ' + color + ';background:transparent;';
        dots.appendChild(dot);
      }
      g.appendChild(lbl); g.appendChild(dots);
      deathRow.appendChild(g);
    });
    hpWrap.appendChild(deathRow);
    p1.appendChild(hpWrap);

    /* Ability Scores */
    const abilSection = document.createElement('div');
    abilSection.style.cssText = 'margin-bottom:24px;';
    abilSection.appendChild(sectionTitle('Puntuaciones de Característica'));

    const abilGrid = document.createElement('div');
    abilGrid.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:8px;';

    const ABILITY_MAP = [
      { key: 'str_score', abbr: 'FUE', name: 'Fuerza' },
      { key: 'dex_score', abbr: 'DES', name: 'Destreza' },
      { key: 'con_score', abbr: 'CON', name: 'Constitución' },
      { key: 'int_score', abbr: 'INT', name: 'Inteligencia' },
      { key: 'wis_score', abbr: 'SAB', name: 'Sabiduría' },
      { key: 'cha_score', abbr: 'CAR', name: 'Carisma' },
    ];
    ABILITY_MAP.forEach(ab => {
      const score = c[ab.key] ?? 10;
      const m     = mod(score);
      const mText = (m >= 0 ? '+' : '') + m;
      const cell  = document.createElement('div');
      cell.style.cssText = 'background:var(--stone-light);border:1px solid var(--border);border-radius:10px;padding:12px 6px;text-align:center;transition:border-color 150ms,transform 150ms;cursor:default;';
      cell.title = ab.name;
      const abbrEl = document.createElement('div');
      abbrEl.style.cssText = 'font-size:9px;font-weight:700;color:var(--gold-dim);letter-spacing:0.08em;margin-bottom:4px;';
      abbrEl.textContent = ab.abbr;
      const scoreEl = document.createElement('div');
      scoreEl.className = 'stat-counter';
      scoreEl.style.cssText = 'font-size:28px;font-weight:700;color:var(--ink);font-family:var(--font-mono);line-height:1;';
      scoreEl.textContent = '0';
      const divider = document.createElement('div');
      divider.style.cssText = 'margin:4px 0;height:1px;background:var(--border);';
      const modEl = document.createElement('div');
      modEl.style.cssText = 'font-size:15px;font-weight:600;color:var(--gold);font-family:var(--font-mono);';
      modEl.textContent = mText;
      cell.appendChild(abbrEl); cell.appendChild(scoreEl); cell.appendChild(divider); cell.appendChild(modEl);
      cell.addEventListener('mouseenter', () => { cell.style.borderColor='var(--gold-dim)'; cell.style.transform='translateY(-2px)'; });
      cell.addEventListener('mouseleave', () => { cell.style.borderColor='var(--border)'; cell.style.transform=''; });
      abilGrid.appendChild(cell);
      animateCounter(scoreEl, score);
    });
    abilSection.appendChild(abilGrid);
    p1.appendChild(abilSection);

    /* Combat stats */
    const combatSection = document.createElement('div');
    combatSection.style.cssText = 'margin-bottom:0;';
    combatSection.appendChild(sectionTitle('Combate & Movimiento'));

    const combatGrid = document.createElement('div');
    combatGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;';

    const initBonus = mod(c.dex_score ?? 10) + (c.initiative_bonus ?? 0);
    const initStr   = (initBonus >= 0 ? '+' : '') + initBonus;

    [
      { label: 'CA',                val: c.ac ?? 10 },
      { label: 'Iniciativa',        val: initStr },
      { label: 'Velocidad',         val: (c.speed ?? 30) + ' ft' },
      { label: 'Percepción Pasiva', val: c.passive_perception ?? (10 + mod(c.wis_score ?? 10)) },
      { label: 'Bonus Prof.',       val: '+' + prof },
      { label: 'Inspiración',       val: c.inspiration ? 'Si' : 'No' },
    ].forEach(item => {
      const badge = document.createElement('div');
      badge.style.cssText = 'background:var(--stone-light);border:1px solid var(--border);border-radius:8px;padding:10px 6px;text-align:center;';
      const valEl = document.createElement('div');
      valEl.style.cssText = 'font-size:18px;font-weight:700;color:var(--gold);font-family:var(--font-mono);';
      valEl.textContent = String(item.val);
      const lblEl = document.createElement('div');
      lblEl.style.cssText = 'font-size:9px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:3px;line-height:1.3;';
      lblEl.textContent = item.label;
      badge.appendChild(valEl); badge.appendChild(lblEl);
      combatGrid.appendChild(badge);
    });
    combatSection.appendChild(combatGrid);
    p1.appendChild(combatSection);

    /* Combate calculado desde el equipo (Fase I4) */
    const derivedSection = document.createElement('div');
    derivedSection.style.cssText = 'margin-top:20px;';
    derivedSection.appendChild(sectionTitle('Combate según equipo'));
    const derivedBody = document.createElement('div');
    derivedBody.style.cssText = 'font-size:13px;color:var(--ink-muted);';
    derivedBody.textContent = 'Calculando...';
    derivedSection.appendChild(derivedBody);
    p1.appendChild(derivedSection);
    renderDerivedCombat(c.id, derivedBody);

    async function renderDerivedCombat(charId, target) {
      try {
        const res = await api.get(`/characters/${charId}/combat`);
        const d = res.data;
        target.innerHTML = '';

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;';
        const badge = (label, val, sub) => {
          const b = document.createElement('div');
          b.style.cssText = 'flex:1;min-width:90px;background:var(--stone-light);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;';
          b.innerHTML = `<div style="font-size:20px;font-weight:700;color:var(--gold);font-family:var(--font-mono);">${val}</div>
            <div style="font-size:9px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:3px;">${label}</div>
            ${sub ? `<div style="font-size:9px;color:var(--ink-faint);margin-top:2px;line-height:1.3;">${sub}</div>` : ''}`;
          return b;
        };
        const spd = d.speed.total + ' ft' + (d.speed.penalty ? ` (${d.speed.penalty})` : '');
        row.appendChild(badge('CA efectiva', d.ac.total,
          d.ac.breakdown.map(x => `${x.source} ${x.value >= 0 ? '+' : ''}${x.value}`).join(' · ')));
        row.appendChild(badge('Velocidad', spd, d.speed.reason || ''));
        row.appendChild(badge('Sigilo', d.stealth_disadvantage ? 'Desv.' : 'OK',
          d.stealth_disadvantage ? 'armadura ruidosa' : ''));
        target.appendChild(row);

        if (d.attacks.length) {
          const at = document.createElement('div');
          at.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
          d.attacks.forEach(a => {
            const ar = document.createElement('div');
            ar.style.cssText = 'display:flex;justify-content:space-between;gap:8px;background:var(--stone-light);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:13px;';
            const dmgType = a.damage_type ? ' ' + a.damage_type : '';
            ar.innerHTML = `<span style="color:var(--ink);font-weight:600;">${a.name}</span>
              <span style="font-family:var(--font-mono);color:var(--ink-muted);">${a.attack_bonus} · ${a.damage}${dmgType}</span>`;
            at.appendChild(ar);
          });
          target.appendChild(at);
        } else {
          const none = document.createElement('div');
          none.style.cssText = 'font-size:12px;color:var(--ink-faint);';
          none.textContent = 'Sin armas equipadas.';
          target.appendChild(none);
        }

        if (d.notes && d.notes.length) {
          const nt = document.createElement('div');
          nt.style.cssText = 'font-size:10px;color:var(--ink-faint);margin-top:8px;line-height:1.4;';
          nt.textContent = d.notes.join(' ');
          target.appendChild(nt);
        }
      } catch (e) {
        target.textContent = 'No se pudo calcular el combate.';
      }
    }

    /* ─── TAB 2: HABILIDADES ─── */
    const p2 = panels['habilidades'];
    p2.style.cssText = 'padding:24px 32px;display:none;';

    /* Saving Throws */
    const savesWrap = document.createElement('div');
    savesWrap.style.cssText = 'margin-bottom:24px;';
    savesWrap.appendChild(sectionTitle('Tiradas de Salvación'));
    const savesGrid = document.createElement('div');
    savesGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;';

    const SAVE_MAP = [
      { key: 'str', abbr: 'Fuerza',        scoreKey: 'str_score' },
      { key: 'dex', abbr: 'Destreza',      scoreKey: 'dex_score' },
      { key: 'con', abbr: 'Constitución',  scoreKey: 'con_score' },
      { key: 'int', abbr: 'Inteligencia',  scoreKey: 'int_score' },
      { key: 'wis', abbr: 'Sabiduría',     scoreKey: 'wis_score' },
      { key: 'cha', abbr: 'Carisma',       scoreKey: 'cha_score' },
    ];
    SAVE_MAP.forEach(s => {
      const base      = mod(c[s.scoreKey] ?? 10);
      const info      = saves_data[s.key] ?? {};
      const classSaveKeys = CLASS_SAVES_KEYS[c.char_class] ?? [];
      const proficient= !!(info.proficient || info.expert) || classSaveKeys.includes(s.key);
      const bonus     = base + (proficient ? prof : 0);
      const bonusStr  = (bonus >= 0 ? '+' : '') + bonus;
      const row       = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;background:var(--stone-light);border:1px solid var(--border);';
      const dot = document.createElement('div');
      dot.style.cssText = 'width:10px;height:10px;border-radius:50%;border:1.5px solid ' + (proficient?'var(--gold)':'var(--border)') + ';background:' + (proficient?'var(--gold)':'transparent') + ';flex-shrink:0;';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:12px;color:var(--ink-muted);flex:1;';
      lbl.textContent = s.abbr;
      const val = document.createElement('span');
      val.style.cssText = 'font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--gold);';
      val.textContent = bonusStr;
      row.appendChild(dot); row.appendChild(lbl); row.appendChild(val);
      savesGrid.appendChild(row);
    });
    savesWrap.appendChild(savesGrid);
    p2.appendChild(savesWrap);

    /* Skills */
    const skillsWrap = document.createElement('div');
    skillsWrap.style.cssText = 'margin-bottom:24px;';
    skillsWrap.appendChild(sectionTitle('Habilidades'));
    const skillsGrid = document.createElement('div');
    skillsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:5px;';

    const ABBR = { str_score:'FUE', dex_score:'DES', con_score:'CON', int_score:'INT', wis_score:'SAB', cha_score:'CAR' };
    const SKILL_MAP = [
      { key:'acrobatics',      name:'Acrobacias',          scoreKey:'dex_score' },
      { key:'animal_handling', name:'Trato con Animales',  scoreKey:'wis_score' },
      { key:'arcana',          name:'Arcanos',             scoreKey:'int_score' },
      { key:'athletics',       name:'Atletismo',           scoreKey:'str_score' },
      { key:'deception',       name:'Engaño',              scoreKey:'cha_score' },
      { key:'history',         name:'Historia',            scoreKey:'int_score' },
      { key:'insight',         name:'Perspicacia',         scoreKey:'wis_score' },
      { key:'intimidation',    name:'Intimidación',        scoreKey:'cha_score' },
      { key:'investigation',   name:'Investigación',       scoreKey:'int_score' },
      { key:'medicine',        name:'Medicina',            scoreKey:'wis_score' },
      { key:'nature',          name:'Naturaleza',          scoreKey:'int_score' },
      { key:'perception',      name:'Percepción',          scoreKey:'wis_score' },
      { key:'performance',     name:'Actuación',           scoreKey:'cha_score' },
      { key:'persuasion',      name:'Persuasión',          scoreKey:'cha_score' },
      { key:'religion',        name:'Religión',            scoreKey:'int_score' },
      { key:'sleight_of_hand', name:'Juego de Manos',      scoreKey:'dex_score' },
      { key:'stealth',         name:'Sigilo',              scoreKey:'dex_score' },
      { key:'survival',        name:'Supervivencia',       scoreKey:'wis_score' },
    ];
    SKILL_MAP.forEach(sk => {
      const base   = mod(c[sk.scoreKey] ?? 10);
      const info   = skills_data[sk.key] ?? {};
      const hasPro = !!(info.proficient || info.expert);
      const hasExp = !!info.expert;
      const bonus  = base + (hasPro ? prof : 0) + (hasExp ? prof : 0);
      const bStr   = (bonus >= 0 ? '+' : '') + bonus;
      const row    = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;background:var(--stone-light);border:1px solid var(--border);';
      const dotColor   = hasExp ? 'var(--gold)' : hasPro ? 'var(--success)' : 'transparent';
      const dotBorder  = hasExp ? 'var(--gold)' : hasPro ? 'var(--success)' : 'var(--border)';
      const dot = document.createElement('div');
      dot.style.cssText = 'width:8px;height:8px;border-radius:50%;border:1.5px solid ' + dotBorder + ';background:' + dotColor + ';flex-shrink:0;';
      dot.title = hasExp ? 'Pericia' : hasPro ? 'Competente' : '';
      const name = document.createElement('span');
      name.style.cssText = 'font-size:11px;color:var(--ink-muted);flex:1;';
      name.textContent = sk.name;
      const attr = document.createElement('span');
      attr.style.cssText = 'font-size:9px;color:var(--ink-faint);';
      attr.textContent = ABBR[sk.scoreKey];
      const val = document.createElement('span');
      val.style.cssText = 'font-family:var(--font-mono);font-size:12px;font-weight:700;color:var(--gold);min-width:26px;text-align:right;';
      val.textContent = bStr;
      row.appendChild(dot); row.appendChild(name); row.appendChild(attr); row.appendChild(val);
      skillsGrid.appendChild(row);
    });
    skillsWrap.appendChild(skillsGrid);
    p2.appendChild(skillsWrap);

    /* Conditions */
    if (Array.isArray(conditions) && conditions.length > 0) {
      const condWrap = document.createElement('div');
      condWrap.appendChild(sectionTitle('Condiciones Activas'));
      const condList = document.createElement('div');
      condList.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
      conditions.forEach(cond => {
        const badge = document.createElement('div');
        badge.style.cssText = 'background:rgba(155,35,53,0.12);border:1px solid var(--crimson);border-radius:6px;padding:4px 10px;font-size:12px;color:var(--crimson);';
        badge.textContent = cond;
        condList.appendChild(badge);
      });
      condWrap.appendChild(condList);
      p2.appendChild(condWrap);
    }

    /* ─── TAB 3: HECHIZOS (lazy-load, Fase H5) ─── */
    const p3 = panels['hechizos'];
    p3.style.cssText = 'padding:24px 32px;display:none;';
    p3.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ink-muted);font-size:13px;">Cargando hechizos…</div>';
    {
      let spLoaded = false;
      const spBtn = tabBar.querySelector('[data-tab="hechizos"]');
      if (spBtn) spBtn.addEventListener('click', () => {
        if (!spLoaded) { spLoaded = true; renderShHechizos(p3); }
      });
    }

    /* ─── TAB 4: RASGOS ─── */
    const p4 = panels['rasgos'];
    p4.style.cssText = 'padding:24px 32px;display:none;';

    const personalityFields = [
      { key:'personality_traits', label:'Rasgos de Personalidad' },
      { key:'ideals',             label:'Ideales' },
      { key:'bonds',              label:'Vínculos' },
      { key:'flaws',              label:'Defectos' },
    ].filter(f => c[f.key]);

    if (personalityFields.length > 0) {
      const pSection = document.createElement('div');
      pSection.style.cssText = 'margin-bottom:24px;';
      pSection.appendChild(sectionTitle('Personalidad'));
      const pGrid = document.createElement('div');
      pGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;';
      personalityFields.forEach(f => pGrid.appendChild(textBlock(f.label, c[f.key])));
      pSection.appendChild(pGrid);
      p4.appendChild(pSection);
    }

    if (c.backstory) {
      const bsSection = document.createElement('div');
      bsSection.style.cssText = 'margin-bottom:24px;';
      bsSection.appendChild(sectionTitle('Historia'));
      bsSection.appendChild(textBlock('Trasfondo del Personaje', c.backstory));
      p4.appendChild(bsSection);
    }

    if (c.notes) {
      const nSection = document.createElement('div');
      nSection.style.cssText = 'margin-bottom:24px;';
      nSection.appendChild(sectionTitle('Notas'));
      nSection.appendChild(textBlock('Notas', c.notes));
      p4.appendChild(nSection);
    }

    if (Array.isArray(feats) && feats.length > 0) {
      const fSection = document.createElement('div');
      fSection.style.cssText = 'margin-bottom:24px;';
      fSection.appendChild(sectionTitle('Dotes & Rasgos'));
      feats.forEach(f => {
        const item = document.createElement('div');
        item.style.cssText = 'background:var(--stone-light);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;';
        const fn = document.createElement('div');
        fn.style.cssText = 'font-size:13px;font-weight:600;color:var(--ink);margin-bottom:4px;';
        fn.textContent = f.name ?? String(f);
        item.appendChild(fn);
        if (f.description) {
          const fd = document.createElement('div');
          fd.style.cssText = 'font-size:12px;color:var(--ink-muted);line-height:1.5;';
          fd.textContent = f.description;
          item.appendChild(fd);
        }
        fSection.appendChild(item);
      });
      p4.appendChild(fSection);
    }

    if (!personalityFields.length && !c.backstory && !c.notes && !(Array.isArray(feats) && feats.length)) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align:center;padding:48px;color:var(--ink-muted);';
      empty.innerHTML = '<div style="font-size:36px;margin-bottom:12px;">📜</div><div style="font-size:13px;">Sin rasgos registrados aún</div>';
      p4.appendChild(empty);
    }

    /* ─── TAB 5: INVENTARIO ─── */
    async function renderShInventario(el) {
      el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--ink-muted);font-size:13px;">Cargando inventario…</div>';

      const RARITY_COLOR = {
        common:'#6B6460', uncommon:'#2D6A4F', rare:'#1a5fa8',
        very_rare:'#7b3fa0', legendary:'#c97a0a', artifact:'#9B2335',
      };
      const TYPE_ICON = {
        weapon:'⚔️', armor:'🛡️', potion:'⚗️', spell_scroll:'📜',
        ring:'💍', rod:'🪄', staff:'🏑', wand:'✨', wondrous:'🌟',
        tool:'🔧', ammunition:'🏹', gear:'🎒', treasure:'💰',
        vehicle:'🚢', other:'📦',
      };

      const render = async () => {
        el.innerHTML = '';
        let items = [];
        try {
          const res = await api.get(`/characters/${c.id}/inventory`);
          items = res.data ?? [];
        } catch (err) {
          el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--crimson);font-size:13px;">${err.message}</div>`;
          return;
        }

        /* Add button */
        const addRow = document.createElement('div');
        addRow.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:16px;';
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-primary';
        addBtn.style.cssText = 'font-size:13px;padding:8px 16px;';
        addBtn.textContent = '+ Añadir item';
        addBtn.addEventListener('click', () => openInvAddModal(c.id, render));
        addRow.appendChild(addBtn);
        el.appendChild(addRow);

        if (!items.length) {
          const empty = document.createElement('div');
          empty.style.cssText = 'text-align:center;padding:48px;color:var(--ink-muted);';
          empty.innerHTML = '<div style="font-size:36px;margin-bottom:12px;">🎒</div><div style="font-size:13px;">El inventario está vacío</div>';
          el.appendChild(empty);
          return;
        }

        const list = document.createElement('div');
        list.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

        items.forEach(item => {
          const row = document.createElement('div');
          row.style.cssText = `
            display:flex;align-items:center;gap:12px;
            background:var(--stone-light);border:1px solid var(--border);
            border-radius:8px;padding:10px 14px;
            transition:box-shadow var(--dur-fast) var(--ease-smooth);
          `;

          const icon = document.createElement('span');
          icon.style.cssText = 'font-size:18px;flex-shrink:0;';
          icon.textContent = TYPE_ICON[item.type] ?? '📦';

          const info = document.createElement('div');
          info.style.cssText = 'flex:1;min-width:0;';

          const name = document.createElement('div');
          name.style.cssText = 'font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
          name.textContent = item.custom_name || item.name;

          const meta = document.createElement('div');
          meta.style.cssText = 'font-size:11px;color:var(--ink-muted);margin-top:2px;';
          const rarityColor = RARITY_COLOR[item.rarity] ?? 'var(--ink-muted)';
          meta.innerHTML = `<span style="color:${rarityColor};font-weight:600;">${item.rarity ?? ''}</span>${item.rarity && item.type ? ' · ' : ''}<span>${item.type ?? ''}</span>${item.quantity > 1 ? ` · ×${item.quantity}` : ''}`;

          info.appendChild(name);
          info.appendChild(meta);

          const actions = document.createElement('div');
          actions.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';

          /* Equip toggle */
          const equipBtn = document.createElement('button');
          equipBtn.style.cssText = `
            font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid;
            background:${item.equipped ? 'var(--gold)' : 'transparent'};
            color:${item.equipped ? '#fff' : 'var(--ink-muted)'};
            border-color:${item.equipped ? 'var(--gold)' : 'var(--border)'};
            transition:all var(--dur-fast) var(--ease-smooth);
          `;
          equipBtn.textContent = item.equipped ? 'Equipado' : 'Equipar';
          equipBtn.addEventListener('click', async () => {
            try {
              await api.put(`/characters/${c.id}/inventory/${item.item_id}`, { equipped: !item.equipped });
              render();
            } catch (err) { toast.error('Error', err.message); }
          });

          /* Remove button */
          const removeBtn = document.createElement('button');
          removeBtn.style.cssText = `
            font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;
            background:transparent;border:1px solid var(--crimson);color:var(--crimson);
            transition:all var(--dur-fast) var(--ease-smooth);
          `;
          removeBtn.textContent = 'Quitar';
          removeBtn.addEventListener('click', async () => {
            if (!confirm(`¿Quitar "${item.name}" del inventario?`)) return;
            try {
              await api.del(`/characters/${c.id}/inventory/${item.item_id}`);
              render();
            } catch (err) { toast.error('Error', err.message); }
          });

          actions.appendChild(equipBtn);
          actions.appendChild(removeBtn);
          row.appendChild(icon);
          row.appendChild(info);
          row.appendChild(actions);
          list.appendChild(row);
        });

        el.appendChild(list);
      };

      await render();
    }

    async function openInvAddModal(charId, onSuccess) {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(9,8,10,0.85);
        backdrop-filter:blur(8px);z-index:2000;
        display:flex;align-items:center;justify-content:center;
        padding:32px 16px;animation:fadeIn var(--dur-normal) var(--ease-smooth);
      `;

      const modal = document.createElement('div');
      modal.style.cssText = `
        background:var(--stone);border:1px solid var(--border);
        border-radius:12px;padding:28px;width:100%;max-width:520px;
        box-shadow:0 24px 64px rgba(0,0,0,0.3);
      `;

      const title = document.createElement('div');
      title.style.cssText = 'font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--ink);margin-bottom:20px;';
      title.textContent = '+ Añadir item al inventario';
      modal.appendChild(title);

      /* Search */
      const searchInput = document.createElement('input');
      searchInput.className = 'input';
      searchInput.placeholder = 'Buscar item por nombre…';
      searchInput.style.cssText = 'margin-bottom:12px;';
      modal.appendChild(searchInput);

      const resultList = document.createElement('div');
      resultList.style.cssText = 'max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:16px;';
      modal.appendChild(resultList);

      let selectedItem = null;

      const renderResults = async (q) => {
        resultList.innerHTML = '<div style="padding:12px;text-align:center;font-size:12px;color:var(--ink-muted);">Buscando…</div>';
        try {
          const res = await api.get(`/items?search=${encodeURIComponent(q)}&per_page=20`);
          const items = res.data ?? [];
          resultList.innerHTML = '';
          if (!items.length) {
            resultList.innerHTML = '<div style="padding:12px;text-align:center;font-size:12px;color:var(--ink-muted);">Sin resultados</div>';
            return;
          }
          items.forEach(it => {
            const row = document.createElement('button');
            row.style.cssText = `
              display:block;width:100%;text-align:left;padding:10px 14px;
              background:transparent;border:none;border-bottom:1px solid var(--border);
              cursor:pointer;font-size:13px;color:var(--ink);
              transition:background var(--dur-fast);
            `;
            row.textContent = it.name + (it.rarity ? ` (${it.rarity})` : '');
            row.addEventListener('mouseenter', () => row.style.background = 'var(--stone-light)');
            row.addEventListener('mouseleave', () => {
              row.style.background = selectedItem?.id === it.id ? 'var(--gold-glow)' : 'transparent';
            });
            row.addEventListener('click', () => {
              selectedItem = it;
              resultList.querySelectorAll('button').forEach(b => b.style.background = 'transparent');
              row.style.background = 'var(--gold-glow)';
            });
            resultList.appendChild(row);
          });
        } catch (err) {
          resultList.innerHTML = `<div style="padding:12px;color:var(--crimson);font-size:12px;">${err.message}</div>`;
        }
      };

      /* Initial load */
      renderResults('');

      let searchTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => renderResults(searchInput.value.trim()), 350);
      });

      /* Quantity */
      const qRow = document.createElement('div');
      qRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:20px;';
      const qLabel = document.createElement('label');
      qLabel.style.cssText = 'font-size:13px;color:var(--ink-muted);white-space:nowrap;';
      qLabel.textContent = 'Cantidad:';
      const qInput = document.createElement('input');
      qInput.type = 'number'; qInput.min = 1; qInput.value = 1;
      qInput.className = 'input';
      qInput.style.cssText = 'width:80px;';
      qRow.appendChild(qLabel);
      qRow.appendChild(qInput);
      modal.appendChild(qRow);

      /* Buttons */
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:10px;';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn';
      cancelBtn.style.cssText = 'flex:1;background:transparent;border:1px solid var(--border);color:var(--ink-muted);';
      cancelBtn.textContent = 'Cancelar';
      cancelBtn.addEventListener('click', () => overlay.remove());

      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-primary';
      addBtn.style.cssText = 'flex:2;';
      addBtn.textContent = 'Añadir';
      addBtn.addEventListener('click', async () => {
        if (!selectedItem) { toast.error('Selecciona un item', ''); return; }
        const qty = parseInt(qInput.value) || 1;
        addBtn.disabled = true; addBtn.textContent = 'Añadiendo…';
        try {
          await api.post(`/characters/${charId}/inventory`, { item_id: selectedItem.id, quantity: qty });
          toast.success('Item añadido', selectedItem.name);
          overlay.remove();
          onSuccess();
        } catch (err) {
          toast.error('Error', err.message);
          addBtn.disabled = false; addBtn.textContent = 'Añadir';
        }
      });

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(addBtn);
      modal.appendChild(btnRow);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); }
      });
      setTimeout(() => searchInput.focus(), 100);
    }

    /* ═══════════════════════════════════════════════════════════════
       TAB HECHIZOS — repertorio + parámetros de conjuración (Fase H5)
    ═══════════════════════════════════════════════════════════════ */
    const SP_SCHOOLS = {
      abjuration: ['Abjuración', '#4a9eff'], conjuration: ['Conjuración', '#f59e0b'],
      divination: ['Adivinación', '#14b8a6'], enchantment: ['Encantamiento', '#ec4899'],
      evocation: ['Evocación', '#9B2335'], illusion: ['Ilusión', '#a855f7'],
      necromancy: ['Nigromancia', '#4b5563'], transmutation: ['Transmutación', '#22c55e'],
    };
    const SP_ABIL = { STR: 'Fuerza', DEX: 'Destreza', CON: 'Constitución', INT: 'Inteligencia', WIS: 'Sabiduría', CHA: 'Carisma' };
    const spFmt = (n) => (n >= 0 ? '+' : '') + n;
    const spLvlName = (n) => (n === 0 ? 'Trucos' : 'Nivel ' + n);

    function spBadge(text, color) {
      const el = document.createElement('span');
      el.style.cssText = `padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;color:${color};background:${color}1e;border:1px solid ${color}33;`;
      el.textContent = text;
      return el;
    }

    async function renderShHechizos(el) {
      const render = async () => {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ink-muted);font-size:13px;">Cargando hechizos…</div>';
        let sc, repertoire;
        try {
          const [scRes, repRes] = await Promise.all([
            api.get(`/characters/${c.id}/spellcasting`),
            api.get(`/characters/${c.id}/spells`),
          ]);
          sc = scRes.data; repertoire = repRes.data ?? [];
        } catch (e) {
          el.innerHTML = `<div style="color:var(--crimson);padding:20px;">Error: ${e.message}</div>`;
          return;
        }
        el.innerHTML = '';

        if (!sc || !sc.is_caster) {
          el.innerHTML = '<div style="text-align:center;padding:48px 20px;color:var(--ink-muted);"><div style="font-size:36px;margin-bottom:12px;">📿</div><div style="font-size:13px;">Esta clase no lanza hechizos</div></div>';
          return;
        }

        /* Parámetros de conjuración */
        const stats = document.createElement('div');
        stats.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px;';
        const statCard = (label, val) => {
          const card = document.createElement('div');
          card.style.cssText = 'background:var(--stone-light);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;';
          card.innerHTML = `<div style="font-size:9px;font-weight:700;color:var(--gold-dim);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">${label}</div>
            <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--gold);">${val}</div>`;
          return card;
        };
        stats.appendChild(statCard('Característica', sc.spellcasting_ability || '—'));
        stats.appendChild(statCard('CD salvación', sc.spell_save_dc ?? '—'));
        stats.appendChild(statCard('Ataque', sc.spell_attack_bonus != null ? spFmt(sc.spell_attack_bonus) : '—'));
        stats.appendChild(statCard('Nivel máx.', sc.max_spell_level ?? '—'));
        el.appendChild(stats);

        /* Contadores de límite */
        const cantripsKnown = repertoire.filter((s) => s.level === 0).length;
        const leveled = repertoire.filter((s) => s.level > 0);
        const counters = document.createElement('div');
        counters.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;';
        counters.appendChild(spBadge(`✨ Trucos ${cantripsKnown}/${sc.max_cantrips ?? '—'}`, 'var(--gold)'));
        if (sc.preparation_model === 'prepared') {
          const prepared = leveled.filter((s) => s.is_prepared).length;
          counters.appendChild(spBadge(`📖 Preparados ${prepared}/${sc.max_spells_prepared ?? '—'}`, '#4a9eff'));
        } else if (sc.max_spells_known != null) {
          counters.appendChild(spBadge(`📚 Conocidos ${leveled.length}/${sc.max_spells_known}`, '#4a9eff'));
        }
        el.appendChild(counters);

        /* Espacios de conjuro */
        el.appendChild(sectionTitle('Espacios de Conjuro'));
        if (sc.caster_type === 'pact' && sc.pact_magic) {
          const p = document.createElement('div');
          p.style.cssText = 'background:var(--stone-light);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;margin-bottom:20px;';
          p.innerHTML = `<div style="font-size:9px;font-weight:700;color:var(--gold-dim);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Pacto (nivel ${sc.pact_magic.slot_level})</div>
            <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--gold);">${sc.pact_magic.slots} ranuras</div>
            <div style="font-size:10px;color:var(--ink-muted);margin-top:4px;">Se recuperan en descanso corto</div>`;
          el.appendChild(p);
        } else {
          const slots = sc.spell_slots || {};
          const keys = Object.keys(slots);
          if (!keys.length) {
            const none = document.createElement('div');
            none.style.cssText = 'color:var(--ink-muted);font-size:12px;margin-bottom:20px;';
            none.textContent = 'Sin espacios de conjuro a este nivel.';
            el.appendChild(none);
          } else {
            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:12px;margin-bottom:20px;';
            for (let n = 1; n <= 9; n++) {
              const sd = slots[n] ?? slots[String(n)];
              if (!sd) continue;
              const total = sd.total ?? 0;
              const avail = Math.max(0, total - (sd.used ?? 0));
              const card = document.createElement('div');
              card.style.cssText = 'background:var(--stone-light);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;';
              const bubbles = [];
              for (let i = 0; i < total; i++) {
                bubbles.push(`<div style="width:12px;height:12px;border-radius:50%;border:1.5px solid ${i < avail ? 'var(--gold)' : 'var(--border)'};background:${i < avail ? 'var(--gold)' : 'transparent'};"></div>`);
              }
              card.innerHTML = `<div style="font-size:9px;font-weight:700;color:var(--gold-dim);text-transform:uppercase;margin-bottom:8px;">Nivel ${n}</div>
                <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:4px;margin-bottom:8px;">${bubbles.join('')}</div>
                <div style="font-family:var(--font-mono);font-size:14px;font-weight:700;color:var(--gold);">${avail}/${total}</div>`;
              grid.appendChild(card);
            }
            el.appendChild(grid);
          }
        }

        /* Encabezado del repertorio + botón añadir */
        const repHead = document.createElement('div');
        repHead.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin:8px 0 12px;';
        const repTitle = sectionTitle('Repertorio');
        repTitle.style.margin = '0';
        repHead.appendChild(repTitle);
        if (canEdit) {
          const addBtn = document.createElement('button');
          addBtn.className = 'btn btn-primary';
          addBtn.style.cssText = 'font-size:12px;padding:6px 12px;';
          addBtn.textContent = '+ Añadir hechizo';
          addBtn.addEventListener('click', () => openSpellAddModal(sc, render));
          repHead.appendChild(addBtn);
        }
        el.appendChild(repHead);

        if (!repertoire.length) {
          const empty = document.createElement('div');
          empty.style.cssText = 'text-align:center;padding:32px;color:var(--ink-muted);font-size:13px;';
          empty.textContent = 'Aún no hay hechizos en el repertorio.';
          el.appendChild(empty);
          return;
        }

        /* Agrupar por nivel */
        for (let lvl = 0; lvl <= 9; lvl++) {
          const group = repertoire.filter((s) => s.level === lvl);
          if (!group.length) continue;
          const gTitle = document.createElement('div');
          gTitle.style.cssText = 'font-family:var(--font-ui);font-size:11px;font-weight:700;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.06em;margin:16px 0 8px;';
          gTitle.textContent = spLvlName(lvl);
          el.appendChild(gTitle);
          group.forEach((sp) => el.appendChild(buildSpellRow(sp, sc, render)));
        }
      };

      await render();
    }

    function buildSpellRow(sp, sc, reload) {
      const sch = SP_SCHOOLS[sp.school] || [sp.school, 'var(--gold)'];
      const row = document.createElement('div');
      row.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;overflow:hidden;';

      const headRow = document.createElement('div');
      headRow.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;';

      const info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:13px;font-weight:600;color:var(--ink);';
      nameEl.textContent = sp.name;
      const metaEl = document.createElement('div');
      metaEl.style.cssText = `font-size:11px;color:${sch[1]};margin-top:1px;`;
      metaEl.textContent = sch[0]
        + (sp.concentration ? ' · 🌀 Conc.' : '')
        + (sp.ritual ? ' · 📜 Ritual' : '')
        + (sp.damage_dice ? ` · 💥 ${sp.damage_dice}` : '')
        + (sp.saving_throw ? ` · 🛡️ ${sp.saving_throw}` : '');
      info.appendChild(nameEl);
      info.appendChild(metaEl);
      headRow.appendChild(info);

      /* Toggle preparado (solo modelo preparado, nivel > 0) */
      if (sc.preparation_model === 'prepared' && sp.level > 0 && !sp.is_always_known) {
        const prep = document.createElement('label');
        prep.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:11px;color:var(--ink-muted);cursor:pointer;';
        prep.addEventListener('click', (e) => e.stopPropagation());
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!sp.is_prepared;
        cb.disabled = !canEdit;
        cb.style.cssText = 'accent-color:var(--gold);cursor:pointer;';
        cb.addEventListener('change', async () => {
          cb.disabled = true;
          try {
            await api.put(`/characters/${c.id}/spells/${sp.spell_id}`, { is_prepared: cb.checked });
            sp.is_prepared = cb.checked;
            toast.success(cb.checked ? 'Hechizo preparado' : 'Preparación retirada');
            reload();
          } catch (err) {
            cb.checked = !cb.checked;
            cb.disabled = false;
            toast.error(err.message);
          }
        });
        prep.appendChild(cb);
        prep.appendChild(document.createTextNode('Preparado'));
        headRow.appendChild(prep);
      }

      if (canEdit) {
        const del = document.createElement('button');
        del.style.cssText = 'padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;background:var(--crimson-dim);color:var(--crimson);border:1px solid var(--crimson);';
        del.textContent = '✕';
        del.title = 'Quitar del repertorio';
        del.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm(`¿Quitar "${sp.name}" del repertorio?`)) return;
          try {
            await api.del(`/characters/${c.id}/spells/${sp.spell_id}`);
            toast.success('Hechizo retirado');
            reload();
          } catch (err) { toast.error(err.message); }
        });
        headRow.appendChild(del);
      }

      /* Detalle expandible */
      const detail = document.createElement('div');
      detail.style.cssText = 'display:none;padding:0 14px 14px;border-top:1px solid var(--border);';
      let built = false;
      headRow.addEventListener('click', () => {
        const open = detail.style.display === 'block';
        detail.style.display = open ? 'none' : 'block';
        if (!built && !open) {
          built = true;
          const meta = document.createElement('div');
          meta.style.cssText = 'font-size:11px;color:var(--ink-muted);margin:10px 0;line-height:1.6;';
          meta.textContent = `⏱ ${sp.casting_time} · 🎯 ${sp.range_text} · ⌛ ${sp.duration}`
            + (sp.comp_material && sp.material_description ? ` · Material: ${sp.material_description}` : '');
          detail.appendChild(meta);
          (sp.description || '').split('\n\n').forEach((par) => {
            const p = document.createElement('p');
            p.style.cssText = 'font-size:12px;color:var(--ink);line-height:1.6;margin:0 0 8px;';
            p.textContent = par;
            detail.appendChild(p);
          });
          if (sp.higher_levels) {
            const hl = document.createElement('div');
            hl.style.cssText = 'font-size:12px;color:var(--ink);line-height:1.6;margin-top:6px;padding:8px 10px;background:var(--gold-glow);border-radius:6px;';
            hl.innerHTML = '<strong style="color:var(--gold);">A niveles superiores: </strong>';
            hl.appendChild(document.createTextNode(sp.higher_levels));
            detail.appendChild(hl);
          }
        }
      });

      row.appendChild(headRow);
      row.appendChild(detail);
      return row;
    }

    async function openSpellAddModal(sc, onSuccess) {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(9,8,10,0.85);
        backdrop-filter:blur(8px);z-index:2000;
        display:flex;align-items:center;justify-content:center;
        padding:32px 16px;animation:fadeIn var(--dur-normal) var(--ease-smooth);
      `;
      const modal = document.createElement('div');
      modal.style.cssText = `
        background:var(--stone);border:1px solid var(--border);
        border-radius:12px;padding:28px;width:100%;max-width:520px;
        box-shadow:0 24px 64px rgba(0,0,0,0.3);
      `;
      const title = document.createElement('div');
      title.style.cssText = 'font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px;';
      title.textContent = '+ Añadir hechizo';
      modal.appendChild(title);
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:11px;color:var(--ink-muted);margin-bottom:16px;';
      hint.textContent = `Solo hechizos de tu clase hasta nivel ${sc.max_spell_level} (y trucos).`;
      modal.appendChild(hint);

      const searchInput = document.createElement('input');
      searchInput.className = 'input';
      searchInput.placeholder = 'Buscar hechizo por nombre…';
      searchInput.style.cssText = 'margin-bottom:12px;';
      modal.appendChild(searchInput);

      const resultList = document.createElement('div');
      resultList.style.cssText = 'max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;';
      modal.appendChild(resultList);

      const renderResults = async (q) => {
        resultList.innerHTML = '<div style="padding:12px;text-align:center;font-size:12px;color:var(--ink-muted);">Buscando…</div>';
        try {
          let path = `/spells?per_page=60&class=${encodeURIComponent(sc.class_key)}`;
          if (q) path += `&search=${encodeURIComponent(q)}`;
          const res = await api.get(path);
          let spells = (res.data ?? []).filter((s) => s.level === 0 || s.level <= (sc.max_spell_level || 0));
          resultList.innerHTML = '';
          if (!spells.length) {
            resultList.innerHTML = '<div style="padding:12px;text-align:center;font-size:12px;color:var(--ink-muted);">Sin resultados disponibles</div>';
            return;
          }
          spells.forEach((sp) => {
            const btn = document.createElement('button');
            btn.style.cssText = `
              display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;text-align:left;
              padding:10px 14px;background:transparent;border:none;border-bottom:1px solid var(--border);
              cursor:pointer;font-size:13px;color:var(--ink);transition:background var(--dur-fast);
            `;
            btn.innerHTML = `<span>${sp.name}</span><span style="font-size:11px;color:var(--ink-muted);">${spLvlName(sp.level)}</span>`;
            btn.addEventListener('mouseenter', () => btn.style.background = 'var(--stone-light)');
            btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
            btn.addEventListener('click', async () => {
              btn.disabled = true;
              try {
                await api.post(`/characters/${c.id}/spells`, { spell_id: sp.id });
                toast.success('Hechizo añadido', sp.name);
                overlay.remove();
                onSuccess();
              } catch (err) {
                toast.error(err.message);
                btn.disabled = false;
              }
            });
            resultList.appendChild(btn);
          });
        } catch (err) {
          resultList.innerHTML = `<div style="padding:12px;color:var(--crimson);font-size:12px;">${err.message}</div>`;
        }
      };
      renderResults('');

      let searchTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => renderResults(searchInput.value.trim()), 300);
      });

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:10px;margin-top:16px;';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn';
      cancelBtn.style.cssText = 'flex:1;background:transparent;border:1px solid var(--border);color:var(--ink-muted);';
      cancelBtn.textContent = 'Cerrar';
      cancelBtn.addEventListener('click', () => overlay.remove());
      btnRow.appendChild(cancelBtn);
      modal.appendChild(btnRow);

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); }
      });
      setTimeout(() => searchInput.focus(), 100);
    }

    /* Animate after mount */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const bar = wrap.querySelector('#sh-hp-bar');
      if (bar) bar.style.width = hpPct + '%';
      const xpBar = wrap.querySelector('#sh-xp-fill');
      if (xpBar) xpBar.style.width = xpPct + '%';
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

  /* ── Open Edit Modal (fetches full character first) ── */
  async function openEditModal(charId) {
    try {
      const res = await api.get(`/characters/${charId}`);
      openCharacterModal(res.data);
    } catch (err) {
      toast.error('Error', err.message);
    }
  }

  /* ── Create / Edit Character Modal ── */
  async function openCreateModal() { openCharacterModal(null); }

  async function openCharacterModal(existing) {
    const isEdit = !!existing;

    /* Load campaigns for dropdown */
    let campaigns = [];
    try {
      const res = await api.get('/campaigns');
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
      border-radius:12px;padding:32px;width:100%;max-width:680px;
      animation:modalIn var(--dur-normal) var(--ease-spring);margin-bottom:32px;
    `;

    const modalTitle = document.createElement('h3');
    modalTitle.style.cssText = 'font-family:var(--font-display);color:var(--gold);margin:0 0 24px;font-size:20px;';
    modalTitle.textContent = isEdit ? `✏️ Editar — ${existing.name}` : '✦ Nuevo Personaje';

    const form = document.createElement('div');
    form.style.cssText = 'display:flex;flex-direction:column;gap:16px;';

    /* ── Helpers ── */
    function sectionHeader(text) {
      const d = document.createElement('div');
      d.style.cssText = 'font-size:10px;font-weight:700;color:var(--gold-dim);letter-spacing:0.12em;text-transform:uppercase;padding-bottom:6px;border-bottom:1px solid var(--border);margin-top:4px;';
      d.textContent = text;
      return d;
    }

    function fRow(label, el) {
      const g = document.createElement('div');
      const l = document.createElement('label');
      l.style.cssText = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:5px;';
      l.textContent = label;
      g.appendChild(l); g.appendChild(el);
      return g;
    }

    function fInput(id, placeholder, value = '') {
      const el = document.createElement('input');
      el.type = 'text'; el.id = id; el.placeholder = placeholder; el.value = value;
      el.className = 'input'; return el;
    }

    function fNum(id, value, min = 0, max = 999) {
      const el = document.createElement('input');
      el.type = 'number'; el.id = id; el.value = value; el.min = min; el.max = max;
      el.className = 'input'; return el;
    }

    function fSelect(id, options, selectedVal = '') {
      const el = document.createElement('select');
      el.id = id; el.className = 'input';
      options.forEach(o => {
        const opt = document.createElement('option');
        const val = typeof o === 'string' ? o : o.value;
        const lbl = typeof o === 'string' ? o : o.label;
        opt.value = val; opt.textContent = lbl;
        if (String(val) === String(selectedVal)) opt.selected = true;
        el.appendChild(opt);
      });
      return el;
    }

    function fTextarea(id, placeholder, value = '', rows = 3) {
      const el = document.createElement('textarea');
      el.id = id; el.placeholder = placeholder; el.value = value; el.rows = rows;
      el.className = 'input'; el.style.resize = 'vertical'; return el;
    }

    function twoCol(...children) {
      const d = document.createElement('div');
      d.style.cssText = `display:grid;grid-template-columns:repeat(${children.length},1fr);gap:12px;`;
      children.forEach(c => d.appendChild(c)); return d;
    }

    const BACKGROUNDS = ['Acólito','Artesano Gremial','Criminal','Ermitaño','Forajido','Héroe Popular','Marinero','Mercader','Militar','Noble','Sabio','Siervo'];
    // DB enum values for alignment_type
    const ALIGNMENTS = ['LG','NG','CG','LN','TN','CN','LE','NE','CE'];
    const ALIGNMENT_LABELS = {
      LG:'Legal Bueno', NG:'Neutral Bueno', CG:'Caótico Bueno',
      LN:'Legal Neutral', TN:'Neutral', CN:'Caótico Neutral',
      LE:'Legal Malvado', NE:'Neutral Malvado', CE:'Caótico Malvado',
    };
    const campOptions = [
      { value: '', label: '— Sin campaña —' },
      ...campaigns.map(c => ({ value: c.id, label: c.name })),
    ];

    const e = existing ?? {};

    /* ── SECCIÓN: Identidad ── */
    form.appendChild(sectionHeader('Identidad'));
    form.appendChild(fRow('Nombre *', fInput('f-name', 'Aragorn el Montaraz', e.name ?? '')));
    // Subraza — select dinámico: opciones cambian según la raza elegida
    const subraceEl = document.createElement('select');
    subraceEl.id = 'f-subrace'; subraceEl.className = 'input';
    const updateSubraceOptions = (race, sel = '') => {
      subraceEl.innerHTML = '<option value="">— Sin subraza —</option>';
      const sr = RACE_DATA[race]?.subraces;
      if (sr) {
        Object.keys(sr).forEach(k => {
          const o = document.createElement('option');
          o.value = k; o.textContent = k; if (k === sel) o.selected = true;
          subraceEl.appendChild(o);
        });
        subraceEl.disabled = false;
      } else {
        subraceEl.disabled = true;
      }
    };
    updateSubraceOptions(e.race ?? '', e.subrace ?? '');

    form.appendChild(twoCol(
      fRow('Raza', fSelect('f-race', [''].concat(RACES), e.race ?? '')),
      fRow('Subraza', subraceEl),
    ));
    // Clase con badge de salvaciones
    const clsSelect = fSelect('f-class', [''].concat(CLASSES), e.char_class ?? '');
    const clsSaves  = document.createElement('div');
    clsSaves.id = 'f-class-saves';
    clsSaves.style.cssText = 'font-size:10px;color:var(--gold-dim);margin-top:4px;min-height:14px;font-style:italic;';
    const initSaves = CLASS_SAVES[e.char_class ?? ''];
    clsSaves.textContent = initSaves ? '🛡 Salvaciones: ' + initSaves.join(' + ') : '';
    const clsWrap = document.createElement('div');
    clsWrap.appendChild(clsSelect); clsWrap.appendChild(clsSaves);

    form.appendChild(twoCol(
      fRow('Clase', clsWrap),
      fRow('Subclase', fInput('f-subclass', 'Ej. Campeón', e.subclass ?? '')),
    ));

    // Hint Semielfo: +1 a 2 características a elección (no automático)
    const semielfoHint = document.createElement('div');
    semielfoHint.id = 'f-semielfo-hint';
    semielfoHint.style.cssText = 'font-size:11px;color:var(--gold);background:rgba(122,92,10,0.08);border:1px solid var(--gold-glow);border-radius:6px;padding:8px 12px;display:none;';
    semielfoHint.innerHTML = '✨ <b>Semielfo:</b> Además del +2 CAR, elige 2 características distintas y añade +1 a cada una manualmente en los campos de abajo.';
    form.appendChild(semielfoHint);
    // Trasfondo con badge de competencias
    const bgSelect = fSelect('f-background', [''].concat(BACKGROUNDS), e.background ?? '');
    const bgBadge  = document.createElement('div');
    bgBadge.style.cssText = 'font-size:10px;color:var(--gold-dim);margin-top:4px;min-height:14px;font-style:italic;letter-spacing:0.02em;';
    const updateBgBadge = bg => {
      const sk = BACKGROUND_SKILLS[bg];
      bgBadge.textContent = sk ? '⚔ Competencias: ' + sk.join(' · ') : '';
    };
    updateBgBadge(e.background ?? '');
    bgSelect.addEventListener('change', ev => updateBgBadge(ev.target.value));
    const bgWrap = document.createElement('div');
    bgWrap.appendChild(bgSelect); bgWrap.appendChild(bgBadge);

    form.appendChild(twoCol(
      fRow('Trasfondo', bgWrap),
      fRow('Alineamiento', fSelect('f-alignment', [{ value:'', label:'—' }, ...ALIGNMENTS.map(a => ({ value: a, label: ALIGNMENT_LABELS[a] }))], e.alignment ?? '')),
    ));
    form.appendChild(twoCol(
      fRow('Deidad / Patrón', fInput('f-deity', 'Ej. Bahamut', e.deity ?? '')),
      fRow('Nivel', fNum('f-level', e.level ?? 1, 1, 20)),
    ));
    form.appendChild(fRow('Campaña', fSelect('f-campaign', campOptions, e.campaign_id ?? '')));
    form.appendChild(fRow('URL Avatar / Retrato', fInput('f-portrait', 'https://...', e.portrait_url ?? '')));

    /* ── SECCIÓN: Estadísticas de combate ── */
    form.appendChild(sectionHeader('Combate'));
    form.appendChild(twoCol(
      fRow('HP Actual', fNum('f-hp', e.hp ?? 8, 0, 999)),
      fRow('HP Máximo *', fNum('f-maxhp', e.max_hp ?? 8, 1, 999)),
    ));
    form.appendChild(twoCol(
      fRow('Temp. HP', fNum('f-temphp', e.temp_hp ?? 0, 0, 999)),
      fRow('CA', fNum('f-ac', e.ac ?? 10, 0, 30)),
    ));
    form.appendChild(twoCol(
      fRow('Velocidad (ft)', fNum('f-speed', e.speed ?? 30, 0, 120)),
      fRow('Bonus Iniciativa', fNum('f-init', e.initiative_bonus ?? 0, -10, 20)),
    ));
    form.appendChild(twoCol(
      fRow('Bonus Competencia', fNum('f-prof', e.prof_bonus ?? 2, 1, 9)),
      fRow('Percepción Pasiva', fNum('f-pp', e.passive_perception ?? 10, 1, 30)),
    ));

    /* ── SECCIÓN: Puntuaciones de Característica ── */
    form.appendChild(sectionHeader('Puntuaciones de Característica'));

    // Barra de métodos SRD
    const methodRow = document.createElement('div');
    methodRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';
    const methodLbl = document.createElement('span');
    methodLbl.style.cssText = 'font-size:10px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.06em;flex-shrink:0;';
    methodLbl.textContent = 'Método:';
    methodRow.appendChild(methodLbl);

    const STANDARD_ARRAY = [15,14,13,12,10,8];
    const POINT_BUY_COST = { 8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9 };

    const applyStatValues = baseVals => {
      const rdata  = RACE_DATA[form.querySelector('#f-race').value];
      const srdata = rdata?.subraces?.[form.querySelector('#f-subrace').value];
      const bonuses = { ...(rdata?.bonuses ?? {}), ...(srdata?.bonuses ?? {}) };
      STAT_DEFS.forEach((sf, i) => {
        const total = Math.min(30, Math.max(1, baseVals[i] + (bonuses[sf.bk] ?? 0)));
        form.querySelector('#' + sf.id).value = total;
        const badge = form.querySelector('#' + sf.id + '-mod');
        if (badge) badge.textContent = modStr(total);
      });
      recalcDerived();
    };

    [
      {
        label: 'Array Estándar',
        title: 'Rellena con 15/14/13/12/10/8 en orden FUE·DES·CON·INT·SAB·CAR. Redistribuye a mano según tu concepto.',
        action: () => applyStatValues([...STANDARD_ARRAY]),
      },
      {
        label: '🎲 Tirar Dados',
        title: 'Simula 4d6 descartando el dado más bajo para cada característica (método clásico).',
        action: () => applyStatValues(STAT_DEFS.map(() => {
          const d = Array.from({length:4}, () => 1 + Math.floor(Math.random() * 6)).sort((a,b) => a-b);
          return d[1] + d[2] + d[3];
        })),
      },
    ].forEach(({ label, title, action }) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn'; btn.title = title;
      btn.style.cssText = 'font-size:11px;padding:5px 10px;';
      btn.textContent = label;
      btn.addEventListener('click', action);
      methodRow.appendChild(btn);
    });
    form.appendChild(methodRow);

    // Counter de Point Buy (se actualiza en recalcDerived)
    const pbCounter = document.createElement('div');
    pbCounter.id = 'f-pb-counter';
    pbCounter.style.cssText = 'font-size:10px;color:var(--ink-muted);text-align:right;min-height:14px;transition:color 150ms;';
    form.appendChild(pbCounter);
    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;';
    const STAT_DEFS = [
      { id:'f-str', label:'Fuerza',       key:'str_score', bk:'str' },
      { id:'f-dex', label:'Destreza',     key:'dex_score', bk:'dex' },
      { id:'f-con', label:'Constitución', key:'con_score', bk:'con' },
      { id:'f-int', label:'Inteligencia', key:'int_score', bk:'int' },
      { id:'f-wis', label:'Sabiduría',    key:'wis_score', bk:'wis' },
      { id:'f-cha', label:'Carisma',      key:'cha_score', bk:'cha' },
    ];
    STAT_DEFS.forEach(sf => {
      const inputRow = document.createElement('div');
      inputRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
      const numInput = fNum(sf.id, e[sf.key] ?? 10, 1, 30);
      numInput.style.flex = '1';
      const modBadge = document.createElement('div');
      modBadge.id = sf.id + '-mod';
      modBadge.style.cssText = 'min-width:32px;text-align:center;font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--gold);background:var(--stone-light);border:1px solid var(--border);border-radius:6px;padding:6px 4px;flex-shrink:0;';
      modBadge.textContent = modStr(e[sf.key] ?? 10);
      numInput.addEventListener('input', () => {
        modBadge.textContent = modStr(parseInt(numInput.value) || 10);
        recalcDerived();
      });
      inputRow.appendChild(numInput);
      inputRow.appendChild(modBadge);
      statsGrid.appendChild(fRow(sf.label, inputRow));
    });
    form.appendChild(statsGrid);

    /* ── SECCIÓN: Competencias de Habilidad ── */
    form.appendChild(sectionHeader('Competencias de Habilidad'));

    // Parser local (safeJson está en otro scope)
    const pj = (v, d) => { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? d); } catch (_) { return d; } };
    const existingSkillData = pj(e.skills, {});
    let lockedSkillKeys = new Set();

    const mkSkillBadge = txt => {
      const b = document.createElement('span');
      b.style.cssText = 'display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:4px;font-size:11px;font-family:var(--font-ui);background:rgba(122,92,10,0.1);border:1px solid var(--gold-dim);color:var(--gold);';
      b.textContent = '🔒 ' + txt;
      return b;
    };

    // Grupo Trasfondo
    const bgSkillLbl = document.createElement('div');
    bgSkillLbl.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-muted);margin-bottom:5px;margin-top:4px;';
    bgSkillLbl.textContent = 'Trasfondo';
    const bgSkillBadges = document.createElement('div');
    bgSkillBadges.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;min-height:20px;margin-bottom:10px;';

    // Grupo Especie
    const raceSkillLbl = document.createElement('div');
    raceSkillLbl.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-muted);margin-bottom:5px;';
    raceSkillLbl.textContent = 'Especie / Raza';
    const raceSkillBadges = document.createElement('div');
    raceSkillBadges.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;min-height:20px;margin-bottom:10px;';

    // Grupo Clase
    const clsSkillHdr = document.createElement('div');
    clsSkillHdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
    const clsSkillLbl = document.createElement('div');
    clsSkillLbl.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-muted);';
    clsSkillLbl.textContent = 'Clase (elección del jugador)';
    const clsSkillCounter = document.createElement('div');
    clsSkillCounter.style.cssText = 'font-size:11px;font-family:var(--font-mono);color:var(--gold);';
    clsSkillHdr.appendChild(clsSkillLbl);
    clsSkillHdr.appendChild(clsSkillCounter);
    const clsSkillGrid = document.createElement('div');
    clsSkillGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px;';

    const skillSection = document.createElement('div');
    skillSection.appendChild(bgSkillLbl);
    skillSection.appendChild(bgSkillBadges);
    skillSection.appendChild(raceSkillLbl);
    skillSection.appendChild(raceSkillBadges);
    skillSection.appendChild(clsSkillHdr);
    skillSection.appendChild(clsSkillGrid);
    form.appendChild(skillSection);

    function updateBgSkillComp(bg) {
      bgSkillBadges.innerHTML = '';
      (BACKGROUND_SKILLS[bg] ?? []).forEach(name => {
        const key = SKILL_NAME_TO_KEY[name];
        if (key) lockedSkillKeys.add(key);
        bgSkillBadges.appendChild(mkSkillBadge(name));
      });
    }
    function updateRaceSkillComp(race) {
      raceSkillBadges.innerHTML = '';
      (RACE_SKILLS[race] ?? []).forEach(k => {
        lockedSkillKeys.add(k);
        raceSkillBadges.appendChild(mkSkillBadge(SKILL_KEY_TO_NAME[k] ?? k));
      });
    }
    function updateClsSkillComp(cls, savedSkills) {
      clsSkillGrid.innerHTML = '';
      clsSkillCounter.textContent = '';
      const cfg = CLASS_SKILLS[cls];
      if (!cfg) return;
      const { count, options } = cfg;
      const savedKeys = new Set(Object.keys(savedSkills ?? {}).filter(k => options.includes(k) && !lockedSkillKeys.has(k)));

      const refreshCounter = () => {
        const n = clsSkillGrid.querySelectorAll('input[type=checkbox]:checked').length;
        clsSkillCounter.style.color = n > count ? 'var(--crimson)' : n === count ? 'var(--success)' : 'var(--gold)';
        clsSkillCounter.textContent = n + '/' + count;
      };

      options.forEach(k => {
        const isLocked  = lockedSkillKeys.has(k);
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;cursor:' + (isLocked ? 'default' : 'pointer') + ';border:1px solid var(--border);background:var(--stone-light);font-size:11px;color:' + (isLocked ? 'var(--ink-faint)' : 'var(--ink)') + ';user-select:none;';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.name = 'class-skill'; cb.value = k;
        cb.checked = !isLocked && savedKeys.has(k);
        cb.disabled = isLocked;
        cb.style.accentColor = 'var(--gold)';
        cb.addEventListener('change', () => {
          const n = clsSkillGrid.querySelectorAll('input[type=checkbox]:checked').length;
          if (n > count) { cb.checked = false; return; }
          refreshCounter();
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(SKILL_KEY_TO_NAME[k] ?? k));
        clsSkillGrid.appendChild(label);
      });
      refreshCounter();
    }
    function rebuildAllSkillComp() {
      lockedSkillKeys = new Set();
      updateBgSkillComp(form.querySelector('#f-background').value);
      updateRaceSkillComp(form.querySelector('#f-race').value);
      updateClsSkillComp(form.querySelector('#f-class').value, existingSkillData);
    }
    rebuildAllSkillComp();

    /* ── SECCIÓN: Personalidad ── */
    form.appendChild(sectionHeader('Personalidad & Historia'));
    form.appendChild(fRow('Rasgos de Personalidad', fTextarea('f-traits', 'Soy curioso y siempre hago preguntas…', e.personality_traits ?? '')));
    form.appendChild(twoCol(
      fRow('Ideales', fTextarea('f-ideals', 'La justicia es el bien supremo.', e.ideals ?? '', 2)),
      fRow('Vínculos', fTextarea('f-bonds', 'Protejo a mi aldea natal.', e.bonds ?? '', 2)),
    ));
    form.appendChild(fRow('Defectos', fTextarea('f-flaws', 'No puedo resistir un acertijo.', e.flaws ?? '', 2)));
    form.appendChild(fRow('Historia del Personaje', fTextarea('f-backstory', 'Nació en una pequeña aldea…', e.backstory ?? '', 4)));
    form.appendChild(fRow('Notas', fTextarea('f-notes', 'Detalles adicionales…', e.notes ?? '', 3)));

    /* ── Lógica reactiva D&D 5e ─────────────────────────────────────── */

    function recalcDerived() {
      const dex   = parseInt(form.querySelector('#f-dex').value) || 10;
      const con   = parseInt(form.querySelector('#f-con').value) || 10;
      const wis   = parseInt(form.querySelector('#f-wis').value) || 10;
      const level = parseInt(form.querySelector('#f-level').value) || 1;
      const cls   = form.querySelector('#f-class').value;
      const prof  = profBonusByLevel(level);

      form.querySelector('#f-prof').value = prof;
      form.querySelector('#f-init').value = modifier(dex);
      form.querySelector('#f-pp').value   = 10 + modifier(wis);

      if (cls && CLASS_HIT_DIE[cls]) {
        const die    = CLASS_HIT_DIE[cls];
        const conMod = modifier(con);
        const avg    = Math.floor(die / 2) + 1;
        const maxHp  = Math.max(1, die + conMod + (level - 1) * (avg + conMod));
        form.querySelector('#f-maxhp').value = maxHp;
        if (!isEdit) form.querySelector('#f-hp').value = maxHp;
      }

      const savesEl = form.querySelector('#f-class-saves');
      if (savesEl) {
        const saves = CLASS_SAVES[cls];
        savesEl.textContent = saves ? '🛡 Salvaciones: ' + saves.join(' + ') : '';
      }

      const pbEl = form.querySelector('#f-pb-counter');
      if (pbEl) {
        let pts = 0; let outRange = false;
        STAT_DEFS.forEach(sf => {
          const v = parseInt(form.querySelector('#' + sf.id).value) || 10;
          if (v < 8 || v > 15) outRange = true;
          pts += POINT_BUY_COST[v] ?? 0;
        });
        if (outRange) {
          pbEl.style.color = 'var(--ink-faint)';
          pbEl.textContent = 'Point Buy: valores fuera del rango permitido (8–15)';
        } else {
          const rem = 27 - pts;
          pbEl.style.color = rem < 0 ? 'var(--crimson)' : rem === 0 ? 'var(--success)' : 'var(--ink-muted)';
          pbEl.textContent = `Point Buy: ${pts}/27 pts · ${rem >= 0 ? rem + ' restantes' : Math.abs(rem) + ' sobre el límite'}`;
        }
      }
    }

    function applyRaceBonuses() {
      const race    = form.querySelector('#f-race').value;
      const subrace = form.querySelector('#f-subrace').value;
      const rdata   = RACE_DATA[race];
      const srdata  = rdata?.subraces?.[subrace];
      const bonuses = { ...(rdata?.bonuses ?? {}), ...(srdata?.bonuses ?? {}) };
      const speed   = srdata?.speed ?? rdata?.speed ?? 30;

      const BASE = { str:10, dex:10, con:10, int:10, wis:10, cha:10 };
      STAT_DEFS.forEach(sf => {
        const val = BASE[sf.bk] + (bonuses[sf.bk] ?? 0);
        form.querySelector('#' + sf.id).value = val;
        const badge = form.querySelector('#' + sf.id + '-mod');
        if (badge) badge.textContent = modStr(val);
      });

      form.querySelector('#f-speed').value = speed;

      const semiHint = form.querySelector('#f-semielfo-hint');
      if (semiHint) semiHint.style.display = (rdata?.special === 'choice2') ? 'block' : 'none';

      recalcDerived();
    }

    form.querySelector('#f-race').addEventListener('change', ev => {
      updateSubraceOptions(ev.target.value, '');
      if (!isEdit) applyRaceBonuses();
      else {
        form.querySelector('#f-speed').value = RACE_DATA[ev.target.value]?.speed ?? 30;
        recalcDerived();
      }
      rebuildAllSkillComp();
    });
    form.querySelector('#f-subrace').addEventListener('change', () => {
      if (!isEdit) applyRaceBonuses();
      else {
        const rd  = RACE_DATA[form.querySelector('#f-race').value];
        const srd = rd?.subraces?.[form.querySelector('#f-subrace').value];
        form.querySelector('#f-speed').value = srd?.speed ?? rd?.speed ?? 30;
        recalcDerived();
      }
    });
    form.querySelector('#f-class').addEventListener('change', () => { recalcDerived(); rebuildAllSkillComp(); });
    form.querySelector('#f-level').addEventListener('input',  () => recalcDerived());
    form.querySelector('#f-background').addEventListener('change', () => rebuildAllSkillComp());

    if (!isEdit) recalcDerived();

    /* ── Buttons ── */
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
    saveBtn.textContent = isEdit ? 'Guardar cambios' : 'Crear personaje';

    saveBtn.addEventListener('click', async () => {
      const name   = form.querySelector('#f-name').value.trim();
      const maxhp  = parseInt(form.querySelector('#f-maxhp').value) || 1;
      const campId = form.querySelector('#f-campaign').value;

      if (!name)             { toast.error('Campo requerido', 'El nombre es obligatorio'); return; }
      if (!isEdit && !campId){ toast.error('Campo requerido', 'Selecciona una campaña'); return; }

      saveBtn.disabled = true;
      saveBtn.textContent = isEdit ? 'Guardando...' : 'Creando...';

      const payload = {
        name,
        race:               form.querySelector('#f-race').value || null,
        subrace:            form.querySelector('#f-subrace').value || null,
        char_class:         form.querySelector('#f-class').value || null,
        subclass:           form.querySelector('#f-subclass').value || null,
        background:         form.querySelector('#f-background').value || null,
        alignment:          form.querySelector('#f-alignment').value || null,
        deity:              form.querySelector('#f-deity').value || null,
        level:              parseInt(form.querySelector('#f-level').value) || 1,
        hp:                 parseInt(form.querySelector('#f-hp').value) || maxhp,
        max_hp:             maxhp,
        temp_hp:            parseInt(form.querySelector('#f-temphp').value) || 0,
        ac:                 parseInt(form.querySelector('#f-ac').value) || 10,
        speed:              parseInt(form.querySelector('#f-speed').value) || 30,
        initiative_bonus:   parseInt(form.querySelector('#f-init').value) || 0,
        prof_bonus:         parseInt(form.querySelector('#f-prof').value) || 2,
        passive_perception: parseInt(form.querySelector('#f-pp').value) || 10,
        str_score:          parseInt(form.querySelector('#f-str').value) || 10,
        dex_score:          parseInt(form.querySelector('#f-dex').value) || 10,
        con_score:          parseInt(form.querySelector('#f-con').value) || 10,
        int_score:          parseInt(form.querySelector('#f-int').value) || 10,
        wis_score:          parseInt(form.querySelector('#f-wis').value) || 10,
        cha_score:          parseInt(form.querySelector('#f-cha').value) || 10,
        portrait_url:       form.querySelector('#f-portrait').value || null,
        personality_traits: form.querySelector('#f-traits').value || null,
        ideals:             form.querySelector('#f-ideals').value || null,
        bonds:              form.querySelector('#f-bonds').value || null,
        flaws:              form.querySelector('#f-flaws').value || null,
        backstory:          form.querySelector('#f-backstory').value || null,
        notes:              form.querySelector('#f-notes').value || null,
      };

      // Tiradas de salvación — determinísticas por clase (PHB)
      const payloadClass = form.querySelector('#f-class').value;
      const classSavesList = CLASS_SAVES_KEYS[payloadClass] ?? [];
      const saving_throws = {};
      ['str','dex','con','int','wis','cha'].forEach(k => { saving_throws[k] = { proficient: classSavesList.includes(k) }; });
      payload.saving_throws = saving_throws;

      // Competencias de habilidad — trasfondo + raza (locked) + elección de clase
      const skills = {};
      lockedSkillKeys.forEach(k => { skills[k] = { proficient: true }; });
      form.querySelectorAll('input[name="class-skill"]:checked').forEach(cb => { skills[cb.value] = { proficient: true }; });
      payload.skills = skills;

      try {
        if (isEdit) {
          await api.put(`/characters/${existing.id}`, payload);
          toast.success('Personaje actualizado', name);
        } else {
          await api.post('/characters', { ...payload, campaign_id: campId });
          toast.success('Personaje creado', name);
        }
        overlay.remove();
        loadCharacters();
      } catch (err) {
        toast.error('Error', err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Guardar cambios' : 'Crear personaje';
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

    setTimeout(() => form.querySelector('#f-name').focus(), 100);
  }
}
