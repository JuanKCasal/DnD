import { api } from '../js/api.js';
import { auth } from '../js/auth.js';
import { toast } from '../js/components/toast.js';

/* Calendario & Eventos (CM4): muro de publicaciones de Admin/DM. */

const LBL = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;';

export async function render(container) {
  container.innerHTML = '';
  const user = auth.getUser();
  const canPublish = user?.role === 'admin' || user?.role === 'dm';

  const page = document.createElement('div');
  page.className = 'page-calendar fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:900px;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap;';
  header.innerHTML = `<div>
      <h2 style="font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;">᛭ Calendario & Eventos ᛭</h2>
      <p style="color:var(--ink-muted);font-size:14px;margin:0;">Anuncios y próximos eventos de la comunidad</p></div>`;
  if (canPublish) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.innerHTML = '<span style="font-size:18px;">+</span> Publicar';
    btn.addEventListener('click', () => openPostModal());
    header.appendChild(btn);
  }
  page.appendChild(header);

  const upcoming = document.createElement('section');
  upcoming.style.cssText = 'margin-bottom:28px;';
  const wall = document.createElement('section');
  page.appendChild(upcoming);
  page.appendChild(wall);
  container.appendChild(page);

  async function load() {
    upcoming.innerHTML = '';
    wall.innerHTML = '<div style="color:var(--ink-muted);padding:20px;">Cargando...</div>';
    let posts = [];
    try { posts = (await api.get('/community/posts?board=events')).data ?? []; }
    catch (err) { wall.innerHTML = `<div style="color:var(--crimson);padding:20px;">Error: ${esc(err.message)}</div>`; return; }

    const now = Date.now();
    const future = posts.filter(p => p.event_date && new Date(p.event_date).getTime() >= now)
      .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
    if (future.length) {
      upcoming.innerHTML = `<h3 style="font-family:var(--font-display);font-size:18px;color:var(--ink);margin:0 0 12px;border-bottom:1px solid var(--border);padding-bottom:8px;">📅 Próximos eventos</h3>`;
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-top:12px;';
      future.forEach(p => {
        const d = new Date(p.event_date);
        const c = document.createElement('div');
        c.style.cssText = 'background:var(--gold-glow);border:1px solid var(--gold-dim);border-radius:10px;padding:12px 14px;';
        c.innerHTML = `<div style="font-family:var(--font-mono);font-size:12px;color:var(--gold);">${esc(d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }))} · ${esc(d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }))}</div>
          <div style="font-family:var(--font-display);color:var(--ink);margin-top:4px;">${esc(p.title || 'Evento')}</div>`;
        grid.appendChild(c);
      });
      upcoming.appendChild(grid);
    }

    wall.innerHTML = '';
    if (!posts.length) {
      wall.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--ink-muted);"><div style="font-size:40px;">📣</div>
        <div style="font-family:var(--font-display);font-size:18px;color:var(--ink);margin-top:8px;">Sin publicaciones</div>
        ${canPublish ? '<div style="font-size:13px;margin-top:6px;">Publica el primer anuncio o evento.</div>' : ''}</div>`;
      return;
    }
    posts.forEach((p, i) => wall.appendChild(postCard(p, i)));
  }

  function postCard(p, i) {
    const card = document.createElement('div');
    card.style.cssText = `background:var(--stone);border:1px solid var(--border);${p.pinned ? 'border-left:3px solid var(--gold);' : ''}border-radius:12px;padding:18px 20px;margin-bottom:14px;animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${i * 40}ms both;`;
    const author = p.author_member_name || 'Staff';
    const when = new Date(p.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
    const ev = p.event_date ? `<span style="font-family:var(--font-mono);font-size:12px;color:var(--gold);background:var(--gold-glow);border-radius:8px;padding:2px 8px;">📅 ${esc(new Date(p.event_date).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</span>` : '';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
        <div style="font-family:var(--font-display);font-size:18px;color:var(--gold);">${p.pinned ? '📌 ' : ''}${esc(p.title || 'Anuncio')}</div>
        ${ev}
      </div>
      <div style="font-size:11px;color:var(--ink-faint);margin-top:2px;">Por ${esc(author)} · ${esc(when)}</div>
      ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" style="max-width:100%;border-radius:8px;margin-top:10px;" />` : ''}
      ${p.body ? `<p style="font-size:14px;color:var(--ink);line-height:1.6;margin:10px 0 0;white-space:pre-wrap;">${esc(p.body)}</p>` : ''}`;

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:10px;align-items:center;margin-top:12px;';
    const cbtn = miniBtn(`💬 ${p.comment_count || 0} comentarios`, 'var(--ink-muted)');
    actions.appendChild(cbtn);
    if (canPublish && (String(p.author_member_id) === String(user.id) || user.role === 'admin')) {
      actions.appendChild(miniBtn('Eliminar', 'var(--crimson)', async () => {
        if (!confirm('¿Eliminar esta publicación?')) return;
        try { await api.del(`/community/posts/${p.id}`); toast.success('Eliminada'); load(); } catch (e) { toast.error(e.message); }
      }));
    }
    card.appendChild(actions);

    const commentsBox = document.createElement('div');
    commentsBox.style.cssText = 'display:none;margin-top:12px;border-top:1px solid var(--border);padding-top:12px;';
    card.appendChild(commentsBox);
    let loaded = false;
    cbtn.addEventListener('click', async () => {
      const show = commentsBox.style.display === 'none';
      commentsBox.style.display = show ? 'block' : 'none';
      if (show && !loaded) { loaded = true; await renderComments(p, commentsBox); }
    });
    return card;
  }

  async function renderComments(p, box) {
    box.innerHTML = '<div style="color:var(--ink-muted);font-size:12px;">Cargando comentarios...</div>';
    let comments = [];
    try { comments = (await api.get(`/community/posts/${p.id}/comments`)).data ?? []; } catch (_) { /* */ }
    box.innerHTML = '';
    comments.forEach(c => {
      const el = document.createElement('div');
      el.style.cssText = 'margin-bottom:8px;';
      const who = c.author_character_name || c.author_member_name || 'Anónimo';
      el.innerHTML = `<span style="font-size:12px;color:var(--gold-dim);font-weight:600;">${esc(who)}</span> <span style="font-size:14px;color:var(--ink);">${esc(c.body)}</span>`;
      box.appendChild(el);
    });
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
    const inp = document.createElement('input');
    inp.className = 'input'; inp.placeholder = 'Escribe un comentario...'; inp.style.flex = '1';
    const send = document.createElement('button');
    send.className = 'btn btn-primary'; send.textContent = 'Comentar';
    const doSend = async () => {
      const text = inp.value.trim(); if (!text) return;
      inp.value = '';
      try { await api.post(`/community/posts/${p.id}/comments`, { body: text }); await renderComments(p, box); }
      catch (e) { toast.error(e.message); inp.value = text; }
    };
    send.addEventListener('click', doSend);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSend(); });
    row.appendChild(inp); row.appendChild(send);
    box.appendChild(row);
  }

  function openPostModal() {
    const { overlay, form, footer } = buildModal('Publicar en el muro');
    form.appendChild(field('Título', input('ev-title', '', 'Sesión especial de fin de mes')));
    form.appendChild(field('Contenido', textarea('ev-body', '')));
    form.appendChild(field('Fecha del evento (opcional)', input('ev-date', '', '', 'datetime-local')));
    form.appendChild(field('Imagen (URL, opcional)', input('ev-img', '', 'https://...')));
    form.appendChild(check('ev-pin', 'Fijar arriba', false));
    footer.saveBtn.addEventListener('click', async () => {
      const title = val('ev-title');
      const bodyTxt = val('ev-body');
      if (!title && !bodyTxt) { toast.error('Escribe un título o contenido'); return; }
      const dateVal = val('ev-date');
      const body = {
        board: 'events',
        title: title || null,
        body: bodyTxt || null,
        image_url: val('ev-img') || null,
        event_date: dateVal ? new Date(dateVal).toISOString() : null,
        pinned: document.getElementById('ev-pin').checked,
      };
      footer.busy(true);
      try { await api.post('/community/posts', body); toast.success('Publicado'); overlay.remove(); load(); }
      catch (e) { toast.error('Error', e.message); footer.busy(false); }
    });
  }

  load();
}

/* ── helpers ── */
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function val(id) { return (document.getElementById(id)?.value ?? '').trim(); }
function miniBtn(label, color, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = `background:transparent;border:1px solid var(--border);border-radius:6px;padding:4px 12px;font-size:12px;color:${color};cursor:pointer;`;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}
function field(labelText, control) { const g = document.createElement('div'); const l = document.createElement('label'); l.style.cssText = LBL; l.textContent = labelText; g.appendChild(l); g.appendChild(control); return g; }
function input(id, value, placeholder, type = 'text') { const i = document.createElement('input'); i.id = id; i.className = 'input'; i.type = type; i.value = value ?? ''; if (placeholder) i.placeholder = placeholder; return i; }
function textarea(id, value) { const t = document.createElement('textarea'); t.id = id; t.className = 'input'; t.rows = 4; t.style.cssText = 'resize:vertical;min-height:80px;'; t.value = value ?? ''; return t; }
function check(id, labelText, checked) { const g = document.createElement('label'); g.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink);cursor:pointer;'; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = id; cb.checked = !!checked; cb.style.cssText = 'width:16px;height:16px;'; g.appendChild(cb); g.appendChild(document.createTextNode(labelText)); return g; }
function buildModal(titleText) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(9,8,10,0.8);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn var(--dur-normal) var(--ease-smooth);';
  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:12px;padding:28px;width:min(520px,96vw);max-height:90vh;overflow-y:auto;animation:modalIn var(--dur-normal) var(--ease-spring);';
  const title = document.createElement('h3');
  title.style.cssText = 'font-family:var(--font-display);color:var(--gold);margin:0 0 20px;font-size:20px;';
  title.textContent = titleText;
  const form = document.createElement('div');
  form.style.cssText = 'display:flex;flex-direction:column;gap:16px;';
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:12px;margin-top:8px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn'; cancelBtn.style.cssText = 'flex:1;background:transparent;border:1px solid var(--border);color:var(--ink-muted);'; cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', () => overlay.remove());
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary'; saveBtn.style.cssText = 'flex:2;'; saveBtn.textContent = 'Publicar';
  btnRow.appendChild(cancelBtn); btnRow.appendChild(saveBtn);
  modal.appendChild(title); modal.appendChild(form); modal.appendChild(btnRow);
  overlay.appendChild(modal); document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  return { overlay, modal, form, footer: { saveBtn, busy(on) { saveBtn.disabled = on; saveBtn.textContent = on ? 'Publicando...' : 'Publicar'; } } };
}
