import { api } from '../js/api.js';
import { auth } from '../js/auth.js';
import { toast } from '../js/components/toast.js';

const ROLE_CONFIG = {
  admin:  { label: 'Admin',   color: 'var(--crimson)',   bg: 'var(--crimson-dim)', icon: '👑' },
  dm:     { label: 'DM',      color: 'var(--gold)',      bg: 'var(--gold-glow)',   icon: '🎲' },
  player: { label: 'Jugador', color: 'var(--ink-muted)', bg: 'var(--stone-light)', icon: '🧙' },
};

const AVATAR_COLORS = ['#C9A84C', '#9B2335', '#3D6B4F', '#4a5568', '#6b46c1'];

function avatarColor(seed) {
  const s = (seed || '?').charCodeAt(0) || 0;
  return AVATAR_COLORS[s % AVATAR_COLORS.length];
}

function fmtDate(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return '—'; }
}

function fmtRelative(v) {
  if (!v) return 'nunca';
  const d = new Date(v);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 2592000) return `hace ${Math.floor(diff / 86400)} d`;
  return fmtDate(v);
}

export async function render(container) {
  container.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'page-profile fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:1000px;';
  page.innerHTML = `<div style="color:var(--ink-muted);padding:40px;">Cargando tu perfil…</div>`;
  container.appendChild(page);

  /* ── Cargar datos ── */
  let me;
  try {
    const res = await api.get('/auth/me');
    me = res.data ?? res;
    auth.setUser(me); // mantener localStorage sincronizado
  } catch (err) {
    me = auth.getUser();
    if (!me) {
      page.innerHTML = `<div style="color:var(--crimson);padding:40px;">No se pudo cargar el perfil: ${err.message}</div>`;
      return;
    }
  }

  let characters = [];
  try {
    const res = await api.get(`/members/${me.id}/characters`);
    characters = (res.data ?? []).filter(c => c.active !== false);
  } catch (_) { /* sin personajes */ }

  paint();

  /* ============================================================== */
  function paint() {
    page.innerHTML = '';

    page.appendChild(buildHeader());
    page.appendChild(buildStats());
    page.appendChild(buildActiveCharacter());
    if (characters.length) page.appendChild(buildCharacters());
    page.appendChild(buildSecurity());
    page.appendChild(buildSessionCard());
  }

  /* ── Cabecera + datos ── */
  function buildHeader() {
    const rc = ROLE_CONFIG[me.role] || ROLE_CONFIG.player;
    const color = avatarColor(me.username);
    const initials = (me.display_name || me.username || '?').slice(0, 2).toUpperCase();

    const card = document.createElement('div');
    card.style.cssText = `
      position:relative;overflow:hidden;border:1px solid var(--border);border-radius:16px;
      background:var(--stone);margin-bottom:20px;
      animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) both;
    `;

    const banner = document.createElement('div');
    banner.style.cssText = `height:96px;background:
      radial-gradient(120% 140% at 12% -10%, var(--gold-glow), transparent 60%),
      linear-gradient(120deg, ${color}22, var(--stone-light));
      border-bottom:1px solid var(--border);`;
    card.appendChild(banner);

    const body = document.createElement('div');
    body.style.cssText = 'padding:0 28px 24px;';

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;align-items:flex-end;gap:18px;margin-top:-42px;flex-wrap:wrap;';

    // Avatar (imagen o iniciales)
    const av = document.createElement('div');
    av.style.cssText = `
      width:88px;height:88px;border-radius:50%;flex-shrink:0;border:4px solid var(--stone);
      background:${color}22;box-shadow:0 4px 16px rgba(0,0,0,0.18);
      display:flex;align-items:center;justify-content:center;overflow:hidden;
      font-family:var(--font-display);font-size:30px;font-weight:700;color:${color};
    `;
    if (me.avatar_url) {
      const img = document.createElement('img');
      img.src = me.avatar_url;
      img.alt = me.display_name || me.username;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      img.onerror = () => { av.textContent = initials; };
      av.appendChild(img);
    } else {
      av.textContent = initials;
    }

    const idBlock = document.createElement('div');
    idBlock.style.cssText = 'flex:1;min-width:200px;padding-bottom:2px;';
    idBlock.innerHTML = `
      <div style="font-family:var(--font-display);font-size:26px;color:var(--ink);line-height:1.15;">${esc(me.display_name || me.username)}</div>
      <div style="font-size:13px;color:var(--ink-muted);margin-top:2px;">@${esc(me.username)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${rc.bg};color:${rc.color};border:1px solid ${rc.color}33;">${rc.icon} ${rc.label}</span>
        ${me.rank ? `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${me.rank.color_hex}1a;color:${me.rank.color_hex};border:1px solid ${me.rank.color_hex}44;">⚜️ ${esc(me.rank.name)}</span>` : ''}
      </div>`;

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-primary';
    editBtn.textContent = '✏️ Editar perfil';
    editBtn.style.alignSelf = 'flex-end';
    editBtn.addEventListener('click', openEditModal);

    top.appendChild(av);
    top.appendChild(idBlock);
    top.appendChild(editBtn);
    body.appendChild(top);

    // Rejilla de metadatos
    const meta = document.createElement('div');
    meta.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:22px;';
    const items = [
      ['✉️', 'Correo', me.email || '—'],
      ['🎮', 'Discord', me.discord_handle || '—'],
      ['🌐', 'Zona horaria', me.timezone || '—'],
      ['📅', 'Miembro desde', fmtDate(me.created_at)],
      ['🕑', 'Última conexión', fmtRelative(me.last_seen_at)],
    ];
    items.forEach(([ic, k, v]) => {
      const cell = document.createElement('div');
      cell.style.cssText = 'background:var(--stone-light);border:1px solid var(--border);border-radius:10px;padding:10px 12px;';
      cell.innerHTML = `<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-faint);font-weight:600;">${ic} ${k}</div>
        <div style="font-size:13px;color:var(--ink);margin-top:3px;word-break:break-word;">${esc(String(v))}</div>`;
      meta.appendChild(cell);
    });
    body.appendChild(meta);

    if (me.bio) {
      const bio = document.createElement('div');
      bio.style.cssText = 'margin-top:14px;font-family:var(--font-body);font-size:15px;color:var(--ink-muted);line-height:1.6;padding:14px 16px;background:var(--stone-light);border:1px solid var(--border);border-radius:10px;';
      bio.textContent = me.bio;
      body.appendChild(bio);
    }

    card.appendChild(body);
    return card;
  }

  /* ── Estadísticas ── */
  function buildStats() {
    const xp = me.xp || {};
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:20px;';
    const stats = [
      ['✨', 'XP total', xp.total_xp ?? 0],
      ['📜', 'Sesiones', xp.sessions_attended ?? 0],
      ['💬', 'Mensajes', xp.messages_sent ?? 0],
      ['🧙', 'Personajes', me.character_count ?? characters.length],
    ];
    stats.forEach(([ic, label, val], i) => {
      const c = document.createElement('div');
      c.style.cssText = `
        background:var(--stone);border:1px solid var(--border);border-radius:12px;padding:18px 20px;
        animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${i * 40}ms both;
      `;
      c.innerHTML = `
        <div style="font-size:20px;">${ic}</div>
        <div style="font-family:var(--font-mono);font-size:26px;font-weight:700;color:var(--gold);margin-top:6px;">${Number(val).toLocaleString('es-CL')}</div>
        <div style="font-size:12px;color:var(--ink-muted);margin-top:2px;">${label}</div>`;
      wrap.appendChild(c);
    });
    return wrap;
  }

  /* ── Personaje activo ── */
  function buildActiveCharacter() {
    const card = sectionCard('🎭 Personaje activo', 'Identidad con la que hablas en el chat y los clanes.');

    if (!characters.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:var(--ink-muted);font-size:13px;';
      empty.innerHTML = `Aún no tienes personajes. <a href="#/characters" style="color:var(--gold);">Crea tu primer personaje →</a>`;
      card.appendChild(empty);
      return card;
    }

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;';

    const sel = document.createElement('select');
    applyInputStyle(sel);
    sel.style.maxWidth = '280px';
    const none = document.createElement('option');
    none.value = ''; none.textContent = '🎭 Sin personaje';
    sel.appendChild(none);
    characters.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = `🎭 ${c.name} · Nv.${c.level ?? 1}`;
      sel.appendChild(o);
    });
    sel.value = me.active_character_id || '';

    sel.addEventListener('change', async () => {
      sel.disabled = true;
      try {
        await api.put('/me/active-character', { character_id: sel.value || null });
        me.active_character_id = sel.value || null;
        const u = auth.getUser();
        if (u) { u.active_character_id = me.active_character_id; auth.setUser(u); }
        // Sincronizar el selector de la barra superior
        const navSel = document.querySelector('.nav-char-switch');
        if (navSel) navSel.value = me.active_character_id || '';
        toast.success('Personaje activo actualizado');
      } catch (err) {
        toast.error(err.message);
        sel.value = me.active_character_id || '';
      } finally { sel.disabled = false; }
    });

    row.appendChild(sel);
    card.appendChild(row);
    return card;
  }

  /* ── Grid de personajes ── */
  function buildCharacters() {
    const card = sectionCard('Mis personajes', `${characters.length} personaje${characters.length === 1 ? '' : 's'}`);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;';

    characters.forEach(c => {
      const isActive = String(c.id) === String(me.active_character_id || '');
      const item = document.createElement('div');
      item.style.cssText = `
        display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;
        background:var(--stone-light);border:1px solid ${isActive ? 'var(--gold-dim)' : 'var(--border)'};
        transition:border-color var(--dur-fast),transform var(--dur-fast) var(--ease-spring);
      `;
      item.addEventListener('mouseenter', () => item.style.transform = 'translateY(-2px)');
      item.addEventListener('mouseleave', () => item.style.transform = '');

      const pic = document.createElement('div');
      pic.style.cssText = `width:44px;height:44px;border-radius:10px;flex-shrink:0;overflow:hidden;
        background:${avatarColor(c.name)}22;display:flex;align-items:center;justify-content:center;font-size:20px;`;
      if (c.portrait_url) {
        const img = document.createElement('img');
        img.src = c.portrait_url; img.alt = c.name;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        img.onerror = () => { pic.textContent = '🧙'; };
        pic.appendChild(img);
      } else pic.textContent = '🧙';

      const info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      info.innerHTML = `
        <div style="font-weight:600;font-size:13px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.name || 'Sin nombre')}</div>
        <div style="font-size:11px;color:var(--ink-muted);">Nv.${c.level ?? 1} · ${esc(c.race || '')} ${esc(c.char_class || '')}</div>
        <div style="font-size:11px;color:var(--ink-faint);margin-top:2px;">❤️ ${c.hp ?? 0}/${c.max_hp ?? 0} · 🛡️ ${c.ac ?? '—'}</div>`;

      item.appendChild(pic);
      item.appendChild(info);

      if (isActive) {
        const badge = document.createElement('span');
        badge.style.cssText = 'font-size:10px;font-weight:600;color:var(--gold);background:var(--gold-glow);border:1px solid var(--gold-dim);padding:2px 8px;border-radius:10px;flex-shrink:0;';
        badge.textContent = 'Activo';
        item.appendChild(badge);
      } else {
        const setBtn = document.createElement('button');
        setBtn.title = 'Hacer activo';
        setBtn.style.cssText = 'background:var(--stone);border:1px solid var(--border);color:var(--ink-muted);border-radius:8px;padding:5px 8px;font-size:12px;cursor:pointer;flex-shrink:0;';
        setBtn.textContent = '🎭';
        setBtn.addEventListener('click', async () => {
          setBtn.disabled = true;
          try {
            await api.put('/me/active-character', { character_id: c.id });
            me.active_character_id = String(c.id);
            const u = auth.getUser();
            if (u) { u.active_character_id = me.active_character_id; auth.setUser(u); }
            const navSel = document.querySelector('.nav-char-switch');
            if (navSel) navSel.value = me.active_character_id;
            toast.success(`${c.name} es tu personaje activo`);
            paint();
          } catch (err) { toast.error(err.message); setBtn.disabled = false; }
        });
        item.appendChild(setBtn);
      }
      grid.appendChild(item);
    });

    card.appendChild(grid);
    return card;
  }

  /* ── Seguridad ── */
  function buildSecurity() {
    const card = sectionCard('🔒 Seguridad', 'Cambia tu contraseña de acceso.');

    const form = document.createElement('div');
    form.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;align-items:end;';

    const cur = pwInput('Contraseña actual');
    const nw = pwInput('Nueva contraseña');
    const conf = pwInput('Confirmar nueva');

    form.appendChild(cur.wrap);
    form.appendChild(nw.wrap);
    form.appendChild(conf.wrap);
    card.appendChild(form);

    const err = document.createElement('div');
    err.style.cssText = 'color:var(--crimson);font-size:12px;margin-top:10px;min-height:16px;';
    card.appendChild(err);

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Actualizar contraseña';
    btn.style.marginTop = '6px';
    btn.addEventListener('click', async () => {
      err.textContent = '';
      if (!cur.input.value || !nw.input.value) { err.textContent = 'Completa todos los campos.'; return; }
      if (nw.input.value.length < 8) { err.textContent = 'La nueva contraseña debe tener al menos 8 caracteres.'; return; }
      if (nw.input.value !== conf.input.value) { err.textContent = 'Las contraseñas nuevas no coinciden.'; return; }
      btn.disabled = true;
      try {
        await api.post('/auth/change-password', { current_password: cur.input.value, new_password: nw.input.value });
        toast.success('Contraseña actualizada');
        cur.input.value = nw.input.value = conf.input.value = '';
      } catch (e2) { err.textContent = e2.message; }
      finally { btn.disabled = false; }
    });
    card.appendChild(btn);
    return card;
  }

  /* ── Sesión ── */
  function buildSessionCard() {
    const card = sectionCard('Sesión', 'Cierra tu sesión en este dispositivo.');
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '🚪 Cerrar sesión';
    btn.style.cssText += 'color:var(--crimson);border-color:var(--crimson);';
    btn.addEventListener('click', auth.logout);
    card.appendChild(btn);
    return card;
  }

  /* ── Modal editar perfil ── */
  function openEditModal() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(9,8,10,0.85);backdrop-filter:blur(8px);
      z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn var(--dur-fast) ease;`;

    const modal = document.createElement('div');
    modal.style.cssText = `background:var(--stone);border:1px solid var(--border);border-radius:14px;padding:28px;
      width:100%;max-width:460px;max-height:90vh;overflow-y:auto;animation:modalIn var(--dur-normal) var(--ease-spring);
      box-shadow:0 20px 60px rgba(0,0,0,0.6);`;

    const h3 = document.createElement('h3');
    h3.style.cssText = 'font-family:var(--font-display);font-size:18px;color:var(--gold);margin:0 0 20px;';
    h3.textContent = 'Editar perfil';
    modal.appendChild(h3);

    function field(label, el, mt = '12px') {
      const lbl = buildLabel(label);
      lbl.style.marginTop = mt;
      modal.appendChild(lbl);
      modal.appendChild(el);
      return el;
    }

    const nameI = document.createElement('input');
    nameI.type = 'text'; nameI.value = me.display_name || ''; nameI.placeholder = 'Nombre visible';
    applyInputStyle(nameI); field('NOMBRE', nameI, '0');

    const avatarI = document.createElement('input');
    avatarI.type = 'url'; avatarI.value = me.avatar_url || ''; avatarI.placeholder = 'https://…/avatar.png';
    applyInputStyle(avatarI); field('URL DE AVATAR', avatarI);

    const discordI = document.createElement('input');
    discordI.type = 'text'; discordI.value = me.discord_handle || ''; discordI.placeholder = 'usuario#0000';
    applyInputStyle(discordI); field('DISCORD', discordI);

    const tzI = document.createElement('input');
    tzI.type = 'text'; tzI.value = me.timezone || ''; tzI.placeholder = 'America/Santiago';
    applyInputStyle(tzI); field('ZONA HORARIA', tzI);

    const bioI = document.createElement('textarea');
    bioI.value = me.bio || ''; bioI.placeholder = 'Cuéntanos sobre tu aventurero…'; bioI.rows = 3;
    applyInputStyle(bioI); bioI.style.resize = 'vertical'; field('BIO', bioI);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:22px;';
    const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'Cancelar';
    const save = document.createElement('button'); save.className = 'btn btn-primary'; save.textContent = 'Guardar';
    footer.appendChild(cancel); footer.appendChild(save);
    modal.appendChild(footer);

    const close = () => overlay.remove();
    cancel.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    save.addEventListener('click', async () => {
      const body = {};
      if (nameI.value !== (me.display_name || '')) body.display_name = nameI.value;
      if (avatarI.value !== (me.avatar_url || '')) body.avatar_url = avatarI.value;
      if (discordI.value !== (me.discord_handle || '')) body.discord_handle = discordI.value;
      if (tzI.value !== (me.timezone || '')) body.timezone = tzI.value;
      if (bioI.value !== (me.bio || '')) body.bio = bioI.value;
      if (!Object.keys(body).length) { close(); return; }
      save.disabled = true;
      try {
        await api.put(`/members/${me.id}`, body);
        Object.assign(me, body);
        auth.setUser(me);
        // Refrescar nombre/rol en la barra superior
        const dn = document.querySelector('.nav-username');
        if (dn) dn.textContent = me.display_name || me.username;
        toast.success('Perfil actualizado');
        close();
        paint();
      } catch (err) { toast.error(err.message); save.disabled = false; }
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  /* ── Helpers ── */
  function sectionCard(title, subtitle) {
    const card = document.createElement('div');
    card.style.cssText = `background:var(--stone);border:1px solid var(--border);border-radius:14px;padding:22px 24px;margin-bottom:20px;
      animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) both;`;
    const h = document.createElement('div');
    h.style.cssText = 'margin-bottom:16px;';
    h.innerHTML = `<div style="font-family:var(--font-display);font-size:17px;color:var(--ink);">${title}</div>
      ${subtitle ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:2px;">${subtitle}</div>` : ''}`;
    card.appendChild(h);
    return card;
  }

  function pwInput(placeholder) {
    const wrap = document.createElement('div');
    const lbl = buildLabel(placeholder.toUpperCase());
    const input = document.createElement('input');
    input.type = 'password'; input.placeholder = placeholder; input.autocomplete = 'off';
    applyInputStyle(input);
    wrap.appendChild(lbl); wrap.appendChild(input);
    return { wrap, input };
  }

  function buildLabel(text) {
    const l = document.createElement('label');
    l.style.cssText = 'display:block;margin-bottom:5px;font-size:11px;color:var(--ink-muted);font-weight:600;letter-spacing:0.05em;';
    l.textContent = text;
    return l;
  }

  function applyInputStyle(el) {
    el.style.cssText = `width:100%;box-sizing:border-box;background:var(--stone-light);border:1px solid var(--border);
      color:var(--ink);border-radius:8px;padding:9px 12px;font-family:var(--font-ui);font-size:13px;
      outline:none;transition:border-color var(--dur-fast);display:block;`;
    el.addEventListener('focus', () => el.style.borderColor = 'var(--gold-dim)');
    el.addEventListener('blur', () => el.style.borderColor = 'var(--border)');
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
}
