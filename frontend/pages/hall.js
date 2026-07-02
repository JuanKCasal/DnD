import { api } from '../js/api.js';
import { auth } from '../js/auth.js';
import { toast } from '../js/components/toast.js';

/* Salón de la Fama (CM6): proezas (premios), ranking y valoración de DMs. */

const LBL = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;';
const RARITY_COLOR = { common: 'var(--ink-muted)', uncommon: 'var(--success)', rare: 'var(--gold)', very_rare: 'var(--gold-dim)', legendary: 'var(--crimson)' };
const TABS = [['awards', '🏅 Proezas'], ['ranking', '📊 Ranking'], ['dms', '⭐ Valorar DMs']];

export async function render(container) {
  container.innerHTML = '';
  const user = auth.getUser();
  const canAward = user?.role === 'admin' || user?.role === 'dm';

  const page = document.createElement('div');
  page.className = 'page-hall fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:960px;';

  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom:16px;';
  header.innerHTML = `<h2 style="font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;">᛭ Salón de la Fama ᛭</h2>
    <p style="color:var(--ink-muted);font-size:14px;margin:0;">Proezas, ranking de la comunidad y aprecio a los DMs</p>`;
  page.appendChild(header);

  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:8px;border-bottom:1px solid var(--border);margin-bottom:20px;';
  const content = document.createElement('div');
  page.appendChild(tabBar);
  page.appendChild(content);
  container.appendChild(page);

  let active = 'awards';
  TABS.forEach(([k, label]) => {
    const b = document.createElement('button');
    b.dataset.tab = k; b.textContent = label; b.style.cssText = tabStyle(k === active);
    b.addEventListener('click', () => { active = k; sync(); renderTab(); });
    tabBar.appendChild(b);
  });
  function sync() { tabBar.querySelectorAll('button').forEach(b => { b.style.cssText = tabStyle(b.dataset.tab === active); }); }

  function renderTab() {
    content.innerHTML = '<div style="color:var(--ink-muted);padding:20px;">Cargando...</div>';
    if (active === 'awards') return renderAwards();
    if (active === 'ranking') return renderRanking();
    if (active === 'dms') return renderDms();
  }

  /* ── Proezas ── */
  async function renderAwards() {
    let awards = [];
    try { awards = (await api.get('/hall/awards?limit=100')).data ?? []; }
    catch (err) { content.innerHTML = errBox(err); return; }
    content.innerHTML = '';
    if (canAward) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary'; btn.style.cssText = 'margin-bottom:16px;';
      btn.innerHTML = '🏅 Otorgar premio';
      btn.addEventListener('click', openAwardModal);
      content.appendChild(btn);
    }
    if (!awards.length) { content.appendChild(el(emptyEl('Aún no hay proezas premiadas'))); return; }
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;';
    awards.forEach((a, i) => grid.appendChild(awardCard(a, i)));
    content.appendChild(grid);
  }

  function awardCard(a, i) {
    const color = RARITY_COLOR[a.rarity] || 'var(--gold)';
    const card = document.createElement('div');
    card.style.cssText = `background:var(--stone);border:1px solid var(--border);border-left:4px solid ${color};border-radius:12px;padding:16px 18px;animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${i * 40}ms both;position:relative;`;
    card.innerHTML = `
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <div style="font-size:30px;flex-shrink:0;">${esc(a.icon || '🏅')}</div>
        <div style="min-width:0;">
          <div style="font-family:var(--font-display);font-size:16px;color:${color};">${esc(a.title)}</div>
          <div style="font-size:13px;color:var(--ink);margin-top:2px;">🎭 ${esc(a.character_name)}</div>
          ${a.description ? `<p style="font-size:13px;color:var(--ink-muted);line-height:1.5;margin:6px 0 0;">${esc(a.description)}</p>` : ''}
          <div style="font-size:11px;color:var(--ink-faint);margin-top:8px;">${a.campaign_name ? esc(a.campaign_name) + ' · ' : ''}por ${esc(a.awarded_by_name || 'DM')} · ${esc(new Date(a.created_at).toLocaleDateString('es-CL'))}</div>
        </div>
      </div>`;
    if (canAward) {
      const rm = document.createElement('button');
      rm.textContent = '✕'; rm.title = 'Quitar';
      rm.style.cssText = 'position:absolute;top:10px;right:10px;background:none;border:none;color:var(--crimson);cursor:pointer;';
      rm.addEventListener('click', async () => {
        if (!confirm('¿Quitar este premio?')) return;
        try { await api.del(`/hall/awards/${a.id}`); toast.success('Quitado'); renderAwards(); } catch (e) { toast.error(e.message); }
      });
      card.appendChild(rm);
    }
    return card;
  }

  /* ── Ranking ── */
  async function renderRanking() {
    let rows = [];
    try { rows = (await api.get('/hall/leaderboard')).data ?? []; }
    catch (err) { content.innerHTML = errBox(err); return; }
    content.innerHTML = '';
    if (!rows.length) { content.appendChild(el(emptyEl('Sin datos de ranking'))); return; }
    const table = document.createElement('div');
    table.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:12px;overflow:hidden;';
    table.innerHTML = `<div style="display:grid;grid-template-columns:40px 1fr 90px 90px 70px;gap:8px;padding:10px 16px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-faint);border-bottom:1px solid var(--border);">
      <span>#</span><span>Miembro</span><span style="text-align:right;">XP</span><span style="text-align:right;">Sesiones</span><span style="text-align:right;">Premios</span></div>` +
      rows.map((r, i) => `<div style="display:grid;grid-template-columns:40px 1fr 90px 90px 70px;gap:8px;padding:10px 16px;font-size:14px;border-bottom:1px solid var(--border);align-items:center;">
        <span style="font-family:var(--font-display);color:${i < 3 ? 'var(--gold)' : 'var(--ink-faint)'};">${i + 1}</span>
        <span style="color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.display_name || r.username)}</span>
        <span style="text-align:right;font-family:var(--font-mono);color:var(--gold-dim);">${(r.total_xp || 0).toLocaleString('es-CL')}</span>
        <span style="text-align:right;font-family:var(--font-mono);color:var(--ink-muted);">${r.sessions_attended || 0}</span>
        <span style="text-align:right;">${r.awards ? '🏅' + r.awards : '—'}</span></div>`).join('');
    content.appendChild(table);
  }

  /* ── Valorar DMs ── */
  async function renderDms() {
    content.innerHTML = '';
    let campaigns = [], myRatings = [], dmAvgs = [];
    try {
      [campaigns, myRatings, dmAvgs] = await Promise.all([
        api.get('/campaigns?per_page=100').then(r => r.data ?? []),
        api.get('/hall/my-ratings').then(r => r.data ?? []).catch(() => []),
        api.get('/hall/dm-ratings').then(r => r.data ?? []).catch(() => []),
      ]);
    } catch (err) { content.innerHTML = errBox(err); return; }

    // Ranking de DMs
    const avgWrap = document.createElement('div');
    avgWrap.style.cssText = 'margin-bottom:24px;';
    avgWrap.innerHTML = `<h3 style="font-family:var(--font-display);font-size:16px;color:var(--ink);margin:0 0 10px;">Ranking de DMs</h3>`;
    if (!dmAvgs.length) avgWrap.innerHTML += '<div style="font-size:13px;color:var(--ink-faint);">Aún no hay valoraciones.</div>';
    else dmAvgs.forEach(d => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;';
      row.innerHTML = `<span style="color:var(--ink);">${esc(d.dm_name || 'DM')}</span><span style="color:var(--gold);">${stars(Math.round(d.avg_stars))} <span style="font-family:var(--font-mono);font-size:12px;color:var(--ink-muted);">${d.avg_stars} (${d.ratings})</span></span>`;
      avgWrap.appendChild(row);
    });
    content.appendChild(avgWrap);

    // Valorar mis campañas
    const rateHead = document.createElement('h3');
    rateHead.style.cssText = 'font-family:var(--font-display);font-size:16px;color:var(--ink);margin:0 0 10px;';
    rateHead.textContent = 'Valorar al DM de tus campañas';
    content.appendChild(rateHead);
    const rateable = campaigns.filter(c => String(c.dm_id) !== String(user.id));
    if (!rateable.length) { content.appendChild(el('<div style="font-size:13px;color:var(--ink-faint);">No hay campañas para valorar.</div>')); return; }
    const myMap = {}; myRatings.forEach(r => { myMap[String(r.campaign_id)] = r; });
    rateable.forEach(c => content.appendChild(rateCard(c, myMap[String(c.id)])));
  }

  function rateCard(campaign, existing) {
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:10px;';
    let picked = existing ? existing.stars : 0;
    const title = document.createElement('div');
    title.style.cssText = 'font-family:var(--font-display);color:var(--ink);margin-bottom:6px;';
    title.textContent = campaign.name;
    const starRow = document.createElement('div');
    starRow.style.cssText = 'font-size:22px;cursor:pointer;user-select:none;letter-spacing:2px;';
    const paint = () => { starRow.textContent = ''; for (let s = 1; s <= 5; s++) { const sp = document.createElement('span'); sp.textContent = s <= picked ? '★' : '☆'; sp.style.color = s <= picked ? 'var(--gold)' : 'var(--ink-faint)'; sp.addEventListener('click', () => { picked = s; paint(); }); starRow.appendChild(sp); } };
    paint();
    const comment = document.createElement('input');
    comment.className = 'input'; comment.placeholder = 'Comentario (opcional)'; comment.value = existing?.comment || ''; comment.style.cssText = 'margin-top:8px;';
    const send = document.createElement('button');
    send.className = 'btn btn-primary'; send.style.cssText = 'margin-top:8px;'; send.textContent = existing ? 'Actualizar valoración' : 'Enviar valoración';
    send.addEventListener('click', async () => {
      if (!picked) { toast.error('Elige de 1 a 5 estrellas'); return; }
      send.disabled = true;
      try { await api.post('/hall/ratings', { campaign_id: campaign.id, stars: picked, comment: comment.value.trim() || null }); toast.success('¡Gracias por tu valoración!'); renderDms(); }
      catch (e) { toast.error('Error', e.message); send.disabled = false; }
    });
    card.appendChild(title); card.appendChild(starRow); card.appendChild(comment); card.appendChild(send);
    return card;
  }

  /* ── Otorgar premio (Admin/DM) ── */
  async function openAwardModal() {
    let chars = [], camps = [];
    try {
      [chars, camps] = await Promise.all([
        api.get('/characters?per_page=200').then(r => r.data ?? []),
        api.get('/campaigns?per_page=100').then(r => r.data ?? []),
      ]);
    } catch (_) { /* */ }
    if (!chars.length) { toast.error('No hay personajes para premiar'); return; }
    const { overlay, form, footer } = buildModal('Otorgar premio');
    form.appendChild(field('Personaje *', select('aw-char', chars.map(c => ({ value: c.id, label: c.name })))));
    form.appendChild(field('Título *', input('aw-title', '', 'Matadragones')));
    form.appendChild(field('Descripción', textarea('aw-desc', '')));
    const row = document.createElement('div'); row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
    row.appendChild(field('Ícono', input('aw-icon', '🏅', '🏅')));
    row.appendChild(field('Rareza', select('aw-rarity', [
      { value: 'common', label: 'Común' }, { value: 'uncommon', label: 'Infrecuente' }, { value: 'rare', label: 'Raro' },
      { value: 'very_rare', label: 'Muy raro' }, { value: 'legendary', label: 'Legendario' },
    ], 'rare')));
    form.appendChild(row);
    form.appendChild(field('Campaña (opcional)', select('aw-camp', [{ value: '', label: '—' }, ...camps.map(c => ({ value: c.id, label: c.name }))], '')));
    footer.saveBtn.addEventListener('click', async () => {
      const character_id = val('aw-char'); const title = val('aw-title');
      if (!character_id || !title) { toast.error('Personaje y título son obligatorios'); return; }
      const body = { character_id, title, description: val('aw-desc') || null, icon: val('aw-icon') || '🏅', rarity: val('aw-rarity'), campaign_id: val('aw-camp') || null };
      footer.busy(true);
      try { await api.post('/hall/awards', body); toast.success('¡Premio otorgado!'); overlay.remove(); renderAwards(); }
      catch (e) { toast.error('Error', e.message); footer.busy(false); }
    });
  }

  sync();
  renderTab();
}

