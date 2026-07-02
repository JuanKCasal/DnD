import { api } from '../js/api.js';
import { toast } from '../js/components/toast.js';
import { auth } from '../js/auth.js';

/* ─── CONFIG ─────────────────────────────────────────────────────── */
const ADV_STATUS = {
  not_started: { label: 'Sin empezar', color: 'var(--ink-muted)' },
  active:      { label: 'Activa',      color: 'var(--gold)' },
  completed:   { label: 'Completada',  color: 'var(--success)' },
  abandoned:   { label: 'Abandonada',  color: 'var(--crimson)' },
};
const QUEST_STATUS = {
  active:    { label: 'Activa',     color: 'var(--gold)' },
  completed: { label: 'Completada', color: 'var(--success)' },
  failed:    { label: 'Fallida',    color: 'var(--crimson)' },
  abandoned: { label: 'Abandonada', color: 'var(--ink-muted)' },
};
const QUEST_TYPES = [
  { value: 'main', label: 'Principal' },
  { value: 'side', label: 'Secundaria' },
  { value: 'personal', label: 'Personal' },
  { value: 'faction', label: 'Facción' },
  { value: 'fetch', label: 'Recadero' },
  { value: 'escort', label: 'Escolta' },
  { value: 'bounty', label: 'Recompensa' },
];
const QUEST_TYPE_LABEL = Object.fromEntries(QUEST_TYPES.map(t => [t.value, t.label]));

const LBL = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;';

