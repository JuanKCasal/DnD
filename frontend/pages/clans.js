import { api } from '../js/api.js';
import { auth } from '../js/auth.js';
import { toast } from '../js/components/toast.js';

/* Clanes (CM5): gremios como muro social. El muro reutiliza community_posts (board=clan). */

const LBL = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;';
const ROLE_LABEL = { leader: 'Líder', officer: 'Oficial', veteran: 'Veterano', member: 'Miembro', initiate: 'Iniciado' };

export async function render(container) {
  container.innerHTML = '';
  const user = auth.getUser();
  const isAdmin = user?.role === 'admin';

  const page = document.createElement('div');
  page.className = 'page-clans fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:1000px;';
  container.appendChild(page);

  renderList();

  /* ── Lista / descubrir ── */
  async function renderList() {
    page.innerHTML = '';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap;';
    header.innerHTML = `<div>
        <h2 style="font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;">᛭ Clanes ᛭</h2>
        <p style="color:var(--ink-muted);font-size:14px;margin:0;">Gremios de la comunidad — muros sociales</p></div>`;
    const createBtn = document.createElement('button');
    createBtn.className = 'btn btn-primary';
    createBtn.innerHTML = '<span style="font-size:18px;">+</span> Crear clan';
    createBtn.addEventListener('click', openCreateModal);
    header.appendChild(createBtn);
    page.appendChild(header);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;';
    page.appendChild(grid);
    let clans = [];
    try { clans = (await api.get('/clans?per_page=100')).data ?? []; }
    catch (err) { grid.innerHTML = `<div style="color:var(--crimson);">Error: ${esc(err.message)}</div>`; return; }
    if (!clans.length) { grid.innerHTML = emptyEl('No hay clanes aún. ¡Crea el primero!'); return; }
    clans.forEach((c, i) => grid.appendChild(clanCard(c, i)));
  }

  function clanCard(c, i) {
    const color = c.color_hex || 'var(--gold-dim)';
    const card = document.createElement('div');
    card.style.cssText = `background:var(--stone);border:1px solid var(--border);border-top:4px solid ${color};border-radius:12px;padding:20px;cursor:pointer;transition:transform var(--dur-fast) var(--ease-spring),box-shadow var(--dur-fast);animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${i * 50}ms both;`;
    card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-3px)'; card.style.boxShadow = '0 0 24px var(--gold-glow)'; });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; card.style.boxShadow = ''; });
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;height:44px;border-radius:10px;background:${color}22;color:${color};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">${c.emblem_url ? `<img src="${esc(c.emblem_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">` : '🛡️'}</div>
        <div style="min-width:0;">
          <div style="font-family:var(--font-display);font-size:17px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.name)}</div>
          ${c.motto ? `<div style="font-size:12px;font-style:italic;color:var(--ink-muted);">“${esc(c.motto)}”</div>` : ''}
        </div>
      </div>
      ${c.description ? `<p style="font-size:13px;color:var(--ink-muted);line-height:1.5;margin:12px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(c.description)}</p>` : ''}
      <div style="display:flex;gap:12px;font-size:12px;color:var(--ink-faint);margin-top:12px;border-top:1px solid var(--border);padding-top:10px;">
        <span>👥 ${c.member_count ?? 0} miembros</span>${c.is_public ? '' : '<span>🔒 privado</span>'}
      </div>`;
    card.addEventListener('click', () => renderDetail(c.id));
    return card;
  }

  /* ── Detalle: perfil + muro ── */
  async function renderDetail(clanId) {
    page.innerHTML = '<div style="color:var(--ink-muted);padding:30px;">Cargando clan...</div>';
    let clan;
    try { clan = (await api.get(`/clans/${clanId}`)).data; }
    catch (err) { page.innerHTML = `<div style="color:var(--crimson);padding:20px;">Error: ${esc(err.message)}</div>`; return; }
    const members = clan.members ?? [];
    const isMember = members.some(m => String(m.member_id) === String(user.id));
    const canPost = isMember || isAdmin;
    const color = clan.color_hex || 'var(--gold-dim)';

    page.innerHTML = '';
    const back = document.createElement('button');
    back.className = 'btn';
    back.style.cssText = 'background:transparent;border:1px solid var(--border);color:var(--ink-muted);margin-bottom:16px;';
    back.textContent = '← Volver a clanes';
    back.addEventListener('click', renderList);
    page.appendChild(back);

    const banner = document.createElement('div');
    banner.style.cssText = `background:var(--stone);border:1px solid var(--border);border-top:4px solid ${color};border-radius:12px;padding:22px;margin-bottom:20px;`;
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <div style="width:56px;height:56px;border-radius:12px;background:${color}22;color:${color};display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;">${clan.emblem_url ? `<img src="${esc(clan.emblem_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">` : '🛡️'}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--font-display);font-size:24px;color:var(--gold);">${esc(clan.name)}</div>
          ${clan.motto ? `<div style="font-style:italic;color:var(--ink-muted);">“${esc(clan.motto)}”</div>` : ''}
        </div>
        <div id="join-slot"></div>
      </div>
      ${clan.description ? `<p style="font-size:14px;color:var(--ink);line-height:1.6;margin:14px 0 0;">${esc(clan.description)}</p>` : ''}`;
    page.appendChild(banner);

    const joinSlot = banner.querySelector('#join-slot');
    if (!isMember && clan.active !== false) {
      const joinBtn = document.createElement('button');
      joinBtn.className = 'btn btn-primary';
      joinBtn.textContent = clan.requires_approval ? 'Solicitar unirse' : 'Unirse al clan';
      joinBtn.addEventListener('click', async () => {
        try { await api.post(`/clans/${clanId}/join`, {}); toast.success('¡Te uniste al clan!'); renderDetail(clanId); }
        catch (e) { toast.error(e.message); }
      });
      joinSlot.appendChild(joinBtn);
    } else if (isMember) {
      joinSlot.innerHTML = '<span style="font-size:12px;color:var(--success);">✓ Eres miembro</span>';
    }

    // Layout: muro (izq) + miembros (der)
    const cols = document.createElement('div');
    cols.style.cssText = 'display:grid;grid-template-columns:1fr 260px;gap:20px;align-items:start;';
    const wall = document.createElement('div');
    const side = document.createElement('div');
    side.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:12px;padding:16px;';
    side.innerHTML = `<h3 style="font-family:var(--font-display);font-size:15px;color:var(--ink);margin:0 0 10px;">👥 Miembros (${members.length})</h3>` +
      (members.map(m => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:5px 0;">
        <span style="color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(m.display_name || m.username)}</span>
        <span style="font-size:11px;color:var(--gold-dim);white-space:nowrap;">${ROLE_LABEL[m.clan_role] || m.clan_role}</span>
      </div>`).join('') || '<div style="font-size:12px;color:var(--ink-faint);">Sin miembros</div>');
    cols.appendChild(wall);
    cols.appendChild(side);
    page.appendChild(cols);

    // Composer
    if (canPost) wall.appendChild(composer(clanId, () => loadWall(clanId)));
    const feed = document.createElement('div');
    feed.id = 'clan-feed';
    feed.style.cssText = 'margin-top:16px;';
    wall.appendChild(feed);
    loadWall(clanId);
  }

  async function loadWall(clanId) {
    const feed = page.querySelector('#clan-feed');
    if (!feed) return;
    feed.innerHTML = '<div style="color:var(--ink-muted);padding:12px;">Cargando muro...</div>';
    let posts = [];
    try { posts = (await api.get(`/community/posts?board=clan&clan_id=${clanId}`)).data ?? []; }
    catch (err) { feed.innerHTML = `<div style="color:var(--crimson);padding:12px;">${esc(err.message)}</div>`; return; }
    feed.innerHTML = '';
    if (!posts.length) { feed.innerHTML = emptyEl('El muro está vacío. ¡Comparte algo!'); return; }
    posts.forEach((p, i) => feed.appendChild(postCard(p, i, clanId)));
  }

  function composer(clanId, reload) {
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:12px;padding:14px;';
    const ta = document.createElement('textarea');
    ta.className = 'input'; ta.rows = 2; ta.placeholder = 'Comparte algo con tu clan…'; ta.style.cssText = 'resize:vertical;min-height:56px;';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center;';
    const img = document.createElement('input');
    img.className = 'input'; img.placeholder = 'URL de imagen (opcional)'; img.style.cssText = 'flex:1;min-width:160px;';
    const itemSel = document.createElement('select');
    itemSel.className = 'input'; itemSel.style.cssText = 'max-width:180px;';
    itemSel.innerHTML = '<option value="">🎒 Compartir ítem…</option>';
    (async () => {
      try {
        const items = (await api.get('/items?per_page=200')).data ?? [];
        items.forEach(it => { const o = document.createElement('option'); o.value = it.id; o.textContent = it.name; itemSel.appendChild(o); });
      } catch (_) { /* */ }
    })();
    const send = document.createElement('button');
    send.className = 'btn btn-primary'; send.textContent = 'Publicar';
    send.addEventListener('click', async () => {
      const body = ta.value.trim();
      if (!body && !img.value.trim() && !itemSel.value) { toast.error('Escribe algo o adjunta'); return; }
      send.disabled = true;
      try {
        await api.post('/community/posts', { board: 'clan', clan_id: clanId, body: body || null, image_url: img.value.trim() || null, item_id: itemSel.value || null });
        ta.value = ''; img.value = ''; itemSel.value = '';
        reload();
      } catch (e) { toast.error('Error', e.message); }
      finally { send.disabled = false; }
    });
    row.appendChild(img); row.appendChild(itemSel); row.appendChild(send);
    box.appendChild(ta); box.appendChild(row);
    return box;
  }

  function postCard(p, i, clanId) {
    const card = document.createElement('div');
    card.style.cssText = `background:var(--stone);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:12px;animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${i * 40}ms both;`;
    const who = p.author_character_name || p.author_member_name || 'Anónimo';
    const when = new Date(p.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    card.innerHTML = `
      <div style="font-size:12px;color:var(--ink-muted);"><b style="color:var(--gold-dim);">${esc(who)}</b> · ${esc(when)}</div>
      ${p.body ? `<p style="font-size:14px;color:var(--ink);line-height:1.6;margin:8px 0 0;white-space:pre-wrap;">${esc(p.body)}</p>` : ''}
      ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" style="max-width:100%;border-radius:8px;margin-top:10px;">` : ''}
      ${p.item_name ? `<div style="display:inline-flex;align-items:center;gap:6px;background:var(--gold-glow);border:1px solid var(--gold-dim);border-radius:8px;padding:4px 10px;margin-top:10px;font-size:13px;color:var(--gold);">🎒 ${esc(p.item_name)}</div>` : ''}`;
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:10px;margin-top:12px;';
    const cbtn = miniBtn(`💬 ${p.comment_count || 0}`, 'var(--ink-muted)');
    actions.appendChild(cbtn);
    if (String(p.author_member_id) === String(user.id) || isAdmin) {
      actions.appendChild(miniBtn('Eliminar', 'var(--crimson)', async () => {
        if (!confirm('¿Eliminar esta publicación?')) return;
        try { await api.del(`/community/posts/${p.id}`); loadWall(clanId); }
        catch (e) { toast.error(e.message); }
      }));
    }
    card.appendChild(actions);
    const cbox = document.createElement('div');
    cbox.style.cssText = 'display:none;margin-top:10px;border-top:1px solid var(--border);padding-top:10px;';
    card.appendChild(cbox);
    let loaded = false;
    cbtn.addEventListener('click', async () => {
      const show = cbox.style.display === 'none';
      cbox.style.display = show ? 'block' : 'none';
      if (show && !loaded) { loaded = true; await renderComments(p, cbox); }
    });
    return card;
  }

  async function renderComments(p, box) {
    box.innerHTML = '<div style="font-size:12px;color:var(--ink-muted);">Cargando...</div>';
    let comments = [];
    try { comments = (await api.get(`/community/posts/${p.id}/comments`)).data ?? []; } catch (_) { /* */ }
    box.innerHTML = '';
    comments.forEach(c => {
      const el = document.createElement('div');
      el.style.cssText = 'margin-bottom:6px;font-size:13px;';
      el.innerHTML = `<b style="color:var(--gold-dim);">${esc(c.author_character_name || c.author_member_name || 'Anónimo')}</b> <span style="color:var(--ink);">${esc(c.body)}</span>`;
      box.appendChild(el);
    });
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
    const inp = document.createElement('input');
    inp.className = 'input'; inp.placeholder = 'Comentar...'; inp.style.flex = '1';
    const btn = document.createElement('button'); btn.className = 'btn btn-primary'; btn.textContent = 'Enviar';
    const doSend = async () => {
      const t = inp.value.trim(); if (!t) return; inp.value = '';
      try { await api.post(`/community/posts/${p.id}/comments`, { body: t }); await renderComments(p, box); }
      catch (e) { toast.error(e.message); inp.value = t; }
    };
    btn.addEventListener('click', doSend);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSend(); });
    row.appendChild(inp); row.appendChild(btn);
    box.appendChild(row);
  }

  /* ── Crear clan ── */
  function openCreateModal() {
    const { overlay, form, footer } = buildModal('Crear clan');
    form.appendChild(field('Nombre *', input('cl-name', '', 'Los Guardianes del Alba')));
    form.appendChild(field('Slug *', input('cl-slug', '', 'guardianes-alba')));
    form.appendChild(field('Lema', input('cl-motto', '', 'Hasta el último aliento')));
    form.appendChild(field('Descripción', textarea('cl-desc', '')));
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
    const colorInp = input('cl-color', '#C9A84C', '', 'color');
    row.appendChild(field('Color', colorInp));
    row.appendChild(field('Emblema (URL)', input('cl-emblem', '', 'https://...')));
    form.appendChild(row);
    const flags = document.createElement('div'); flags.style.cssText = 'display:flex;gap:20px;';
    flags.appendChild(check('cl-public', 'Público', true));
    flags.appendChild(check('cl-approval', 'Requiere aprobación', false));
    form.appendChild(flags);

    const nameI = form.querySelector('#cl-name'); const slugI = form.querySelector('#cl-slug');
    nameI.addEventListener('input', () => { slugI.value = nameI.value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-'); });

    footer.saveBtn.addEventListener('click', async () => {
      const name = val('cl-name'); const slug = val('cl-slug');
      if (!name || !slug) { toast.error('Nombre y slug obligatorios'); return; }
      const body = {
        name, slug, motto: val('cl-motto') || null, description: val('cl-desc') || null,
        color_hex: val('cl-color') || '#C9A84C', emblem_url: val('cl-emblem') || null,
        is_public: document.getElementById('cl-public').checked,
        requires_approval: document.getElementById('cl-approval').checked,
      };
      footer.busy(true);
      try { const res = await api.post('/clans', body); toast.success('¡Clan creado!'); overlay.remove(); renderDetail(res.data.id); }
      catch (e) { toast.error('Error', e.message); footer.busy(false); }
    });
  }
}

/* ── helpers ── */
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function val(id) { return (document.getElementById(id)?.value ?? '').trim(); }
function emptyEl(t) { return `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--ink-muted);font-family:var(--font-display);">${t}</div>`; }
function miniBtn(label, color, onClick) { const b = document.createElement('button'); b.textContent = label; b.style.cssText = `background:transparent;border:1px solid var(--border);border-radius:6px;padding:4px 12px;font-size:12px;color:${color};cursor:pointer;`; if (onClick) b.addEventListener('click', onClick); return b; }
function field(labelText, control) { const g = document.createElement('div'); const l = document.createElement('label'); l.style.cssText = LBL; l.textContent = labelText; g.appendChild(l); g.appendChild(control); return g; }
function input(id, value, placeholder, type = 'text') { const i = document.createElement('input'); i.id = id; i.className = 'input'; i.type = type; i.value = value ?? ''; if (placeholder) i.placeholder = placeholder; return i; }
function textarea(id, value) { const t = document.createElement('textarea'); t.id = id; t.className = 'input'; t.rows = 3; t.style.cssText = 'resize:vertical;min-height:70px;'; t.value = value ?? ''; return t; }
function check(id, labelText, checked) { const g = document.createElement('label'); g.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink);cursor:pointer;'; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = id; cb.checked = !!checked; cb.style.cssText = 'width:16px;height:16px;'; g.appendChild(cb); g.appendChild(document.createTextNode(labelText)); return g; }
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
  const saveBtn = document.createElement('button'); saveBtn.className = 'btn btn-primary'; saveBtn.style.cssText = 'flex:2;'; saveBtn.textContent = 'Crear';
  btnRow.appendChild(cancelBtn); btnRow.appendChild(saveBtn);
  modal.appendChild(title); modal.appendChild(form); modal.appendChild(btnRow);
  overlay.appendChild(modal); document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  return { overlay, modal, form, footer: { saveBtn, busy(on) { saveBtn.disabled = on; saveBtn.textContent = on ? 'Creando...' : 'Crear'; } } };
}
