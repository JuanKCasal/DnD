import { api } from '../js/api.js';
import { toast } from '../js/components/toast.js';
import { auth } from '../js/auth.js';

/* ═══════════════════════════════════════════════════════════════
   CATÁLOGO DE HECHIZOS  (#/spellbook — menú Configuración)
   Fase H3
═══════════════════════════════════════════════════════════════ */

/* ── Escuelas de magia (documento §11) ── */
const SCHOOLS = {
  abjuration:    { label: 'Abjuración',     icon: '🛡️', color: '#4a9eff' },
  conjuration:   { label: 'Conjuración',    icon: '🌀', color: '#f59e0b' },
  divination:    { label: 'Adivinación',    icon: '🔮', color: '#14b8a6' },
  enchantment:   { label: 'Encantamiento',  icon: '💫', color: '#ec4899' },
  evocation:     { label: 'Evocación',      icon: '🔥', color: '#9B2335' },
  illusion:      { label: 'Ilusión',        icon: '🎭', color: '#a855f7' },
  necromancy:    { label: 'Nigromancia',    icon: '💀', color: '#4b5563' },
  transmutation: { label: 'Transmutación',  icon: '🔄', color: '#22c55e' },
};

/* ── Clases lanzadoras (claves canónicas) ── */
const CLASSES = {
  bard: 'Bardo', cleric: 'Clérigo', druid: 'Druida', paladin: 'Paladín',
  ranger: 'Explorador', sorcerer: 'Hechicero', warlock: 'Brujo', wizard: 'Mago',
  eldritch_knight: 'Caballero Arcano', arcane_trickster: 'Pícaro Arcano',
};

const ABILITIES = {
  STR: 'Fuerza', DEX: 'Destreza', CON: 'Constitución',
  INT: 'Inteligencia', WIS: 'Sabiduría', CHA: 'Carisma',
};

const DAMAGE_ES = {
  acid: 'ácido', bludgeoning: 'contundente', cold: 'frío', fire: 'fuego',
  force: 'fuerza', lightning: 'relámpago', necrotic: 'necrótico',
  piercing: 'perforante', poison: 'veneno', psychic: 'psíquico',
  radiant: 'radiante', slashing: 'cortante', thunder: 'trueno',
};

const levelLabel = (n) => (n === 0 ? 'Truco' : `Nivel ${n}`);

/* ── Traductores ligeros de campos en inglés (SRD) ── */
function tCasting(txt) {
  if (!txt) return '—';
  return txt
    .replace(/1 bonus action/i, '1 acción adicional')
    .replace(/1 action/i, '1 acción')
    .replace(/1 reaction.*/i, (m) => m.replace(/1 reaction/i, '1 reacción'))
    .replace(/minutes?/i, (m) => (m.toLowerCase() === 'minute' ? 'minuto' : 'minutos'))
    .replace(/hours?/i, (m) => (m.toLowerCase() === 'hour' ? 'hora' : 'horas'));
}
function tRange(sp) {
  switch (sp.range_type) {
    case 'self': return sp.range_text?.toLowerCase().includes('radius') ? sp.range_text.replace(/self/i, 'Personal') : 'Personal';
    case 'touch': return 'Toque';
    case 'sight': return 'Vista';
    case 'unlimited': return 'Ilimitado';
    default: return sp.range_feet ? `${sp.range_feet} pies` : (sp.range_text || '—');
  }
}
function tDuration(txt) {
  if (!txt) return '—';
  return txt
    .replace(/Instantaneous/i, 'Instantáneo')
    .replace(/Concentration/i, 'Concentración')
    .replace(/up to/i, 'hasta')
    .replace(/Until dispelled/i, 'Hasta ser disipado')
    .replace(/minutes?/i, (m) => (m.toLowerCase() === 'minute' ? 'minuto' : 'minutos'))
    .replace(/hours?/i, (m) => (m.toLowerCase() === 'hour' ? 'hora' : 'horas'))
    .replace(/rounds?/i, (m) => (m.toLowerCase() === 'round' ? 'asalto' : 'asaltos'))
    .replace(/days?/i, (m) => (m.toLowerCase() === 'day' ? 'día' : 'días'));
}
const compStr = (sp) => ['V', 'S', 'M'].filter((c) => sp[`comp_${c === 'V' ? 'verbal' : c === 'S' ? 'somatic' : 'material'}`]).join(', ') || '—';

