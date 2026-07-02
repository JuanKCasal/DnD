import { api } from '../js/api.js';
import { toast } from '../js/components/toast.js';

/* Rastreador de combate (Fase C6). Overlay abierto desde un encuentro. */

const CONDITIONS = [
  { value: 'blinded', label: 'Cegado' }, { value: 'charmed', label: 'Encantado' },
  { value: 'deafened', label: 'Ensordecido' }, { value: 'frightened', label: 'Asustado' },
  { value: 'grappled', label: 'Agarrado' }, { value: 'incapacitated', label: 'Incapacitado' },
  { value: 'invisible', label: 'Invisible' }, { value: 'paralyzed', label: 'Paralizado' },
  { value: 'petrified', label: 'Petrificado' }, { value: 'poisoned', label: 'Envenenado' },
  { value: 'prone', label: 'Derribado' }, { value: 'restrained', label: 'Apresado' },
  { value: 'stunned', label: 'Aturdido' }, { value: 'unconscious', label: 'Inconsciente' },
];
const COND_LABEL = Object.fromEntries(CONDITIONS.map(c => [c.value, c.label]));
const TYPE_ICON = { pc: '🧙', monster: '🐉', npc: '🧑' };

function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

export function openCombat(campaignId, encounter) {
  const base = `/campaigns/${campaignId}/encounters/${encounter.id}/combat`;
  let state = null;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(9,8,10,0.85);backdrop-filter:blur(8px);z-index:1100;display:flex;align-items:center;justify-content:center;animation:fadeIn var(--dur-normal) var(--ease-smooth);';
  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--stone);border:1px solid var(--border);border-radius:14px;width:min(920px,96vw);max-height:92vh;display:flex;flex-direction:column;animation:modalIn var(--dur-normal) var(--ease-spring);';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 24px;border-bottom:1px solid var(--border);flex-wrap:wrap;';
  const body = document.createElement('div');
  body.style.cssText = 'padding:20px 24px;overflow-y:auto;';
  modal.appendChild(head); modal.appendChild(body);

  async function call(method, path, payload) {
    const res = await api[method](base + path, payload);
    state = res.data;
    render();
  }
  async function refresh() {
    try { state = (await api.get(base)).data; } catch (e) { state = null; }
    render();
  }

  function render() {
    head.innerHTML = '';
    body.innerHTML = '';

    const titleWrap = document.createElement('div');
    titleWrap.innerHTML = `<div style="font-family:var(--font-display);font-size:20px;color:var(--gold);">⚔️ ${esc(encounter.name)}</div>
      ${state ? `<div style="font-size:12px;color:var(--ink-muted);">Ronda <b style="color:var(--ink);">${state.round}</b> · ${state.combatants.length} combatientes</div>` : ''}`;
    head.appendChild(titleWrap);

    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    if (state) {
      controls.appendChild(btn('▶ Siguiente turno', 'btn-primary', () => call('post', '/next-turn')));
      controls.appendChild(btn('+ Combatiente', 'btn', addCombatantPrompt));
      controls.appendChild(btn('↻ Reiniciar', 'btn', async () => { if (confirm('¿Reiniciar el combate? Se recrean los combatientes.')) call('post', '/start'); }));
      controls.appendChild(btn('Terminar', 'btn', async () => { if (confirm('¿Terminar el combate?')) { await api.del(base); state = null; render(); } }));
    }
    controls.appendChild(btn('✕', 'btn', () => overlay.remove()));
    head.appendChild(controls);

    if (!state) {
      body.innerHTML = `<div style="text-align:center;padding:50px 20px;color:var(--ink-muted);">
        <div style="font-size:40px;margin-bottom:12px;">🎲</div>
        <div style="font-family:var(--font-display);font-size:18px;color:var(--ink);">Combate no iniciado</div>
        <div style="font-size:13px;margin:6px 0 18px;">Se cargarán los monstruos del encuentro y los personajes de la campaña, con iniciativa tirada automáticamente.</div>
      </div>`;
      const start = btn('🎲 Iniciar combate', 'btn-primary', () => call('post', '/start'));
      start.style.margin = '0 auto'; start.style.display = 'block';
      body.appendChild(start);
      return;
    }

    if (!state.combatants.length) {
      body.appendChild(document.createTextNode('Sin combatientes. Usa "+ Combatiente".'));
      return;
    }

    state.combatants.forEach((c, i) => body.appendChild(combatantRow(c, i === state.current_turn_index)));
  }

  function combatantRow(c, isActive) {
    const dead = c.is_dead || (c.current_hp === 0 && c.max_hp);
    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:12px;padding:10px 12px;margin-bottom:8px;border-radius:10px;
      border:1px solid ${isActive ? 'var(--gold)' : 'var(--border)'};
      background:${isActive ? 'var(--gold-glow)' : 'var(--stone-light)'};
      ${dead ? 'opacity:0.55;' : ''}`;

    /* Initiative */
    const init = document.createElement('input');
    init.type = 'number'; init.value = c.initiative; init.className = 'input';
    init.title = 'Iniciativa';
    init.style.cssText = 'width:52px;text-align:center;font-family:var(--font-mono);font-size:16px;';
    init.addEventListener('change', () => call('put', `/combatants/${c.id}`, { initiative: parseInt(init.value, 10) || 0 }));
    row.appendChild(init);

    /* Name + type + conditions */
    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0;';
    const conds = (c.conditions || []).map(cd =>
      `<span data-cond="${cd}" title="Quitar" style="cursor:pointer;font-size:10px;text-transform:uppercase;background:var(--crimson-dim);color:var(--crimson);border-radius:8px;padding:1px 7px;">${COND_LABEL[cd] || cd} ✕</span>`).join(' ');
    info.innerHTML = `<div style="font-size:15px;color:var(--ink);">${TYPE_ICON[c.combatant_type] || ''} ${esc(c.name)}${c.armor_class != null ? ` <span style="font-size:11px;color:var(--ink-muted);">CA ${c.armor_class}</span>` : ''}${c.concentration ? ` <span title="Concentración" style="font-size:11px;color:var(--gold-dim);">✦ ${esc(c.concentration)}</span>` : ''}${c.exhaustion ? ` <span style="font-size:10px;color:var(--crimson);">Agot. ${c.exhaustion}</span>` : ''}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;">${conds}</div>`;
    info.querySelectorAll('[data-cond]').forEach(chip => {
      chip.addEventListener('click', () => {
        const next = (c.conditions || []).filter(x => x !== chip.dataset.cond);
        call('put', `/combatants/${c.id}`, { conditions: next });
      });
    });
    row.appendChild(info);

    /* HP */
    const hpWrap = document.createElement('div');
    hpWrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const hpTxt = document.createElement('div');
    hpTxt.style.cssText = 'font-family:var(--font-mono);font-size:14px;min-width:70px;text-align:right;';
    const ratio = c.max_hp ? Math.max(0, (c.current_hp ?? 0) / c.max_hp) : 1;
    const hpColor = ratio > 0.5 ? 'var(--success)' : ratio > 0.25 ? 'var(--gold)' : 'var(--crimson)';
    hpTxt.innerHTML = c.max_hp != null
      ? `<span style="color:${hpColor};font-weight:600;">${c.current_hp ?? 0}</span><span style="color:var(--ink-faint);">/${c.max_hp}</span>${c.temp_hp ? `<span style="color:var(--gold-dim);"> +${c.temp_hp}</span>` : ''}`
      : '<span style="color:var(--ink-faint);">—</span>';
    const amount = document.createElement('input');
    amount.type = 'number'; amount.min = '0'; amount.placeholder = '0'; amount.className = 'input';
    amount.style.cssText = 'width:56px;text-align:center;';
    const dmg = btn('−', 'btn', () => {
      const n = parseInt(amount.value, 10) || 0; if (!n) return;
      call('put', `/combatants/${c.id}`, { current_hp: Math.max(0, (c.current_hp ?? 0) - n) });
    });
    dmg.title = 'Daño'; dmg.style.cssText = 'background:var(--crimson-dim);color:var(--crimson);border:1px solid var(--crimson);padding:4px 10px;';
    const heal = btn('+', 'btn', () => {
      const n = parseInt(amount.value, 10) || 0; if (!n) return;
      const capped = c.max_hp != null ? Math.min(c.max_hp, (c.current_hp ?? 0) + n) : (c.current_hp ?? 0) + n;
      call('put', `/combatants/${c.id}`, { current_hp: capped });
    });
    heal.title = 'Curar'; heal.style.cssText = 'background:var(--success);color:#fff;border:1px solid var(--success);padding:4px 10px;';
    hpWrap.appendChild(hpTxt); hpWrap.appendChild(dmg); hpWrap.appendChild(amount); hpWrap.appendChild(heal);
    row.appendChild(hpWrap);

    /* Menu: conditions / concentration / remove */
    const addCond = document.createElement('select');
    addCond.className = 'input'; addCond.style.cssText = 'width:130px;';
    addCond.innerHTML = '<option value="">+ Condición</option>' + CONDITIONS.map(cd => `<option value="${cd.value}">${cd.label}</option>`).join('');
    addCond.addEventListener('change', () => {
      if (!addCond.value) return;
      const next = Array.from(new Set([...(c.conditions || []), addCond.value]));
      call('put', `/combatants/${c.id}`, { conditions: next });
    });
    row.appendChild(addCond);

    const more = btn('⋯', 'btn', () => {
      const conc = prompt('Concentración (hechizo activo; vacío para quitar):', c.concentration || '');
      if (conc === null) return;
      call('put', `/combatants/${c.id}`, { concentration: conc.trim() || null });
    });
    more.title = 'Concentración';
    row.appendChild(more);

    const rm = btn('🗑', 'btn', () => { if (confirm(`¿Quitar a ${c.name}?`)) call('del', `/combatants/${c.id}`); });
    rm.style.cssText += 'color:var(--crimson);';
    row.appendChild(rm);

    return row;
  }

  function addCombatantPrompt() {
    const name = prompt('Nombre del combatiente:');
    if (!name) return;
    const hp = parseInt(prompt('Puntos de golpe máximos (opcional):', '') || '', 10);
    const init = parseInt(prompt('Iniciativa:', '10') || '10', 10);
    call('post', '/combatants', {
      name: name.trim(), combatant_type: 'npc',
      max_hp: Number.isFinite(hp) ? hp : null, current_hp: Number.isFinite(hp) ? hp : null,
      initiative: Number.isFinite(init) ? init : 0,
    });
  }

  function btn(label, cls, onClick) {
    const b = document.createElement('button');
    b.className = 'btn ' + (cls || '');
    b.textContent = label;
    b.style.cssText = (b.style.cssText || '') + 'cursor:pointer;';
    b.addEventListener('click', onClick);
    return b;
  }

  render();
  refresh();
}
