import { api } from '../js/api.js';
import { toast } from '../js/components/toast.js';
import { auth } from '../js/auth.js';

/* ─── CONFIG ─────────────────────────────────────────────────────── */
const SIZES = [
  { value: '', label: '—' }, { value: 'tiny', label: 'Diminuto' }, { value: 'small', label: 'Pequeño' },
  { value: 'medium', label: 'Mediano' }, { value: 'large', label: 'Grande' }, { value: 'huge', label: 'Enorme' },
  { value: 'gargantuan', label: 'Gigantesco' },
];
const CREATURE_TYPES = [
  { value: '', label: '—' }, { value: 'aberration', label: 'Aberración' }, { value: 'beast', label: 'Bestia' },
  { value: 'celestial', label: 'Celestial' }, { value: 'construct', label: 'Constructo' }, { value: 'dragon', label: 'Dragón' },
  { value: 'elemental', label: 'Elemental' }, { value: 'fey', label: 'Feérico' }, { value: 'fiend', label: 'Infernal' },
  { value: 'giant', label: 'Gigante' }, { value: 'humanoid', label: 'Humanoide' }, { value: 'monstrosity', label: 'Monstruosidad' },
  { value: 'ooze', label: 'Cieno' }, { value: 'plant', label: 'Planta' }, { value: 'undead', label: 'No-muerto' },
];
const CTYPE_LABEL = Object.fromEntries(CREATURE_TYPES.map(t => [t.value, t.label]));
const CR_OPTIONS = [0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const CR_XP = { 0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000 };
const ENC_TYPES = [
  { value: 'combat', label: 'Combate' }, { value: 'social', label: 'Social' }, { value: 'exploration', label: 'Exploración' },
  { value: 'puzzle', label: 'Acertijo' }, { value: 'trap', label: 'Trampa' }, { value: 'hazard', label: 'Peligro' },
  { value: 'chase', label: 'Persecución' }, { value: 'rest', label: 'Descanso' },
];
const ENC_STATUS = [
  { value: 'planned', label: 'Planificado' }, { value: 'active', label: 'Activo' },
  { value: 'completed', label: 'Completado' }, { value: 'skipped', label: 'Omitido' },
];
const DIFF = {
  trivial: { label: 'Trivial', color: 'var(--ink-faint)' },
  easy: { label: 'Fácil', color: 'var(--success)' },
  medium: { label: 'Media', color: 'var(--gold)' },
  hard: { label: 'Difícil', color: 'var(--gold-dim)' },
  deadly: { label: 'Mortal', color: 'var(--crimson)' },
};
const TABS = [{ key: 'encounters', label: '⚔️ Encuentros' }, { key: 'bestiary', label: '🐉 Bestiario' }];
const LBL = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;';

function crLabel(cr) { return cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr); }