/* ═══════════════════════════════════════════════════════════════
   MAIN RENDER
═══════════════════════════════════════════════════════════════ */
export async function render(container) {
  container.innerHTML = '';
  const user = auth.getUser();
  const isAdmin = user?.role === 'admin';

  const page = document.createElement('div');
  page.className = 'page-spells fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:1100px;';

  /* ── Header ── */
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;gap:16px;flex-wrap:wrap;';
  const titleBlock = document.createElement('div');
  const title = document.createElement('h2');
  title.style.cssText = 'font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;';
  title.textContent = '᛭ Catálogo de Hechizos ᛭';
  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'color:var(--ink-muted);font-size:14px;margin:0;';
  subtitle.textContent = 'Todos los conjuros disponibles para la comunidad';
  titleBlock.appendChild(title);
  titleBlock.appendChild(subtitle);
  header.appendChild(titleBlock);
  page.appendChild(header);

  /* ── Controles / filtros ── */
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap;';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Buscar hechizos...';
  searchInput.style.cssText = `
    background:var(--stone);border:1px solid var(--border);color:var(--ink);
    border-radius:8px;padding:8px 12px;font-family:var(--font-ui);font-size:13px;
    flex:1;min-width:180px;outline:none;
  `;

  const levelSelect = buildSelect([
    ['', 'Todos los niveles'], ['0', 'Trucos'],
    ...Array.from({ length: 9 }, (_, i) => [String(i + 1), `Nivel ${i + 1}`]),
  ]);
  const schoolSelect = buildSelect([
    ['', 'Todas las escuelas'],
    ...Object.entries(SCHOOLS).map(([k, v]) => [k, `${v.icon} ${v.label}`]),
  ]);
  const classSelect = buildSelect([
    ['', 'Todas las clases'],
    ...Object.entries(CLASSES).map(([k, v]) => [k, v]),
  ]);
  const flagSelect = buildSelect([
    ['', 'Todos'], ['ritual', '📜 Ritual'], ['concentration', '🌀 Concentración'],
  ]);

  controls.appendChild(searchInput);
  controls.appendChild(levelSelect);
  controls.appendChild(schoolSelect);
  controls.appendChild(classSelect);
  controls.appendChild(flagSelect);

  if (isAdmin) {
    const createBtn = document.createElement('button');
    createBtn.className = 'btn btn-primary';
    createBtn.style.cssText = 'display:flex;align-items:center;gap:6px;white-space:nowrap;';
    createBtn.innerHTML = '<span style="font-size:16px;">+</span> Nuevo hechizo';
    createBtn.addEventListener('click', () => openSpellModal('create', null));
    controls.appendChild(createBtn);
  }
  page.appendChild(controls);

  const countEl = document.createElement('div');
  countEl.style.cssText = 'font-size:12px;color:var(--ink-muted);margin-bottom:14px;';
  page.appendChild(countEl);

  const gridWrap = document.createElement('div');
  page.appendChild(gridWrap);
  container.appendChild(page);

  /* ── Búsqueda con debounce ── */
  let searchTimer;
  const doSearch = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 250);
  };
  searchInput.addEventListener('input', doSearch);
  [levelSelect, schoolSelect, classSelect, flagSelect].forEach((s) => s.addEventListener('change', load));

  async function load() {
    gridWrap.innerHTML = '<div style="color:var(--ink-muted);padding:40px;text-align:center;">Cargando hechizos...</div>';
    countEl.textContent = '';
    try {
      let q = '/spells?per_page=100';
      if (searchInput.value) q += `&search=${encodeURIComponent(searchInput.value)}`;
      if (levelSelect.value !== '') q += `&level=${levelSelect.value}`;
      if (schoolSelect.value) q += `&school=${schoolSelect.value}`;
      if (classSelect.value) q += `&class=${classSelect.value}`;
      if (flagSelect.value === 'ritual') q += '&ritual=true';
      if (flagSelect.value === 'concentration') q += '&concentration=true';

      const res = await api.get(q);
      const spells = res.data ?? [];
      const total = res.meta?.total ?? spells.length;
      gridWrap.innerHTML = '';
      countEl.textContent = `${total} hechizo${total === 1 ? '' : 's'}${total > spells.length ? ` (mostrando ${spells.length})` : ''}`;

      if (!spells.length) {
        gridWrap.innerHTML = `<div style="text-align:center;padding:80px;color:var(--ink-muted);">
          <div style="font-size:32px;margin-bottom:12px;">📖</div>
          <div>No se encontraron hechizos con esos filtros</div>
        </div>`;
        return;
      }

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;';
      spells.forEach((sp, i) => grid.appendChild(buildCard(sp, i)));
      gridWrap.appendChild(grid);
    } catch (err) {
      gridWrap.innerHTML = `<div style="color:var(--crimson);padding:20px;">Error: ${err.message}</div>`;
    }
  }

  /* ── Tarjeta de hechizo ── */
  function buildCard(sp, index) {
    const sc = SCHOOLS[sp.school] || { label: sp.school, icon: '✨', color: 'var(--gold)' };

    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-radius:10px;
      padding:16px;cursor:pointer;position:relative;overflow:hidden;
      animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${index * 18}ms both;
      transition:transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur-fast);
      border-top:2px solid ${sc.color}66;
    `;
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = `0 0 0 1px ${sc.color}44, 0 4px 20px ${sc.color}22`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
    });
    card.addEventListener('click', () => openDetailModal(sp));

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;';
    const iconEl = document.createElement('div');
    iconEl.style.cssText = `width:36px;height:36px;border-radius:8px;background:${sc.color}1e;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;`;
    iconEl.textContent = sc.icon;
    const nameBlock = document.createElement('div');
    nameBlock.style.cssText = 'flex:1;min-width:0;';
    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-weight:600;color:var(--ink);font-size:14px;line-height:1.3;';
    nameEl.textContent = sp.name;
    const metaEl = document.createElement('div');
    metaEl.style.cssText = `font-size:11px;font-weight:600;color:${sc.color};margin-top:2px;`;
    metaEl.textContent = `${levelLabel(sp.level)} · ${sc.label}`;
    nameBlock.appendChild(nameEl);
    nameBlock.appendChild(metaEl);
    head.appendChild(iconEl);
    head.appendChild(nameBlock);
    card.appendChild(head);

    /* línea de meta rápida */
    const quick = document.createElement('div');
    quick.style.cssText = 'font-size:11px;color:var(--ink-muted);margin-bottom:10px;line-height:1.5;';
    quick.textContent = `⏱ ${tCasting(sp.casting_time)} · 🎯 ${tRange(sp)} · 🧩 ${compStr(sp)}`;
    card.appendChild(quick);

    const badges = document.createElement('div');
    badges.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
    if (sp.concentration) badges.appendChild(badge('🌀 Concentración', '#f59e0b', 'rgba(245,158,11,0.12)'));
    if (sp.ritual) badges.appendChild(badge('📜 Ritual', '#14b8a6', 'rgba(20,184,166,0.12)'));
    if (sp.requires_attack_roll) badges.appendChild(badge('🎯 Ataque', '#4a9eff', 'rgba(74,158,255,0.12)'));
    if (sp.saving_throw) badges.appendChild(badge(`🛡️ ${sp.saving_throw}`, '#a855f7', 'rgba(168,85,247,0.12)'));
    if (sp.damage_dice) badges.appendChild(badge(`💥 ${sp.damage_dice}`, 'var(--crimson)', 'var(--crimson-dim)'));
    card.appendChild(badges);

    if (isAdmin) {
      const editBtn = document.createElement('button');
      editBtn.style.cssText = 'position:absolute;top:8px;right:34px;padding:3px 8px;border-radius:4px;font-size:10px;cursor:pointer;background:var(--gold-glow);color:var(--gold);border:1px solid var(--gold-dim);';
      editBtn.textContent = '✎';
      editBtn.title = 'Editar hechizo';
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); openSpellModal('edit', sp); });
      card.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.style.cssText = 'position:absolute;top:8px;right:8px;padding:3px 8px;border-radius:4px;font-size:10px;cursor:pointer;background:var(--crimson-dim);color:var(--crimson);border:1px solid var(--crimson);';
      delBtn.textContent = '✕';
      delBtn.title = 'Eliminar del catálogo';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`¿Eliminar "${sp.name}" del catálogo?`)) return;
        try {
          await api.del(`/spells/${sp.id}`);
          toast.success('Hechizo eliminado');
          card.remove();
        } catch (err) { toast.error(err.message); }
      });
      card.appendChild(delBtn);
    }
    return card;
  }

  /* ── Modal de detalle (toda la información de uso) ── */
  function openDetailModal(sp) {
    const sc = SCHOOLS[sp.school] || { label: sp.school, icon: '✨', color: 'var(--gold)' };
    const overlay = buildOverlay();
    const m = buildModal(`${sc.icon} ${sp.name}`);
    m.style.maxWidth = '560px';

    const sub = document.createElement('div');
    sub.style.cssText = `font-size:13px;font-weight:600;color:${sc.color};margin:-12px 0 16px;`;
    sub.textContent = `${levelLabel(sp.level)} · ${sc.label}` + (sp.name_en ? `  ·  ${sp.name_en}` : '');
    m.appendChild(sub);

    /* Ficha de atributos */
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin-bottom:16px;';
    const rows = [
      ['Tiempo de lanzamiento', tCasting(sp.casting_time)],
      ['Alcance', tRange(sp)],
      ['Componentes', compStr(sp)],
      ['Duración', tDuration(sp.duration)],
    ];
    if (sp.saving_throw) rows.push(['Salvación', ABILITIES[sp.saving_throw] || sp.saving_throw]);
    if (sp.requires_attack_roll) rows.push(['Resolución', 'Tirada de ataque de hechizo']);
    if (sp.damage_dice) rows.push(['Daño', `${sp.damage_dice}${sp.damage_type ? ' ' + (DAMAGE_ES[sp.damage_type] || sp.damage_type) : ''}`]);
    rows.forEach(([k, v]) => {
      const cell = document.createElement('div');
      cell.innerHTML = `<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-faint);margin-bottom:2px;">${k}</div>
        <div style="font-size:13px;color:var(--ink);font-weight:500;">${v}</div>`;
      grid.appendChild(cell);
    });
    m.appendChild(grid);

    /* Insignias */
    const flags = document.createElement('div');
    flags.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;';
    if (sp.concentration) flags.appendChild(badge('🌀 Concentración', '#f59e0b', 'rgba(245,158,11,0.12)'));
    if (sp.ritual) flags.appendChild(badge('📜 Ritual', '#14b8a6', 'rgba(20,184,166,0.12)'));
    if (flags.children.length) m.appendChild(flags);

    /* Componente material */
    if (sp.comp_material && sp.material_description) {
      const mat = document.createElement('div');
      mat.style.cssText = 'font-size:12px;color:var(--ink-muted);font-style:italic;margin-bottom:16px;padding:8px 12px;background:var(--stone-light);border-radius:8px;';
      mat.textContent = `Material: ${sp.material_description}`;
      m.appendChild(mat);
    }

    /* Descripción (párrafos) */
    if (sp.description) {
      sp.description.split('\n\n').forEach((par) => {
        const p = document.createElement('p');
        p.style.cssText = 'font-size:13px;color:var(--ink);line-height:1.6;margin:0 0 10px;';
        p.textContent = par;
        m.appendChild(p);
      });
    }

    /* A niveles superiores */
    if (sp.higher_levels) {
      const hl = document.createElement('div');
      hl.style.cssText = 'margin-top:12px;padding:12px;background:var(--gold-glow);border-radius:8px;border:1px solid var(--gold-dim);';
      hl.innerHTML = `<div style="font-size:11px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">A niveles superiores</div>`;
      const hlText = document.createElement('div');
      hlText.style.cssText = 'font-size:13px;color:var(--ink);line-height:1.6;';
      hlText.textContent = sp.higher_levels;
      hl.appendChild(hlText);
      m.appendChild(hl);
    }

    /* Clases */
    if (sp.classes?.length) {
      const cl = document.createElement('div');
      cl.style.cssText = 'margin-top:16px;display:flex;flex-wrap:wrap;gap:6px;';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:11px;color:var(--ink-muted);align-self:center;margin-right:2px;';
      lbl.textContent = 'Clases:';
      cl.appendChild(lbl);
      sp.classes.forEach((c) => cl.appendChild(badge(CLASSES[c] || c, 'var(--ink-muted)', 'var(--stone-light)')));
      m.appendChild(cl);
    }

    /* Acciones */
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:24px;';
    if (isAdmin) {
      const edit = buildBtn('Editar', false);
      edit.addEventListener('click', () => { close(); openSpellModal('edit', sp); });
      actions.appendChild(edit);
    }
    const closeBtn = buildBtn('Cerrar', true);
    closeBtn.addEventListener('click', close);
    actions.appendChild(closeBtn);
    m.appendChild(actions);

    function close() { overlay.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', esc);

    overlay.appendChild(m);
    document.body.appendChild(overlay);
  }

  /* ── Modal crear/editar (admin) ── */
  function openSpellModal(mode, sp) {
    const isEdit = mode === 'edit';
    const overlay = buildOverlay();
    const m = buildModal(isEdit ? `Editar «${sp.name}»` : 'Nuevo hechizo');
    m.style.maxWidth = '560px';

    const form = document.createElement('div');
    form.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

    const fName = textInput('Nombre (español)', sp?.name || '');
    const fNameEn = textInput('Nombre (inglés)', sp?.name_en || '');
    const fLevel = selectField('Nivel', [['0', 'Truco'], ...Array.from({ length: 9 }, (_, i) => [String(i + 1), `Nivel ${i + 1}`])], String(sp?.level ?? '0'));
    const fSchool = selectField('Escuela', Object.entries(SCHOOLS).map(([k, v]) => [k, v.label]), sp?.school || 'evocation');
    const fCasting = textInput('Tiempo de lanzamiento', sp?.casting_time || '1 acción');
    const fRange = textInput('Alcance', sp?.range_text || 'Toque');
    const fDuration = textInput('Duración', sp?.duration || 'Instantáneo');

    /* Componentes */
    const compWrap = fieldWrap('Componentes');
    const compRow = document.createElement('div');
    compRow.style.cssText = 'display:flex;gap:16px;';
    const cV = checkbox('Verbal (V)', sp?.comp_verbal);
    const cS = checkbox('Somático (S)', sp?.comp_somatic);
    const cM = checkbox('Material (M)', sp?.comp_material);
    compRow.append(cV.wrap, cS.wrap, cM.wrap);
    compWrap.appendChild(compRow);

    const fMaterial = textInput('Descripción del material (si M)', sp?.material_description || '');

    /* Flags */
    const flagWrap = fieldWrap('Propiedades');
    const flagRow = document.createElement('div');
    flagRow.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;';
    const cConc = checkbox('Concentración', sp?.concentration);
    const cRit = checkbox('Ritual', sp?.ritual);
    const cAtk = checkbox('Tirada de ataque', sp?.requires_attack_roll);
    flagRow.append(cConc.wrap, cRit.wrap, cAtk.wrap);
    flagWrap.appendChild(flagRow);

    const fSave = selectField('Salvación', [['', '—'], ...Object.entries(ABILITIES).map(([k, v]) => [k, v])], sp?.saving_throw || '');
    const fDmgDice = textInput('Dados de daño (ej. 8d6)', sp?.damage_dice || '');
    const fDmgType = selectField('Tipo de daño', [['', '—'], ...Object.entries(DAMAGE_ES).map(([k, v]) => [k, v])], sp?.damage_type || '');
    const fScaling = textInput('Escalado de daño', sp?.damage_scaling || '');

    /* Clases (checkboxes) */
    const classWrap = fieldWrap('Clases');
    const classGrid = document.createElement('div');
    classGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;';
    const classChecks = Object.entries(CLASSES).map(([k, v]) => {
      const c = checkbox(v, sp?.classes?.includes(k));
      c.key = k;
      classGrid.appendChild(c.wrap);
      return c;
    });
    classWrap.appendChild(classGrid);

    const fDesc = textareaInput('Descripción', sp?.description || '', 5);
    const fHigher = textareaInput('A niveles superiores', sp?.higher_levels || '', 3);

    form.append(
      fName.wrap, fNameEn.wrap, row2(fLevel.wrap, fSchool.wrap),
      fCasting.wrap, row2(fRange.wrap, fDuration.wrap),
      compWrap, fMaterial.wrap, flagWrap,
      row2(fSave.wrap, fDmgType.wrap), row2(fDmgDice.wrap, fScaling.wrap),
      classWrap, fDesc.wrap, fHigher.wrap,
    );
    m.appendChild(form);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:20px;';
    const cancel = buildBtn('Cancelar', false);
    cancel.addEventListener('click', close);
    const save = buildBtn(isEdit ? 'Guardar cambios' : 'Crear hechizo', true);
    save.addEventListener('click', submit);
    actions.append(cancel, save);
    m.appendChild(actions);

    async function submit() {
      const payload = {
        name: fName.input.value.trim(),
        name_en: fNameEn.input.value.trim() || null,
        level: parseInt(fLevel.input.value, 10),
        school: fSchool.input.value,
        casting_time: fCasting.input.value.trim(),
        range_text: fRange.input.value.trim(),
        duration: fDuration.input.value.trim(),
        comp_verbal: cV.input.checked,
        comp_somatic: cS.input.checked,
        comp_material: cM.input.checked,
        material_description: fMaterial.input.value.trim() || null,
        concentration: cConc.input.checked,
        ritual: cRit.input.checked,
        requires_attack_roll: cAtk.input.checked,
        saving_throw: fSave.input.value || null,
        damage_dice: fDmgDice.input.value.trim() || null,
        damage_type: fDmgType.input.value || null,
        damage_scaling: fScaling.input.value.trim() || null,
        classes: classChecks.filter((c) => c.input.checked).map((c) => c.key),
        description: fDesc.input.value.trim(),
      };
      const higher = fHigher.input.value.trim();
      if (higher) payload.higher_levels = higher;

      if (!payload.name) { toast.error('El nombre es obligatorio'); return; }
      save.disabled = true;
      try {
        if (isEdit) await api.put(`/spells/${sp.id}`, payload);
        else await api.post('/spells', payload);
        toast.success(isEdit ? 'Hechizo actualizado' : 'Hechizo creado');
        close();
        load();
      } catch (err) {
        toast.error(err.message);
        save.disabled = false;
      }
    }

    function close() { overlay.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', esc);

    overlay.appendChild(m);
    document.body.appendChild(overlay);
  }

  load();
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function badge(text, color, bg) {
  const el = document.createElement('span');
  el.style.cssText = `padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;color:${color};background:${bg};border:1px solid ${color}33;`;
  el.textContent = text;
  return el;
}

function buildOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(9,8,10,0.85);
    backdrop-filter:blur(8px);z-index:1000;
    display:flex;align-items:center;justify-content:center;padding:20px;
    animation:fadeIn var(--dur-fast) ease;
  `;
  return overlay;
}

