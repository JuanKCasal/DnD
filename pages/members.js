import { api } from '../js/api.js';
import { toast } from '../js/components/toast.js';
import { auth } from '../js/auth.js';

const ROLE_CONFIG = {
  admin:  { label: 'Admin',   color: 'var(--crimson)',  bg: 'var(--crimson-dim)',        icon: '👑' },
  dm:     { label: 'DM',      color: 'var(--gold)',     bg: 'var(--gold-glow)',           icon: '🎲' },
  player: { label: 'Jugador', color: 'var(--ink-muted)',bg: 'var(--stone-light)',         icon: '🧙' },
};

export async function render(container) {
  container.innerHTML = '';
  const user = auth.getUser();
  const isAdmin = user?.role === 'admin';

  const page = document.createElement('div');
  page.className = 'page-members fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:1100px;';

  /* ── Header ── */
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;gap:16px;flex-wrap:wrap;';

  const titleBlock = document.createElement('div');
  const title = document.createElement('h2');
  title.style.cssText = 'font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;';
  title.textContent = '᛭ Miembros ᛭';
  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'color:var(--ink-muted);font-size:14px;margin:0;';
  subtitle.textContent = 'Comunidad de aventureros';
  titleBlock.appendChild(title);
  titleBlock.appendChild(subtitle);

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Buscar miembro...';
  searchInput.style.cssText = `
    background:var(--stone);border:1px solid var(--border);color:var(--ink);
    border-radius:8px;padding:8px 12px;font-family:var(--font-ui);font-size:13px;
    outline:none;min-width:180px;transition:border-color var(--dur-fast);
  `;
  searchInput.addEventListener('focus', () => searchInput.style.borderColor = 'var(--gold-dim)');
  searchInput.addEventListener('blur', () => searchInput.style.borderColor = 'var(--border)');

  const roleFilter = buildSelect([
    ['', 'Todos los roles'],
    ['admin', '👑 Admin'],
    ['dm', '🎲 DM'],
    ['player', '🧙 Jugador'],
  ]);

  controls.appendChild(searchInput);
  controls.appendChild(roleFilter);

  header.appendChild(titleBlock);
  header.appendChild(controls);
  page.appendChild(header);

  /* ── Grid ── */
  const grid = document.createElement('div');
  grid.id = 'members-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;';
  page.appendChild(grid);

  container.appendChild(page);

  /* ── Load ── */
  let allMembers = [];
  try {
    const res = await api.get('/members?per_page=100');
    allMembers = res.data ?? [];
  } catch (err) {
    grid.innerHTML = `<div style="color:var(--crimson);padding:20px;">Error: ${err.message}</div>`;
    return;
  }

  renderGrid(allMembers);

  let filterTimer;
  const doFilter = () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      const q = searchInput.value.toLowerCase();
      const role = roleFilter.value;
      const filtered = allMembers.filter(m =>
        (!q || m.username.toLowerCase().includes(q) || (m.display_name || '').toLowerCase().includes(q)) &&
        (!role || m.role === role)
      );
      renderGrid(filtered);
    }, 200);
  };
  searchInput.addEventListener('input', doFilter);
  roleFilter.addEventListener('change', doFilter);

  /* ── Render grid ── */
  function renderGrid(members) {
    grid.innerHTML = '';
    if (!members.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:80px;color:var(--ink-muted);">
        <div style="font-size:40px;margin-bottom:12px;">👥</div>
        <div>No se encontraron miembros</div>
      </div>`;
      return;
    }
    members.forEach((m, i) => grid.appendChild(buildMemberCard(m, i)));
  }

  /* ── Member card ── */
  function buildMemberCard(m, index) {
    const rc = ROLE_CONFIG[m.role] || ROLE_CONFIG.player;
    const isSelf = String(m.id) === String(user.id);

    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-radius:12px;
      padding:20px;cursor:pointer;position:relative;
      animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${index * 30}ms both;
      transition:transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur-fast);
    `;
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = '0 0 0 1px var(--gold-dim), 0 4px 20px var(--gold-glow)';
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; card.style.boxShadow = ''; });
    card.addEventListener('click', () => openProfile(m));

    /* Avatar */
    const avatarRow = document.createElement('div');
    avatarRow.style.cssText = 'display:flex;align-items:center;gap:14px;margin-bottom:14px;';

    const avatar = document.createElement('div');
    const initials = (m.display_name || m.username || '?').slice(0, 2).toUpperCase();
    const avatarColors = ['#C9A84C','#9B2335','#3D6B4F','#4a5568','#6b46c1'];
    const colorIdx = m.username.charCodeAt(0) % avatarColors.length;
    avatar.style.cssText = `
      width:48px;height:48px;border-radius:50%;flex-shrink:0;
      background:${avatarColors[colorIdx]}22;border:2px solid ${avatarColors[colorIdx]}66;
      display:flex;align-items:center;justify-content:center;
      font-family:var(--font-display);font-size:16px;font-weight:700;
      color:${avatarColors[colorIdx]};
    `;
    avatar.textContent = initials;

    const nameBlock = document.createElement('div');
    nameBlock.style.cssText = 'flex:1;min-width:0;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-weight:600;color:var(--ink);font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    nameEl.textContent = m.display_name || m.username;

    const usernameEl = document.createElement('div');
    usernameEl.style.cssText = 'font-size:12px;color:var(--ink-muted);margin-top:1px;';
    usernameEl.textContent = '@' + m.username;

    nameBlock.appendChild(nameEl);
    nameBlock.appendChild(usernameEl);
    avatarRow.appendChild(avatar);
    avatarRow.appendChild(nameBlock);
    card.appendChild(avatarRow);

    /* Role badge */
    const roleBadge = document.createElement('span');
    roleBadge.style.cssText = `
      display:inline-flex;align-items:center;gap:5px;
      padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;
      background:${rc.bg};color:${rc.color};border:1px solid ${rc.color}33;
    `;
    roleBadge.innerHTML = `${rc.icon} ${rc.label}`;

    /* Status dot */
    const statusDot = document.createElement('span');
    statusDot.style.cssText = `
      display:inline-block;width:6px;height:6px;border-radius:50%;
      background:${m.active ? 'var(--success)' : 'var(--ink-faint)'};
      margin-left:8px;
    `;
    statusDot.title = m.active ? 'Activo' : 'Inactivo';

    const badges = document.createElement('div');
    badges.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:6px;';
    badges.appendChild(roleBadge);
    badges.appendChild(statusDot);
    if (isSelf) {
      const selfBadge = document.createElement('span');
      selfBadge.style.cssText = 'font-size:10px;color:var(--ink-muted);padding:2px 7px;border-radius:10px;background:var(--stone-light);border:1px solid var(--border);';
      selfBadge.textContent = 'Tú';
      badges.appendChild(selfBadge);
    }
    card.appendChild(badges);

    if (m.discord_handle) {
      const discord = document.createElement('div');
      discord.style.cssText = 'font-size:12px;color:var(--ink-muted);margin-top:10px;';
      discord.textContent = '🎮 ' + m.discord_handle;
      card.appendChild(discord);
    }

    /* Admin actions */
    if (isAdmin && !isSelf) {
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border);';

      const editBtn = document.createElement('button');
      editBtn.style.cssText = `
        flex:1;padding:6px;border-radius:6px;font-size:12px;cursor:pointer;
        background:var(--stone-light);color:var(--ink);border:1px solid var(--border);
        transition:all var(--dur-fast);
      `;
      editBtn.textContent = '✏️ Editar rol';
      editBtn.addEventListener('click', e => { e.stopPropagation(); openEditRole(m, card); });

      const toggleBtn = document.createElement('button');
      toggleBtn.style.cssText = `
        padding:6px 10px;border-radius:6px;font-size:12px;cursor:pointer;
        background:${m.active ? 'var(--crimson-dim)' : 'var(--stone-light)'};
        color:${m.active ? 'var(--crimson)' : 'var(--ink-muted)'};
        border:1px solid ${m.active ? 'var(--crimson)33' : 'var(--border)'};
        transition:all var(--dur-fast);
      `;
      toggleBtn.textContent = m.active ? '🚫' : '✅';
      toggleBtn.title = m.active ? 'Desactivar' : 'Activar';
      toggleBtn.addEventListener('click', async e => {
        e.stopPropagation();
        try {
          await api.put(`/members/${m.id}`, { active: !m.active });
          m.active = !m.active;
          toast.success(m.active ? 'Miembro activado' : 'Miembro desactivado');
          // Re-render grid entry
          const fresh = await api.get(`/members/${m.id}`);
          Object.assign(m, fresh.data);
          const newCard = buildMemberCard(m, 0);
          card.replaceWith(newCard);
        } catch (err) { toast.error(err.message); }
      });

      actions.appendChild(editBtn);
      actions.appendChild(toggleBtn);
      card.appendChild(actions);
    }

    return card;
  }

  /* ── Profile modal ── */
  async function openProfile(m) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(9,8,10,0.85);backdrop-filter:blur(8px);
      z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;
      animation:fadeIn var(--dur-fast) ease;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-radius:14px;
      width:100%;max-width:460px;max-height:85vh;overflow-y:auto;
      animation:modalIn var(--dur-normal) var(--ease-spring);
      box-shadow:0 20px 60px rgba(0,0,0,0.6);
    `;

    const rc = ROLE_CONFIG[m.role] || ROLE_CONFIG.player;
    const initials = (m.display_name || m.username || '?').slice(0, 2).toUpperCase();
    const avatarColors = ['#C9A84C','#9B2335','#3D6B4F','#4a5568','#6b46c1'];
    const colorIdx = m.username.charCodeAt(0) % avatarColors.length;
    const color = avatarColors[colorIdx];

    modal.innerHTML = `
      <div style="padding:28px 28px 0;">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
          <div style="width:64px;height:64px;border-radius:50%;background:${color}22;border:2px solid ${color}66;
               display:flex;align-items:center;justify-content:center;font-family:var(--font-display);
               font-size:22px;font-weight:700;color:${color};flex-shrink:0;">${initials}</div>
          <div style="flex:1;">
            <div style="font-family:var(--font-display);font-size:20px;color:var(--gold);">${m.display_name || m.username}</div>
            <div style="font-size:13px;color:var(--ink-muted);">@${m.username}</div>
            <span style="display:inline-flex;align-items:center;gap:5px;margin-top:6px;
              padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;
              background:${rc.bg};color:${rc.color};border:1px solid ${rc.color}33;">
              ${rc.icon} ${rc.label}
            </span>
          </div>
          <button id="profile-close" style="background:none;border:none;color:var(--ink-muted);font-size:20px;cursor:pointer;align-self:flex-start;">✕</button>
        </div>
        ${m.bio ? `<div style="font-size:13px;color:var(--ink-muted);line-height:1.6;margin-bottom:16px;padding:12px;background:var(--stone-light);border-radius:8px;">${m.bio}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;">
          ${m.discord_handle ? `<div style="background:var(--stone-light);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--ink-muted);">🎮 ${m.discord_handle}</div>` : ''}
          ${m.timezone ? `<div style="background:var(--stone-light);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--ink-muted);">🌐 ${m.timezone}</div>` : ''}
        </div>
      </div>
      <div id="profile-chars" style="padding:0 28px 28px;">
        <div style="font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Personajes</div>
        <div style="color:var(--ink-muted);font-size:13px;">Cargando...</div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    modal.querySelector('#profile-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    // Load characters
    const charsEl = modal.querySelector('#profile-chars div:last-child');
    try {
      const res = await api.get(`/members/${m.id}/characters`);
      const chars = res.data ?? [];
      if (!chars.length) {
        charsEl.textContent = 'Sin personajes';
        return;
      }
      charsEl.innerHTML = '';
      chars.forEach(c => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--stone-light);border-radius:8px;margin-bottom:6px;';
        row.innerHTML = `
          <span style="font-size:18px;">🧙</span>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:13px;color:var(--ink);">${c.name || 'Sin nombre'}</div>
            <div style="font-size:11px;color:var(--ink-muted);">Nv.${c.level || 1} ${c.race || ''} ${c.char_class || ''}</div>
          </div>
          <div style="font-size:11px;color:var(--ink-muted);">${c.hp ?? 0}/${c.max_hp ?? 0} HP</div>
        `;
        charsEl.appendChild(row);
      });
    } catch (_) { charsEl.textContent = 'No se pudieron cargar'; }
  }

  /* ── Edit role modal ── */
  function openEditRole(m, card) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(9,8,10,0.85);backdrop-filter:blur(8px);
      z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-radius:14px;
      padding:28px;width:100%;max-width:380px;
      animation:modalIn var(--dur-normal) var(--ease-spring);
      box-shadow:0 20px 60px rgba(0,0,0,0.6);
    `;

    const h3 = document.createElement('h3');
    h3.style.cssText = 'font-family:var(--font-display);font-size:18px;color:var(--gold);margin:0 0 18px;';
    h3.textContent = `Editar: ${m.display_name || m.username}`;
    modal.appendChild(h3);

    // Role select
    const roleLabel = buildLabel('ROL');
    const roleSelect = buildSelect([
      ['player', '🧙 Jugador'],
      ['dm', '🎲 DM'],
      ['admin', '👑 Admin'],
    ]);
    roleSelect.value = m.role;
    applyInputStyle(roleSelect);
    modal.appendChild(roleLabel);
    modal.appendChild(roleSelect);

    // Discord handle
    const discordLabel = buildLabel('DISCORD');
    discordLabel.style.marginTop = '12px';
    const discordInput = document.createElement('input');
    discordInput.type = 'text';
    discordInput.value = m.discord_handle || '';
    discordInput.placeholder = 'usuario#0000';
    applyInputStyle(discordInput);
    modal.appendChild(discordLabel);
    modal.appendChild(discordInput);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:20px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.textContent = 'Cancelar';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Guardar';

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    modal.appendChild(footer);

    const close = () => overlay.remove();
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      try {
        const body = { role: roleSelect.value };
        if (discordInput.value !== m.discord_handle) body.discord_handle = discordInput.value;
        await api.put(`/members/${m.id}`, body);
        m.role = roleSelect.value;
        m.discord_handle = discordInput.value;
        toast.success('Miembro actualizado');
        close();
        const newCard = buildMemberCard(m, 0);
        card.replaceWith(newCard);
      } catch (err) { toast.error(err.message); saveBtn.disabled = false; }
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  /* ── Helpers ── */
  function buildSelect(options) {
    const sel = document.createElement('select');
    sel.style.cssText = `
      background:var(--stone);border:1px solid var(--border);color:var(--ink);
      border-radius:8px;padding:8px 12px;font-family:var(--font-ui);font-size:13px;cursor:pointer;
    `;
    options.forEach(([val, lbl]) => {
      const o = document.createElement('option');
      o.value = val;
      o.textContent = lbl;
      sel.appendChild(o);
    });
    return sel;
  }

  function buildLabel(text) {
    const l = document.createElement('label');
    l.style.cssText = 'display:block;margin-bottom:5px;font-size:11px;color:var(--ink-muted);font-weight:600;letter-spacing:0.05em;';
    l.textContent = text;
    return l;
  }

  function applyInputStyle(el) {
    el.style.cssText = `
      width:100%;box-sizing:border-box;
      background:var(--stone-light);border:1px solid var(--border);color:var(--ink);
      border-radius:8px;padding:9px 12px;font-family:var(--font-ui);font-size:13px;
      outline:none;transition:border-color var(--dur-fast);display:block;
    `;
    el.addEventListener('focus', () => el.style.borderColor = 'var(--gold-dim)');
    el.addEventListener('blur', () => el.style.borderColor = 'var(--border)');
  }
}
