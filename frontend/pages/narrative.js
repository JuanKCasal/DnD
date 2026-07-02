import { api } from '../js/api.js';
import { toast } from '../js/components/toast.js';
import { auth } from '../js/auth.js';

/* ─── CONFIG ─────────────────────────────────────────────────────── */
const ARC_TYPES = [
  { value: 'main', label: 'Principal' }, { value: 'side', label: 'Secundario' },
  { value: 'character', label: 'De personaje' }, { value: 'faction', label: 'De facción' },
];
const ARC_TYPE_LABEL = Object.fromEntries(ARC_TYPES.map(t => [t.value, t.label]));
const ARC_STATUS = {
  not_started: { label: 'Sin empezar', color: 'var(--ink-muted)' },
  active: { label: 'Activo', color: 'var(--gold)' },
  resolved: { label: 'Resuelto', color: 'var(--success)' },
  failed: { label: 'Fallido', color: 'var(--crimson)' },
  abandoned: { label: 'Abandonado', color: 'var(--ink-faint)' },
};
const LBL = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;';

export async function render(container) {
  container.innerHTML = '';
  const user = auth.getUser();
  const canManage = user?.role === 'admin' || user?.role === 'dm';

  let campaigns = [];
  let currentCampaign = null;
  let arcs = [];

  const page = document.createElement('div');
  page.className = 'page-narrative fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:1300px;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;gap:16px;flex-wrap:wrap;';
  header.innerHTML = `<div>
      <h2 style="font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;">᛭ Trama ᛭</h2>
      <p style="color:var(--ink-muted);font-size:14px;margin:0;">Arcos, giros y recompensas</p></div>`;
  const right = document.createElement('div');
  right.style.cssText = 'display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;';
  const campWrap = document.createElement('div');
  const cl = document.createElement('label'); cl.style.cssText = LBL; cl.textContent = 'Campaña';
  const campSelect = document.createElement('select'); campSelect.className = 'input'; campSelect.style.cssText = 'min-width:220px;';
  campWrap.appendChild(cl); campWrap.appendChild(campSelect);
  const rewardBtn = document.createElement('button');
  rewardBtn.className = 'btn'; rewardBtn.textContent = '💰 Recompensas por nivel';
  rewardBtn.style.cssText = 'background:var(--gold-glow);border:1px solid var(--gold-dim);color:var(--gold);';
  rewardBtn.addEventListener('click', openTreasureModal);
  right.appendChild(campWrap);
  if (canManage) right.appendChild(rewardBtn);
  header.appendChild(right);
  page.appendChild(header);

  const arcSection = document.createElement('section');
  arcSection.style.cssText = 'margin-bottom:36px;';
  const twistSection = document.createElement('section');
  page.appendChild(arcSection); page.appendChild(twistSection);
  container.appendChild(page);

  try { campaigns = (await api.get('/campaigns')).data ?? []; }
  catch (err) { page.innerHTML = `<div style="color:var(--crimson);padding:40px;">Error: ${err.message}</div>`; return; }
  if (!campaigns.length) {
    arcSection.innerHTML = `<div style="text-align:center;padding:60px;color:var(--ink-muted);"><div style="font-size:40px;">🎭</div>
      <div style="font-family:var(--font-display);font-size:18px;color:var(--ink);margin-top:8px;">No hay campañas</div></div>`;
    return;
  }
  campaigns.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; campSelect.appendChild(o); });
  currentCampaign = campaigns[0].id;
  campSelect.addEventListener('change', () => { currentCampaign = campSelect.value; refresh(); });

  async function refresh() { await loadArcs(); await loadTwists(); }

  /* ── Arcs ── */
  async function loadArcs() {
    arcSection.innerHTML = '';
    arcSection.appendChild(sectionHead('Arcos argumentales', canManage ? () => openArcModal() : null));
    const box = document.createElement('div');
    box.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-top:16px;';
    arcSection.appendChild(box);
    try { arcs = (await api.get(`/campaigns/${currentCampaign}/arcs`)).data ?? []; }
    catch (err) { box.innerHTML = errBox(err); return; }
    if (!arcs.length) { box.innerHTML = emptyEl('Sin arcos aún'); return; }
    arcs.forEach((a, i) => box.appendChild(arcCard(a, i)));
  }

  function arcCard(a, i) {
    const st = ARC_STATUS[a.status] ?? ARC_STATUS.active;
    const beats = Array.isArray(a.beats) ? a.beats : [];
    const done = beats.filter(b => b.completed).length;
    const card = baseCard(st.color, i);
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
        <div style="font-family:var(--font-display);font-size:16px;color:var(--ink);">${esc(a.title)}</div>
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:${st.color};white-space:nowrap;">${st.label}</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:11px;color:var(--ink-faint);">
        <span style="text-transform:uppercase;letter-spacing:0.05em;color:var(--gold-dim);border:1px solid var(--gold-glow);background:var(--gold-glow);padding:1px 8px;border-radius:10px;">${ARC_TYPE_LABEL[a.arc_type] ?? a.arc_type}</span>
        ${beats.length ? `<span style="font-family:var(--font-mono);">${done}/${beats.length} beats</span>` : ''}
        ${a.visible_to_players ? '' : '<span style="color:var(--crimson);">🔒 DM</span>'}
      </div>
      ${a.description ? `<p style="font-size:13px;color:var(--ink-muted);line-height:1.5;margin:8px 0 0;">${esc(a.description)}</p>` : ''}
      ${beats.length ? `<ul style="list-style:none;padding:0;margin:8px 0 0;display:flex;flex-direction:column;gap:3px;">
        ${beats.map(b => `<li style="font-size:12px;color:${b.completed ? 'var(--ink-faint)' : 'var(--ink)'};${b.completed ? 'text-decoration:line-through;' : ''}">${b.completed ? '☑' : '☐'} ${esc(b.title)}</li>`).join('')}
      </ul>` : ''}`;
    if (canManage) card.appendChild(cardActions(() => openArcModal(a), () => del(`arcs/${a.id}`, `arco "${a.title}"`)));
    return card;
  }

  function openArcModal(arc = null) {
    const isEdit = !!arc;
    const { overlay, form, footer } = buildModal(isEdit ? 'Editar arco' : 'Nuevo arco');
    form.appendChild(field('Título *', input('a-title', arc?.title ?? '', 'La sombra del culto')));
    form.appendChild(field('Descripción', textarea('a-desc', arc?.description ?? '')));
    const r1 = grid2();
    r1.appendChild(field('Tipo', select('a-type', ARC_TYPES, arc?.arc_type ?? 'main')));
    r1.appendChild(field('Estado', select('a-status', Object.entries(ARC_STATUS).map(([v, c]) => ({ value: v, label: c.label })), arc?.status ?? 'active')));
    form.appendChild(r1);

    const beatsLabel = document.createElement('label'); beatsLabel.style.cssText = LBL; beatsLabel.textContent = 'Beats (momentos clave)';
    const beatsBox = document.createElement('div'); beatsBox.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    (arc?.beats ?? []).forEach(b => beatsBox.appendChild(beatRow(b)));
    const addBeat = document.createElement('button');
    addBeat.type = 'button'; addBeat.className = 'btn'; addBeat.textContent = '+ Beat';
    addBeat.style.cssText = 'align-self:flex-start;background:transparent;border:1px dashed var(--border);color:var(--ink-muted);font-size:12px;padding:4px 12px;';
    addBeat.addEventListener('click', () => beatsBox.appendChild(beatRow()));
    const bg = document.createElement('div'); bg.appendChild(beatsLabel); bg.appendChild(beatsBox); bg.appendChild(addBeat);
    form.appendChild(bg);

    form.appendChild(field('Notas del DM', textarea('a-notes', arc?.notes ?? '')));
    form.appendChild(check('a-visible', 'Visible para jugadores', arc ? arc.visible_to_players : true));

    footer.saveBtn.addEventListener('click', async () => {
      const title = val('a-title');
      if (!title) { toast.error('Falta el título'); return; }
      const beats = [...beatsBox.querySelectorAll('[data-beat]')].map(r => ({
        title: r.querySelector('[data-beat-title]').value.trim(),
        completed: r.querySelector('[data-beat-done]').checked,
      })).filter(b => b.title);
      const body = {
        title, description: val('a-desc') || null, arc_type: val('a-type'), status: val('a-status'),
        beats, notes: val('a-notes') || null, visible_to_players: byId('a-visible').checked,
      };
      await save(isEdit, `arcs${isEdit ? '/' + arc.id : ''}`, body, overlay, footer, loadArcs);
    });
  }

  function beatRow(b = {}) {
    const row = document.createElement('div');
    row.setAttribute('data-beat', ''); row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const done = document.createElement('input'); done.type = 'checkbox'; done.setAttribute('data-beat-done', ''); done.checked = !!b.completed; done.style.cssText = 'width:16px;height:16px;';
    const t = document.createElement('input'); t.className = 'input'; t.setAttribute('data-beat-title', ''); t.value = b.title ?? ''; t.placeholder = 'Momento clave...'; t.style.flex = '1';
    const rm = document.createElement('button'); rm.type = 'button'; rm.textContent = '✕'; rm.style.cssText = 'background:transparent;border:none;color:var(--crimson);cursor:pointer;';
    rm.addEventListener('click', () => row.remove());
    row.appendChild(done); row.appendChild(t); row.appendChild(rm);
    return row;
  }

  /* ── Plot twists (DM) ── */
  async function loadTwists() {
    twistSection.innerHTML = '';
    twistSection.appendChild(sectionHead('Giros argumentales', canManage ? () => openTwistModal() : null));
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--ink-faint);margin:4px 0 12px;';
    hint.textContent = canManage ? 'Los jugadores solo ven los giros marcados como "revelado".' : 'Giros ya revelados.';
    twistSection.appendChild(hint);
    const box = document.createElement('div');
    box.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;';
    twistSection.appendChild(box);
    let twists = [];
    try { twists = (await api.get(`/campaigns/${currentCampaign}/plot-twists`)).data ?? []; }
    catch (err) { box.innerHTML = errBox(err); return; }
    if (!twists.length) { box.innerHTML = emptyEl('Sin giros aún'); return; }
    twists.forEach((t, i) => box.appendChild(twistCard(t, i)));
  }

  function twistCard(t, i) {
    const arc = arcs.find(a => a.id === t.arc_id);
    const card = baseCard(t.revealed ? 'var(--success)' : 'var(--crimson)', i);
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
        <div style="font-family:var(--font-display);font-size:16px;color:var(--ink);">${esc(t.title)}</div>
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:${t.revealed ? 'var(--success)' : 'var(--crimson)'};white-space:nowrap;">${t.revealed ? 'Revelado' : 'Oculto'}</span>
      </div>
      ${arc ? `<div style="font-size:11px;color:var(--ink-faint);margin-top:2px;">📖 ${esc(arc.title)}</div>` : ''}
      ${t.description ? `<p style="font-size:13px;color:var(--ink-muted);line-height:1.5;margin:8px 0 0;">${esc(t.description)}</p>` : ''}
      ${(t.setup_clues || []).length ? `<div style="font-size:12px;color:var(--gold-dim);margin-top:6px;">🔎 ${t.setup_clues.map(esc).join(' · ')}</div>` : ''}
      ${t.reveal_condition ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:6px;">Se revela: ${esc(t.reveal_condition)}</div>` : ''}
      ${t.impact ? `<div style="font-size:12px;color:var(--crimson);margin-top:6px;">💥 ${esc(t.impact)}</div>` : ''}`;
    if (canManage) {
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:8px;margin-top:12px;';
      actions.appendChild(miniBtn(t.revealed ? 'Ocultar' : 'Revelar', 'var(--gold)', async () => {
        try { await api.put(`/campaigns/${currentCampaign}/plot-twists/${t.id}`, { revealed: !t.revealed }); loadTwists(); }
        catch (err) { toast.error(err.message); }
      }));
      actions.appendChild(miniBtn('Editar', 'var(--ink-muted)', () => openTwistModal(t)));
      actions.appendChild(miniBtn('Eliminar', 'var(--crimson)', () => del(`plot-twists/${t.id}`, `giro "${t.title}"`, loadTwists)));
      card.appendChild(actions);
    }
    return card;
  }

  function openTwistModal(twist = null) {
    const isEdit = !!twist;
    const { overlay, form, footer } = buildModal(isEdit ? 'Editar giro' : 'Nuevo giro');
    form.appendChild(field('Título *', input('t-title', twist?.title ?? '', 'El aliado es el villano')));
    form.appendChild(field('El giro (descripción)', textarea('t-desc', twist?.description ?? '')));
    const arcOpts = [{ value: '', label: '— Ninguno —' }, ...arcs.map(a => ({ value: a.id, label: a.title }))];
    form.appendChild(field('Arco', select('t-arc', arcOpts, twist?.arc_id ?? '')));
    form.appendChild(field('Pistas sembradas (separadas por comas)', input('t-clues', (twist?.setup_clues ?? []).join(', '), 'carta extraña, símbolo repetido')));
    form.appendChild(field('Condición de revelación', input('t-cond', twist?.reveal_condition ?? '', 'Al entrar a la cripta')));
    form.appendChild(field('Impacto', textarea('t-impact', twist?.impact ?? '')));
    const flags = document.createElement('div'); flags.style.cssText = 'display:flex;gap:20px;';
    flags.appendChild(check('t-revealed', 'Revelado', twist ? twist.revealed : false));
    flags.appendChild(check('t-dmonly', 'Solo DM', twist ? twist.dm_only : true));
    form.appendChild(flags);

    footer.saveBtn.addEventListener('click', async () => {
      const title = val('t-title');
      if (!title) { toast.error('Falta el título'); return; }
      const body = {
        title, description: val('t-desc') || null, arc_id: val('t-arc') || null,
        setup_clues: val('t-clues').split(',').map(s => s.trim()).filter(Boolean),
        reveal_condition: val('t-cond') || null, impact: val('t-impact') || null,
        revealed: byId('t-revealed').checked, dm_only: byId('t-dmonly').checked,
      };
      await save(isEdit, `plot-twists${isEdit ? '/' + twist.id : ''}`, body, overlay, footer, loadTwists);
    });
  }

  /* ── Treasure guidance ── */
  async function openTreasureModal() {
    const { form } = buildModalPlain('💰 Recompensas por nivel (DMG §13)');
    const lvlWrap = document.createElement('div');
    lvlWrap.appendChild(field('Nivel del grupo', numInput('tr-level', 5, 1, 20)));
    form.appendChild(lvlWrap);
    const out = document.createElement('div');
    out.style.cssText = 'margin-top:8px;';
    form.appendChild(out);

    async function refreshGuide() {
      const lvl = parseInt(val('tr-level'), 10) || 1;
      try {
        const res = await api.get(`/campaigns/${currentCampaign}/treasure-guidance?party_level=${lvl}`);
        const d = res.data; const g = d.current; const rl = d.rarity_labels;
        out.innerHTML = `
          <div style="background:var(--gold-glow);border:1px solid var(--gold-dim);border-radius:10px;padding:14px 16px;">
            <div style="font-family:var(--font-display);color:var(--gold);">Nivel ${g.party_level} · Tier ${g.tier}</div>
            <div style="font-size:13px;color:var(--ink);margin-top:6px;"><b>Tesoro acumulado (hoard):</b> ${esc(g.hoard)}</div>
            <div style="font-size:13px;color:var(--ink);margin-top:4px;"><b>Individual:</b> ${esc(g.individual)}</div>
            <div style="font-size:13px;color:var(--ink);margin-top:4px;"><b>Objetos mágicos:</b> ${g.magic_item_rarities.map(r => rl[r] || r).join(', ')}</div>
          </div>
          <div style="font-size:11px;color:var(--ink-faint);margin-top:10px;">Tabla completa: ${d.table.map(t => `${t.tier} (${t.magic_item_rarities.map(r => rl[r] || r).join('/')})`).join(' · ')}</div>`;
      } catch (err) { out.innerHTML = `<div style="color:var(--crimson);">${err.message}</div>`; }
    }
    byId('tr-level').addEventListener('input', refreshGuide);
    refreshGuide();
  }

  /* ── shared save/delete ── */
  async function save(isEdit, path, body, overlay, footer, reload) {
    footer.busy(true);
    try {
      if (isEdit) await api.put(`/campaigns/${currentCampaign}/${path}`, body);
      else await api.post(`/campaigns/${currentCampaign}/${path}`, body);
      toast.success(isEdit ? 'Guardado' : 'Creado');
      overlay.remove(); reload();
    } catch (err) { toast.error('Error', err.message); footer.busy(false); }
  }
  async function del(path, label, reload) {
    if (!confirm(`¿Eliminar ${label}?`)) return;
    try { await api.del(`/campaigns/${currentCampaign}/${path}`); toast.success('Eliminado'); (reload || refresh)(); }
    catch (err) { toast.error(err.message); }
  }

  refresh();
}

/* ─── HELPERS ─────────────────────────────────────────────────────── */
function sectionHead(title, onAdd) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:8px;';
  const h = document.createElement('h3'); h.style.cssText = 'font-family:var(--font-display);font-size:20px;color:var(--ink);margin:0;'; h.textContent = title;
  wrap.appendChild(h);
  if (onAdd) { const b = document.createElement('button'); b.className = 'btn btn-primary'; b.style.cssText = 'padding:6px 14px;font-size:13px;'; b.innerHTML = '<span style="font-size:16px;">+</span> Añadir'; b.addEventListener('click', onAdd); wrap.appendChild(b); }
  return wrap;
}
function baseCard(accent, i) { const c = document.createElement('div'); c.style.cssText = `background:var(--stone);border:1px solid var(--border);border-left:3px solid ${accent};border-radius:10px;padding:18px;animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${i * 40}ms both;`; return c; }
function cardActions(onEdit, onDelete) { const a = document.createElement('div'); a.style.cssText = 'display:flex;gap:8px;margin-top:12px;'; a.appendChild(miniBtn('Editar', 'var(--ink-muted)', onEdit)); a.appendChild(miniBtn('Eliminar', 'var(--crimson)', onDelete)); return a; }
function miniBtn(label, color, onClick) { const b = document.createElement('button'); b.textContent = label; b.style.cssText = `background:transparent;border:1px solid var(--border);border-radius:6px;padding:4px 12px;font-size:12px;color:${color};cursor:pointer;`; b.addEventListener('click', onClick); return b; }
function emptyEl(text) { const d = document.createElement('div'); d.style.cssText = 'grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--ink-muted);font-family:var(--font-display);font-size:16px;'; d.textContent = text; return d; }
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
function buildModal(titleText) { return buildModalBase(titleText, true); }
function buildModalPlain(titleText) { return buildModalBase(titleText, false); }
function buildModalBase(titleText, withFooter) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(9,8,10,0.8);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;animation:fadeIn var(--dur-normal) var(--ease-smooth);';
  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:12px;padding:32px;width:100%;max-width:560px;animation:modalIn var(--dur-normal) var(--ease-spring);max-height:90vh;overflow-y:auto;';
  const title = document.createElement('h3'); title.style.cssText = 'font-family:var(--font-display);color:var(--gold);margin:0 0 24px;font-size:20px;'; title.textContent = titleText;
  const form = document.createElement('div'); form.style.cssText = 'display:flex;flex-direction:column;gap:16px;';
  modal.appendChild(title); modal.appendChild(form);
  let footer = null;
  if (withFooter) {
    const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:12px;margin-top:8px;';
    const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn'; cancelBtn.style.cssText = 'flex:1;background:transparent;border:1px solid var(--border);color:var(--ink-muted);'; cancelBtn.textContent = 'Cancelar'; cancelBtn.addEventListener('click', () => overlay.remove());
    const saveBtn = document.createElement('button'); saveBtn.className = 'btn btn-primary'; saveBtn.style.cssText = 'flex:2;'; saveBtn.textContent = 'Guardar';
    btnRow.appendChild(cancelBtn); btnRow.appendChild(saveBtn); modal.appendChild(btnRow);
    footer = { saveBtn, busy(on) { saveBtn.disabled = on; saveBtn.textContent = on ? 'Guardando...' : 'Guardar'; } };
  } else {
    const closeBtn = document.createElement('button'); closeBtn.className = 'btn'; closeBtn.style.cssText = 'margin-top:8px;background:transparent;border:1px solid var(--border);color:var(--ink-muted);'; closeBtn.textContent = 'Cerrar'; closeBtn.addEventListener('click', () => overlay.remove());
    modal.appendChild(closeBtn);
  }
  overlay.appendChild(modal); document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  return { overlay, modal, form, footer };
}
