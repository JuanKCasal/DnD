import { api } from '../js/api.js';
import { toast } from '../js/components/toast.js';
import { auth } from '../js/auth.js';

/* ── marked.js CDN (lazy load) ─────────────────────────────────── */
async function getMarked() {
  if (window.marked) return window.marked;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  window.marked.setOptions({ breaks: true, gfm: true });
  return window.marked;
}

/* ── MAIN RENDER ────────────────────────────────────────────────── */
export async function render(container) {
  container.innerHTML = '';

  const user = auth.getUser();
  const canCreate = user?.role === 'admin' || user?.role === 'dm';

  const page = document.createElement('div');
  page.className = 'page-sessions fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:1100px;';

  /* ── Header ── */
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;gap:16px;flex-wrap:wrap;';

  const titleBlock = document.createElement('div');
  const title = document.createElement('h2');
  title.style.cssText = 'font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;';
  title.textContent = '᛭ Sesiones ᛭';
  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'color:var(--ink-muted);font-size:14px;margin:0;';
  subtitle.textContent = 'Crónicas de las aventuras';
  titleBlock.appendChild(title);
  titleBlock.appendChild(subtitle);

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;';

  /* Campaign selector */
  const campSelect = document.createElement('select');
  campSelect.style.cssText = `
    background:var(--stone);border:1px solid var(--border);color:var(--ink);
    border-radius:8px;padding:8px 12px;font-family:var(--font-ui);font-size:13px;
    cursor:pointer;min-width:180px;
  `;
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Todas las campañas';
  campSelect.appendChild(defaultOpt);

  if (canCreate) {
    const createBtn = document.createElement('button');
    createBtn.className = 'btn btn-primary';
    createBtn.style.cssText = 'display:flex;align-items:center;gap:8px;white-space:nowrap;';
    createBtn.innerHTML = '<span style="font-size:18px;">+</span> Nueva Sesión';
    createBtn.addEventListener('click', () => openModal());
    controls.appendChild(campSelect);
    controls.appendChild(createBtn);
  } else {
    controls.appendChild(campSelect);
  }

  header.appendChild(titleBlock);
  header.appendChild(controls);

  /* ── Timeline list ── */
  const list = document.createElement('div');
  list.id = 'sessions-list';

  page.appendChild(header);
  page.appendChild(list);
  container.appendChild(page);

  /* ── Load campaigns for selector ── */
  let campaigns = [];
  try {
    const res = await api.get('/campaigns?status=active&per_page=100');
    campaigns = res.data ?? [];
    campaigns.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      campSelect.appendChild(opt);
    });
  } catch (_) { /* non-fatal */ }

  campSelect.addEventListener('change', () => loadSessions());
  loadSessions();

  /* ═══════════════════════════════════════════════════════════════
     LOAD SESSIONS
  ═══════════════════════════════════════════════════════════════ */
  async function loadSessions() {
    list.innerHTML = '<div style="color:var(--ink-muted);padding:40px;text-align:center;">Cargando sesiones...</div>';
    const campId = campSelect.value;
    const query = campId ? `?campaign_id=${campId}&per_page=50` : '?per_page=50';
    try {
      const res = await api.get(`/sessions${query}`);
      const sessions = res.data ?? [];
      list.innerHTML = '';

      if (!sessions.length) {
        list.innerHTML = `
          <div style="text-align:center;padding:80px 20px;color:var(--ink-muted);">
            <div style="font-size:40px;margin-bottom:16px;">📜</div>
            <div style="font-family:var(--font-display);font-size:18px;color:var(--ink);">Sin sesiones registradas</div>
            ${canCreate ? '<div style="margin-top:8px;font-size:13px;">Registra la primera sesión de la campaña</div>' : ''}
          </div>`;
        return;
      }

      sessions.forEach((s, i) => {
        const card = buildSessionCard(s, i, campaigns);
        list.appendChild(card);
      });
    } catch (err) {
      list.innerHTML = `<div style="color:var(--crimson);padding:40px;">Error: ${err.message}</div>`;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     SESSION CARD
  ═══════════════════════════════════════════════════════════════ */
  function buildSessionCard(s, index, camps) {
    const camp = camps.find(c => c.id === s.campaign_id);

    const wrap = document.createElement('div');
    wrap.style.cssText = `
      display:flex;gap:0;margin-bottom:0;
      animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${index * 50}ms both;
    `;

    /* Timeline spine */
    const spine = document.createElement('div');
    spine.style.cssText = 'display:flex;flex-direction:column;align-items:center;margin-right:20px;flex-shrink:0;padding-top:6px;';

    const dot = document.createElement('div');
    dot.style.cssText = `
      width:36px;height:36px;border-radius:50%;
      background:var(--stone-light);border:2px solid var(--gold-dim);
      display:flex;align-items:center;justify-content:center;
      font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--gold);
      flex-shrink:0;
    `;
    dot.textContent = `#${s.session_number}`;

    const line = document.createElement('div');
    line.style.cssText = 'width:2px;flex:1;background:var(--border);margin-top:8px;min-height:24px;';

    spine.appendChild(dot);
    spine.appendChild(line);

    /* Card body */
    const card = document.createElement('div');
    card.style.cssText = `
      flex:1;background:var(--stone);border:1px solid var(--border);border-radius:10px;
      padding:20px 24px;margin-bottom:16px;cursor:pointer;
      transition:transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur-fast) var(--ease-spring);
      position:relative;
    `;

    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = '0 0 0 1px var(--gold-dim), 0 0 20px var(--gold-glow)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
    });
    card.addEventListener('click', () => openDetail(s, camps));

    /* Campaign badge */
    if (camp && !campSelect.value) {
      const campBadge = document.createElement('div');
      campBadge.style.cssText = `
        position:absolute;top:12px;right:12px;
        padding:3px 10px;border-radius:12px;font-size:11px;font-family:var(--font-ui);
        background:var(--gold-glow);color:var(--gold);border:1px solid var(--gold-dim)44;
      `;
      campBadge.textContent = camp.name;
      card.appendChild(campBadge);
    }

    /* Title */
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-family:var(--font-display);font-size:16px;color:var(--ink);margin-bottom:6px;padding-right:120px;';
    titleEl.textContent = s.title || `Sesión ${s.session_number}`;
    card.appendChild(titleEl);

    /* Meta row */
    const meta = document.createElement('div');
    meta.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px;';

    if (s.date) {
      const dateEl = document.createElement('span');
      dateEl.style.cssText = 'font-size:12px;color:var(--ink-muted);display:flex;align-items:center;gap:4px;';
      dateEl.textContent = '📅 ' + new Date(s.date + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
      meta.appendChild(dateEl);
    }

    if (s.duration_min) {
      const dur = document.createElement('span');
      dur.style.cssText = 'font-size:12px;color:var(--ink-muted);display:flex;align-items:center;gap:4px;';
      dur.textContent = `⏱️ ${s.duration_min}m`;
      meta.appendChild(dur);
    }

    if (s.xp_awarded) {
      const xp = document.createElement('span');
      xp.style.cssText = 'font-size:12px;color:var(--gold);display:flex;align-items:center;gap:4px;font-family:var(--font-mono);';
      xp.textContent = `✨ ${s.xp_awarded} XP`;
      meta.appendChild(xp);
    }

    if (s.next_session_date) {
      const next = document.createElement('span');
      next.style.cssText = 'font-size:12px;color:var(--ink-muted);display:flex;align-items:center;gap:4px;';
      const d = new Date(s.next_session_date);
      next.textContent = '⏭️ Próxima: ' + d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
      meta.appendChild(next);
    }

    card.appendChild(meta);

    /* Summary preview */
    if (s.summary) {
      const preview = document.createElement('p');
      preview.style.cssText = `
        font-size:13px;color:var(--ink-muted);line-height:1.5;margin:0;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
      `;
      /* Strip markdown for preview */
      preview.textContent = s.summary.replace(/[#*_`>\[\]]/g, '').slice(0, 200);
      card.appendChild(preview);
    }

    /* Actions (DM/admin only) */
    if (canCreate) {
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border);';

      const editBtn = document.createElement('button');
      editBtn.style.cssText = 'font-size:12px;padding:4px 12px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--ink-muted);cursor:pointer;font-family:var(--font-ui);transition:all var(--dur-fast);';
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', e => { e.stopPropagation(); openModal(s); });
      editBtn.addEventListener('mouseenter', () => { editBtn.style.borderColor = 'var(--gold-dim)'; editBtn.style.color = 'var(--gold)'; });
      editBtn.addEventListener('mouseleave', () => { editBtn.style.borderColor = 'var(--border)'; editBtn.style.color = 'var(--ink-muted)'; });

      const attendBtn = document.createElement('button');
      attendBtn.style.cssText = 'font-size:12px;padding:4px 12px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--ink-muted);cursor:pointer;font-family:var(--font-ui);transition:all var(--dur-fast);';
      attendBtn.textContent = '👥 Asistencia';
      attendBtn.addEventListener('click', e => { e.stopPropagation(); openAttendance(s); });
      attendBtn.addEventListener('mouseenter', () => { attendBtn.style.borderColor = 'var(--gold-dim)'; attendBtn.style.color = 'var(--gold)'; });
      attendBtn.addEventListener('mouseleave', () => { attendBtn.style.borderColor = 'var(--border)'; attendBtn.style.color = 'var(--ink-muted)'; });

      actions.appendChild(editBtn);
      actions.appendChild(attendBtn);
      card.appendChild(actions);
    }

    wrap.appendChild(spine);
    wrap.appendChild(card);
    return wrap;
  }

  /* ═══════════════════════════════════════════════════════════════
     DETAIL MODAL (chronicle + attendance)
  ═══════════════════════════════════════════════════════════════ */
  async function openDetail(session, camps) {
    const camp = camps.find(c => c.id === session.campaign_id);

    const overlay = createOverlay();
    const modal = document.createElement('div');
    modal.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-radius:14px;
      width:min(760px,96vw);max-height:88vh;overflow:hidden;
      display:flex;flex-direction:column;
      animation:modalIn var(--dur-normal) var(--ease-spring) both;
    `;

    /* Modal header */
    const mh = document.createElement('div');
    mh.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;padding:24px 28px 0;';

    const mTitle = document.createElement('div');
    const mh1 = document.createElement('h3');
    mh1.style.cssText = 'font-family:var(--font-display);font-size:22px;color:var(--gold);margin:0 0 4px;';
    mh1.textContent = session.title || `Sesión ${session.session_number}`;
    const mhMeta = document.createElement('div');
    mhMeta.style.cssText = 'font-size:12px;color:var(--ink-muted);display:flex;gap:12px;flex-wrap:wrap;';
    if (camp) { const s = document.createElement('span'); s.textContent = '🗺️ ' + camp.name; mhMeta.appendChild(s); }
    const snum = document.createElement('span');
    snum.style.cssText = 'font-family:var(--font-mono);color:var(--gold-dim);';
    snum.textContent = `#${session.session_number}`;
    mhMeta.appendChild(snum);
    if (session.date) { const sd = document.createElement('span'); sd.textContent = '📅 ' + new Date(session.date + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }); mhMeta.appendChild(sd); }
    if (session.xp_awarded) { const xp = document.createElement('span'); xp.style.color = 'var(--gold)'; xp.textContent = `✨ ${session.xp_awarded} XP`; mhMeta.appendChild(xp); }
    mTitle.appendChild(mh1);
    mTitle.appendChild(mhMeta);

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;color:var(--ink-muted);font-size:22px;cursor:pointer;padding:0;line-height:1;margin-top:-4px;';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => closeOverlay(overlay));

    mh.appendChild(mTitle);
    mh.appendChild(closeBtn);

    /* Tabs */
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:0;padding:16px 28px 0;border-bottom:1px solid var(--border);margin-top:16px;';

    const tabContent = document.createElement('div');
    tabContent.style.cssText = 'flex:1;overflow-y:auto;padding:24px 28px;';

    const tabs = [
      { id: 'chronicle', label: '📖 Crónica' },
      { id: 'highlights', label: '⭐ Highlights' },
      { id: 'attendance', label: '👥 Asistencia' },
    ];

    let activeTab = 'chronicle';

    function renderTab(id) {
      activeTab = id;
      tabBar.querySelectorAll('.tab-btn').forEach(b => {
        const isActive = b.dataset.tab === id;
        b.style.borderBottom = isActive ? '2px solid var(--gold)' : '2px solid transparent';
        b.style.color = isActive ? 'var(--gold)' : 'var(--ink-muted)';
      });
      tabContent.innerHTML = '';

      if (id === 'chronicle') {
        if (session.summary) {
          getMarked().then(marked => {
            const prose = document.createElement('div');
            prose.className = 'chronicle-prose';
            prose.style.cssText = `
              font-family:var(--font-body);font-size:15px;line-height:1.8;color:var(--ink);
              max-width:660px;
            `;
            prose.innerHTML = marked.parse(session.summary);
            tabContent.appendChild(prose);
          });
        } else {
          tabContent.innerHTML = `<div style="text-align:center;padding:40px;color:var(--ink-muted);">
            <div style="font-size:32px;margin-bottom:12px;">📜</div>
            <div>Sin crónica registrada</div>
          </div>`;
        }
      }

      if (id === 'highlights') {
        const hl = session.highlights ?? [];
        if (!hl.length) {
          tabContent.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ink-muted);">Sin highlights registrados</div>';
        } else {
          const ul = document.createElement('ul');
          ul.style.cssText = 'list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;';
          hl.forEach((h, i) => {
            const li = document.createElement('li');
            li.style.cssText = `
              background:var(--stone-light);border:1px solid var(--border);border-left:3px solid var(--gold);
              border-radius:8px;padding:12px 16px;font-size:14px;color:var(--ink);line-height:1.5;
              animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${i * 60}ms both;
            `;
            li.textContent = '⭐ ' + h;
            ul.appendChild(li);
          });
          tabContent.appendChild(ul);
        }
      }

      if (id === 'attendance') {
        tabContent.innerHTML = '<div style="color:var(--ink-muted);padding:20px;">Cargando asistencia...</div>';
        api.get(`/sessions/${session.id}/attendance`).then(res => {
          tabContent.innerHTML = '';
          const attendees = res.data ?? [];
          if (!attendees.length) {
            tabContent.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ink-muted);">Sin registros de asistencia</div>';
            return;
          }
          const grid = document.createElement('div');
          grid.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
          attendees.forEach(a => {
            const row = document.createElement('div');
            row.style.cssText = `
              display:flex;align-items:center;gap:12px;padding:10px 14px;
              background:var(--stone-light);border-radius:8px;border:1px solid var(--border);
            `;
            const indicator = document.createElement('div');
            indicator.style.cssText = `
              width:8px;height:8px;border-radius:50%;flex-shrink:0;
              background:${a.present ? 'var(--success)' : 'var(--crimson)'};
            `;
            const name = document.createElement('div');
            name.style.cssText = 'font-size:14px;color:var(--ink);flex:1;';
            name.textContent = a.display_name || a.username;
            const status = document.createElement('div');
            status.style.cssText = `font-size:12px;color:${a.present ? 'var(--success)' : 'var(--crimson)'};`;
            status.textContent = a.present ? 'Presente' : 'Ausente';
            if (a.xp_received) {
              const xp = document.createElement('div');
              xp.style.cssText = 'font-size:12px;color:var(--gold);font-family:var(--font-mono);';
              xp.textContent = '+' + a.xp_received + ' XP';
              row.appendChild(indicator);
              row.appendChild(name);
              row.appendChild(xp);
              row.appendChild(status);
            } else {
              row.appendChild(indicator);
              row.appendChild(name);
              row.appendChild(status);
            }
            grid.appendChild(row);
          });
          tabContent.appendChild(grid);
        }).catch(() => {
          tabContent.innerHTML = '<div style="color:var(--crimson);padding:20px;">Error al cargar asistencia</div>';
        });
      }
    }

    tabs.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      btn.dataset.tab = t.id;
      btn.style.cssText = `
        background:none;border:none;border-bottom:2px solid transparent;
        padding:8px 16px;font-family:var(--font-ui);font-size:13px;
        cursor:pointer;color:var(--ink-muted);transition:all var(--dur-fast);
      `;
      btn.textContent = t.label;
      btn.addEventListener('click', () => renderTab(t.id));
      tabBar.appendChild(btn);
    });

    modal.appendChild(mh);
    modal.appendChild(tabBar);
    modal.appendChild(tabContent);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    renderTab('chronicle');
  }

  /* ═══════════════════════════════════════════════════════════════
     CREATE / EDIT MODAL
  ═══════════════════════════════════════════════════════════════ */
  function openModal(session = null) {
    const isEdit = !!session;
    const overlay = createOverlay();

    const modal = document.createElement('div');
    modal.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-radius:14px;
      width:min(640px,96vw);max-height:88vh;overflow-y:auto;
      animation:modalIn var(--dur-normal) var(--ease-spring) both;
    `;

    const mh = document.createElement('div');
    mh.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:24px 28px 20px;border-bottom:1px solid var(--border);';
    const mTitle = document.createElement('h3');
    mTitle.style.cssText = 'font-family:var(--font-display);font-size:20px;color:var(--gold);margin:0;';
    mTitle.textContent = isEdit ? `✍️ Editar Sesión #${session.session_number}` : '+ Nueva Sesión';
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;color:var(--ink-muted);font-size:22px;cursor:pointer;padding:0;';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => closeOverlay(overlay));
    mh.appendChild(mTitle);
    mh.appendChild(closeBtn);

    const body = document.createElement('div');
    body.style.cssText = 'padding:24px 28px;display:flex;flex-direction:column;gap:18px;';

    /* Campaign select (only for create) */
    if (!isEdit) {
      const fg = fieldGroup('Campaña *');
      const sel = document.createElement('select');
      sel.name = 'campaign_id';
      applySelectStyle(sel);
      const dopt = document.createElement('option');
      dopt.value = '';
      dopt.textContent = 'Seleccionar campaña...';
      sel.appendChild(dopt);
      campaigns.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.name;
        if (campSelect.value === c.id) o.selected = true;
        sel.appendChild(o);
      });
      fg.appendChild(sel);
      body.appendChild(fg);
    }

    /* Title */
    const fgTitle = fieldGroup('Título');
    const titleInput = input('text', 'title', 'Nombre de la sesión', session?.title || '');
    fgTitle.appendChild(titleInput);
    body.appendChild(fgTitle);

    /* Date + Duration row */
    const row1 = document.createElement('div');
    row1.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;';

    const fgDate = fieldGroup('Fecha');
    const dateInput = input('date', 'date', '', session?.date || '');
    fgDate.appendChild(dateInput);

    const fgDur = fieldGroup('Duración (min)');
    const durInput = input('number', 'duration_min', 'ej. 240', session?.duration_min || '');
    fgDur.appendChild(durInput);

    row1.appendChild(fgDate);
    row1.appendChild(fgDur);
    body.appendChild(row1);

    /* XP + Next session row */
    const row2 = document.createElement('div');
    row2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;';

    const fgXP = fieldGroup('XP Otorgado');
    const xpInput = input('number', 'xp_awarded', 'ej. 300', session?.xp_awarded || '');
    fgXP.appendChild(xpInput);

    const fgNext = fieldGroup('Próxima sesión (fecha)');
    const nextInput = input('datetime-local', 'next_session_date', '', session?.next_session_date ? session.next_session_date.slice(0, 16) : '');
    fgNext.appendChild(nextInput);

    row2.appendChild(fgXP);
    row2.appendChild(fgNext);
    body.appendChild(row2);

    /* Highlights */
    const fgHL = fieldGroup('Highlights (uno por línea)');
    const hlTextarea = document.createElement('textarea');
    hlTextarea.name = 'highlights';
    hlTextarea.placeholder = 'El dragón fue derrotado\nThorin alcanzó nivel 5\n...';
    hlTextarea.value = (session?.highlights ?? []).join('\n');
    hlTextarea.rows = 3;
    applyTextareaStyle(hlTextarea);
    fgHL.appendChild(hlTextarea);
    body.appendChild(fgHL);

    /* Summary / chronicle */
    const fgSum = fieldGroup('Crónica (Markdown)');
    const sumTextarea = document.createElement('textarea');
    sumTextarea.name = 'summary';
    sumTextarea.placeholder = '# La caverna del horror\n\nEl grupo descubrió...\n\n## Combate\n...';
    sumTextarea.value = session?.summary || '';
    sumTextarea.rows = 8;
    applyTextareaStyle(sumTextarea);

    const mdHint = document.createElement('div');
    mdHint.style.cssText = 'font-size:11px;color:var(--ink-faint);margin-top:4px;';
    mdHint.textContent = '✦ Soporta Markdown — **negrita**, *cursiva*, # encabezados, > citas';

    fgSum.appendChild(sumTextarea);
    fgSum.appendChild(mdHint);
    body.appendChild(fgSum);

    /* Footer buttons */
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;padding:0 28px 24px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.style.cssText = 'background:transparent;border:1px solid var(--border);color:var(--ink-muted);';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.addEventListener('click', () => closeOverlay(overlay));

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = isEdit ? 'Guardar cambios' : 'Crear sesión';

    saveBtn.addEventListener('click', async () => {
      const highlights = hlTextarea.value.split('\n').map(l => l.trim()).filter(Boolean);
      const payload = {
        title: titleInput.value.trim() || null,
        date: dateInput.value || null,
        duration_min: durInput.value ? parseInt(durInput.value) : null,
        xp_awarded: xpInput.value ? parseInt(xpInput.value) : 0,
        next_session_date: nextInput.value ? new Date(nextInput.value).toISOString() : null,
        highlights,
        summary: sumTextarea.value.trim() || null,
      };

      if (!isEdit) {
        const campSel = body.querySelector('[name="campaign_id"]');
        if (!campSel?.value) { toast.error('Selecciona una campaña'); return; }
        payload.campaign_id = campSel.value;
      }

      console.log("[Sessions] Payload:", JSON.stringify(payload, null, 2));
      saveBtn.disabled = true;
      saveBtn.textContent = isEdit ? 'Guardando...' : 'Creando...';

      try {
        if (isEdit) {
          await api.put(`/sessions/${session.id}`, payload);
          toast.success(`Sesión actualizada`);
        } else {
          await api.post('/sessions', payload);
          toast.success('Sesión registrada');
        }
        closeOverlay(overlay);
        loadSessions();
      } catch (err) {
        toast.error(err.message || 'Error al guardar');
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Guardar cambios' : 'Crear sesión';
      }
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);

    modal.appendChild(mh);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  /* ═══════════════════════════════════════════════════════════════
     ATTENDANCE MODAL
  ═══════════════════════════════════════════════════════════════ */
  async function openAttendance(session) {
    const overlay = createOverlay();
    const modal = document.createElement('div');
    modal.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-radius:14px;
      width:min(520px,96vw);max-height:80vh;overflow:hidden;display:flex;flex-direction:column;
      animation:modalIn var(--dur-normal) var(--ease-spring) both;
    `;

    const mh = document.createElement('div');
    mh.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--border);';
    const mt = document.createElement('h3');
    mt.style.cssText = 'font-family:var(--font-display);font-size:18px;color:var(--gold);margin:0;';
    mt.textContent = `👥 Asistencia — Sesión #${session.session_number}`;
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;color:var(--ink-muted);font-size:22px;cursor:pointer;padding:0;';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => closeOverlay(overlay));
    mh.appendChild(mt);
    mh.appendChild(closeBtn);

    const body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:12px;';

    modal.appendChild(mh);
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    /* Load members for attendance */
    body.innerHTML = '<div style="color:var(--ink-muted);">Cargando miembros...</div>';

    try {
      const [memberRes, attendRes] = await Promise.all([
        api.get('/members?per_page=100'),
        api.get(`/sessions/${session.id}/attendance`),
      ]);
      const members = memberRes.data ?? [];
      const existing = {};
      (attendRes.data ?? []).forEach(a => { existing[a.member_id] = a; });

      body.innerHTML = '';

      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:12px;color:var(--ink-muted);margin-bottom:4px;';
      hint.textContent = 'Marca quién estuvo presente en la sesión:';
      body.appendChild(hint);

      if (!members.length) {
        body.innerHTML += '<div style="text-align:center;padding:20px;color:var(--ink-muted);">Sin miembros registrados</div>';
        return;
      }

      const rows = {};
      members.forEach(m => {
        const rec = existing[m.id];
        const row = document.createElement('div');
        row.style.cssText = `
          display:flex;align-items:center;gap:12px;padding:10px 14px;
          background:var(--stone-light);border-radius:8px;border:1px solid var(--border);
          transition:border-color var(--dur-fast);
        `;

        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.checked = rec?.present ?? false;
        toggle.style.cssText = 'width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;';

        const nameEl = document.createElement('div');
        nameEl.style.cssText = 'flex:1;font-size:14px;color:var(--ink);';
        nameEl.textContent = m.display_name || m.username;

        const roleEl = document.createElement('div');
        roleEl.style.cssText = 'font-size:11px;color:var(--ink-muted);font-family:var(--font-ui);';
        roleEl.textContent = m.role;

        const xpInput = document.createElement('input');
        xpInput.type = 'number';
        xpInput.placeholder = 'XP';
        xpInput.value = rec?.xp_received ?? session.xp_awarded ?? 0;
        xpInput.min = 0;
        xpInput.style.cssText = `
          width:70px;background:var(--stone);border:1px solid var(--border);
          color:var(--gold);border-radius:6px;padding:4px 8px;font-family:var(--font-mono);
          font-size:12px;text-align:right;
        `;

        toggle.addEventListener('change', () => {
          row.style.borderColor = toggle.checked ? 'var(--gold-dim)' : 'var(--border)';
        });
        if (toggle.checked) row.style.borderColor = 'var(--gold-dim)';

        row.appendChild(toggle);
        row.appendChild(nameEl);
        row.appendChild(roleEl);
        row.appendChild(xpInput);
        body.appendChild(row);

        rows[m.id] = { toggle, xpInput };
      });

      /* Save button */
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-primary';
      saveBtn.style.cssText = 'margin-top:8px;width:100%;';
      saveBtn.textContent = 'Guardar asistencia';

      saveBtn.addEventListener('click', async () => {
        console.log("[Sessions] Payload:", JSON.stringify(payload, null, 2));
      saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';

        const promises = members.map(m => {
          const { toggle, xpInput } = rows[m.id];
          return api.post(`/sessions/${session.id}/attendance`, {
            member_id: m.id,
            present: toggle.checked,
            xp_received: parseInt(xpInput.value) || 0,
          });
        });

        try {
          await Promise.all(promises);
          toast.success('Asistencia guardada');
          closeOverlay(overlay);
        } catch (err) {
          toast.error(err.message || 'Error al guardar asistencia');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Guardar asistencia';
        }
      });

      body.appendChild(saveBtn);
    } catch (err) {
      body.innerHTML = `<div style="color:var(--crimson);">Error: ${err.message}</div>`;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════════════════ */
  function createOverlay() {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;inset:0;background:rgba(9,8,10,0.8);
      display:flex;align-items:center;justify-content:center;z-index:1000;
      backdrop-filter:blur(6px);padding:16px;
    `;
    el.addEventListener('click', e => { if (e.target === el) closeOverlay(el); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { closeOverlay(el); document.removeEventListener('keydown', esc); }
    });
    return el;
  }

  function closeOverlay(el) {
    el.style.opacity = '0';
    el.style.transition = 'opacity var(--dur-fast) var(--ease-smooth)';
    setTimeout(() => el.remove(), 150);
  }

  function fieldGroup(label) {
    const fg = document.createElement('div');
    fg.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    const lbl = document.createElement('label');
    lbl.style.cssText = 'font-size:12px;color:var(--ink-muted);font-family:var(--font-ui);font-weight:500;text-transform:uppercase;letter-spacing:.5px;';
    lbl.textContent = label;
    fg.appendChild(lbl);
    return fg;
  }

  function input(type, name, placeholder, value) {
    const el = document.createElement('input');
    el.type = type;
    el.name = name;
    el.placeholder = placeholder;
    el.value = value;
    el.style.cssText = `
      background:var(--stone-light);border:1px solid var(--border);color:var(--ink);
      border-radius:8px;padding:10px 14px;font-family:var(--font-ui);font-size:14px;
      outline:none;transition:border-color var(--dur-fast);width:100%;box-sizing:border-box;
    `;
    el.addEventListener('focus', () => { el.style.borderColor = 'var(--gold-dim)'; });
    el.addEventListener('blur', () => { el.style.borderColor = 'var(--border)'; });
    return el;
  }

  function applySelectStyle(el) {
    el.style.cssText = `
      background:var(--stone-light);border:1px solid var(--border);color:var(--ink);
      border-radius:8px;padding:10px 14px;font-family:var(--font-ui);font-size:14px;
      outline:none;width:100%;box-sizing:border-box;cursor:pointer;
    `;
  }

  function applyTextareaStyle(el) {
    el.style.cssText = `
      background:var(--stone-light);border:1px solid var(--border);color:var(--ink);
      border-radius:8px;padding:10px 14px;font-family:var(--font-body);font-size:14px;
      outline:none;resize:vertical;width:100%;box-sizing:border-box;line-height:1.6;
      transition:border-color var(--dur-fast);
    `;
    el.addEventListener('focus', () => { el.style.borderColor = 'var(--gold-dim)'; });
    el.addEventListener('blur', () => { el.style.borderColor = 'var(--border)'; });
  }
}
