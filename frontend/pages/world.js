import { api } from '../js/api.js';
import { toast } from '../js/components/toast.js';
import { auth } from '../js/auth.js';

/* ─── CONFIG ─────────────────────────────────────────────────────── */
const RELATIONSHIPS = [
  { value: 'ally', label: 'Aliado', color: 'var(--success)' },
  { value: 'enemy', label: 'Enemigo', color: 'var(--crimson)' },
  { value: 'neutral', label: 'Neutral', color: 'var(--ink-muted)' },
  { value: 'unknown', label: 'Desconocido', color: 'var(--ink-faint)' },
];
const REL_MAP = Object.fromEntries(RELATIONSHIPS.map(r => [r.value, r]));
const ATTITUDES = [
  { value: '', label: '—' },
  { value: 'hostile', label: 'Hostil' },
  { value: 'unfriendly', label: 'Poco amistoso' },
  { value: 'indifferent', label: 'Indiferente' },
  { value: 'friendly', label: 'Amistoso' },
  { value: 'helpful', label: 'Servicial' },
];
const LOC_TYPES = [
  { value: 'city', label: 'Ciudad' },
  { value: 'region', label: 'Región' },
  { value: 'dungeon', label: 'Mazmorra' },
  { value: 'wilderness', label: 'Yermo' },
  { value: 'plane', label: 'Plano' },
  { value: 'poi', label: 'Punto de interés' },
];
const LOC_TYPE_LABEL = Object.fromEntries(LOC_TYPES.map(t => [t.value, t.label]));
const ALIGNMENTS = [
  { value: '', label: '—' },
  { value: 'LG', label: 'Legal Bueno' }, { value: 'NG', label: 'Neutral Bueno' }, { value: 'CG', label: 'Caótico Bueno' },
  { value: 'LN', label: 'Legal Neutral' }, { value: 'TN', label: 'Neutral Verdadero' }, { value: 'CN', label: 'Caótico Neutral' },
  { value: 'LE', label: 'Legal Malvado' }, { value: 'NE', label: 'Neutral Malvado' }, { value: 'CE', label: 'Caótico Malvado' },
];
const TABS = [
  { key: 'npcs', label: '🧑 NPCs' },
  { key: 'locations', label: '🗺️ Localizaciones' },
  { key: 'factions', label: '⚑ Facciones' },
];
const LBL = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;';