function buildModal(title) {
  const m = document.createElement('div');
  m.style.cssText = `
    background:var(--stone);border:1px solid var(--border);border-radius:14px;
    padding:28px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;
    animation:modalIn var(--dur-normal) var(--ease-spring);
    box-shadow:0 20px 60px rgba(0,0,0,0.6);
  `;
  const h = document.createElement('h3');
  h.style.cssText = 'font-family:var(--font-display);font-size:20px;color:var(--gold);margin:0 0 20px;';
  h.textContent = title;
  m.appendChild(h);
  return m;
}

function buildBtn(label, primary) {
  const btn = document.createElement('button');
  btn.className = primary ? 'btn btn-primary' : 'btn';
  btn.textContent = label;
  return btn;
}

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

function applyInputStyle(el) {
  el.style.cssText = `
    width:100%;box-sizing:border-box;
    background:var(--stone-light);border:1px solid var(--border);color:var(--ink);
    border-radius:8px;padding:9px 12px;font-family:var(--font-ui);font-size:13px;
    outline:none;transition:border-color var(--dur-fast);
  `;
  el.addEventListener('focus', () => (el.style.borderColor = 'var(--gold-dim)'));
  el.addEventListener('blur', () => (el.style.borderColor = 'var(--border)'));
}

function fieldWrap(label) {
  const wrap = document.createElement('div');
  const lbl = document.createElement('label');
  lbl.style.cssText = 'display:block;font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px;';
  lbl.textContent = label;
  wrap.appendChild(lbl);
  return wrap;
}

function textInput(label, value) {
  const wrap = fieldWrap(label);
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  applyInputStyle(input);
  wrap.appendChild(input);
  return { wrap, input };
}

function textareaInput(label, value, rows) {
  const wrap = fieldWrap(label);
  const input = document.createElement('textarea');
  input.rows = rows || 4;
  input.value = value;
  applyInputStyle(input);
  input.style.resize = 'vertical';
  wrap.appendChild(input);
  return { wrap, input };
}

function selectField(label, options, value) {
  const wrap = fieldWrap(label);
  const input = buildSelect(options);
  input.style.width = '100%';
  input.style.boxSizing = 'border-box';
  input.value = value;
  wrap.appendChild(input);
  return { wrap, input };
}

function checkbox(label, checked) {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink);cursor:pointer;';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!checked;
  input.style.cssText = 'accent-color:var(--gold);cursor:pointer;';
  wrap.append(input, document.createTextNode(label));
  return { wrap, input };
}

function row2(a, b) {
  const row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
  row.append(a, b);
  return row;
}
