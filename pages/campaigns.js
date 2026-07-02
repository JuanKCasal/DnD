import { api } from '../js/api.js';
import { toast } from '../js/components/toast.js';
import { auth } from '../js/auth.js';

/* ─── STATUS CONFIG ─────────────────────────────────────────────── */
const STATUS_CONFIG = {
  planning:  { label: 'Planificación', color: 'var(--gold-dim)', border: 'var(--gold-dim)' },
  active:    { label: 'Activa',     color: 'var(--gold)',    border: 'var(--gold)' },
  paused:    { label: 'En pausa',   color: 'var(--crimson)', border: 'var(--crimson)' },
  on_hiatus: { label: 'En hiato',   color: 'var(--crimson)', border: 'var(--crimson)' },
  completed: { label: 'Completada', color: 'var(--success)', border: 'var(--success)' },
  archived:  { label: 'Archivada',  color: 'var(--ink-muted)', border: 'var(--border)' },
};

const SYSTEMS = ['D&D 5e', 'Pathfinder 2e', 'Call of Cthulhu', 'Vampire: The Masquerade', 'Cyberpunk RED', 'Other'];
const RULESETS = [
  { value: 'dnd_5e_2014', label: "D&D 5e (2014)" },
  { value: 'dnd_5e_2024', label: "D&D 5e (2024)" },
  { value: 'dnd_5e_homebrew', label: 'D&D 5e (Homebrew)' },
];
const FREQUENCIES = [
  { value: '', label: '—' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'irregular', label: 'Irregular' },
];
const LEVELING = [
  { value: 'xp', label: 'Puntos de experiencia (XP)' },
  { value: 'milestone', label: 'Hitos (Milestone)' },
];