export async function render(container) {
  container.innerHTML = '';
  const user = auth.getUser();
  const canManage = user?.role === 'admin' || user?.role === 'dm';

  let campaigns = [];
  let currentCampaign = null;
  let activeTab = 'encounters';
  let bestiary = [];

  const page = document.createElement('div');
  page.className = 'page-encounters fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:1300px;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;gap:16px;flex-wrap:wrap;';
  header.innerHTML = `<div>
      <h2 style="font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;">᛭ Encuentros ᛭</h2>
      <p style="color:var(--ink-muted);font-size:14px;margin:0;">Bestiario y balanceo (DMG)</p></div>`;
  const campWrap = document.createElement('div');
  const cl = document.createElement('label'); cl.style.cssText = LBL; cl.textContent = 'Campaña';
  const campSelect = document.createElement('select');
  campSelect.className = 'input'; campSelect.style.cssText = 'min-width:240px;';
  campWrap.appendChild(cl); campWrap.appendChild(campSelect);
  header.appendChild(campWrap);
  page.appendChild(header);

  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:8px;border-bottom:1px solid var(--border);margin-bottom:20px;';
  const content = document.createElement('div');
  page.appendChild(tabBar); page.appendChild(content);
  container.appendChild(page);

  try { campaigns = (await api.get('/campaigns')).data ?? []; }
  catch (err) { page.innerHTML = `<div style="color:var(--crimson);padding:40px;">Error: ${err.message}</div>`; return; }
  if (!campaigns.length) {
    content.innerHTML = `<div style="text-align:center;padding:60px;color:var(--ink-muted);"><div style="font-size:40px;">🐉</div>
      <div style="font-family:var(--font-display);font-size:18px;color:var(--ink);margin-top:8px;">No hay campañas</div></div>`;
    return;
  }
  campaigns.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; campSelect.appendChild(o); });
  currentCampaign = campaigns[0].id;
  campSelect.addEventListener('change', () => { currentCampaign = campSelect.value; refresh(); });

  TABS.forEach(t => {
    const b = document.createElement('button');
    b.dataset.tab = t.key; b.textContent = t.label; b.style.cssText = tabStyle(t.key === activeTab);
    b.addEventListener('click', () => { activeTab = t.key; syncTabs(); renderTab(); });
    tabBar.appendChild(b);
  });
  function syncTabs() { tabBar.querySelectorAll('button').forEach(b => { b.style.cssText = tabStyle(b.dataset.tab === activeTab); }); }

  async function refresh() {
    try { bestiary = (await api.get(`/campaigns/${currentCampaign}/bestiary`)).data ?? []; }
    catch (_) { bestiary = []; }
    renderTab();
  }
  function renderTab() {
    content.innerHTML = '<div style="color:var(--ink-muted);padding:30px;">Cargando...</div>';
    return activeTab === 'encounters' ? renderEncounters() : renderBestiary();
  }

  /* ── Encounters ── */
  async function renderEncounters() {
    let encs = [];
    try { encs = (await api.get(`/campaigns/${currentCampaign}/encounters`)).data ?? []; }
    catch (err) { content.innerHTML = errBox(err); return; }
    content.innerHTML = '';
    content.appendChild(addBar('Encuentros', canManage ? () => openEncounterModal() : null));
    if (!encs.length) { content.appendChild(emptyEl('Sin encuentros aún')); return; }
    const grid = gridEl();
    encs.forEach((e, i) => grid.appendChild(encounterCard(e, i)));
    content.appendChild(grid);
  }

  function encounterCard(e, i) {
    const d = DIFF[e.difficulty] ?? DIFF.medium;
    const card = baseCard(d.color, i);
    const mons = (e.monsters ?? []).map(m => `${m.quantity}× ${esc(m.stat_block_name || m.name_override || '¿?')}`).join(', ');
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
        <div style="font-family:var(--font-display);font-size:16px;color:var(--ink);">${esc(e.name)}</div>
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:${d.color};white-space:nowrap;">${d.label}</span>
      </div>
      <div style="font-size:11px;color:var(--ink-faint);margin-top:2px;">${e.party_size} PJ · nivel ${e.party_level} · ${esc(e.status)}${e.visible_to_players ? '' : ' · 🔒 DM'}</div>
      ${mons ? `<div style="font-size:13px;color:var(--ink-muted);margin-top:8px;">${mons}</div>` : '<div style="font-size:12px;color:var(--ink-faint);margin-top:8px;">Sin monstruos</div>'}
      ${e.description ? `<p style="font-size:13px;color:var(--ink-muted);line-height:1.5;margin:8px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(e.description)}</p>` : ''}`;
    if (canManage) card.appendChild(cardActions(() => openEncounterModal(e), () => del(`encounters/${e.id}`, `encuentro "${e.name}"`)));
    return card;
  }

  function openEncounterModal(enc = null) {
    const isEdit = !!enc;
    const { overlay, form, footer } = buildModal(isEdit ? 'Editar encuentro' : 'Nuevo encuentro');
    form.appendChild(field('Nombre *', input('e-name', enc?.name ?? '', 'Emboscada en el camino')));
    const r1 = grid2();
    r1.appendChild(field('Tipo', select('e-type', ENC_TYPES, enc?.encounter_type ?? 'combat')));
    r1.appendChild(field('Estado', select('e-status', ENC_STATUS, enc?.status ?? 'planned')));
    form.appendChild(r1);
    const r2 = grid2();
    r2.appendChild(field('Nº de personajes', numInput('e-psize', enc?.party_size ?? 4, 1, 12)));
    r2.appendChild(field('Nivel del grupo', numInput('e-plevel', enc?.party_level ?? 1, 1, 20)));
    form.appendChild(r2);

    /* Monster picker */
    const mLabel = document.createElement('label'); mLabel.style.cssText = LBL; mLabel.textContent = 'Monstruos';
    const pickerRow = document.createElement('div');
    pickerRow.style.cssText = 'display:flex;gap:8px;';
    const pick = select('e-pick', [{ value: '', label: 'Elegir del bestiario...' }, ...bestiary.map(b => ({ value: b.id, label: `${b.name} (CR ${crLabel(b.challenge_rating)}, ${b.xp_value} XP)` }))], '');
    pick.style.flex = '1';
    const addBtn = document.createElement('button');
    addBtn.type = 'button'; addBtn.className = 'btn'; addBtn.textContent = '+ Añadir';
    addBtn.style.cssText = 'background:var(--gold-glow);border:1px solid var(--gold-dim);color:var(--gold);white-space:nowrap;';
    pickerRow.appendChild(pick); pickerRow.appendChild(addBtn);
    const monBox = document.createElement('div');
    monBox.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:8px;';
    const mGroup = document.createElement('div');
    mGroup.appendChild(mLabel); mGroup.appendChild(pickerRow); mGroup.appendChild(monBox);
    form.appendChild(mGroup);

    /* Difficulty readout */
    const diffBox = document.createElement('div');
    diffBox.style.cssText = 'margin-top:4px;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--stone-light);font-size:13px;color:var(--ink-muted);';
    diffBox.textContent = 'Añade monstruos para calcular la dificultad.';
    form.appendChild(diffBox);

    form.appendChild(field('Descripción', textarea('e-desc', enc?.description ?? '')));
    form.appendChild(field('Terreno / rasgos', input('e-terrain', enc?.terrain_features ?? '', 'Cobertura, terreno difícil...')));
    form.appendChild(field('Notas del DM', textarea('e-dmnotes', enc?.dm_notes ?? '')));
    form.appendChild(check('e-visible', 'Visible para jugadores', enc ? enc.visible_to_players : false));

    function addMonsterRow(stat_block_id, qty) {
      const b = bestiary.find(x => x.id === stat_block_id);
      if (!b) return;
      const row = document.createElement('div');
      row.setAttribute('data-mon', b.id);
      row.dataset.xp = b.xp_value;
      row.style.cssText = 'display:flex;align-items:center;gap:8px;background:var(--stone);border:1px solid var(--border);border-radius:8px;padding:6px 10px;';
      const q = document.createElement('input');
      q.type = 'number'; q.min = '1'; q.value = qty || 1; q.setAttribute('data-qty', '');
      q.style.cssText = 'width:56px;'; q.className = 'input';
      q.addEventListener('input', recalc);
      const label = document.createElement('span');
      label.style.cssText = 'flex:1;font-size:13px;color:var(--ink);';
      label.textContent = `${b.name} · CR ${crLabel(b.challenge_rating)} · ${b.xp_value} XP`;
      const rm = document.createElement('button');
      rm.type = 'button'; rm.textContent = '✕';
      rm.style.cssText = 'background:transparent;border:none;color:var(--crimson);cursor:pointer;';
      rm.addEventListener('click', () => { row.remove(); recalc(); });
      row.appendChild(q); row.appendChild(label); row.appendChild(rm);
      monBox.appendChild(row);
    }

    addBtn.addEventListener('click', () => {
      if (!pick.value) return;
      if (monBox.querySelector(`[data-mon="${pick.value}"]`)) { toast.error('Ese monstruo ya está en el encuentro'); return; }
      addMonsterRow(pick.value, 1);
      recalc();
    });

    let recalcTimer = null;
    function collectMonsters() {
      return [...monBox.querySelectorAll('[data-mon]')].map(r => ({
        stat_block_id: r.getAttribute('data-mon'),
        quantity: parseInt(r.querySelector('[data-qty]').value, 10) || 1,
      }));
    }
    function recalc() {
      const monsters = collectMonsters();
      if (!monsters.length) { diffBox.textContent = 'Añade monstruos para calcular la dificultad.'; return; }
      clearTimeout(recalcTimer);
      recalcTimer = setTimeout(async () => {
        try {
          const res = await api.post(`/campaigns/${currentCampaign}/encounters/preview-difficulty`, {
            monsters, party_size: parseInt(byId('e-psize').value, 10) || 4, party_level: parseInt(byId('e-plevel').value, 10) || 1,
          });
          const p = res.data; const d = DIFF[p.difficulty] ?? DIFF.medium;
          diffBox.innerHTML = `<span style="font-weight:700;color:${d.color};text-transform:uppercase;">${d.label}</span>
            &nbsp;·&nbsp; XP base <b>${p.base_xp}</b> · ajustado <b>${p.adjusted_xp}</b> (×${p.multiplier})
            <div style="font-size:11px;color:var(--ink-faint);margin-top:4px;">Umbrales grupo — Fácil ${p.thresholds.easy} · Media ${p.thresholds.medium} · Difícil ${p.thresholds.hard} · Mortal ${p.thresholds.deadly}</div>
            ${p.adjusted_xp >= p.thresholds.deadly ? '<div style="font-size:12px;color:var(--crimson);margin-top:4px;">⚠️ Potencialmente letal.</div>' : ''}
            ${p.monster_count === 1 ? '<div style="font-size:11px;color:var(--ink-faint);margin-top:4px;">ℹ️ Un solo monstruo suele ser fácil de rodear (action economy).</div>' : ''}
            <div style="font-size:11px;color:var(--ink-faint);margin-top:4px;">XP a repartir (recompensa): ${p.base_xp}.</div>`;
        } catch (err) { diffBox.textContent = 'No se pudo calcular: ' + err.message; }
      }, 250);
    }

    byId('e-psize') && byId('e-psize').addEventListener('input', recalc);
    byId('e-plevel') && byId('e-plevel').addEventListener('input', recalc);
    (enc?.monsters ?? []).forEach(m => { if (m.stat_block_id) addMonsterRow(m.stat_block_id, m.quantity); });
    recalc();

    footer.saveBtn.addEventListener('click', async () => {
      const name = val('e-name');
      if (!name) { toast.error('Falta el nombre'); return; }
      const body = {
        name, encounter_type: val('e-type'), status: val('e-status'),
        party_size: parseInt(byId('e-psize').value, 10) || 4, party_level: parseInt(byId('e-plevel').value, 10) || 1,
        description: val('e-desc') || null, terrain_features: val('e-terrain') || null,
        dm_notes: val('e-dmnotes') || null, visible_to_players: byId('e-visible').checked,
        monsters: collectMonsters(),
      };
      footer.busy(true);
      try {
        if (isEdit) await api.put(`/campaigns/${currentCampaign}/encounters/${enc.id}`, body);
        else await api.post(`/campaigns/${currentCampaign}/encounters`, body);
        toast.success(isEdit ? 'Encuentro actualizado' : 'Encuentro creado');
        overlay.remove(); renderEncounters();
      } catch (err) { toast.error('Error', err.message); footer.busy(false); }
    });
  }

  /* ── Bestiary ── */
  async function renderBestiary() {
    content.innerHTML = '';
    content.appendChild(addBar('Bestiario', canManage ? () => openStatBlockModal() : null));
    if (!bestiary.length) { content.appendChild(emptyEl('Bestiario vacío (ejecuta el seed SRD)')); return; }
    const grid = gridEl();
    bestiary.forEach((b, i) => grid.appendChild(statBlockCard(b, i)));
    content.appendChild(grid);
  }

  function statBlockCard(b, i) {
    const homebrew = !!b.campaign_id;
    const card = baseCard(homebrew ? 'var(--crimson)' : 'var(--gold-dim)', i);
    const ab = b.abilities || {};
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
        <div style="font-family:var(--font-display);font-size:16px;color:var(--ink);">${esc(b.name)}</div>
        <span style="font-family:var(--font-mono);font-size:12px;color:var(--gold);white-space:nowrap;">CR ${crLabel(b.challenge_rating)} · ${b.xp_value} XP</span>
      </div>
      <div style="font-size:11px;color:var(--ink-faint);margin-top:2px;">${[b.size, CTYPE_LABEL[b.creature_type] || b.creature_type, b.alignment].filter(Boolean).join(' · ')}${homebrew ? ' · 🛠️ homebrew' : ''}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--ink-muted);margin-top:8px;">
        ${b.armor_class != null ? `<span>🛡️ CA ${b.armor_class}</span>` : ''}
        ${b.hit_points != null ? `<span>❤️ ${b.hit_points} PG${b.hit_dice ? ` (${b.hit_dice})` : ''}</span>` : ''}
      </div>
      ${Object.keys(ab).length ? `<div style="font-family:var(--font-mono);font-size:11px;color:var(--ink-faint);margin-top:6px;">FUE ${ab.STR ?? '–'} · DES ${ab.DEX ?? '–'} · CON ${ab.CON ?? '–'} · INT ${ab.INT ?? '–'} · SAB ${ab.WIS ?? '–'} · CAR ${ab.CHA ?? '–'}</div>` : ''}
      ${b.description ? `<p style="font-size:13px;color:var(--ink-muted);line-height:1.5;margin:8px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(b.description)}</p>` : ''}`;
    if (canManage && homebrew) card.appendChild(cardActions(() => openStatBlockModal(b), () => del(`bestiary/${b.id}`, `monstruo "${b.name}"`)));
    return card;
  }

  function openStatBlockModal(sb = null) {
    const isEdit = !!sb;
    const { overlay, form, footer } = buildModal(isEdit ? 'Editar monstruo' : 'Nuevo monstruo (homebrew)');
    form.appendChild(field('Nombre *', input('s-name', sb?.name ?? '', 'Sabueso infernal')));
    const r1 = grid2();
    r1.appendChild(field('Tamaño', select('s-size', SIZES, sb?.size ?? 'medium')));
    r1.appendChild(field('Tipo', select('s-type', CREATURE_TYPES, sb?.creature_type ?? '')));
    form.appendChild(r1);
    form.appendChild(field('Alineamiento', input('s-align', sb?.alignment ?? '', 'Neutral Malvado')));
    const r2 = grid2();
    const crSel = select('s-cr', CR_OPTIONS.map(c => ({ value: c, label: `CR ${crLabel(c)} (${CR_XP[c]} XP)` })), sb?.challenge_rating ?? 0);
    r2.appendChild(field('Desafío (CR)', crSel));
    r2.appendChild(field('Velocidad (pies)', numInput('s-speed', sb?.speed?.walk ?? 30, 0, 200)));
    form.appendChild(r2);
    const r3 = grid2();
    r3.appendChild(field('Clase de Armadura', numInput('s-ac', sb?.armor_class ?? 12, 0, 40)));
    r3.appendChild(field('Puntos de Golpe', numInput('s-hp', sb?.hit_points ?? 10, 1, 1000)));
    form.appendChild(r3);
    form.appendChild(field('Dados de golpe', input('s-hd', sb?.hit_dice ?? '', '2d8+2')));

    const ab = sb?.abilities || {};
    const abLabel = document.createElement('label'); abLabel.style.cssText = LBL; abLabel.textContent = 'Características';
    const abGrid = document.createElement('div');
    abGrid.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:8px;';
    [['STR', 'FUE'], ['DEX', 'DES'], ['CON', 'CON'], ['INT', 'INT'], ['WIS', 'SAB'], ['CHA', 'CAR']].forEach(([k, es]) => {
      const wrap = document.createElement('div');
      const l = document.createElement('div'); l.style.cssText = 'font-size:10px;color:var(--ink-muted);text-align:center;margin-bottom:2px;'; l.textContent = es;
      const inp = numInput('s-ab-' + k, ab[k] ?? 10, 1, 30); inp.style.textAlign = 'center';
      wrap.appendChild(l); wrap.appendChild(inp); abGrid.appendChild(wrap);
    });
    const abG = document.createElement('div'); abG.appendChild(abLabel); abG.appendChild(abGrid);
    form.appendChild(abG);
    form.appendChild(field('Descripción', textarea('s-desc', sb?.description ?? '')));

    footer.saveBtn.addEventListener('click', async () => {
      const name = val('s-name');
      if (!name) { toast.error('Falta el nombre'); return; }
      const cr = parseFloat(val('s-cr'));
      const abilities = {};
      ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].forEach(k => { abilities[k] = parseInt(byId('s-ab-' + k).value, 10) || 10; });
      const body = {
        name, size: val('s-size') || null, creature_type: val('s-type') || null,
        alignment: val('s-align') || null, challenge_rating: cr, xp_value: CR_XP[cr] ?? 0,
        armor_class: parseInt(val('s-ac'), 10) || null, hit_points: parseInt(val('s-hp'), 10) || null,
        hit_dice: val('s-hd') || null, speed: { walk: parseInt(val('s-speed'), 10) || 0 },
        abilities, description: val('s-desc') || null,
      };
      footer.busy(true);
      try {
        if (isEdit) await api.put(`/campaigns/${currentCampaign}/bestiary/${sb.id}`, body);
        else await api.post(`/campaigns/${currentCampaign}/bestiary`, body);
        toast.success(isEdit ? 'Monstruo actualizado' : 'Monstruo creado');
        overlay.remove(); refresh();
      } catch (err) { toast.error('Error', err.message); footer.busy(false); }
    });
  }

  async function del(path, label) {
    if (!confirm(`¿Eliminar ${label}?`)) return;
    try { await api.del(`/campaigns/${currentCampaign}/${path}`); toast.success('Eliminado'); refresh(); }
    catch (err) { toast.error(err.message); }
  }

  function addBar(title, onAdd) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
    const h = document.createElement('h3'); h.style.cssText = 'font-family:var(--font-display);font-size:18px;color:var(--ink);margin:0;'; h.textContent = title;
    wrap.appendChild(h);
    if (onAdd) {
      const b = document.createElement('button'); b.className = 'btn btn-primary'; b.style.cssText = 'padding:6px 14px;font-size:13px;';
      b.innerHTML = '<span style="font-size:16px;">+</span> Añadir'; b.addEventListener('click', onAdd); wrap.appendChild(b);
    }
    return wrap;
  }

  syncTabs();
  refresh();
}

