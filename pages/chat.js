import { api } from '../js/api.js';
import { auth } from '../js/auth.js';
import { toast } from '../js/components/toast.js';

/* Chat de comunidad (CM2). Hablas como tu PERSONAJE ACTIVO. Entrega en vivo por polling. */

const POLL_MS = 4000;

export async function render(container) {
  container.innerHTML = '';
  const user = auth.getUser();
  const isStaff = user?.role === 'admin' || user?.role === 'dm';

  const page = document.createElement('div');
  page.className = 'page-chat fade-in';
  page.style.cssText = 'display:flex;gap:0;height:calc(100dvh - 108px);min-height:420px;max-width:1300px;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--stone);';

  const sidebar = document.createElement('div');
  sidebar.style.cssText = 'width:270px;flex-shrink:0;border-right:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto;background:var(--stone-light);';
  const main = document.createElement('div');
  main.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;';
  page.appendChild(sidebar);
  page.appendChild(main);
  container.appendChild(page);

  let activeChar = null;   // {id, name}
  let rooms = [];
  let current = null;      // {kind:'room'|'dm', id, name, room?}
  let lastTs = null;       // created_at del último mensaje (para polling de salas)
  let pollTimer = null;

  try {
    const [acRes, roomsRes] = await Promise.all([
      api.get('/me/active-character').catch(() => ({ data: {} })),
      api.get('/chat/rooms'),
    ]);
    activeChar = acRes.data?.character ? { id: acRes.data.active_character_id, name: acRes.data.character.name } : null;
    rooms = roomsRes.data ?? [];
  } catch (err) {
    main.innerHTML = `<div style="color:var(--crimson);padding:30px;">Error al cargar el chat: ${esc(err.message)}</div>`;
    return;
  }

  await buildSidebar();
  // Abrir por defecto el canal Público (general) o el primero disponible.
  const first = rooms.find(r => r.slug === 'general') || rooms[0];
  if (first) openRoom(first);
  else main.innerHTML = placeholder('Sin canales disponibles');

  /* ── Sidebar ── */
  async function buildSidebar() {
    sidebar.innerHTML = '';
    const idBadge = document.createElement('div');
    idBadge.style.cssText = 'padding:12px 14px;border-bottom:1px solid var(--border);font-size:12px;color:var(--ink-muted);';
    idBadge.innerHTML = activeChar
      ? `Hablas como <b style="color:var(--gold);">🎭 ${esc(activeChar.name)}</b>`
      : `<span style="color:var(--crimson);">Sin personaje activo</span> — elígelo arriba para hablar IC`;
    sidebar.appendChild(idBadge);

    const community = rooms.filter(r => !r.campaign_id && !r.clan_id);
    const campaignRooms = rooms.filter(r => r.campaign_id);
    const clanRooms = rooms.filter(r => r.clan_id);
    addGroup('Comunidad', community);
    if (campaignRooms.length) addGroup('Campañas', campaignRooms);
    if (clanRooms.length) addGroup('Clanes', clanRooms);

    // Privados (susurros)
    const privHead = groupHeader('Privados');
    const newBtn = document.createElement('button');
    newBtn.textContent = '＋';
    newBtn.title = 'Nuevo susurro';
    newBtn.style.cssText = 'background:none;border:none;color:var(--gold);cursor:pointer;font-size:16px;';
    newBtn.addEventListener('click', openNewWhisper);
    privHead.appendChild(newBtn);
    sidebar.appendChild(privHead);
    const dmBox = document.createElement('div');
    dmBox.id = 'dm-list';
    sidebar.appendChild(dmBox);
    loadConversations(dmBox);
  }

  function addGroup(title, list) {
    sidebar.appendChild(groupHeader(title));
    list.forEach(r => {
      const b = document.createElement('button');
      b.className = 'chat-room-btn';
      b.dataset.room = r.id;
      b.style.cssText = roomBtnStyle(false);
      b.innerHTML = `<span>${r.icon || '💬'}</span> <span style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.name)}</span>${r.is_readonly ? '<span title="Solo lectura" style="opacity:.6;">🔒</span>' : ''}`;
      b.addEventListener('click', () => openRoom(r));
      sidebar.appendChild(b);
    });
  }

  async function loadConversations(box) {
    try {
      const convos = (await api.get('/chat/dm')).data ?? [];
      box.innerHTML = '';
      if (!convos.length) { box.innerHTML = '<div style="padding:6px 16px;font-size:12px;color:var(--ink-faint);">Sin susurros</div>'; return; }
      convos.forEach(c => {
        const b = document.createElement('button');
        b.className = 'chat-dm-btn';
        b.style.cssText = roomBtnStyle(false);
        b.innerHTML = `<span>💌</span> <span style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.other_name)}</span>${c.unread ? `<span style="background:var(--crimson);color:#fff;border-radius:10px;font-size:10px;padding:0 6px;">${c.unread}</span>` : ''}`;
        b.addEventListener('click', () => openDm({ id: c.other_id, name: c.other_name }));
        box.appendChild(b);
      });
    } catch (_) { /* sin personaje activo → sin susurros */ }
  }

  function highlightSidebar() {
    sidebar.querySelectorAll('.chat-room-btn').forEach(b => { b.style.cssText = roomBtnStyle(current?.kind === 'room' && b.dataset.room === current.id); });
  }

  /* ── Abrir sala ── */
  function openRoom(room) {
    stopPoll();
    current = { kind: 'room', id: room.id, name: room.name, room };
    lastTs = null;
    highlightSidebar();
    renderThreadShell(`${room.icon || '💬'} ${room.name}`, room.description || '', roomComposer(room));
    loadRoomMessages(true).then(() => startPoll());
  }

  async function loadRoomMessages(initial) {
    const box = main.querySelector('#msg-box');
    if (!box) return;
    try {
      const q = (!initial && lastTs) ? `?after=${encodeURIComponent(lastTs)}` : '';
      const msgs = (await api.get(`/chat/rooms/${current.id}/messages${q}`)).data ?? [];
      if (initial) box.innerHTML = '';
      msgs.forEach(m => box.appendChild(roomMessageEl(m)));
      if (msgs.length) { lastTs = msgs[msgs.length - 1].created_at; scrollBottom(box); }
      else if (initial && !box.childElementCount) box.innerHTML = placeholder('Sé el primero en escribir');
    } catch (err) { if (initial) box.innerHTML = `<div style="color:var(--crimson);padding:20px;">${esc(err.message)}</div>`; }
  }

  /* ── Abrir susurro ── */
  function openDm(other) {
    if (!activeChar) { toast.error('Sin personaje', 'Elige un personaje activo arriba'); return; }
    stopPoll();
    current = { kind: 'dm', id: other.id, name: other.name };
    highlightSidebar();
    renderThreadShell(`💌 ${other.name}`, 'Susurro privado (personaje ↔ personaje)', dmComposer(other));
    loadDmMessages(true).then(() => startPoll());
  }

  async function loadDmMessages(initial) {
    const box = main.querySelector('#msg-box');
    if (!box) return;
    try {
      const msgs = (await api.get(`/chat/dm/${current.id}`)).data ?? [];
      msgs.reverse(); // llega DESC → mostrar ASC
      box.innerHTML = '';
      if (!msgs.length) { box.innerHTML = placeholder('Aún no hay mensajes'); return; }
      msgs.forEach(m => box.appendChild(dmMessageEl(m)));
      scrollBottom(box);
    } catch (err) { if (initial) box.innerHTML = `<div style="color:var(--crimson);padding:20px;">${esc(err.message)}</div>`; }
  }

  /* ── Polling ── */
  function startPoll() {
    stopPoll();
    const tick = async () => {
      if (!page.isConnected) return stopPoll();
      if (current?.kind === 'room') await loadRoomMessages(false);
      else if (current?.kind === 'dm') await loadDmMessages(false);
      if (page.isConnected) pollTimer = setTimeout(tick, POLL_MS);
    };
    pollTimer = setTimeout(tick, POLL_MS);
  }
  function stopPoll() { if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } }

  /* ── Thread shell ── */
  function renderThreadShell(title, subtitle, composerEl) {
    main.innerHTML = '';
    const head = document.createElement('div');
    head.style.cssText = 'padding:14px 20px;border-bottom:1px solid var(--border);';
    head.innerHTML = `<div style="font-family:var(--font-display);font-size:17px;color:var(--gold);">${esc(title)}</div>${subtitle ? `<div style="font-size:12px;color:var(--ink-muted);">${esc(subtitle)}</div>` : ''}`;
    const box = document.createElement('div');
    box.id = 'msg-box';
    box.style.cssText = 'flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:10px;';
    main.appendChild(head);
    main.appendChild(box);
    if (composerEl) main.appendChild(composerEl);
  }

  /* ── Composers ── */
  function roomComposer(room) {
    const readonlyBlocked = room.is_readonly && !isStaff;
    if (readonlyBlocked) return note('Canal de solo lectura.');
    if (room.is_ic && !activeChar) return note('Este canal es In-Character: elige un personaje activo arriba para escribir.');

    const wrap = composerWrap();
    const input = wrap.querySelector('textarea');
    const sendBtn = wrap.querySelector('button');
    let mode = room.is_ic ? 'ic' : 'ooc';
    // Toggle IC/OOC solo si el canal no es forzado IC y hay personaje
    if (!room.is_ic && activeChar) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.style.cssText = 'background:var(--stone-light);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;color:var(--ink-muted);';
      const paint = () => { toggle.textContent = mode === 'ic' ? '🎭 IC' : '💬 OOC'; toggle.style.color = mode === 'ic' ? 'var(--gold)' : 'var(--ink-muted)'; };
      paint();
      toggle.addEventListener('click', () => { mode = mode === 'ic' ? 'ooc' : 'ic'; paint(); input.focus(); });
      wrap.insertBefore(toggle, input);
    }
    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      const roll = parseRoll(text);
      const body = roll
        ? { content: roll.label, message_type: 'dice', dice_result: roll }
        : { content: text, message_type: (mode === 'ic' && !activeChar) ? 'ooc' : mode };
      input.value = '';
      try {
        await api.post(`/chat/rooms/${room.id}/messages`, body);
        await loadRoomMessages(false);
      } catch (err) { toast.error('No se pudo enviar', err.message); input.value = text; }
    };
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    input.placeholder = room.is_ic ? 'Habla como tu personaje…  (o /roll 2d6+3)' : 'Escribe…  (/roll 1d20, Shift+Enter salto de línea)';
    return wrap;
  }

  function dmComposer(other) {
    const wrap = composerWrap();
    const input = wrap.querySelector('textarea');
    const sendBtn = wrap.querySelector('button');
    input.placeholder = `Susurrar a ${other.name}…`;
    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      try {
        await api.post(`/chat/dm/${other.id}`, { content: text, message_type: 'ic' });
        await loadDmMessages(false);
        const box = sidebar.querySelector('#dm-list'); if (box) loadConversations(box);
      } catch (err) { toast.error('No se pudo enviar', err.message); input.value = text; }
    };
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    return wrap;
  }

  /* ── Nuevo susurro ── */
  async function openNewWhisper() {
    if (!activeChar) { toast.error('Sin personaje', 'Elige un personaje activo arriba'); return; }
    let chars = [];
    try { chars = (await api.get('/characters?per_page=200')).data ?? []; } catch (_) { /* */ }
    const others = chars.filter(c => String(c.id) !== String(activeChar.id));
    if (!others.length) { toast.error('Sin destinatarios', 'No hay otros personajes'); return; }
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(9,8,10,0.7);z-index:1100;display:flex;align-items:center;justify-content:center;padding:20px;';
    const m = document.createElement('div');
    m.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:12px;padding:24px;width:min(400px,96vw);';
    m.innerHTML = `<h3 style="font-family:var(--font-display);color:var(--gold);margin:0 0 14px;font-size:18px;">Nuevo susurro</h3>
      <select id="wh-target" class="input">${others.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <div style="display:flex;gap:10px;margin-top:16px;"><button id="wh-cancel" class="btn" style="flex:1;background:transparent;border:1px solid var(--border);color:var(--ink-muted);">Cancelar</button><button id="wh-ok" class="btn btn-primary" style="flex:2;">Abrir</button></div>`;
    ov.appendChild(m); document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    m.querySelector('#wh-cancel').addEventListener('click', () => ov.remove());
    m.querySelector('#wh-ok').addEventListener('click', () => {
      const sel = m.querySelector('#wh-target');
      const name = sel.options[sel.selectedIndex].textContent;
      ov.remove();
      openDm({ id: sel.value, name });
    });
  }

  /* ── Message elements ── */
  function roomMessageEl(m) {
    if (m.message_type === 'system') {
      const s = document.createElement('div');
      s.style.cssText = 'align-self:center;background:var(--stone-light);border:1px solid var(--border);border-radius:12px;padding:5px 14px;font-size:12px;color:var(--ink-muted);text-align:center;max-width:90%;';
      s.textContent = m.content;
      return s;
    }
    const author = m.character_name || m.member_name || 'Anónimo';
    const isDice = m.message_type === 'dice' && m.dice_result;
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';
    const badge = m.character_name ? '🎭' : '💬';
    el.innerHTML = `
      <div style="width:32px;height:32px;border-radius:50%;background:var(--gold-glow);color:var(--gold);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;">${badge}</div>
      <div style="min-width:0;flex:1;">
        <div style="font-size:12px;color:var(--ink-muted);"><b style="color:${m.character_name ? 'var(--gold)' : 'var(--ink)'};">${esc(author)}</b> · ${fmtTime(m.created_at)}</div>
        ${isDice ? diceHtml(m.dice_result) : `<div style="font-size:14px;color:var(--ink);line-height:1.5;white-space:pre-wrap;word-break:break-word;${m.message_type === 'ic' ? 'font-family:var(--font-body);font-style:italic;' : ''}">${esc(m.content)}</div>`}
      </div>`;
    return el;
  }

  function dmMessageEl(m) {
    const mine = String(m.from_character_id) === String(activeChar?.id);
    const el = document.createElement('div');
    el.style.cssText = `display:flex;${mine ? 'justify-content:flex-end;' : ''}`;
    el.innerHTML = `<div style="max-width:78%;background:${mine ? 'var(--gold-glow)' : 'var(--stone-light)'};border:1px solid var(--border);border-radius:10px;padding:8px 12px;">
      <div style="font-size:11px;color:var(--ink-muted);margin-bottom:2px;">${esc(m.from_character_name)} · ${fmtTime(m.created_at)}</div>
      <div style="font-size:14px;color:var(--ink);white-space:pre-wrap;word-break:break-word;">${esc(m.content)}</div></div>`;
    return el;
  }

  function scrollBottom(box) { box.scrollTop = box.scrollHeight; }
}