export async function render(container) {
  container.innerHTML = '';
  const user = auth.getUser();
  const canManage = user?.role === 'admin' || user?.role === 'dm';

  let campaigns = [];
  let currentCampaign = null;
  let activeTab = 'npcs';
  let locations = [];   // cache para dropdowns
  let factions = [];    // cache para dropdowns

  const page = document.createElement('div');
  page.className = 'page-world fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:1300px;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;gap:16px;flex-wrap:wrap;';
  header.innerHTML = `<div>
      <h2 style="font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;">᛭ Compendio ᛭</h2>
      <p style="color:var(--ink-muted);font-size:14px;margin:0;">El mundo vivo de la campaña</p>
    </div>`;
  const campWrap = document.createElement('div');
  const campLabel = document.createElement('label');
  campLabel.style.cssText = LBL; campLabel.textContent = 'Campaña';
  const campSelect = document.createElement('select');
  campSelect.className = 'input'; campSelect.style.cssText = 'min-width:240px;';
  campWrap.appendChild(campLabel); campWrap.appendChild(campSelect);
  header.appendChild(campWrap);
  page.appendChild(header);

  /* Tab bar */
  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:8px;border-bottom:1px solid var(--border);margin-bottom:20px;';
  const content = document.createElement('div');
  page.appendChild(tabBar);
  page.appendChild(content);
  container.appendChild(page);

  /* Load campaigns */
  try {
    const res = await api.get('/campaigns');
    campaigns = res.data ?? [];
  } catch (err) {
    page.innerHTML = `<div style="color:var(--crimson);padding:40px;">Error al cargar campañas: ${err.message}</div>`;
    return;
  }
  if (!campaigns.length) {
    content.innerHTML = `<div style="text-align:center;padding:60px;color:var(--ink-muted);">
      <div style="font-size:40px;">🌍</div><div style="font-family:var(--font-display);font-size:18px;color:var(--ink);margin-top:8px;">No hay campañas</div>
      <div style="font-size:13px;margin-top:6px;">Crea una campaña para poblar su mundo.</div></div>`;
    return;
  }
  campaigns.forEach(c => {
    const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; campSelect.appendChild(o);
  });
  currentCampaign = campaigns[0].id;
  campSelect.addEventListener('change', () => { currentCampaign = campSelect.value; refresh(); });

  TABS.forEach(t => {
    const b = document.createElement('button');
    b.dataset.tab = t.key;
    b.textContent = t.label;
    b.style.cssText = tabStyle(t.key === activeTab);
    b.addEventListener('click', () => { activeTab = t.key; syncTabs(); renderTab(); });
    tabBar.appendChild(b);
  });
  function syncTabs() {
    tabBar.querySelectorAll('button').forEach(b => { b.style.cssText = tabStyle(b.dataset.tab === activeTab); });
  }

  async function refresh() {
    // recarga caches compartidas y la pestaña activa
    try {
      const [loc, fac] = await Promise.all([
        api.get(`/campaigns/${currentCampaign}/locations`),
        api.get(`/campaigns/${currentCampaign}/factions`),
      ]);
      locations = loc.data ?? [];
      factions = fac.data ?? [];
    } catch (e) { locations = []; factions = []; }
    renderTab();
  }

  async function renderTab() {
    content.innerHTML = '<div style="color:var(--ink-muted);padding:30px;">Cargando...</div>';
    if (activeTab === 'npcs') return renderNpcs();
    if (activeTab === 'locations') return renderLocations();
    if (activeTab === 'factions') return renderFactions();
  }

  /* ── NPCs ── */
  async function renderNpcs() {
    let npcs = [];
    try { npcs = (await api.get(`/campaigns/${currentCampaign}/npcs`)).data ?? []; }
    catch (err) { content.innerHTML = errBox(err); return; }
    content.innerHTML = '';
    content.appendChild(addBar('NPCs', canManage ? () => openNpcModal() : null));
    if (!npcs.length) { content.appendChild(emptyEl('Sin NPCs aún')); return; }
    const grid = gridEl();
    npcs.forEach((n, i) => grid.appendChild(npcCard(n, i)));
    content.appendChild(grid);
  }

  function npcCard(n, i) {
    const rel = REL_MAP[n.relationship] ?? REL_MAP.unknown;
    const card = baseCard(rel.color, i);
    const meta = [n.race, n.npc_class, n.role].filter(Boolean).join(' · ');
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
        <div style="font-family:var(--font-display);font-size:16px;color:var(--ink);">${esc(n.name)}${n.alive ? '' : ' <span style="font-size:11px;color:var(--crimson);">†</span>'}</div>
        <span style="font-size:10px;font-weight:600;text-transform:uppercase;color:${rel.color};white-space:nowrap;">${rel.label}</span>
      </div>
      ${meta ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:2px;">${esc(meta)}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:11px;color:var(--ink-faint);">
        ${n.location_name ? `<span>📍 ${esc(n.location_name)}</span>` : ''}
        ${n.faction_name ? `<span>⚑ ${esc(n.faction_name)}</span>` : ''}
        ${n.dm_only ? '<span style="color:var(--crimson);">🔒 DM</span>' : ''}
      </div>
      ${n.description ? `<p style="font-size:13px;color:var(--ink-muted);line-height:1.5;margin:8px 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${esc(n.description)}</p>` : ''}
      ${n.secret ? `<div style="font-size:12px;color:var(--crimson);margin-top:8px;">🤫 ${esc(n.secret)}</div>` : ''}`;
    if (canManage) card.appendChild(cardActions(() => openNpcModal(n), () => del(`npcs/${n.id}`, `NPC "${n.name}"`)));
    return card;
  }

  function openNpcModal(npc = null) {
    const isEdit = !!npc;
    const { overlay, form, footer } = buildModal(isEdit ? 'Editar NPC' : 'Nuevo NPC');
    form.appendChild(field('Nombre *', input('n-name', npc?.name ?? '', 'Ismark Kolyanovich')));
    const r1 = grid2();
    r1.appendChild(field('Raza', input('n-race', npc?.race ?? '', 'Humano')));
    r1.appendChild(field('Clase', input('n-class', npc?.npc_class ?? '', 'Noble')));
    form.appendChild(r1);
    form.appendChild(field('Rol', input('n-role', npc?.role ?? '', 'Burgomaestre')));
    const r2 = grid2();
    r2.appendChild(field('Relación', select('n-rel', RELATIONSHIPS, npc?.relationship ?? 'unknown')));
    r2.appendChild(field('Actitud', select('n-att', ATTITUDES, npc?.attitude ?? '')));
    form.appendChild(r2);
    const r3 = grid2();
    r3.appendChild(field('Localización', select('n-loc', [{ value: '', label: '—' }, ...locations.map(l => ({ value: l.id, label: l.name }))], npc?.location_id ?? '')));
    r3.appendChild(field('Facción', select('n-fac', [{ value: '', label: '—' }, ...factions.map(f => ({ value: f.id, label: f.name }))], npc?.faction_id ?? '')));
    form.appendChild(r3);
    form.appendChild(field('Descripción', textarea('n-desc', npc?.description ?? '')));
    form.appendChild(field('Retrato (URL)', input('n-portrait', npc?.portrait_url ?? '', 'https://...')));
    form.appendChild(sep('Contenido del DM (privado)'));
    form.appendChild(field('Motivación', textarea('n-motiv', npc?.motivation ?? '')));
    form.appendChild(field('Secreto', textarea('n-secret', npc?.secret ?? '')));
    form.appendChild(field('Notas', textarea('n-notes', npc?.notes ?? '')));
    const flags = document.createElement('div');
    flags.style.cssText = 'display:flex;gap:20px;';
    flags.appendChild(check('n-alive', 'Vivo', npc ? npc.alive : true));
    flags.appendChild(check('n-dmonly', 'Oculto a jugadores', npc ? npc.dm_only : false));
    form.appendChild(flags);

    footer.saveBtn.addEventListener('click', async () => {
      const name = val('n-name');
      if (!name) { toast.error('Falta el nombre'); return; }
      const body = {
        name, race: val('n-race') || null, npc_class: val('n-class') || null, role: val('n-role') || null,
        relationship: val('n-rel'), attitude: val('n-att') || null,
        location_id: val('n-loc') || null, faction_id: val('n-fac') || null,
        description: val('n-desc') || null, portrait_url: val('n-portrait') || null,
        motivation: val('n-motiv') || null, secret: val('n-secret') || null, notes: val('n-notes') || null,
        alive: byId('n-alive').checked, dm_only: byId('n-dmonly').checked,
      };
      await save(isEdit, `npcs${isEdit ? '/' + npc.id : ''}`, body, overlay, footer);
    });
  }

  /* ── Locations ── */
  async function renderLocations() {
    content.innerHTML = '';
    content.appendChild(addBar('Localizaciones', canManage ? () => openLocationModal() : null));
    if (!locations.length) { content.appendChild(emptyEl('Sin localizaciones aún')); return; }
    const grid = gridEl();
    locations.forEach((l, i) => grid.appendChild(locationCard(l, i)));
    content.appendChild(grid);
  }

  function locationCard(l, i) {
    const parent = locations.find(p => p.id === l.parent_location_id);
    const card = baseCard('var(--gold-dim)', i);
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
        <div style="font-family:var(--font-display);font-size:16px;color:var(--ink);">${esc(l.name)}</div>
        <span style="font-size:10px;font-weight:600;text-transform:uppercase;color:var(--gold-dim);white-space:nowrap;">${LOC_TYPE_LABEL[l.type] ?? l.type}</span>
      </div>
      ${parent ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:2px;">↳ ${esc(parent.name)}</div>` : ''}
      <div style="font-size:11px;color:var(--ink-faint);margin-top:4px;">${l.is_discovered ? '👁️ Descubierta' : '🔒 Oculta a jugadores'}</div>
      ${l.description ? `<p style="font-size:13px;color:var(--ink-muted);line-height:1.5;margin:8px 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${esc(l.description)}</p>` : ''}`;
    if (canManage) card.appendChild(cardActions(() => openLocationModal(l), () => del(`locations/${l.id}`, `localización "${l.name}"`)));
    return card;
  }

  function openLocationModal(loc = null) {
    const isEdit = !!loc;
    const { overlay, form, footer } = buildModal(isEdit ? 'Editar localización' : 'Nueva localización');
    form.appendChild(field('Nombre *', input('l-name', loc?.name ?? '', 'Aldea de Barovia')));
    const r1 = grid2();
    r1.appendChild(field('Tipo', select('l-type', LOC_TYPES, loc?.type ?? 'poi')));
    const parentOpts = [{ value: '', label: '— Ninguna —' }, ...locations.filter(x => x.id !== loc?.id).map(l => ({ value: l.id, label: l.name }))];
    r1.appendChild(field('Ubicación padre', select('l-parent', parentOpts, loc?.parent_location_id ?? '')));
    form.appendChild(r1);
    form.appendChild(field('Descripción', textarea('l-desc', loc?.description ?? '')));
    form.appendChild(field('Mapa (URL)', input('l-map', loc?.map_url ?? '', 'https://...')));
    form.appendChild(field('Notas del DM (privadas)', textarea('l-notes', loc?.notes ?? '')));
    form.appendChild(check('l-disc', 'Descubierta por los jugadores', loc ? loc.is_discovered : true));

    footer.saveBtn.addEventListener('click', async () => {
      const name = val('l-name');
      if (!name) { toast.error('Falta el nombre'); return; }
      const body = {
        name, type: val('l-type'),
        parent_location_id: val('l-parent') || null,
        description: val('l-desc') || null, map_url: val('l-map') || null,
        notes: val('l-notes') || null, is_discovered: byId('l-disc').checked,
      };
      await save(isEdit, `locations${isEdit ? '/' + loc.id : ''}`, body, overlay, footer);
    });
  }

  /* ── Factions ── */
  async function renderFactions() {
    content.innerHTML = '';
    content.appendChild(addBar('Facciones', canManage ? () => openFactionModal() : null));
    if (!factions.length) { content.appendChild(emptyEl('Sin facciones aún')); return; }
    const grid = gridEl();
    factions.forEach((f, i) => grid.appendChild(factionCard(f, i)));
    content.appendChild(grid);
  }

  function factionCard(f, i) {
    const card = baseCard('var(--crimson)', i);
    card.innerHTML = `
      <div style="font-family:var(--font-display);font-size:16px;color:var(--ink);">${esc(f.name)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:11px;color:var(--ink-faint);">
        ${f.alignment ? `<span style="font-family:var(--font-mono);">${esc(f.alignment)}</span>` : ''}
        ${f.leader_name ? `<span>👑 ${esc(f.leader_name)}</span>` : ''}
      </div>
      ${f.goals ? `<div style="font-size:12px;color:var(--gold-dim);margin-top:6px;">🎯 ${esc(f.goals)}</div>` : ''}
      ${f.description ? `<p style="font-size:13px;color:var(--ink-muted);line-height:1.5;margin:8px 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${esc(f.description)}</p>` : ''}`;
    if (canManage) card.appendChild(cardActions(() => openFactionModal(f), () => del(`factions/${f.id}`, `facción "${f.name}"`)));
    return card;
  }

  function openFactionModal(fac = null) {
    const isEdit = !!fac;
    const { overlay, form, footer } = buildModal(isEdit ? 'Editar facción' : 'Nueva facción');
    form.appendChild(field('Nombre *', input('f-name', fac?.name ?? '', 'Los Guardianes del Alba')));
    form.appendChild(field('Alineamiento', select('f-align', ALIGNMENTS, fac?.alignment ?? '')));
    form.appendChild(field('Líder', input('f-leader', fac?.leader_name ?? '', 'Lady Wachter')));
    form.appendChild(field('Objetivos', textarea('f-goals', fac?.goals ?? '')));
    form.appendChild(field('Descripción', textarea('f-desc', fac?.description ?? '')));
    form.appendChild(field('Emblema (URL)', input('f-emblem', fac?.emblem_url ?? '', 'https://...')));

    footer.saveBtn.addEventListener('click', async () => {
      const name = val('f-name');
      if (!name) { toast.error('Falta el nombre'); return; }
      const body = {
        name, alignment: val('f-align') || null, leader_name: val('f-leader') || null,
        goals: val('f-goals') || null, description: val('f-desc') || null, emblem_url: val('f-emblem') || null,
      };
      await save(isEdit, `factions${isEdit ? '/' + fac.id : ''}`, body, overlay, footer);
    });
  }

  /* ── Shared save/delete ── */
  async function save(isEdit, path, body, overlay, footer) {
    footer.busy(true);
    try {
      if (isEdit) await api.put(`/campaigns/${currentCampaign}/${path}`, body);
      else await api.post(`/campaigns/${currentCampaign}/${path}`, body);
      toast.success(isEdit ? 'Guardado' : 'Creado');
      overlay.remove();
      refresh();
    } catch (err) { toast.error('Error', err.message); footer.busy(false); }
  }
  async function del(path, label) {
    if (!confirm(`¿Eliminar ${label}?`)) return;
    try { await api.del(`/campaigns/${currentCampaign}/${path}`); toast.success('Eliminado'); refresh(); }
    catch (err) { toast.error(err.message); }
  }

  syncTabs();
  refresh();

  /* ── local element helpers using shared campaign scope ── */
  function addBar(title, onAdd) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
    const h = document.createElement('h3');
    h.style.cssText = 'font-family:var(--font-display);font-size:18px;color:var(--ink);margin:0;';
    h.textContent = title;
    wrap.appendChild(h);
    if (onAdd) {
      const b = document.createElement('button');
      b.className = 'btn btn-primary'; b.style.cssText = 'padding:6px 14px;font-size:13px;';
      b.innerHTML = '<span style="font-size:16px;">+</span> Añadir';
      b.addEventListener('click', onAdd);
      wrap.appendChild(b);
    }
    return wrap;
  }
}

/* ─── MODULE HELPERS ─────────────────────────────────────────────── */
function tabStyle(active) {
  return `padding:8px 16px;font-family:var(--font-ui);font-size:14px;cursor:pointer;background:none;border:none;
    border-bottom:2px solid ${active ? 'var(--gold)' : 'transparent'};color:${active ? 'var(--gold)' : 'var(--ink-muted)'};
    font-weight:${active ? '600' : '400'};transition:all var(--dur-fast);`;
}
function gridEl() {
  const g = document.createElement('div');
  g.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;';
  return g;
}
function baseCard(accent, i) {
  const c = document.createElement('div');
  c.style.cssText = `background:var(--stone);border:1px solid var(--border);border-left:3px solid ${accent};
    border-radius:10px;padding:18px;animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${i * 40}ms both;`;
  return c;
}
function cardActions(onEdit, onDelete) {
  const a = document.createElement('div');
  a.style.cssText = 'display:flex;gap:8px;margin-top:12px;';
  a.appendChild(miniBtn('Editar', 'var(--ink-muted)', onEdit));
  a.appendChild(miniBtn('Eliminar', 'var(--crimson)', onDelete));
  return a;
}
function miniBtn(label, color, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = `background:transparent;border:1px solid var(--border);border-radius:6px;padding:4px 12px;font-size:12px;color:${color};cursor:pointer;`;
  b.addEventListener('click', onClick);
  return b;
}
function emptyEl(text) {
  const d = document.createElement('div');
  d.style.cssText = 'text-align:center;padding:40px 20px;color:var(--ink-muted);font-family:var(--font-display);font-size:16px;';
  d.textContent = text;
  return d;
}
function errBox(err) { return `<div style="color:var(--crimson);padding:20px;">Error: ${err.message}</div>`; }
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function val(id) { return (document.getElementById(id)?.value ?? '').trim(); }
function byId(id) { return document.getElementById(id); }

function grid2() { const d = document.createElement('div'); d.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;'; return d; }
function sep(text) {
  const d = document.createElement('div');
  d.style.cssText = 'font-family:var(--font-ui);font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--crimson);border-top:1px solid var(--border);padding-top:14px;margin-top:2px;';
  d.textContent = text;
  return d;
}
function field(labelText, control) {
  const g = document.createElement('div');
  const l = document.createElement('label'); l.style.cssText = LBL; l.textContent = labelText;
  g.appendChild(l); g.appendChild(control);
  return g;
}
function input(id, value, placeholder, type = 'text') {
  const i = document.createElement('input');
  i.id = id; i.className = 'input'; i.type = type; i.value = value ?? '';
  if (placeholder) i.placeholder = placeholder;
  return i;
}
function textarea(id, value) {
  const t = document.createElement('textarea');
  t.id = id; t.className = 'input'; t.rows = 3; t.style.cssText = 'resize:vertical;min-height:60px;';
  t.value = value ?? '';
  return t;
}
function select(id, opts, selected) {
  const s = document.createElement('select');
  s.id = id; s.className = 'input';
  opts.forEach(o => {
    const op = document.createElement('option');
    op.value = o.value; op.textContent = o.label;
    op.selected = String(selected) === String(o.value);
    s.appendChild(op);
  });
  return s;
}
function check(id, labelText, checked) {
  const g = document.createElement('label');
  g.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink);cursor:pointer;';
  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.id = id; cb.checked = !!checked; cb.style.cssText = 'width:16px;height:16px;';
  g.appendChild(cb); g.appendChild(document.createTextNode(labelText));
  return g;
}
function buildModal(titleText) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(9,8,10,0.8);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;animation:fadeIn var(--dur-normal) var(--ease-smooth);';
  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:12px;padding:32px;width:100%;max-width:560px;animation:modalIn var(--dur-normal) var(--ease-spring);max-height:90vh;overflow-y:auto;';
  const title = document.createElement('h3');
  title.style.cssText = 'font-family:var(--font-display);color:var(--gold);margin:0 0 24px;font-size:20px;';
  title.textContent = titleText;
  const form = document.createElement('div');
  form.style.cssText = 'display:flex;flex-direction:column;gap:16px;';
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:12px;margin-top:8px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn'; cancelBtn.style.cssText = 'flex:1;background:transparent;border:1px solid var(--border);color:var(--ink-muted);';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', () => overlay.remove());
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary'; saveBtn.style.cssText = 'flex:2;'; saveBtn.textContent = 'Guardar';
  btnRow.appendChild(cancelBtn); btnRow.appendChild(saveBtn);
  modal.appendChild(title); modal.appendChild(form); modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  const footer = { saveBtn, busy(on) { saveBtn.disabled = on; saveBtn.textContent = on ? 'Guardando...' : 'Guardar'; } };
  return { overlay, modal, form, footer };
}