/* ─── MODULE HELPERS ─────────────────────────────────────────────── */
function tabStyle(active) {
  return `padding:8px 16px;font-family:var(--font-ui);font-size:14px;cursor:pointer;background:none;border:none;
    border-bottom:2px solid ${active ? 'var(--gold)' : 'transparent'};color:${active ? 'var(--gold)' : 'var(--ink-muted)'};
    font-weight:${active ? '600' : '400'};`;
}
function gridEl() { const g = document.createElement('div'); g.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;'; return g; }
function baseCard(accent, i) { const c = document.createElement('div'); c.style.cssText = `background:var(--stone);border:1px solid var(--border);border-left:3px solid ${accent};border-radius:10px;padding:18px;animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${i * 40}ms both;`; return c; }
function cardActions(onEdit, onDelete) { const a = document.createElement('div'); a.style.cssText = 'display:flex;gap:8px;margin-top:12px;'; a.appendChild(miniBtn('Editar', 'var(--ink-muted)', onEdit)); a.appendChild(miniBtn('Eliminar', 'var(--crimson)', onDelete)); return a; }
function miniBtn(label, color, onClick) { const b = document.createElement('button'); b.textContent = label; b.style.cssText = `background:transparent;border:1px solid var(--border);border-radius:6px;padding:4px 12px;font-size:12px;color:${color};cursor:pointer;`; b.addEventListener('click', onClick); return b; }
function emptyEl(text) { const d = document.createElement('div'); d.style.cssText = 'text-align:center;padding:40px 20px;color:var(--ink-muted);font-family:var(--font-display);font-size:16px;'; d.textContent = text; return d; }
function errBox(err) { return `<div style="color:var(--crimson);padding:20px;">Error: ${err.message}</div>`; }
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function val(id) { return (document.getElementById(id)?.value ?? '').trim(); }
function byId(id) { return document.getElementById(id); }
function grid2() { const d = document.createElement('div'); d.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;'; return d; }
function field(labelText, control) { const g = document.createElement('div'); const l = document.createElement('label'); l.style.cssText = LBL; l.textContent = labelText; g.appendChild(l); g.appendChild(control); return g; }
function input(id, value, placeholder, type = 'text') { const i = document.createElement('input'); i.id = id; i.className = 'input'; i.type = type; i.value = value ?? ''; if (placeholder) i.placeholder = placeholder; return i; }
function numInput(id, value, min, max) { const i = input(id, value ?? '', '', 'number'); if (min != null) i.min = String(min); if (max != null) i.max = String(max); return i; }
function textarea(id, value) { const t = document.createElement('textarea'); t.id = id; t.className = 'input'; t.rows = 3; t.style.cssText = 'resize:vertical;min-height:60px;'; t.value = value ?? ''; return t; }
function select(id, opts, selected) { const s = document.createElement('select'); s.id = id; s.className = 'input'; opts.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.label; op.selected = String(selected) === String(o.value); s.appendChild(op); }); return s; }
function check(id, labelText, checked) { const g = document.createElement('label'); g.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink);cursor:pointer;'; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = id; cb.checked = !!checked; cb.style.cssText = 'width:16px;height:16px;'; g.appendChild(cb); g.appendChild(document.createTextNode(labelText)); return g; }
function buildModal(titleText) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(9,8,10,0.8);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;animation:fadeIn var(--dur-normal) var(--ease-smooth);';
  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:12px;padding:32px;width:100%;max-width:580px;animation:modalIn var(--dur-normal) var(--ease-spring);max-height:90vh;overflow-y:auto;';
  const title = document.createElement('h3');
  title.style.cssText = 'font-family:var(--font-display);color:var(--gold);margin:0 0 24px;font-size:20px;'; title.textContent = titleText;
  const form = document.createElement('div'); form.style.cssText = 'display:flex;flex-direction:column;gap:16px;';
  const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:12px;margin-top:8px;';
  const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn'; cancelBtn.style.cssText = 'flex:1;background:transparent;border:1px solid var(--border);color:var(--ink-muted);'; cancelBtn.textContent = 'Cancelar'; cancelBtn.addEventListener('click', () => overlay.remove());
  const saveBtn = document.createElement('button'); saveBtn.className = 'btn btn-primary'; saveBtn.style.cssText = 'flex:2;'; saveBtn.textContent = 'Guardar';
  btnRow.appendChild(cancelBtn); btnRow.appendChild(saveBtn);
  modal.appendChild(title); modal.appendChild(form); modal.appendChild(btnRow);
  overlay.appendChild(modal); document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  const footer = { saveBtn, busy(on) { saveBtn.disabled = on; saveBtn.textContent = on ? 'Guardando...' : 'Guardar'; } };
  return { overlay, modal, form, footer };
}