/* ─── HELPERS (módulo) ─── */
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function fmtTime(iso) { try { return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } }
function placeholder(t) { return `<div style="margin:auto;text-align:center;color:var(--ink-faint);font-family:var(--font-display);">${t}</div>`; }
function note(t) { const d = document.createElement('div'); d.style.cssText = 'padding:14px 20px;border-top:1px solid var(--border);color:var(--ink-muted);font-size:13px;'; d.textContent = t; return d; }
function groupHeader(t) {
  const h = document.createElement('div');
  h.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 16px 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);';
  const s = document.createElement('span'); s.textContent = t; h.appendChild(s);
  return h;
}
function roomBtnStyle(active) {
  return `display:flex;align-items:center;gap:8px;width:100%;padding:8px 16px;border:none;cursor:pointer;font-family:var(--font-ui);font-size:13px;text-align:left;background:${active ? 'var(--gold-glow)' : 'transparent'};color:${active ? 'var(--gold)' : 'var(--ink)'};`;
}
function composerWrap() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:8px;align-items:flex-end;padding:12px 16px;border-top:1px solid var(--border);';
  const ta = document.createElement('textarea');
  ta.rows = 1;
  ta.className = 'input';
  ta.style.cssText = 'flex:1;resize:none;min-height:40px;max-height:120px;';
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.textContent = 'Enviar';
  wrap.appendChild(ta);
  wrap.appendChild(btn);
  return wrap;
}
function diceHtml(d) {
  const rolls = Array.isArray(d.rolls) ? d.rolls.join(', ') : '';
  return `<div style="display:inline-flex;align-items:center;gap:8px;background:var(--stone-light);border:1px solid var(--gold-dim);border-radius:8px;padding:6px 12px;margin-top:2px;">
    <span style="font-size:16px;">🎲</span>
    <span style="font-family:var(--font-mono);font-size:13px;color:var(--ink);">${esc(d.expression || '')} → [${esc(rolls)}]${d.modifier ? (d.modifier > 0 ? ' +' + d.modifier : ' ' + d.modifier) : ''} = <b style="color:var(--gold);">${esc(String(d.total))}</b></span>
  </div>`;
}
function parseRoll(text) {
  const t = text.trim();
  if (!/^\/(roll|r)\s+/i.test(t)) return null;
  const expr = t.replace(/^\/(roll|r)\s+/i, '').trim();
  const mm = expr.match(/^(\d*)d(\d+)\s*([+-]\s*\d+)?$/i);
  if (!mm) return null;
  const n = Math.min(parseInt(mm[1] || '1', 10), 50);
  const faces = Math.min(parseInt(mm[2], 10), 1000);
  const mod = mm[3] ? parseInt(mm[3].replace(/\s+/g, ''), 10) : 0;
  if (!n || !faces) return null;
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * faces));
  const total = rolls.reduce((a, b) => a + b, 0) + mod;
  const expression = `${n}d${faces}${mod ? (mod > 0 ? '+' + mod : mod) : ''}`;
  return { expression, rolls, modifier: mod, total, label: `🎲 ${expression} = ${total}` };
}