/* ─── MAIN RENDER ───────────────────────────────────────────────── */
export async function render(container) {
  container.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'page-campaigns fade-in';
  page.style.cssText = 'padding:32px 40px; max-width:1300px;';

  /* Header */
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;';

  const titleBlock = document.createElement('div');
  const title = document.createElement('h2');
  title.style.cssText = 'font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;';
  title.textContent = '᛭ Campañas ᛭';
  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'color:var(--ink-muted);font-size:14px;margin:0;';
  subtitle.textContent = 'Aventuras del gremio';
  titleBlock.appendChild(title);
  titleBlock.appendChild(subtitle);

  const user = auth.getUser();
  const canCreate = user?.role === 'admin' || user?.role === 'dm';

  let createBtn = null;
  if (canCreate) {
    createBtn = document.createElement('button');
    createBtn.className = 'btn btn-primary';
    createBtn.style.cssText = 'display:flex;align-items:center;gap:8px;';
    createBtn.innerHTML = '<span style="font-size:18px;">+</span> Nueva Campaña';
    createBtn.addEventListener('click', () => openModal());
  }

  header.appendChild(titleBlock);
  if (createBtn) header.appendChild(createBtn);

  /* Filters */
  const filters = document.createElement('div');
  filters.style.cssText = 'display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap;';

  const allStatuses = ['all', 'planning', 'active', 'paused', 'on_hiatus', 'completed', 'archived'];
  const filterLabels = { all: 'Todas', ...Object.fromEntries(Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])) };

  let activeFilter = 'all';

  allStatuses.forEach(s => {
    const btn = document.createElement('button');
    btn.dataset.status = s;
    btn.textContent = filterLabels[s];
    btn.style.cssText = `
      padding:6px 14px;border-radius:20px;font-size:12px;font-family:var(--font-ui);
      cursor:pointer;transition:all var(--dur-fast) var(--ease-smooth);
      border:1px solid ${s === 'all' ? 'var(--gold)' : 'var(--border)'};
      background:${s === 'all' ? 'var(--gold-glow)' : 'transparent'};
      color:${s === 'all' ? 'var(--gold)' : 'var(--ink-muted)'};
    `;
    btn.addEventListener('click', () => {
      activeFilter = s;
      filters.querySelectorAll('button').forEach(b => {
        const active = b.dataset.status === s;
        b.style.borderColor = active ? 'var(--gold)' : 'var(--border)';
        b.style.background = active ? 'var(--gold-glow)' : 'transparent';
        b.style.color = active ? 'var(--gold)' : 'var(--ink-muted)';
      });
      loadCampaigns();
    });
    filters.appendChild(btn);
  });

  /* Grid */
  const grid = document.createElement('div');
  grid.id = 'campaigns-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;';

  page.appendChild(header);
  page.appendChild(filters);
  page.appendChild(grid);
  container.appendChild(page);

  /* ── Load campaigns ── */
  async function loadCampaigns() {
    grid.innerHTML = '<div style="color:var(--ink-muted);padding:40px;text-align:center;">Cargando campañas...</div>';
    try {
      const params = activeFilter !== 'all' ? `?status=${activeFilter}` : '';
      const res = await api.get(`/campaigns${params}`);
      const campaigns = res.data ?? [];

      grid.innerHTML = '';
      if (!campaigns.length) {
        grid.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:80px 20px;color:var(--ink-muted);">
            <div style="font-size:40px;margin-bottom:16px;">⚔️</div>
            <div style="font-family:var(--font-display);font-size:18px;color:var(--ink);">No hay campañas aún</div>
            ${canCreate ? '<div style="margin-top:8px;font-size:13px;">Crea la primera aventura del gremio</div>' : ''}
          </div>`;
        return;
      }

      campaigns.forEach((c, i) => {
        const card = buildCard(c, i);
        grid.appendChild(card);
      });
    } catch (err) {
      grid.innerHTML = `<div style="color:var(--crimson);padding:40px;">Error: ${err.message}</div>`;
    }
  }

  loadCampaigns();

  /* ── Build campaign card ── */
  function buildCard(c, index) {
    const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.archived;

    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--stone);
      border:1px solid var(--border);
      border-left:3px solid ${cfg.border};
      border-radius:10px;
      padding:24px;
      cursor:pointer;
      transition:transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur-fast) var(--ease-spring);
      animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${index * 60}ms both;
      position:relative;
      overflow:hidden;
    `;

    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-3px)';
      card.style.boxShadow = '0 0 0 1px var(--gold-dim), 0 0 24px var(--gold-glow)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
    });

    /* Click en la tarjeta → detalle completo de la campaña */
    card.addEventListener('click', () => openDetail(c));

    /* Status badge */
    const badge = document.createElement('div');
    badge.style.cssText = `
      position:absolute;top:16px;right:16px;
      padding:3px 10px;border-radius:12px;
      font-size:11px;font-family:var(--font-ui);font-weight:600;
      background:${cfg.border}22;color:${cfg.color};
      border:1px solid ${cfg.border}44;
    `;
    badge.textContent = cfg.label;

    /* Name */
    const name = document.createElement('div');
    name.style.cssText = 'font-family:var(--font-display);font-size:18px;color:var(--ink);margin-bottom:6px;padding-right:80px;';
    name.textContent = c.name;

    /* System + world */
    const meta = document.createElement('div');
    meta.style.cssText = 'font-size:12px;color:var(--ink-muted);margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;';
    if (c.system) {
      const sys = document.createElement('span');
      sys.style.cssText = 'background:var(--stone-light);padding:2px 8px;border-radius:4px;';
      sys.textContent = c.system;
      meta.appendChild(sys);
    }
    if (c.world_name) {
      const world = document.createElement('span');
      world.style.cssText = 'color:var(--gold-dim);';
      world.textContent = '🌍 ' + c.world_name;
      meta.appendChild(world);
    }
    if (c.start_level || c.current_level) {
      const lvl = document.createElement('span');
      lvl.style.cssText = 'background:var(--stone-light);padding:2px 8px;border-radius:4px;font-family:var(--font-mono);';
      const cur = c.current_level ?? c.start_level ?? 1;
      const tgt = c.target_end_level;
      lvl.textContent = tgt ? `Niv ${cur}→${tgt}` : `Niv ${cur}`;
      lvl.title = c.leveling_method === 'milestone' ? 'Progresión por hitos' : 'Progresión por XP';
      meta.appendChild(lvl);
    }

    /* Footer: member count + date */
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:14px;border-top:1px solid var(--border);';

    const members = document.createElement('span');
    members.style.cssText = 'font-size:12px;color:var(--ink-muted);display:flex;align-items:center;gap:4px;';
    members.innerHTML = `👥 <b style="color:var(--ink)">${c.member_count ?? 0}</b> miembros`;

    const date = document.createElement('span');
    date.style.cssText = 'font-size:11px;color:var(--ink-faint);';
    date.textContent = c.start_date ? new Date(c.start_date).toLocaleDateString('es-CL', { year: 'numeric', month: 'short' }) : '';

    footer.appendChild(members);
    footer.appendChild(date);

    card.appendChild(badge);
    card.appendChild(name);
    if (c.subtitle) {
      const sub = document.createElement('div');
      sub.style.cssText = 'font-family:var(--font-body);font-style:italic;font-size:13px;color:var(--ink-muted);margin:-2px 0 10px;padding-right:80px;';
      sub.textContent = c.subtitle;
      card.appendChild(sub);
    }
    card.appendChild(meta);

    /* Tone + theme chips */
    const tags = [...(c.tone ?? []), ...(c.themes ?? [])];
    if (tags.length) {
      const chipRow = document.createElement('div');
      chipRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;';
      tags.slice(0, 6).forEach(t => {
        const chip = document.createElement('span');
        chip.style.cssText = 'font-size:10px;font-family:var(--font-ui);text-transform:uppercase;letter-spacing:0.05em;color:var(--gold-dim);border:1px solid var(--gold-glow);background:var(--gold-glow);padding:2px 8px;border-radius:10px;';
        chip.textContent = t;
        chipRow.appendChild(chip);
      });
      card.appendChild(chipRow);
    }

    if (c.description) {
      const desc = document.createElement('p');
      desc.style.cssText = 'font-size:13px;color:var(--ink-muted);line-height:1.5;margin:0 0 16px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;';
      desc.textContent = c.description;
      card.appendChild(desc);
    }
    card.appendChild(footer);

    /* Edit + Delete buttons for DM/admin */
    if (canCreate) {
      const btnBase = `
        background:transparent;border:1px solid var(--border);
        border-radius:6px;padding:4px 10px;
        font-size:11px;cursor:pointer;opacity:0;transition:opacity var(--dur-fast);
      `;

      const editBtn = document.createElement('button');
      editBtn.style.cssText = `position:absolute;bottom:16px;right:70px;color:var(--ink-muted);${btnBase}`;
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', e => { e.stopPropagation(); openModal(c); });
      card.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.style.cssText = `position:absolute;bottom:16px;right:16px;color:var(--crimson);border-color:var(--crimson)33;${btnBase}`;
      deleteBtn.textContent = '🗑';
      deleteBtn.title = 'Eliminar campaña';
      deleteBtn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`¿Eliminar la campaña "${c.name}"? Esta acción no se puede deshacer.`)) return;
        try {
          await api.del(`/campaigns/${c.id}`);
          toast.success('Campaña eliminada');
          loadCampaigns();
        } catch (err) { toast.error(err.message); }
      });
      card.appendChild(deleteBtn);

      card.addEventListener('mouseenter', () => { editBtn.style.opacity = '1'; deleteBtn.style.opacity = '1'; });
      card.addEventListener('mouseleave', () => { editBtn.style.opacity = '0'; deleteBtn.style.opacity = '0'; });
    }

    return card;
  }

  /* ── Modal: create / edit ── */
  function openModal(campaign = null) {
    const isEdit = !!campaign;
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(9,8,10,0.8);
      backdrop-filter:blur(8px);z-index:1000;
      display:flex;align-items:center;justify-content:center;
      animation:fadeIn var(--dur-normal) var(--ease-smooth);
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background:var(--stone);border:1px solid var(--border);
      border-radius:12px;padding:32px;width:100%;max-width:520px;
      animation:modalIn var(--dur-normal) var(--ease-spring);
      max-height:90vh;overflow-y:auto;
    `;

    const modalTitle = document.createElement('h3');
    modalTitle.style.cssText = 'font-family:var(--font-display);color:var(--gold);margin:0 0 24px;font-size:20px;';
    modalTitle.textContent = isEdit ? 'Editar Campaña' : 'Nueva Campaña';

    const fields = [
      { label: 'Nombre *', id: 'camp-name', type: 'text', value: campaign?.name ?? '', placeholder: 'La Maldición de Strahd' },
      { label: 'Slug *', id: 'camp-slug', type: 'text', value: campaign?.slug ?? '', placeholder: 'maldicion-strahd' },
      { label: 'Subtítulo', id: 'camp-subtitle', type: 'text', value: campaign?.subtitle ?? '', placeholder: 'El terror acecha en la niebla' },
      { label: 'Mundo / Setting', id: 'camp-world', type: 'text', value: campaign?.world_name ?? '', placeholder: 'Barovia' },
      { label: 'Descripción', id: 'camp-desc', type: 'textarea', value: campaign?.description ?? '', placeholder: 'Una historia de terror gótico...' },
    ];

    const form = document.createElement('div');
    form.style.cssText = 'display:flex;flex-direction:column;gap:16px;';

    fields.forEach(f => {
      const group = document.createElement('div');
      const label = document.createElement('label');
      label.style.cssText = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;';
      label.textContent = f.label;

      let input;
      if (f.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
        input.style.cssText = 'resize:vertical;min-height:72px;';
      } else {
        input = document.createElement('input');
        input.type = f.type;
        input.placeholder = f.placeholder;
      }
      input.id = f.id;
      input.value = f.value;
      input.className = 'input';

      group.appendChild(label);
      group.appendChild(input);
      form.appendChild(group);
    });

    /* System select */
    const sysGroup = document.createElement('div');
    const sysLabel = document.createElement('label');
    sysLabel.style.cssText = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;';
    sysLabel.textContent = 'Sistema de Juego';
    const sysSelect = document.createElement('select');
    sysSelect.id = 'camp-system';
    sysSelect.className = 'input';
    SYSTEMS.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      opt.selected = campaign?.system === s;
      sysSelect.appendChild(opt);
    });
    sysGroup.appendChild(sysLabel);
    sysGroup.appendChild(sysSelect);
    form.appendChild(sysGroup);

    /* Status select (only for edit) */
    if (isEdit) {
      const stGroup = document.createElement('div');
      const stLabel = document.createElement('label');
      stLabel.style.cssText = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;';
      stLabel.textContent = 'Estado';
      const stSelect = document.createElement('select');
      stSelect.id = 'camp-status';
      stSelect.className = 'input';
      Object.entries(STATUS_CONFIG).forEach(([val, cfg]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = cfg.label;
        opt.selected = campaign?.status === val;
        stSelect.appendChild(opt);
      });
      stGroup.appendChild(stLabel);
      stGroup.appendChild(stSelect);
      form.appendChild(stGroup);
    }

    /* ── Helpers de formulario ── */
    const sectionStyle = 'font-family:var(--font-ui);font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--gold);margin:8px 0 -4px;border-top:1px solid var(--border);padding-top:16px;';
    const lblStyle = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;';
    const makeLabel = (text) => { const l = document.createElement('label'); l.style.cssText = lblStyle; l.textContent = text; return l; };
    const makeSelect = (id, opts, selected) => {
      const s = document.createElement('select'); s.id = id; s.className = 'input';
      opts.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.label; op.selected = String(selected) === String(o.value); s.appendChild(op); });
      return s;
    };
    const makeInput = (id, value, placeholder, type = 'text') => {
      const i = document.createElement('input'); i.id = id; i.className = 'input'; i.type = type;
      i.value = value ?? ''; if (placeholder) i.placeholder = placeholder;
      if (type === 'number') { i.min = '1'; i.max = '20'; }
      return i;
    };
    const groupEl = (...els) => { const g = document.createElement('div'); els.forEach(e => g.appendChild(e)); return g; };
    const sectionHeader = (text) => { const h = document.createElement('div'); h.style.cssText = sectionStyle; h.textContent = text; return h; };

    /* ── Sección: Progresión (guía §2, §14) ── */
    form.appendChild(sectionHeader('Progresión'));
    const lvlRow = document.createElement('div');
    lvlRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;';
    lvlRow.appendChild(groupEl(makeLabel('Nivel inicial'), makeInput('camp-start-level', campaign?.start_level ?? 1, '1', 'number')));
    lvlRow.appendChild(groupEl(makeLabel('Nivel actual'), makeInput('camp-current-level', campaign?.current_level ?? 1, '1', 'number')));
    lvlRow.appendChild(groupEl(makeLabel('Nivel objetivo'), makeInput('camp-target-level', campaign?.target_end_level ?? '', '20', 'number')));
    form.appendChild(lvlRow);
    form.appendChild(groupEl(makeLabel('Método de progresión'), makeSelect('camp-leveling', LEVELING, campaign?.leveling_method ?? 'xp')));

    /* ── Sección: Sistema y reglas de mesa (guía §3) ── */
    form.appendChild(sectionHeader('Sistema y reglas de mesa'));
    form.appendChild(groupEl(makeLabel('Edición de reglas'), makeSelect('camp-ruleset', RULESETS, campaign?.ruleset ?? 'dnd_5e_2014')));
    form.appendChild(groupEl(makeLabel('Frecuencia de sesiones'), makeSelect('camp-frequency', FREQUENCIES, campaign?.session_frequency ?? '')));
    form.appendChild(groupEl(makeLabel('Tono (separado por comas)'), makeInput('camp-tone', (campaign?.tone ?? []).join(', '), 'heroico, oscuro, exploración')));
    form.appendChild(groupEl(makeLabel('Temas (separado por comas)'), makeInput('camp-themes', (campaign?.themes ?? []).join(', '), 'venganza, redención')));
    form.appendChild(groupEl(makeLabel('Reglas variantes (separado por comas)'), makeInput('camp-variant', (campaign?.variant_rules ?? []).join(', '), 'Flanking, Feats, Multiclassing')));
    const hrArea = document.createElement('textarea');
    hrArea.id = 'camp-houserules'; hrArea.className = 'input'; hrArea.rows = 3;
    hrArea.style.cssText = 'resize:vertical;min-height:64px;';
    hrArea.value = (campaign?.house_rules ?? []).map(r => (r.description ? `${r.title}: ${r.description}` : r.title)).join('\n');
    form.appendChild(groupEl(makeLabel('Reglas caseras (una por línea — "Título: descripción")'), hrArea));

    /* Auto-generate slug */
    const nameInput = form.querySelector('#camp-name');
    const slugInput = form.querySelector('#camp-slug');
    if (!isEdit) {
      nameInput.addEventListener('input', () => {
        slugInput.value = nameInput.value.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim().replace(/\s+/g, '-');
      });
    }

    /* Buttons */
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
    saveBtn.textContent = isEdit ? 'Guardar cambios' : 'Crear campaña';

    saveBtn.addEventListener('click', async () => {
      const name   = form.querySelector('#camp-name').value.trim();
      const slug   = form.querySelector('#camp-slug').value.trim();
      const world  = form.querySelector('#camp-world').value.trim();
      const desc   = form.querySelector('#camp-desc').value.trim();
      const system = form.querySelector('#camp-system').value;
      const subtitle = form.querySelector('#camp-subtitle').value.trim();

      if (!name || !slug) { toast.error('Campos requeridos', 'Nombre y slug son obligatorios'); return; }

      const toArr = (s) => s.split(',').map(x => x.trim()).filter(Boolean);
      const numOrNull = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
      const parseHouseRules = (txt) => txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const idx = l.indexOf(':');
        return idx >= 0
          ? { category: 'other', title: l.slice(0, idx).trim(), description: l.slice(idx + 1).trim(), active: true }
          : { category: 'other', title: l, description: '', active: true };
      });

      const startLevel = numOrNull(form.querySelector('#camp-start-level').value) ?? 1;
      const currentLevel = numOrNull(form.querySelector('#camp-current-level').value) ?? 1;
      const targetLevel = numOrNull(form.querySelector('#camp-target-level').value);
      if (currentLevel < startLevel) { toast.error('Niveles inválidos', 'El nivel actual no puede ser menor que el inicial'); return; }
      if (targetLevel !== null && targetLevel < currentLevel) { toast.error('Niveles inválidos', 'El nivel objetivo no puede ser menor que el actual'); return; }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';

      try {
        const body = {
          name, slug, system,
          subtitle: subtitle || null,
          description: desc || null,
          world_name: world || null,
          start_level: startLevel,
          current_level: currentLevel,
          target_end_level: targetLevel,
          leveling_method: form.querySelector('#camp-leveling').value,
          ruleset: form.querySelector('#camp-ruleset').value,
          session_frequency: form.querySelector('#camp-frequency').value || null,
          tone: toArr(form.querySelector('#camp-tone').value),
          themes: toArr(form.querySelector('#camp-themes').value),
          variant_rules: toArr(form.querySelector('#camp-variant').value),
          house_rules: parseHouseRules(form.querySelector('#camp-houserules').value),
        };
        if (isEdit) {
          const status = form.querySelector('#camp-status')?.value;
          if (status) body.status = status;
          await api.put(`/campaigns/${campaign.id}`, body);
          toast.success('Campaña actualizada', name);
        } else {
          await api.post('/campaigns', body);
          toast.success('¡Campaña creada!', name);
        }
        overlay.remove();
        loadCampaigns();
      } catch (err) {
        toast.error('Error', err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Guardar cambios' : 'Crear campaña';
      }
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    form.appendChild(btnRow);

    modal.appendChild(form);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  /* ── Modal: detalle completo de la campaña (pestañas) ── */
  function openDetail(campaign) {
    const cid = campaign.id;
    const isManager = user?.role === 'admin' || String(campaign.dm_id ?? '') === String(user?.id ?? '');
    let membersCache = null;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(9,8,10,0.8);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn var(--dur-normal) var(--ease-smooth);';
    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:14px;width:min(820px,96vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden;animation:modalIn var(--dur-normal) var(--ease-spring);';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:22px 26px 14px;';
    const cfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.archived;
    head.innerHTML = `<div>
        <div style="font-family:var(--font-display);font-size:22px;color:var(--gold);">${escHtml(campaign.name)}</div>
        ${campaign.subtitle ? `<div style="font-style:italic;color:var(--ink-muted);font-size:13px;margin-top:2px;">${escHtml(campaign.subtitle)}</div>` : ''}
        <div style="margin-top:6px;"><span style="font-size:11px;font-weight:600;text-transform:uppercase;color:${cfg.color};border:1px solid ${cfg.border}44;background:${cfg.border}22;padding:2px 10px;border-radius:12px;">${cfg.label}</span></div>
      </div>`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'background:none;border:none;color:var(--ink-muted);font-size:24px;cursor:pointer;line-height:1;';
    closeBtn.addEventListener('click', () => overlay.remove());
    head.appendChild(closeBtn);

    const tabs = [
      ['details', '📋 Detalles'], ['sessions', '📜 Sesiones'], ['quests', '⚔️ Aventuras & Misiones'],
      ['encounters', '🐉 Encuentros'], ['narrative', '🎭 Trama'], ['dm', '👑 DM'], ['characters', '🧙 Personajes'],
    ];
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:4px;padding:0 26px;border-bottom:1px solid var(--border);overflow-x:auto;';
    const content = document.createElement('div');
    content.style.cssText = 'padding:20px 26px;overflow-y:auto;';
    let active = 'details';
    tabs.forEach(([id, label]) => {
      const b = document.createElement('button');
      b.dataset.tab = id; b.textContent = label;
      b.style.cssText = tabBtnStyle(id === active);
      b.addEventListener('click', () => { active = id; syncTabs(); renderTab(id); });
      tabBar.appendChild(b);
    });
    function syncTabs() { tabBar.querySelectorAll('button').forEach(b => { b.style.cssText = tabBtnStyle(b.dataset.tab === active); }); }

    modal.appendChild(head); modal.appendChild(tabBar); modal.appendChild(content);
    overlay.appendChild(modal); document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    async function getMembers() {
      if (!membersCache) { try { membersCache = (await api.get('/members?per_page=200')).data ?? []; } catch { membersCache = []; } }
      return membersCache;
    }
    const memberName = (id, list) => { const m = (list || []).find(x => String(x.id) === String(id)); return m ? (m.display_name || m.username) : '—'; };

    async function renderTab(id) {
      content.innerHTML = '<div style="color:var(--ink-muted);padding:20px;">Cargando...</div>';
      try {
        if (id === 'details') return await renderDetails();
        if (id === 'sessions') return await renderSessions();
        if (id === 'quests') return await renderQuests();
        if (id === 'encounters') return await renderEncounters();
        if (id === 'narrative') return await renderNarrative();
        if (id === 'dm') return await renderDM();
        if (id === 'characters') return await renderCharacters();
      } catch (e) { content.innerHTML = `<div style="color:var(--crimson);padding:12px;">Error: ${escHtml(e.message)}</div>`; }
    }

    async function renderDetails() {
      const rows = [];
      const add = (k, v) => { if (v !== null && v !== undefined && v !== '') rows.push([k, v]); };
      add('Sistema', campaign.system);
      add('Edición', campaign.ruleset);
      add('Mundo', campaign.world_name);
      add('Ambientación', campaign.setting);
      add('Niveles', `${campaign.start_level ?? 1} → ${campaign.current_level ?? 1}${campaign.target_end_level ? ` (meta ${campaign.target_end_level})` : ''}`);
      add('Progresión', campaign.leveling_method === 'milestone' ? 'Hitos' : 'XP');
      add('Frecuencia', campaign.session_frequency);
      const chips = [...(campaign.tone || []), ...(campaign.themes || [])];
      let html = '<div style="display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:14px;">';
      rows.forEach(([k, v]) => { html += `<div style="color:var(--ink-muted);">${k}</div><div style="color:var(--ink);">${escHtml(String(v))}</div>`; });
      html += '</div>';
      if (campaign.description) html += `<p style="margin-top:16px;font-size:14px;color:var(--ink-muted);line-height:1.6;">${escHtml(campaign.description)}</p>`;
      if (chips.length) html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;">' + chips.map(t => `<span style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--gold-dim);background:var(--gold-glow);border:1px solid var(--gold-glow);padding:2px 8px;border-radius:10px;">${escHtml(t)}</span>`).join('') + '</div>';
      if ((campaign.variant_rules || []).length) html += `<div style="margin-top:12px;font-size:13px;color:var(--ink-muted);"><b>Reglas variantes:</b> ${campaign.variant_rules.map(escHtml).join(', ')}</div>`;
      if ((campaign.house_rules || []).length) html += '<div style="margin-top:8px;font-size:13px;color:var(--ink-muted);"><b>Reglas caseras:</b><ul style="margin:4px 0 0;padding-left:18px;">' + campaign.house_rules.map(r => `<li>${escHtml(r.title || '')}${r.description ? ': ' + escHtml(r.description) : ''}</li>`).join('') + '</ul></div>';
      html += '<div id="camp-prog" style="margin-top:18px;"></div>';
      content.innerHTML = html;
      try {
        const p = (await api.get(`/campaigns/${cid}/progression`)).data;
        const box = content.querySelector('#camp-prog');
        if (p.leveling_method === 'xp') {
          box.innerHTML = `<div style="background:var(--stone-light);border:1px solid var(--border);border-radius:10px;padding:14px 16px;">
            <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:13px;">
              <span style="font-family:var(--font-display);color:var(--gold);">Progresión</span>
              <span style="font-family:var(--font-mono);">Nivel ${p.current_level}</span>
              <span style="font-family:var(--font-mono);color:var(--gold-dim);">${(p.total_xp || 0).toLocaleString('es-CL')} XP</span>
              <span style="font-family:var(--font-mono);color:var(--ink-muted);">BPC +${p.proficiency_bonus}</span>
              ${p.suggested_level > p.current_level ? `<span style="color:var(--success);font-weight:600;">↑ subir a ${p.suggested_level}</span>` : ''}
            </div>
            <div style="height:8px;background:var(--stone);border-radius:4px;overflow:hidden;margin-top:10px;"><div style="height:100%;width:${p.pct_to_next ?? 0}%;background:var(--gold);"></div></div>
            ${p.next_level ? `<div style="font-size:11px;color:var(--ink-faint);margin-top:4px;">${p.xp_needed_for_next} XP para nivel ${p.next_level}</div>` : ''}
          </div>`;
        } else {
          box.innerHTML = `<div style="background:var(--stone-light);border:1px solid var(--border);border-radius:10px;padding:14px 16px;font-size:13px;"><b style="color:var(--gold);font-family:var(--font-display);">Progresión por hitos</b> · Nivel ${p.current_level} · BPC +${p.proficiency_bonus}</div>`;
        }
      } catch (_) { /* progresión opcional */ }
    }

    async function renderSessions() {
      const list = (await api.get(`/sessions?campaign_id=${cid}&per_page=100`)).data ?? [];
      if (!list.length) { content.innerHTML = emptyMsg('Sin sesiones registradas'); return; }
      content.innerHTML = countHead('Sesiones', list.length) + list.map(s => `
        <div style="display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">
          <div><span style="font-family:var(--font-mono);color:var(--gold-dim);">#${s.session_number}</span> <span style="color:var(--ink);">${escHtml(s.title || 'Sesión')}</span></div>
          <div style="font-size:12px;color:var(--ink-muted);white-space:nowrap;">${s.date ? escHtml(new Date(s.date + 'T12:00:00').toLocaleDateString('es-CL')) : ''}${s.xp_awarded ? ` · ✨${s.xp_awarded}` : ''}</div>
        </div>`).join('');
    }

    async function renderQuests() {
      const [advs, qs] = await Promise.all([
        api.get(`/campaigns/${cid}/adventures`).then(r => r.data ?? []).catch(() => []),
        api.get(`/campaigns/${cid}/quests`).then(r => r.data ?? []).catch(() => []),
      ]);
      let html = countHead('Aventuras', advs.length);
      html += advs.length ? advs.map(a => `<div style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;"><span style="color:var(--ink);">${escHtml(a.title)}</span> <span style="font-size:11px;color:var(--ink-muted);">· ${escHtml(a.status)}${(a.rec_level_min || a.rec_level_max) ? ` · Niv ${a.rec_level_min ?? '?'}–${a.rec_level_max ?? '?'}` : ''}</span></div>`).join('') : emptyMsg('Sin aventuras');
      html += countHead('Misiones', qs.length);
      html += qs.length ? qs.map(q => `<div style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;"><span style="color:var(--ink);">${escHtml(q.title)}</span> <span style="font-size:11px;color:var(--ink-muted);">· ${escHtml(q.quest_type)} · ${escHtml(q.status)}</span></div>`).join('') : emptyMsg('Sin misiones');
      content.innerHTML = html;
    }

    async function renderEncounters() {
      const list = (await api.get(`/campaigns/${cid}/encounters`)).data ?? [];
      if (!list.length) { content.innerHTML = emptyMsg('Sin encuentros'); return; }
      const dl = { trivial: 'Trivial', easy: 'Fácil', medium: 'Media', hard: 'Difícil', deadly: 'Mortal' };
      content.innerHTML = countHead('Encuentros', list.length) + list.map(e => {
        const mons = (e.monsters || []).map(m => `${m.quantity}× ${escHtml(m.stat_block_name || m.name_override || '?')}`).join(', ');
        return `<div style="padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;gap:8px;"><span style="color:var(--ink);">${escHtml(e.name)}</span><span style="font-size:11px;text-transform:uppercase;color:var(--gold-dim);">${dl[e.difficulty] || e.difficulty || ''}</span></div>
          ${mons ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:4px;">${mons}</div>` : ''}</div>`;
      }).join('');
    }

    async function renderNarrative() {
      const [arcs, twists] = await Promise.all([
        api.get(`/campaigns/${cid}/arcs`).then(r => r.data ?? []).catch(() => []),
        api.get(`/campaigns/${cid}/plot-twists`).then(r => r.data ?? []).catch(() => []),
      ]);
      let html = countHead('Arcos', arcs.length);
      html += arcs.length ? arcs.map(a => { const b = Array.isArray(a.beats) ? a.beats : []; const d = b.filter(x => x.completed).length; return `<div style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;"><span style="color:var(--ink);">${escHtml(a.title)}</span> <span style="font-size:11px;color:var(--ink-muted);">· ${escHtml(a.status)}${b.length ? ` · ${d}/${b.length} beats` : ''}</span></div>`; }).join('') : emptyMsg('Sin arcos');
      html += countHead('Giros', twists.length);
      html += twists.length ? twists.map(t => `<div style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;"><span style="color:var(--ink);">${escHtml(t.title)}</span> <span style="font-size:11px;color:${t.revealed ? 'var(--success)' : 'var(--crimson)'};">· ${t.revealed ? 'revelado' : 'oculto'}</span></div>`).join('') : emptyMsg('Sin giros');
      content.innerHTML = html;
    }

    async function renderDM() {
      const list = await getMembers();
      let html = `<div style="font-size:14px;color:var(--ink);margin-bottom:14px;">DM actual: <b style="color:var(--gold);">${escHtml(memberName(campaign.dm_id, list))}</b></div>`;
      if (isManager) {
        const opts = list.map(m => `<option value="${m.id}" ${String(m.id) === String(campaign.dm_id) ? 'selected' : ''}>${escHtml(m.display_name || m.username)} (${escHtml(m.role)})</option>`).join('');
        html += `<label style="${LABEL_CSS}">Reasignar DM</label>
          <select id="dm-select" class="input" style="max-width:340px;">${opts}</select>
          <div style="margin-top:12px;"><button id="dm-save" class="btn btn-primary">Guardar DM</button></div>`;
      } else {
        html += '<div style="font-size:12px;color:var(--ink-faint);">Solo el DM actual o un admin puede reasignar.</div>';
      }
      content.innerHTML = html;
      const saveBtn = content.querySelector('#dm-save');
      if (saveBtn) saveBtn.addEventListener('click', async () => {
        const val = content.querySelector('#dm-select').value;
        saveBtn.disabled = true; saveBtn.textContent = 'Guardando...';
        try {
          await api.put(`/campaigns/${cid}`, { dm_id: val });
          campaign.dm_id = val;
          toast.success('DM actualizado');
          loadCampaigns();
          renderDM();
        } catch (e) { toast.error('Error', e.message); saveBtn.disabled = false; saveBtn.textContent = 'Guardar DM'; }
      });
    }

    async function renderCharacters() {
      const inCampaign = (await api.get(`/characters?campaign_id=${cid}&per_page=100`)).data ?? [];
      const list = await getMembers();
      let html = countHead('Personajes en la campaña', inCampaign.length);
      html += inCampaign.length ? inCampaign.map(c => `<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;">
          <span style="color:var(--ink);">${escHtml(c.name)}</span>
          <span style="font-size:12px;color:var(--ink-muted);">${escHtml(c.char_class || '')}${c.level ? ` · Niv ${c.level}` : ''} · ${escHtml(memberName(c.member_id, list))}</span></div>`).join('') : emptyMsg('Sin personajes');
      if (isManager) html += '<div style="margin-top:12px;"><button id="add-char" class="btn">+ Añadir personaje</button></div>';
      content.innerHTML = html;
      const addBtn = content.querySelector('#add-char');
      if (addBtn) addBtn.addEventListener('click', openAddCharacter);
    }

    async function openAddCharacter() {
      let all = [];
      try { all = (await api.get('/characters?per_page=200')).data ?? []; } catch (_) { /* */ }
      const candidates = all.filter(c => String(c.campaign_id) !== String(cid));
      if (!candidates.length) { toast.error('Sin personajes disponibles', 'Todos ya están en esta campaña'); return; }

      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(9,8,10,0.7);z-index:1100;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn var(--dur-fast) var(--ease-smooth);';
      const m = document.createElement('div');
      m.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:12px;padding:24px;width:min(420px,96vw);';
      const opts = candidates.map(c => `<option value="${c.id}">${escHtml(c.name)}${c.char_class ? ' · ' + escHtml(c.char_class) : ''}</option>`).join('');
      m.innerHTML = `<h3 style="font-family:var(--font-display);color:var(--gold);margin:0 0 16px;font-size:18px;">Añadir personaje a la campaña</h3>
        <label style="${LABEL_CSS}">Personaje</label>
        <select id="pick-char" class="input">${opts}</select>
        <div style="display:flex;gap:10px;margin-top:18px;">
          <button id="pk-cancel" class="btn" style="flex:1;background:transparent;border:1px solid var(--border);color:var(--ink-muted);">Cancelar</button>
          <button id="pk-ok" class="btn btn-primary" style="flex:2;">Añadir</button>
        </div>`;
      ov.appendChild(m); document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
      m.querySelector('#pk-cancel').addEventListener('click', () => ov.remove());
      m.querySelector('#pk-ok').addEventListener('click', async () => {
        const charId = m.querySelector('#pick-char').value;
        const char = candidates.find(c => String(c.id) === String(charId));
        const okBtn = m.querySelector('#pk-ok'); okBtn.disabled = true; okBtn.textContent = 'Añadiendo...';
        try {
          await api.put(`/characters/${charId}`, { campaign_id: cid });
          if (char?.member_id) { try { await api.post(`/campaigns/${cid}/members`, { member_id: char.member_id }); } catch (_) { /* ya es miembro */ } }
          toast.success('Personaje añadido');
          ov.remove();
          loadCampaigns();
          renderCharacters();
        } catch (e) { toast.error('Error', e.message); okBtn.disabled = false; okBtn.textContent = 'Añadir'; }
      });
    }

    renderTab('details');
  }
}

/* ── Helpers de módulo (detalle de campaña) ── */
const LABEL_CSS = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;';
function escHtml(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function tabBtnStyle(active) {
  return `padding:10px 12px;font-family:var(--font-ui);font-size:13px;white-space:nowrap;cursor:pointer;background:none;border:none;border-bottom:2px solid ${active ? 'var(--gold)' : 'transparent'};color:${active ? 'var(--gold)' : 'var(--ink-muted)'};font-weight:${active ? '600' : '400'};`;
}
function countHead(t, n) { return `<div style="font-family:var(--font-display);font-size:15px;color:var(--ink);margin:14px 0 8px;">${t} <span style="color:var(--ink-faint);font-family:var(--font-mono);font-size:13px;">(${n})</span></div>`; }
function emptyMsg(t) { return `<div style="color:var(--ink-muted);font-size:13px;padding:8px 0;">${t}.</div>`; }