export async function render(container) {
  container.innerHTML = '';
  const user = auth.getUser();
  const canManage = user?.role === 'admin' || user?.role === 'dm';

  let campaigns = [];
  let currentCampaign = null;
  let adventures = [];

  const page = document.createElement('div');
  page.className = 'page-quests fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:1300px;';

  /* Header + campaign selector */
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap;';
  const titleBlock = document.createElement('div');
  titleBlock.innerHTML = `
    <h2 style="font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;">᛭ Aventuras & Misiones ᛭</h2>
    <p style="color:var(--ink-muted);font-size:14px;margin:0;">Arcos narrativos y objetivos del grupo</p>`;
  const campWrap = document.createElement('div');
  const campLabel = document.createElement('label');
  campLabel.style.cssText = LBL;
  campLabel.textContent = 'Campaña';
  const campSelect = document.createElement('select');
  campSelect.className = 'input';
  campSelect.style.cssText = 'min-width:240px;';
  campWrap.appendChild(campLabel);
  campWrap.appendChild(campSelect);
  header.appendChild(titleBlock);
  header.appendChild(campWrap);
  page.appendChild(header);

  const advSection = document.createElement('section');
  advSection.style.cssText = 'margin-bottom:36px;';
  const questSection = document.createElement('section');
  page.appendChild(advSection);
  page.appendChild(questSection);
  container.appendChild(page);

  /* ── Load campaigns ── */
  try {
    const res = await api.get('/campaigns');
    campaigns = res.data ?? [];
  } catch (err) {
    page.innerHTML = `<div style="color:var(--crimson);padding:40px;">Error al cargar campañas: ${err.message}</div>`;
    return;
  }
  if (!campaigns.length) {
    advSection.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--ink-muted);">
      <div style="font-size:40px;margin-bottom:12px;">🗺️</div>
      <div style="font-family:var(--font-display);font-size:18px;color:var(--ink);">No hay campañas</div>
      <div style="margin-top:6px;font-size:13px;">Crea una campaña primero para gestionar sus aventuras y misiones.</div>
    </div>`;
    return;
  }
  campaigns.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    campSelect.appendChild(opt);
  });
  currentCampaign = campaigns[0].id;
  campSelect.value = currentCampaign;
  campSelect.addEventListener('change', () => { currentCampaign = campSelect.value; loadAll(); });

  /* ── Loaders ── */
  async function loadAll() { await loadAdventures(); await loadQuests(); }

  async function loadAdventures() {
    advSection.innerHTML = '';
    advSection.appendChild(sectionHeaderEl('Aventuras', canManage ? () => openAdventureModal() : null));
    const body = document.createElement('div');
    body.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-top:16px;';
    advSection.appendChild(body);
    try {
      const res = await api.get(`/campaigns/${currentCampaign}/adventures`);
      adventures = res.data ?? [];
    } catch (err) { body.innerHTML = `<div style="color:var(--crimson);">Error: ${err.message}</div>`; return; }
    if (!adventures.length) { body.innerHTML = emptyHint('Sin aventuras aún', canManage ? 'Crea el primer arco narrativo.' : ''); return; }
    adventures.forEach((a, i) => body.appendChild(adventureCard(a, i)));
  }

  async function loadQuests() {
    questSection.innerHTML = '';
    questSection.appendChild(sectionHeaderEl('Misiones', canManage ? () => openQuestModal() : null));
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:12px;margin-top:16px;';
    questSection.appendChild(body);
    let quests = [];
    try {
      const res = await api.get(`/campaigns/${currentCampaign}/quests`);
      quests = res.data ?? [];
    } catch (err) { body.innerHTML = `<div style="color:var(--crimson);">Error: ${err.message}</div>`; return; }
    if (!quests.length) { body.innerHTML = emptyHint('Sin misiones aún', canManage ? 'Registra la primera quest.' : ''); return; }
    quests.forEach((q, i) => body.appendChild(questCard(q, i)));
  }

  function sectionHeaderEl(title, onAdd) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:8px;';
    const h = document.createElement('h3');
    h.style.cssText = 'font-family:var(--font-display);font-size:20px;color:var(--ink);margin:0;';
    h.textContent = title;
    wrap.appendChild(h);
    if (onAdd) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.style.cssText = 'padding:6px 14px;font-size:13px;';
      btn.innerHTML = '<span style="font-size:16px;">+</span> Añadir';
      btn.addEventListener('click', onAdd);
      wrap.appendChild(btn);
    }
    return wrap;
  }

  /* ── Adventure card ── */
  function adventureCard(a, index) {
    const cfg = ADV_STATUS[a.status] ?? ADV_STATUS.not_started;
    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-left:3px solid ${cfg.color};
      border-radius:10px;padding:18px;position:relative;
      animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${index * 50}ms both;`;
    const lvl = (a.rec_level_min || a.rec_level_max)
      ? `<span style="font-family:var(--font-mono);color:var(--ink-muted);font-size:12px;">Niv ${a.rec_level_min ?? '?'}–${a.rec_level_max ?? '?'}</span>` : '';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
        <div style="font-family:var(--font-display);font-size:16px;color:var(--ink);padding-right:8px;">${esc(a.title)}</div>
        <span style="font-size:10px;font-weight:600;text-transform:uppercase;color:${cfg.color};white-space:nowrap;">${cfg.label}</span>
      </div>
      ${a.module_name ? `<div style="font-size:11px;color:var(--gold-dim);margin-top:2px;">📕 ${esc(a.module_name)}</div>` : ''}
      ${a.description ? `<p style="font-size:13px;color:var(--ink-muted);line-height:1.5;margin:8px 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${esc(a.description)}</p>` : '<div style="height:8px;"></div>'}
      <div style="display:flex;gap:12px;align-items:center;font-size:12px;color:var(--ink-faint);border-top:1px solid var(--border);padding-top:8px;margin-top:6px;">
        ${lvl}
        <span title="Sesiones">📜 ${a.session_count ?? 0}</span>
        <span title="Misiones">⚔️ ${a.quest_count ?? 0}</span>
        ${a.visible_to_players ? '' : '<span title="Oculta a jugadores" style="color:var(--crimson);">🔒 DM</span>'}
      </div>`;
    if (canManage) {
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:8px;margin-top:10px;';
      actions.appendChild(miniBtn('Editar', 'var(--ink-muted)', () => openAdventureModal(a)));
      actions.appendChild(miniBtn('Eliminar', 'var(--crimson)', async () => {
        if (!confirm(`¿Eliminar la aventura "${a.title}"?`)) return;
        try { await api.del(`/campaigns/${currentCampaign}/adventures/${a.id}`); toast.success('Aventura eliminada'); loadAll(); }
        catch (err) { toast.error(err.message); }
      }));
      card.appendChild(actions);
    }
    return card;
  }

  /* ── Quest card ── */
  function questCard(q, index) {
    const cfg = QUEST_STATUS[q.status] ?? QUEST_STATUS.active;
    const objs = Array.isArray(q.objectives) ? q.objectives : [];
    const done = objs.filter(o => o.completed).length;
    const adv = adventures.find(a => a.id === q.adventure_id);
    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-left:3px solid ${cfg.color};
      border-radius:10px;padding:18px 20px;position:relative;
      animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${index * 40}ms both;`;

    const rewards = [];
    if (q.reward_xp) rewards.push(`✨ ${q.reward_xp} XP`);
    if (q.reward_gp) rewards.push(`🪙 ${q.reward_gp} po`);
    if (q.reward_description) rewards.push(esc(q.reward_description));

    const objList = objs.length
      ? `<ul style="list-style:none;padding:0;margin:8px 0 0;display:flex;flex-direction:column;gap:4px;">
          ${objs.map(o => `<li style="font-size:13px;color:${o.completed ? 'var(--ink-faint)' : 'var(--ink)'};${o.completed ? 'text-decoration:line-through;' : ''}">
            ${o.completed ? '☑' : '☐'} ${esc(o.text)}${o.optional ? ' <span style="font-size:10px;color:var(--ink-faint);">(opcional)</span>' : ''}</li>`).join('')}
        </ul>` : '';

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
        <div>
          <div style="font-family:var(--font-display);font-size:17px;color:var(--ink);">${esc(q.title)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:11px;">
            <span style="text-transform:uppercase;letter-spacing:0.05em;color:var(--gold-dim);border:1px solid var(--gold-glow);background:var(--gold-glow);padding:1px 8px;border-radius:10px;">${QUEST_TYPE_LABEL[q.quest_type] ?? q.quest_type}</span>
            ${adv ? `<span style="color:var(--ink-muted);">📖 ${esc(adv.title)}</span>` : ''}
            ${q.quest_giver_name ? `<span style="color:var(--ink-muted);">🧑 ${esc(q.quest_giver_name)}</span>` : ''}
            ${objs.length ? `<span style="color:var(--ink-muted);font-family:var(--font-mono);">${done}/${objs.length} objetivos</span>` : ''}
            ${q.visible_to_players ? '' : '<span title="Oculta a jugadores" style="color:var(--crimson);">🔒 DM</span>'}
          </div>
        </div>
        <span style="font-size:11px;font-weight:600;text-transform:uppercase;color:${cfg.color};white-space:nowrap;">${cfg.label}</span>
      </div>
      ${q.description ? `<p style="font-size:13px;color:var(--ink-muted);line-height:1.5;margin:8px 0 0;">${esc(q.description)}</p>` : ''}
      ${objList}
      ${rewards.length ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:10px;">Recompensa: ${rewards.join(' · ')}</div>` : ''}`;

    if (canManage) {
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:8px;margin-top:12px;';
      actions.appendChild(miniBtn('Editar', 'var(--ink-muted)', () => openQuestModal(q)));
      actions.appendChild(miniBtn('Eliminar', 'var(--crimson)', async () => {
        if (!confirm(`¿Eliminar la misión "${q.title}"?`)) return;
        try { await api.del(`/campaigns/${currentCampaign}/quests/${q.id}`); toast.success('Misión eliminada'); loadQuests(); }
        catch (err) { toast.error(err.message); }
      }));
      card.appendChild(actions);
    }
    return card;
  }

  /* ── Adventure modal ── */
  function openAdventureModal(adv = null) {
    const isEdit = !!adv;
    const { overlay, form, footer } = buildModal(isEdit ? 'Editar aventura' : 'Nueva aventura');

    form.appendChild(field('Título *', input('adv-title', adv?.title ?? '', 'El asedio de Barovia')));
    form.appendChild(field('Descripción', textarea('adv-desc', adv?.description ?? '')));
    form.appendChild(field('Módulo publicado', input('adv-module', adv?.module_name ?? '', 'Curse of Strahd')));

    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
    row.appendChild(field('Estado', select('adv-status', Object.entries(ADV_STATUS).map(([v, c]) => ({ value: v, label: c.label })), adv?.status ?? 'not_started')));
    row.appendChild(field('Orden', input('adv-order', adv?.sort_order ?? 0, '0', 'number')));
    form.appendChild(row);

    const lvlRow = document.createElement('div');
    lvlRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
    lvlRow.appendChild(field('Nivel mín. recomendado', numInput('adv-lmin', adv?.rec_level_min)));
    lvlRow.appendChild(field('Nivel máx. recomendado', numInput('adv-lmax', adv?.rec_level_max)));
    form.appendChild(lvlRow);

    form.appendChild(field('Notas del DM (privadas)', textarea('adv-dmnotes', adv?.dm_notes ?? '')));
    form.appendChild(checkboxRow('adv-visible', 'Visible para jugadores', adv ? adv.visible_to_players : true));

    footer.saveBtn.addEventListener('click', async () => {
      const title = val('adv-title');
      if (!title) { toast.error('Falta el título'); return; }
      const body = {
        title,
        description: val('adv-desc') || null,
        module_name: val('adv-module') || null,
        status: val('adv-status'),
        sort_order: intOr('adv-order', 0),
        rec_level_min: intOrNull('adv-lmin'),
        rec_level_max: intOrNull('adv-lmax'),
        dm_notes: val('adv-dmnotes') || null,
        visible_to_players: document.getElementById('adv-visible').checked,
      };
      footer.busy(true);
      try {
        if (isEdit) await api.put(`/campaigns/${currentCampaign}/adventures/${adv.id}`, body);
        else await api.post(`/campaigns/${currentCampaign}/adventures`, body);
        toast.success(isEdit ? 'Aventura actualizada' : 'Aventura creada');
        overlay.remove();
        loadAll();
      } catch (err) { toast.error('Error', err.message); footer.busy(false); }
    });
  }

  /* ── Quest modal ── */
  function openQuestModal(quest = null) {
    const isEdit = !!quest;
    const { overlay, form, footer } = buildModal(isEdit ? 'Editar misión' : 'Nueva misión');

    form.appendChild(field('Título *', input('q-title', quest?.title ?? '', 'Rescatar al burgomaestre')));
    form.appendChild(field('Descripción', textarea('q-desc', quest?.description ?? '')));

    const row1 = document.createElement('div');
    row1.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
    row1.appendChild(field('Tipo', select('q-type', QUEST_TYPES, quest?.quest_type ?? 'side')));
    row1.appendChild(field('Estado', select('q-status', Object.entries(QUEST_STATUS).map(([v, c]) => ({ value: v, label: c.label })), quest?.status ?? 'active')));
    form.appendChild(row1);

    const advOpts = [{ value: '', label: '— Ninguna —' }, ...adventures.map(a => ({ value: a.id, label: a.title }))];
    form.appendChild(field('Aventura', select('q-adventure', advOpts, quest?.adventure_id ?? '')));

    const row2 = document.createElement('div');
    row2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
    row2.appendChild(field('Recompensa XP', input('q-xp', quest?.reward_xp ?? 0, '0', 'number')));
    row2.appendChild(field('Recompensa (po)', input('q-gp', quest?.reward_gp ?? 0, '0', 'number')));
    form.appendChild(row2);
    form.appendChild(field('Recompensa (descripción)', input('q-reward', quest?.reward_description ?? '', 'Un anillo mágico')));

    /* Objectives editor */
    const objLabel = document.createElement('label');
    objLabel.style.cssText = LBL;
    objLabel.textContent = 'Objetivos';
    const objBox = document.createElement('div');
    objBox.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    (quest?.objectives ?? []).forEach(o => objBox.appendChild(objectiveRow(o)));
    const addObjBtn = document.createElement('button');
    addObjBtn.type = 'button';
    addObjBtn.className = 'btn';
    addObjBtn.style.cssText = 'align-self:flex-start;background:transparent;border:1px dashed var(--border);color:var(--ink-muted);font-size:12px;padding:4px 12px;';
    addObjBtn.textContent = '+ Objetivo';
    addObjBtn.addEventListener('click', () => objBox.appendChild(objectiveRow()));
    const objGroup = document.createElement('div');
    objGroup.appendChild(objLabel);
    objGroup.appendChild(objBox);
    objGroup.appendChild(addObjBtn);
    form.appendChild(objGroup);

    form.appendChild(field('Notas', textarea('q-notes', quest?.notes ?? '')));
    form.appendChild(checkboxRow('q-visible', 'Visible para jugadores', quest ? quest.visible_to_players : true));

    footer.saveBtn.addEventListener('click', async () => {
      const title = val('q-title');
      if (!title) { toast.error('Falta el título'); return; }
      const objectives = [...objBox.querySelectorAll('[data-obj-row]')].map(r => ({
        text: r.querySelector('[data-obj-text]').value.trim(),
        completed: r.querySelector('[data-obj-done]').checked,
        optional: r.querySelector('[data-obj-opt]').checked,
      })).filter(o => o.text);
      const body = {
        title,
        description: val('q-desc') || null,
        quest_type: val('q-type'),
        status: val('q-status'),
        adventure_id: val('q-adventure') || null,
        reward_xp: intOr('q-xp', 0),
        reward_gp: parseFloat(val('q-gp')) || 0,
        reward_description: val('q-reward') || null,
        objectives,
        notes: val('q-notes') || null,
        visible_to_players: document.getElementById('q-visible').checked,
      };
      footer.busy(true);
      try {
        if (isEdit) await api.put(`/campaigns/${currentCampaign}/quests/${quest.id}`, body);
        else await api.post(`/campaigns/${currentCampaign}/quests`, body);
        toast.success(isEdit ? 'Misión actualizada' : 'Misión creada');
        overlay.remove();
        loadQuests();
      } catch (err) { toast.error('Error', err.message); footer.busy(false); }
    });
  }

  loadAll();
}

/* ─── SMALL HELPERS (module scope) ───────────────────────────────── */
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function val(id) { return (document.getElementById(id)?.value ?? '').trim(); }
function intOr(id, def) { const n = parseInt(val(id), 10); return Number.isFinite(n) ? n : def; }
function intOrNull(id) { const n = parseInt(val(id), 10); return Number.isFinite(n) ? n : null; }

function emptyHint(title, sub) {
  return `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--ink-muted);">
    <div style="font-family:var(--font-display);font-size:16px;color:var(--ink);">${title}</div>
    ${sub ? `<div style="margin-top:6px;font-size:13px;">${sub}</div>` : ''}</div>`;
}

function miniBtn(label, color, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = `background:transparent;border:1px solid var(--border);border-radius:6px;padding:4px 12px;font-size:12px;color:${color};cursor:pointer;transition:all var(--dur-fast);`;
  b.addEventListener('click', onClick);
  return b;
}

function field(labelText, control) {
  const g = document.createElement('div');
  const l = document.createElement('label');
  l.style.cssText = LBL;
  l.textContent = labelText;
  g.appendChild(l);
  g.appendChild(control);
  return g;
}
function input(id, value, placeholder, type = 'text') {
  const i = document.createElement('input');
  i.id = id; i.className = 'input'; i.type = type; i.value = value ?? '';
  if (placeholder) i.placeholder = placeholder;
  return i;
}
function numInput(id, value) {
  const i = input(id, value ?? '', '1–20', 'number');
  i.min = '1'; i.max = '20';
  return i;
}
function textarea(id, value) {
  const t = document.createElement('textarea');
  t.id = id; t.className = 'input'; t.rows = 3; t.style.cssText = 'resize:vertical;min-height:64px;';
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
function checkboxRow(id, labelText, checked) {
  const g = document.createElement('label');
  g.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink);cursor:pointer;';
  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.id = id; cb.checked = !!checked;
  cb.style.cssText = 'width:16px;height:16px;';
  g.appendChild(cb);
  g.appendChild(document.createTextNode(labelText));
  return g;
}
function objectiveRow(o = {}) {
  const row = document.createElement('div');
  row.setAttribute('data-obj-row', '');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;';
  const done = document.createElement('input');
  done.type = 'checkbox'; done.setAttribute('data-obj-done', ''); done.checked = !!o.completed;
  done.title = 'Completado'; done.style.cssText = 'width:16px;height:16px;flex-shrink:0;';
  const text = document.createElement('input');
  text.className = 'input'; text.setAttribute('data-obj-text', ''); text.value = o.text ?? '';
  text.placeholder = 'Objetivo...'; text.style.cssText = 'flex:1;';
  const optWrap = document.createElement('label');
  optWrap.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:11px;color:var(--ink-muted);white-space:nowrap;';
  const opt = document.createElement('input');
  opt.type = 'checkbox'; opt.setAttribute('data-obj-opt', ''); opt.checked = !!o.optional;
  optWrap.appendChild(opt); optWrap.appendChild(document.createTextNode('opc.'));
  const rm = document.createElement('button');
  rm.type = 'button'; rm.textContent = '✕';
  rm.style.cssText = 'background:transparent;border:none;color:var(--crimson);cursor:pointer;font-size:14px;';
  rm.addEventListener('click', () => row.remove());
  row.appendChild(done); row.appendChild(text); row.appendChild(optWrap); row.appendChild(rm);
  return row;
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
  cancelBtn.className = 'btn';
  cancelBtn.style.cssText = 'flex:1;background:transparent;border:1px solid var(--border);color:var(--ink-muted);';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', () => overlay.remove());
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.style.cssText = 'flex:2;';
  saveBtn.textContent = 'Guardar';
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);

  modal.appendChild(title);
  modal.appendChild(form);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  const footer = {
    saveBtn,
    busy(on) { saveBtn.disabled = on; saveBtn.textContent = on ? 'Guardando...' : 'Guardar'; },
  };
  return { overlay, modal, form, footer };
}