/* ── helpers ── */
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function val(id) { return (document.getElementById(id)?.value ?? '').trim(); }
function stars(n) { n = Math.max(0, Math.min(5, n || 0)); return '★'.repeat(n) + '☆'.repeat(5 - n); }
function el(html) { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild || d; }
function emptyEl(t) { return `<div style="text-align:center;padding:40px 20px;color:var(--ink-muted);font-family:var(--font-display);">${t}</div>`; }
function errBox(err) { return `<div style="color:var(--crimson);padding:20px;">Error: ${esc(err.message)}</div>`; }
function tabStyle(active) { return `padding:8px 16px;font-family:var(--font-ui);font-size:14px;cursor:pointer;background:none;border:none;border-bottom:2px solid ${active ? 'var(--gold)' : 'transparent'};color:${active ? 'var(--gold)' : 'var(--ink-muted)'};font-weight:${active ? '600' : '400'};`; }
function field(labelText, control) { const g = document.createElement('div'); const l = document.createElement('label'); l.style.cssText = LBL; l.textContent = labelText; g.appendChild(l); g.appendChild(control); return g; }
function input(id, value, placeholder) { const i = document.createElement('input'); i.id = id; i.className = 'input'; i.type = 'text'; i.value = value ?? ''; if (placeholder) i.placeholder = placeholder; return i; }
function textarea(id, value) { const t = document.createElement('textarea'); t.id = id; t.className = 'input'; t.rows = 3; t.style.cssText = 'resize:vertical;min-height:64px;'; t.value = value ?? ''; return t; }
function select(id, opts, selected) { const s = document.createElement('select'); s.id = id; s.className = 'input'; opts.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.label; op.selected = String(selected) === String(o.value); s.appendChild(op); }); return s; }
function buildModal(titleText) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(9,8,10,0.8);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn var(--dur-normal) var(--ease-smooth);';
  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:12px;padding:28px;width:min(520px,96vw);max-height:90vh;overflow-y:auto;animation:modalIn var(--dur-normal) var(--ease-spring);';
  const title = document.createElement('h3');
  title.style.cssText = 'font-family:var(--font-display);color:var(--gold);margin:0 0 20px;font-size:20px;';
  title.textContent = titleText;
  const form = document.createElement('div'); form.style.cssText = 'display:flex;flex-direction:column;gap:16px;';
  const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:12px;margin-top:8px;';
  const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn'; cancelBtn.style.cssText = 'flex:1;background:transparent;border:1px solid var(--border);color:var(--ink-muted);'; cancelBtn.textContent = 'Cancelar'; cancelBtn.addEventListener('click', () => overlay.remove());
  const saveBtn = document.createElement('button'); saveBtn.className = 'btn btn-primary'; saveBtn.style.cssText = 'flex:2;'; saveBtn.textContent = 'Otorgar';
  btnRow.appendChild(cancelBtn); btnRow.appendChild(saveBtn);
  modal.appendChild(title); modal.appendChild(form); modal.appendChild(btnRow);
  overlay.appendChild(modal); document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  return { overlay, modal, form, footer: { saveBtn, busy(on) { saveBtn.disabled = on; saveBtn.textContent = on ? 'Otorgando...' : 'Otorgar'; } } };
}
