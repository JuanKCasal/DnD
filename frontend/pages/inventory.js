import { api } from '../js/api.js';
import { toast } from '../js/components/toast.js';
import { auth } from '../js/auth.js';

/* ── Rarity config ─────────────────────────────────────────────── */
const RARITY = {
  common:    { label: 'Común',        color: '#9d9d9d', bg: 'rgba(157,157,157,0.12)' },
  uncommon:  { label: 'Infrecuente',  color: '#1eff00', bg: 'rgba(30,255,0,0.08)'    },
  rare:      { label: 'Raro',         color: '#0070dd', bg: 'rgba(0,112,221,0.12)'   },
  very_rare: { label: 'Muy raro',     color: '#a335ee', bg: 'rgba(163,53,238,0.12)'  },
  legendary: { label: 'Legendario',   color: '#ff8000', bg: 'rgba(255,128,0,0.12)'   },
  artifact:  { label: 'Artefacto',    color: '#e6cc80', bg: 'rgba(230,204,128,0.12)' },
};

const TYPE_ICON = {
  weapon: '⚔️', armor: '🛡️', potion: '🧪', spell_scroll: '📜',
  ring: '💍', rod: '🔱', staff: '🪄', wand: '✨',
  wondrous: '🌟', tool: '🔧', ammunition: '🏹', gear: '🎒',
  treasure: '💎', vehicle: '🚗', other: '📦',
};

/* ── Slots de equipo ───────────────────────────────────────────── */
const SLOT_LABELS = {
  head: 'Cabeza', neck: 'Cuello', body: 'Cuerpo', cloak: 'Espalda (capa)',
  hands: 'Manos', ring_left: 'Anillo izq.', ring_right: 'Anillo der.',
  waist: 'Cintura', feet: 'Pies', main_hand: 'Mano principal',
  off_hand: 'Mano secundaria', back: 'Espalda',
};
const SLOT_OPTIONS = [
  ['main_hand', 'Mano principal'], ['off_hand', 'Mano secundaria'],
  ['head', 'Cabeza'], ['neck', 'Cuello'], ['body', 'Cuerpo'],
  ['cloak', 'Espalda (capa)'], ['hands', 'Manos'], ['ring_left', 'Anillo izq.'],
  ['ring_right', 'Anillo der.'], ['waist', 'Cintura'], ['feet', 'Pies'],
  ['back', 'Espalda'],
];

/* ═══════════════════════════════════════════════════════════════
   MAIN RENDER
═══════════════════════════════════════════════════════════════ */
export async function render(container) {
  container.innerHTML = '';
  const user = auth.getUser();

  /* ── Detectar modo por ruta ── */
  const hash = window.location.hash;
  const mode = hash.startsWith('#/treasury') ? 'treasury'
             : hash.startsWith('#/catalogue') ? 'catalogue'
             : 'player';
  const isAdmin = user?.role === 'admin';
  const isDM    = user?.role === 'dm';
  const canManage = mode === 'catalogue' ? isAdmin : isAdmin || isDM;

  const PAGE_META = {
    player:    { title: '᛭ Inventario del Jugador ᛭', subtitle: 'Equipamiento de tus personajes' },
    treasury:  { title: '᛭ Tesoros de Campaña ᛭',     subtitle: 'Items y monedas del grupo' },
    catalogue: { title: '᛭ Catálogo de Items ᛭',       subtitle: 'Todos los items de la comunidad' },
  };
  const meta = PAGE_META[mode];

  const page = document.createElement('div');
  page.className = 'page-inventory fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:1100px;';

  /* ── Header ── */
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;gap:16px;flex-wrap:wrap;';

  const titleBlock = document.createElement('div');
  const title = document.createElement('h2');
  title.style.cssText = 'font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;';
  title.textContent = meta.title;
  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'color:var(--ink-muted);font-size:14px;margin:0;';
  subtitle.textContent = meta.subtitle;
  titleBlock.appendChild(title);
  titleBlock.appendChild(subtitle);
  header.appendChild(titleBlock);
  page.appendChild(header);

  const content = document.createElement('div');
  page.appendChild(content);
  container.appendChild(page);

  if (mode === 'treasury') renderTreasuryTab();
  else if (mode === 'catalogue') renderCatalogueTab();
  else renderCharacterTab();

  /* ═══════════════════════════════════════════════════════════════
     TAB: MI INVENTARIO
  ═══════════════════════════════════════════════════════════════ */
  async function renderCharacterTab() {
    content.innerHTML = '<div style="color:var(--ink-muted);padding:40px;text-align:center;">Cargando...</div>';

    // Load active characters for current user
    let characters = [];
    try {
      const res = await api.get(`/characters?member_id=${user.id}&active=true&per_page=50`);
      characters = res.data ?? [];
    } catch (_) {}

    content.innerHTML = '';

    if (!characters.length) {
      content.innerHTML = `
        <div style="text-align:center;padding:80px 20px;color:var(--ink-muted);">
          <div style="font-size:40px;margin-bottom:16px;">🧙</div>
          <div style="font-family:var(--font-display);font-size:18px;color:var(--ink);">Sin personajes activos</div>
          <div style="margin-top:8px;font-size:13px;">Crea un personaje para gestionar su inventario</div>
        </div>`;
      return;
    }

    // Character selector
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:20px;flex-wrap:wrap;';

    const charSelect = document.createElement('select');
    charSelect.style.cssText = `
      background:var(--stone);border:1px solid var(--border);color:var(--ink);
      border-radius:8px;padding:8px 12px;font-family:var(--font-ui);font-size:13px;
      cursor:pointer;min-width:200px;
    `;
    characters.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = `${c.name} (${c.race} ${c.class} Nv.${c.level})`;
      charSelect.appendChild(o);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.style.cssText = 'display:flex;align-items:center;gap:6px;white-space:nowrap;';
    addBtn.innerHTML = '<span style="font-size:16px;">+</span> Añadir item';
    addBtn.addEventListener('click', () => openAddItemModal(charSelect.value, 'character', charInventoryEl));

    controls.appendChild(charSelect);
    controls.appendChild(addBtn);
    content.appendChild(controls);

    const charInventoryEl = document.createElement('div');
    content.appendChild(charInventoryEl);

    charSelect.addEventListener('change', () => loadCharInventory(charSelect.value, charInventoryEl));
    loadCharInventory(charSelect.value, charInventoryEl);
  }

  async function loadCharInventory(charId, el) {
    el.innerHTML = '<div style="color:var(--ink-muted);padding:20px;text-align:center;">Cargando inventario...</div>';
    try {
      const res = await api.get(`/characters/${charId}/inventory`);
      const items = res.data ?? [];
      el.innerHTML = '';
      if (!items.length) {
        el.innerHTML = `<div style="text-align:center;padding:60px;color:var(--ink-muted);">
          <div style="font-size:32px;margin-bottom:12px;">🎒</div>
          <div>Inventario vacío — añade items desde el catálogo</div>
        </div>`;
        return;
      }
      // Contador de sintonía (máx 3)
      const attunedCount = items.filter(i => i.attuned).length;
      const counter = document.createElement('div');
      counter.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:12px;';
      const chip = document.createElement('span');
      chip.style.cssText = `padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;
        background:var(--gold-glow);color:var(--gold);border:1px solid var(--gold-dim)44;`;
      chip.textContent = `🔮 Sintonía ${attunedCount}/3`;
      counter.appendChild(chip);
      el.appendChild(counter);

      const equipped = items.filter(i => i.equipped);
      const unequipped = items.filter(i => !i.equipped);
      if (equipped.length) {
        el.appendChild(inventorySection('Equipado', equipped, charId, 'character', el));
      }
      if (unequipped.length) {
        el.appendChild(inventorySection('Mochila', unequipped, charId, 'character', el));
      }
    } catch (err) {
      el.innerHTML = `<div style="color:var(--crimson);padding:20px;">Error: ${err.message}</div>`;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     TAB: TESORO
  ═══════════════════════════════════════════════════════════════ */
  async function renderTreasuryTab() {
    content.innerHTML = '<div style="color:var(--ink-muted);padding:40px;text-align:center;">Cargando...</div>';

    let campaigns = [];
    try {
      const res = await api.get('/campaigns?status=active&per_page=50');
      campaigns = res.data ?? [];
    } catch (_) {}

    content.innerHTML = '';

    if (!campaigns.length) {
      content.innerHTML = `<div style="text-align:center;padding:80px;color:var(--ink-muted);">
        <div style="font-size:40px;margin-bottom:12px;">🗺️</div>
        <div>Sin campañas activas</div>
      </div>`;
      return;
    }

    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:20px;flex-wrap:wrap;';

    const campSelect = document.createElement('select');
    campSelect.style.cssText = `
      background:var(--stone);border:1px solid var(--border);color:var(--ink);
      border-radius:8px;padding:8px 12px;font-family:var(--font-ui);font-size:13px;
      cursor:pointer;min-width:220px;
    `;
    campaigns.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      campSelect.appendChild(o);
    });
    controls.appendChild(campSelect);

    if (canManage) {
      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-primary';
      addBtn.style.cssText = 'display:flex;align-items:center;gap:6px;white-space:nowrap;';
      addBtn.innerHTML = '<span style="font-size:16px;">+</span> Añadir item';
      addBtn.addEventListener('click', () => openAddItemModal(campSelect.value, 'treasury', treasuryEl));
      controls.appendChild(addBtn);

      const currencyBtn = document.createElement('button');
      currencyBtn.className = 'btn';
      currencyBtn.style.cssText = 'white-space:nowrap;';
      currencyBtn.textContent = '💰 Editar monedas';
      currencyBtn.addEventListener('click', () => openCurrencyModal(campSelect.value, treasuryEl));
      controls.appendChild(currencyBtn);
    }

    content.appendChild(controls);

    const treasuryEl = document.createElement('div');
    content.appendChild(treasuryEl);

    campSelect.addEventListener('change', () => loadTreasury(campSelect.value, treasuryEl));
    loadTreasury(campSelect.value, treasuryEl);
  }

  async function loadTreasury(campId, el) {
    el.innerHTML = '<div style="color:var(--ink-muted);padding:20px;text-align:center;">Cargando tesoro...</div>';
    try {
      const res = await api.get(`/campaigns/${campId}/treasury`);
      const { items, currency } = res.data;
      el.innerHTML = '';

      // Currency display
      const curr = document.createElement('div');
      curr.style.cssText = `
        display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;
        background:var(--stone);border:1px solid var(--border);border-radius:10px;
        padding:16px 20px;align-items:center;
      `;
      const coins = [
        { key:'platinum', label:'PP', color:'#b0c4de' },
        { key:'gold',     label:'PO', color:'#ffd700' },
        { key:'electrum', label:'PE', color:'#7fffd4' },
        { key:'silver',   label:'PA', color:'#c0c0c0' },
        { key:'copper',   label:'PC', color:'#b87333' },
      ];
      coins.forEach(({ key, label, color }) => {
        const chip = document.createElement('div');
        chip.style.cssText = `display:flex;align-items:center;gap:6px;`;
        chip.innerHTML = `
          <span style="width:28px;height:28px;border-radius:50%;background:${color}22;
            border:2px solid ${color};display:flex;align-items:center;justify-content:center;
            font-size:10px;font-weight:700;color:${color};">${label}</span>
          <span style="font-family:var(--font-mono);font-size:16px;font-weight:600;color:var(--ink);">${(currency[key] || 0).toLocaleString()}</span>
        `;
        curr.appendChild(chip);
      });
      el.appendChild(curr);

      if (!items.length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:60px;color:var(--ink-muted);';
        empty.innerHTML = '<div style="font-size:32px;margin-bottom:12px;">💎</div><div>Tesoro vacío</div>';
        el.appendChild(empty);
        return;
      }
      el.appendChild(inventorySection('Items del tesoro', items, campId, 'treasury', el));
    } catch (err) {
      el.innerHTML = `<div style="color:var(--crimson);padding:20px;">Error: ${err.message}</div>`;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     TAB: CATÁLOGO
  ═══════════════════════════════════════════════════════════════ */
  async function renderCatalogueTab() {
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:20px;flex-wrap:wrap;';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Buscar items...';
    searchInput.style.cssText = `
      background:var(--stone);border:1px solid var(--border);color:var(--ink);
      border-radius:8px;padding:8px 12px;font-family:var(--font-ui);font-size:13px;
      flex:1;min-width:180px;outline:none;
    `;

    const typeSelect = buildSelect([
      ['', 'Todos los tipos'],
      ['weapon','⚔️ Arma'],['armor','🛡️ Armadura'],['potion','🧪 Poción'],
      ['spell_scroll','📜 Pergamino'],['ring','💍 Anillo'],['rod','🔱 Vara'],
      ['staff','🪄 Bastón'],['wand','✨ Varita'],['wondrous','🌟 Maravilloso'],
      ['tool','🔧 Herramienta'],['ammunition','🏹 Munición'],['gear','🎒 Equipo'],
      ['treasure','💎 Tesoro'],['vehicle','🚗 Vehículo'],['other','📦 Otro'],
    ]);

    const raritySelect = buildSelect([
      ['', 'Todas las rarezas'],
      ['common','Común'],['uncommon','Infrecuente'],['rare','Raro'],
      ['very_rare','Muy raro'],['legendary','Legendario'],['artifact','Artefacto'],
    ]);

    controls.appendChild(searchInput);
    controls.appendChild(typeSelect);
    controls.appendChild(raritySelect);

    if (canManage) {
      const createBtn = document.createElement('button');
      createBtn.className = 'btn btn-primary';
      createBtn.style.cssText = 'display:flex;align-items:center;gap:6px;white-space:nowrap;';
      createBtn.innerHTML = '<span style="font-size:16px;">+</span> Nuevo item';
      createBtn.addEventListener('click', () => openItemModal('create', null, catalogueEl));
      controls.appendChild(createBtn);
    }

    content.appendChild(controls);

    const catalogueEl = document.createElement('div');
    content.appendChild(catalogueEl);

    let searchTimer;
    const doSearch = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => loadCatalogue(catalogueEl, searchInput.value, typeSelect.value, raritySelect.value), 300);
    };

    searchInput.addEventListener('input', doSearch);
    typeSelect.addEventListener('change', doSearch);
    raritySelect.addEventListener('change', doSearch);

    loadCatalogue(catalogueEl, '', '', '');
  }

  async function loadCatalogue(el, search, type, rarity) {
    el.innerHTML = '<div style="color:var(--ink-muted);padding:40px;text-align:center;">Cargando catálogo...</div>';
    try {
      let q = '/items?per_page=50';
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (type)   q += `&type=${type}`;
      if (rarity) q += `&rarity=${rarity}`;

      const res = await api.get(q);
      const items = res.data ?? [];
      el.innerHTML = '';

      if (!items.length) {
        el.innerHTML = `<div style="text-align:center;padding:80px;color:var(--ink-muted);">
          <div style="font-size:32px;margin-bottom:12px;">📦</div>
          <div>No se encontraron items</div>
        </div>`;
        return;
      }

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;';

      items.forEach((item, i) => {
        grid.appendChild(buildCatalogueCard(item, i, el));
      });
      el.appendChild(grid);
    } catch (err) {
      el.innerHTML = `<div style="color:var(--crimson);padding:20px;">Error: ${err.message}</div>`;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     SHARED: Inventory section (list of items with actions)
  ═══════════════════════════════════════════════════════════════ */
  function inventorySection(sectionTitle, items, ownerId, mode, parentEl) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:24px;';

    const heading = document.createElement('div');
    heading.style.cssText = 'font-family:var(--font-ui);font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;';
    heading.textContent = sectionTitle;
    wrap.appendChild(heading);

    items.forEach((item, i) => {
      const row = buildInventoryRow(item, ownerId, mode, parentEl, i);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function buildInventoryRow(item, ownerId, mode, parentEl, index) {
    const r = RARITY[item.rarity] || RARITY.common;
    const icon = TYPE_ICON[item.type] || '📦';

    const row = document.createElement('div');
    row.style.cssText = `
      display:flex;align-items:center;gap:12px;padding:12px 16px;
      background:var(--stone);border:1px solid var(--border);border-radius:8px;
      margin-bottom:8px;
      animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${index * 30}ms both;
      transition:box-shadow var(--dur-fast);
    `;
    row.addEventListener('mouseenter', () => row.style.boxShadow = '0 0 0 1px var(--gold-dim)44');
    row.addEventListener('mouseleave', () => row.style.boxShadow = '');

    // Rarity indicator
    const rarityBar = document.createElement('div');
    rarityBar.style.cssText = `width:3px;height:36px;border-radius:2px;background:${r.color};flex-shrink:0;`;

    // Icon
    const iconEl = document.createElement('div');
    iconEl.style.cssText = `
      width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;
      font-size:18px;background:${r.bg};flex-shrink:0;
    `;
    iconEl.textContent = icon;

    // Info
    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0;';

    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-weight:600;color:var(--ink);font-size:14px;';
    nameEl.textContent = item.custom_name || item.name;

    if (item.equipped) {
      const equippedBadge = document.createElement('span');
      equippedBadge.style.cssText = `padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600;background:var(--gold-glow);color:var(--gold);border:1px solid var(--gold-dim)44;`;
      equippedBadge.textContent = 'Equipado';
      nameRow.appendChild(nameEl);
      nameRow.appendChild(equippedBadge);
    } else {
      nameRow.appendChild(nameEl);
    }

    const meta = document.createElement('div');
    meta.style.cssText = 'font-size:12px;color:var(--ink-muted);margin-top:2px;';
    const parts = [r.label];
    if (item.equipped && item.slot) parts.push(`🧷 ${SLOT_LABELS[item.slot] || item.slot}`);
    if (item.damage_dice) parts.push(`⚔ ${item.damage_dice}${item.damage_type ? ' ' + item.damage_type : ''}`);
    if (item.ac_base != null) parts.push(`🛡 CA ${item.ac_base}`);
    if (item.is_magical) parts.push('✨ Mágico');
    if (item.requires_attunement) parts.push(item.attuned ? '🔮 Sintonizado' : '🔮 Sintonía');
    if (item.value_gp) parts.push(`${item.value_gp} PO`);
    meta.textContent = parts.join(' · ');

    info.appendChild(nameRow);
    info.appendChild(meta);

    // Quantity
    const qty = document.createElement('div');
    qty.style.cssText = 'font-family:var(--font-mono);font-size:13px;color:var(--ink-muted);white-space:nowrap;';
    qty.textContent = `×${item.quantity}`;

    // Actions
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';

    if (mode === 'character') {
      const equipBtn = document.createElement('button');
      equipBtn.style.cssText = `
        padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;
        background:${item.equipped ? 'var(--gold-glow)' : 'var(--stone-light)'};
        color:${item.equipped ? 'var(--gold)' : 'var(--ink-muted)'};
        border:1px solid ${item.equipped ? 'var(--gold-dim)44' : 'var(--border)'};
        transition:all var(--dur-fast);
      `;
      equipBtn.textContent = item.equipped ? 'Desequipar' : 'Equipar';
      equipBtn.addEventListener('click', async () => {
        if (item.equipped) {
          try {
            await api.put(`/characters/${ownerId}/inventory/${item.item_id}`, { equipped: false });
            toast.success('Item desequipado');
            loadCharInventory(ownerId, parentEl);
          } catch (e) { toast.error(e.message); }
        } else {
          openEquipModal(ownerId, item, parentEl);
        }
      });
      actions.appendChild(equipBtn);

      // Botón de sintonía (solo objetos que la requieren)
      if (item.requires_attunement) {
        const attuneBtn = document.createElement('button');
        attuneBtn.style.cssText = `
          padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;
          background:${item.attuned ? 'rgba(163,53,238,0.14)' : 'var(--stone-light)'};
          color:${item.attuned ? '#a335ee' : 'var(--ink-muted)'};
          border:1px solid ${item.attuned ? '#a335ee55' : 'var(--border)'};
          transition:all var(--dur-fast);
        `;
        attuneBtn.textContent = item.attuned ? 'Quitar sintonía' : 'Sintonizar';
        attuneBtn.addEventListener('click', async () => {
          try {
            await api.put(`/characters/${ownerId}/inventory/${item.item_id}`, { attuned: !item.attuned });
            toast.success(item.attuned ? 'Sintonía retirada' : 'Objeto sintonizado');
            loadCharInventory(ownerId, parentEl);
          } catch (e) {
            const msg = (e && e.message) ? e.message : 'Error';
            toast.error(msg.includes('LIMIT') || msg.includes('3 objetos') ? 'Máximo 3 objetos sintonizados' : msg);
          }
        });
        actions.appendChild(attuneBtn);
      }
    }

    const removeBtn = document.createElement('button');
    removeBtn.style.cssText = `
      padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;
      background:var(--crimson-dim);color:var(--crimson);
      border:1px solid var(--crimson)33;transition:all var(--dur-fast);
    `;
    removeBtn.textContent = '✕';
    removeBtn.title = 'Eliminar';
    removeBtn.addEventListener('click', async () => {
      if (!confirm(`¿Eliminar "${item.name}" del inventario?`)) return;
      try {
        const path = mode === 'treasury'
          ? `/campaigns/${ownerId}/treasury/items/${item.item_id}`
          : `/characters/${ownerId}/inventory/${item.item_id}`;
        await api.del(path);
        toast.success('Item eliminado');
        if (mode === 'treasury') loadTreasury(ownerId, parentEl);
        else loadCharInventory(ownerId, parentEl);
      } catch (e) { toast.error(e.message); }
    });
    actions.appendChild(removeBtn);

    row.appendChild(rarityBar);
    row.appendChild(iconEl);
    row.appendChild(info);
    row.appendChild(qty);
    row.appendChild(actions);
    return row;
  }

  function buildCatalogueCard(item, index, catalogueEl) {
    const r = RARITY[item.rarity] || RARITY.common;
    const icon = TYPE_ICON[item.type] || '📦';

    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-radius:10px;
      padding:16px;cursor:pointer;position:relative;overflow:hidden;
      animation:fadeSlideIn var(--dur-slow) var(--ease-out-expo) ${index * 20}ms both;
      transition:transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur-fast);
      border-top:2px solid ${r.color}66;
    `;
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = `0 0 0 1px ${r.color}44, 0 4px 20px ${r.color}22`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
    });
    card.addEventListener('click', () => openItemDetailModal(item, catalogueEl));

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;';

    const iconEl = document.createElement('div');
    iconEl.style.cssText = `width:36px;height:36px;border-radius:8px;background:${r.bg};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;`;
    iconEl.textContent = icon;

    const nameBlock = document.createElement('div');
    nameBlock.style.cssText = 'flex:1;min-width:0;';
    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-weight:600;color:var(--ink);font-size:14px;line-height:1.3;';
    nameEl.textContent = item.name;
    const rarityEl = document.createElement('div');
    rarityEl.style.cssText = `font-size:11px;font-weight:600;color:${r.color};margin-top:2px;`;
    rarityEl.textContent = r.label;
    nameBlock.appendChild(nameEl);
    nameBlock.appendChild(rarityEl);

    head.appendChild(iconEl);
    head.appendChild(nameBlock);
    card.appendChild(head);

    if (item.description) {
      const desc = document.createElement('div');
      desc.style.cssText = 'font-size:12px;color:var(--ink-muted);line-height:1.5;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;';
      desc.textContent = item.description;
      card.appendChild(desc);
    }

    const badges = document.createElement('div');
    badges.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;';
    if (item.is_magical) badges.appendChild(badge('✨ Mágico', 'var(--gold)', 'var(--gold-glow)'));
    if (item.is_consumable) badges.appendChild(badge('⚡ Consumible', '#4a9eff', 'rgba(74,158,255,0.12)'));
    if (item.requires_attunement) badges.appendChild(badge('🔮 Sintonía', '#a335ee', 'rgba(163,53,238,0.12)'));
    if (item.value_gp) badges.appendChild(badge(`${item.value_gp} PO`, 'var(--gold-dim)', 'var(--gold-glow)'));
    card.appendChild(badges);

    if (canManage) {
      const editBtn = document.createElement('button');
      editBtn.style.cssText = `
        position:absolute;top:8px;right:34px;
        padding:3px 8px;border-radius:4px;font-size:10px;cursor:pointer;
        background:var(--gold-glow);color:var(--gold);
        border:1px solid var(--gold-dim)44;
      `;
      editBtn.textContent = '✎';
      editBtn.title = 'Editar item';
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        openItemModal('edit', item, catalogueEl);
      });
      card.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.style.cssText = `
        position:absolute;top:8px;right:8px;
        padding:3px 8px;border-radius:4px;font-size:10px;cursor:pointer;
        background:var(--crimson-dim);color:var(--crimson);
        border:1px solid var(--crimson)33;
      `;
      delBtn.textContent = '✕';
      delBtn.title = 'Eliminar del catálogo';
      delBtn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`¿Eliminar "${item.name}" del catálogo?`)) return;
        try {
          await api.del(`/items/${item.id}`);
          toast.success('Item eliminado del catálogo');
          card.remove();
        } catch (e) { toast.error(e.message); }
      });
      card.appendChild(delBtn);
    }

    return card;
  }

  function badge(text, color, bg) {
    const el = document.createElement('span');
    el.style.cssText = `padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;color:${color};background:${bg};border:1px solid ${color}33;`;
    el.textContent = text;
    return el;
  }

  /* ═══════════════════════════════════════════════════════════════
     MODAL: Equipar item (elegir slot)
  ═══════════════════════════════════════════════════════════════ */
  function _suggestSlot(item) {
    if (item.type === 'weapon') return 'main_hand';
    if (item.type === 'armor') return item.armor_category === 'Shield' ? 'off_hand' : 'body';
    if (item.type === 'ring') return 'ring_left';
    return 'main_hand';
  }

  function openEquipModal(ownerId, item, parentEl) {
    const overlay = buildOverlay();
    const modal = buildModal(`Equipar «${item.custom_name || item.name}»`);

    const label = document.createElement('label');
    label.style.cssText = 'display:block;margin-bottom:6px;font-size:11px;color:var(--ink-muted);font-weight:600;letter-spacing:0.05em;';
    label.textContent = 'RANURA DE EQUIPO';
    modal.appendChild(label);

    const sel = document.createElement('select');
    SLOT_OPTIONS.forEach(([val, lbl]) => {
      const o = document.createElement('option');
      o.value = val; o.textContent = lbl;
      sel.appendChild(o);
    });
    applyInputStyle(sel);
    sel.value = _suggestSlot(item);
    modal.appendChild(sel);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:var(--ink-faint);margin-top:8px;line-height:1.5;';
    hint.textContent = 'Un arma a dos manos ocupa la mano principal y bloquea la secundaria; un escudo o arma en la mano secundaria desaloja las armas a dos manos.';
    modal.appendChild(hint);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:18px;';
    const cancelBtn = buildBtn('Cancelar', false);
    const okBtn = buildBtn('Equipar', true);
    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    modal.appendChild(footer);

    const close = () => overlay.remove();
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    okBtn.addEventListener('click', async () => {
      okBtn.disabled = true;
      try {
        await api.put(`/characters/${ownerId}/inventory/${item.item_id}`, { equipped: true, slot: sel.value });
        toast.success('Item equipado');
        close();
        loadCharInventory(ownerId, parentEl);
      } catch (e) { toast.error(e.message); okBtn.disabled = false; }
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  /* ═══════════════════════════════════════════════════════════════
     MODAL: Añadir item (desde catálogo a personaje/tesoro)
  ═══════════════════════════════════════════════════════════════ */
  function openAddItemModal(ownerId, mode, parentEl) {
    const overlay = buildOverlay();
    const modal = buildModal('Añadir item al ' + (mode === 'treasury' ? 'tesoro' : 'inventario'));

    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'margin-bottom:12px;';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Buscar en catálogo...';
    applyInputStyle(searchInput);
    searchWrap.appendChild(searchInput);
    modal.appendChild(searchWrap);

    const resultsList = document.createElement('div');
    resultsList.style.cssText = 'max-height:220px;overflow-y:auto;margin-bottom:16px;border:1px solid var(--border);border-radius:8px;';
    modal.appendChild(resultsList);

    let selectedItem = null;

    const qtyLabel = document.createElement('label');
    qtyLabel.style.cssText = 'display:block;margin-bottom:6px;font-size:12px;color:var(--ink-muted);font-weight:500;';
    qtyLabel.textContent = 'CANTIDAD';
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.value = '1';
    qtyInput.min = '1';
    applyInputStyle(qtyInput);
    qtyInput.style.marginBottom = '16px';
    modal.appendChild(qtyLabel);
    modal.appendChild(qtyInput);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
    const cancelBtn = buildBtn('Cancelar', false);
    const addBtn = buildBtn('Añadir', true);
    addBtn.disabled = true;
    addBtn.style.opacity = '0.5';
    footer.appendChild(cancelBtn);
    footer.appendChild(addBtn);
    modal.appendChild(footer);

    const close = () => overlay.remove();
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    let timer;
    const doSearch = async () => {
      const q = searchInput.value.trim();
      if (q.length < 2) { resultsList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink-muted);font-size:13px;">Escribe al menos 2 caracteres</div>'; return; }
      resultsList.innerHTML = '<div style="padding:10px;text-align:center;color:var(--ink-muted);font-size:12px;">Buscando...</div>';
      try {
        const res = await api.get(`/items?search=${encodeURIComponent(q)}&per_page=20`);
        resultsList.innerHTML = '';
        (res.data ?? []).forEach(item => {
          const row = document.createElement('div');
          row.style.cssText = `
            display:flex;align-items:center;gap:10px;padding:10px 14px;
            cursor:pointer;transition:background var(--dur-fast);font-size:13px;
            border-bottom:1px solid var(--border);
          `;
          const r = RARITY[item.rarity] || RARITY.common;
          row.innerHTML = `
            <span style="font-size:16px;">${TYPE_ICON[item.type] || '📦'}</span>
            <span style="flex:1;">${item.name}</span>
            <span style="font-size:11px;font-weight:600;color:${r.color};">${r.label}</span>
          `;
          row.addEventListener('mouseenter', () => row.style.background = 'var(--stone-light)');
          row.addEventListener('mouseleave', () => row.style.background = selectedItem?.id === item.id ? 'var(--gold-glow)' : '');
          row.addEventListener('click', () => {
            selectedItem = item;
            resultsList.querySelectorAll('div').forEach(d => d.style.background = '');
            row.style.background = 'var(--gold-glow)';
            addBtn.disabled = false;
            addBtn.style.opacity = '1';
          });
          resultsList.appendChild(row);
        });
        if (!res.data?.length) resultsList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink-muted);font-size:13px;">Sin resultados</div>';
      } catch (_) {}
    };

    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(doSearch, 300);
    });

    addBtn.addEventListener('click', async () => {
      if (!selectedItem) return;
      addBtn.disabled = true;
      try {
        const body = { item_id: selectedItem.id, quantity: parseInt(qtyInput.value) || 1 };
        const path = mode === 'treasury'
          ? `/campaigns/${ownerId}/treasury/items`
          : `/characters/${ownerId}/inventory`;
        await api.post(path, body);
        toast.success(`"${selectedItem.name}" añadido`);
        close();
        if (mode === 'treasury') loadTreasury(ownerId, parentEl);
        else loadCharInventory(ownerId, parentEl);
      } catch (e) { toast.error(e.message); addBtn.disabled = false; }
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(() => searchInput.focus(), 50);
  }

  /* ═══════════════════════════════════════════════════════════════
     Opciones de selects mecánicos
  ═══════════════════════════════════════════════════════════════ */
  const OPT_WEAPON_CAT = [['', '—'], ['Simple', 'Simple'], ['Martial', 'Marcial']];
  const OPT_RANGE_TYPE = [['', '—'], ['Melee', 'Cuerpo a cuerpo'], ['Ranged', 'A distancia']];
  const OPT_DAMAGE_TYPE = [['', '—'], ['bludgeoning', 'Contundente'], ['piercing', 'Perforante'], ['slashing', 'Cortante']];
  const OPT_ARMOR_CAT = [['', '—'], ['Light', 'Ligera'], ['Medium', 'Media'], ['Heavy', 'Pesada'], ['Shield', 'Escudo']];

  const CHARGE_TYPES = ['potion', 'spell_scroll', 'wand', 'staff', 'rod', 'ring', 'wondrous'];

  function _fieldWrap(labelText) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:12px;';
    const label = document.createElement('label');
    label.style.cssText = 'display:block;margin-bottom:5px;font-size:11px;color:var(--ink-muted);font-weight:600;letter-spacing:0.05em;';
    label.textContent = labelText;
    wrap.appendChild(label);
    return wrap;
  }

  function _bindInput(values, key, el, kind) {
    const set = () => {
      values[key] = kind === 'checkbox' ? el.checked : el.value;
    };
    el.addEventListener('change', set);
    el.addEventListener('input', set);
  }

  function _textField(values, key, labelText, kind = 'text') {
    const wrap = _fieldWrap(labelText);
    const el = kind === 'textarea' ? document.createElement('textarea') : document.createElement('input');
    if (kind === 'textarea') { el.rows = 3; el.style.resize = 'vertical'; }
    else el.type = kind === 'number' ? 'number' : 'text';
    applyInputStyle(el);
    const cur = values[key];
    if (cur !== undefined && cur !== null) el.value = cur;
    _bindInput(values, key, el);
    wrap.appendChild(el);
    return wrap;
  }

  function _selectField(values, key, labelText, options) {
    const wrap = _fieldWrap(labelText);
    const el = document.createElement('select');
    options.forEach(([val, lbl]) => {
      const o = document.createElement('option');
      o.value = val; o.textContent = lbl;
      el.appendChild(o);
    });
    applyInputStyle(el);
    if (values[key] !== undefined && values[key] !== null) el.value = values[key];
    _bindInput(values, key, el);
    return { wrap, el };
  }

  function _checkRow(values, defs) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;';
    defs.forEach(([key, lbl, onChange]) => {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ink);cursor:pointer;';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.style.accentColor = 'var(--gold)';
      chk.checked = !!values[key];
      chk.addEventListener('change', () => { values[key] = chk.checked; if (onChange) onChange(); });
      label.appendChild(chk);
      label.appendChild(document.createTextNode(lbl));
      row.appendChild(label);
    });
    return row;
  }

  /* ═══════════════════════════════════════════════════════════════
     MODAL: Crear / Editar item (campos condicionales por tipo)
  ═══════════════════════════════════════════════════════════════ */
  async function openItemModal(mode, item, catalogueEl) {
    const isEdit = mode === 'edit';
    const overlay = buildOverlay();
    const modal = buildModal(isEdit ? 'Editar item' : 'Nuevo item');

    const values = {
      name: '', description: '', type: 'other', rarity: 'common',
      weight: '', value_gp: '', source_book: '',
      is_magical: false, is_consumable: false, requires_attunement: false,
      attunement_restriction: '', charges_max: '',
      weapon_category: '', weapon_range_type: '', damage_dice: '', damage_type: '',
      damage_dice_versatile: '', weapon_properties: '',
      armor_category: '', ac_base: '', ac_dex_bonus: false, ac_max_dex_bonus: '',
      str_minimum: '', stealth_disadvantage: false, bonus_ac: '',
    };

    // Prefill en edición (obtiene el item completo, incl. campos mecánicos)
    if (isEdit && item) {
      let full = item;
      try { full = (await api.get(`/items/${item.id}`)).data; } catch (_) {}
      Object.keys(values).forEach(k => {
        let v = full[k];
        if (v === null || v === undefined) return;
        if (k === 'weapon_properties' && Array.isArray(v)) v = v.join(', ');
        values[k] = v;
      });
    }

    // ── Campos base ──
    modal.appendChild(_textField(values, 'name', 'NOMBRE *'));
    modal.appendChild(_textField(values, 'description', 'DESCRIPCIÓN', 'textarea'));
    const typeSel = _selectField(values, 'type', 'TIPO',
      Object.keys(TYPE_ICON).map(k => [k, `${TYPE_ICON[k]} ${k}`]));
    modal.appendChild(typeSel.wrap);
    modal.appendChild(_selectField(values, 'rarity', 'RAREZA',
      Object.entries(RARITY).map(([k, v]) => [k, v.label])).wrap);
    modal.appendChild(_textField(values, 'weight', 'PESO (lb)', 'number'));
    modal.appendChild(_textField(values, 'value_gp', 'VALOR (PO)', 'number'));
    modal.appendChild(_textField(values, 'source_book', 'FUENTE (libro)'));

    // ── Flags ──
    modal.appendChild(_checkRow(values, [
      ['is_magical', '✨ Mágico', () => renderMechanical()],
      ['is_consumable', '⚡ Consumible'],
      ['requires_attunement', '🔮 Sintonía', () => renderMechanical()],
    ]));

    // ── Sección mecánica condicional ──
    const mech = document.createElement('div');
    modal.appendChild(mech);

    function sectionTitle(txt) {
      const h = document.createElement('div');
      h.style.cssText = 'font-family:var(--font-ui);font-size:11px;font-weight:700;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;margin:4px 0 10px;';
      h.textContent = txt;
      return h;
    }

    function renderMechanical() {
      mech.innerHTML = '';
      const t = values.type;
      if (t === 'weapon') {
        mech.appendChild(sectionTitle('⚔️ Propiedades de arma'));
        mech.appendChild(_selectField(values, 'weapon_category', 'CATEGORÍA', OPT_WEAPON_CAT).wrap);
        mech.appendChild(_selectField(values, 'weapon_range_type', 'ALCANCE', OPT_RANGE_TYPE).wrap);
        mech.appendChild(_textField(values, 'damage_dice', 'DADO DE DAÑO (ej: 1d8)'));
        mech.appendChild(_selectField(values, 'damage_type', 'TIPO DE DAÑO', OPT_DAMAGE_TYPE).wrap);
        mech.appendChild(_textField(values, 'damage_dice_versatile', 'DAÑO VERSÁTIL (ej: 1d10)'));
        mech.appendChild(_textField(values, 'weapon_properties', 'PROPIEDADES (separadas por coma)'));
      } else if (t === 'armor') {
        mech.appendChild(sectionTitle('🛡️ Propiedades de armadura'));
        mech.appendChild(_selectField(values, 'armor_category', 'CATEGORÍA', OPT_ARMOR_CAT).wrap);
        mech.appendChild(_textField(values, 'ac_base', 'CA BASE', 'number'));
        mech.appendChild(_textField(values, 'ac_max_dex_bonus', 'MÁX. BONUS DES (vacío = sin límite)', 'number'));
        mech.appendChild(_textField(values, 'str_minimum', 'FUE MÍNIMA', 'number'));
        mech.appendChild(_textField(values, 'bonus_ac', 'BONUS CA (escudos / mágico)', 'number'));
        mech.appendChild(_checkRow(values, [
          ['ac_dex_bonus', 'Suma DES a la CA'],
          ['stealth_disadvantage', 'Desventaja en Sigilo'],
        ]));
      }
      if (values.is_magical || values.requires_attunement || CHARGE_TYPES.includes(t)) {
        mech.appendChild(sectionTitle('🔮 Mágico / cargas'));
        mech.appendChild(_textField(values, 'charges_max', 'CARGAS MÁXIMAS', 'number'));
        mech.appendChild(_textField(values, 'attunement_restriction', 'RESTRICCIÓN DE SINTONÍA'));
      }
    }
    typeSel.el.addEventListener('change', renderMechanical);
    renderMechanical();

    // ── Footer ──
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:8px;';
    const cancelBtn = buildBtn('Cancelar', false);
    const saveBtn = buildBtn(isEdit ? 'Guardar cambios' : 'Crear item', true);
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    modal.appendChild(footer);

    const close = () => overlay.remove();
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    saveBtn.addEventListener('click', async () => {
      if (!String(values.name).trim()) { toast.error('El nombre es requerido'); return; }
      saveBtn.disabled = true;
      try {
        const body = _buildItemPayload(values);
        if (isEdit) {
          await api.put(`/items/${item.id}`, body);
          toast.success(`"${body.name || item.name}" actualizado`);
        } else {
          await api.post('/items', body);
          toast.success(`"${body.name}" creado`);
        }
        close();
        loadCatalogue(catalogueEl, '', '', '');
      } catch (e) { toast.error(e.message); saveBtn.disabled = false; }
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // Convierte el estado del formulario en el body para la API
  function _buildItemPayload(values) {
    const numeric = ['weight', 'value_gp', 'charges_max', 'ac_base', 'ac_max_dex_bonus', 'str_minimum', 'bonus_ac'];
    const body = {};
    Object.entries(values).forEach(([k, v]) => {
      if (typeof v === 'boolean') { body[k] = v; return; }
      const s = String(v).trim();
      if (s === '') return;                       // omitir vacíos
      if (k === 'weapon_properties') {
        body[k] = s.split(',').map(x => x.trim()).filter(Boolean);
      } else if (numeric.includes(k)) {
        const n = parseFloat(s);
        if (!Number.isNaN(n)) body[k] = n;
      } else {
        body[k] = v;
      }
    });
    return body;
  }

  /* ═══════════════════════════════════════════════════════════════
     MODAL: Detalle de item (solo lectura + acciones si canManage)
  ═══════════════════════════════════════════════════════════════ */
  async function openItemDetailModal(item, catalogueEl) {
    const overlay = buildOverlay();
    const modal = buildModal(item.name);
    modal.appendChild(document.createTextNode(''));

    const body = document.createElement('div');
    body.innerHTML = '<div style="color:var(--ink-muted);font-size:13px;">Cargando...</div>';
    modal.appendChild(body);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:18px;';
    const closeBtn = buildBtn('Cerrar', false);
    footer.appendChild(closeBtn);
    const close = () => overlay.remove();
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    if (canManage) {
      const editBtn = buildBtn('Editar', true);
      editBtn.addEventListener('click', () => { close(); openItemModal('edit', item, catalogueEl); });
      footer.appendChild(editBtn);
    }
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    let it = item;
    try { it = (await api.get(`/items/${item.id}`)).data; } catch (_) {}

    const r = RARITY[it.rarity] || RARITY.common;
    const rows = [];
    const add = (k, v) => { if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) rows.push([k, v]); };

    add('Tipo', `${TYPE_ICON[it.type] || '📦'} ${it.type}`);
    add('Rareza', r.label);
    add('Peso', it.weight != null ? `${it.weight} lb` : null);
    add('Valor', it.value_gp != null ? `${it.value_gp} PO` : null);
    if (it.type === 'weapon') {
      add('Categoría', it.weapon_category);
      add('Alcance', it.weapon_range_type === 'Ranged' ? 'A distancia' : (it.weapon_range_type === 'Melee' ? 'Cuerpo a cuerpo' : null));
      add('Daño', it.damage_dice ? `${it.damage_dice} ${it.damage_type || ''}`.trim() : null);
      add('Versátil', it.damage_dice_versatile);
      if (it.range_normal) add('Rango', `${it.range_normal}/${it.range_long} ft`);
      if (it.throw_range_normal) add('Arrojadiza', `${it.throw_range_normal}/${it.throw_range_long} ft`);
      add('Propiedades', (it.weapon_properties || []).join(', '));
    }
    if (it.type === 'armor') {
      add('Categoría', it.armor_category);
      add('CA base', it.ac_base);
      add('DES', it.ac_dex_bonus ? (it.ac_max_dex_bonus ? `+DES (máx ${it.ac_max_dex_bonus})` : '+DES') : 'sin DES');
      add('FUE mínima', it.str_minimum || null);
      add('Bonus CA', it.bonus_ac || null);
      add('Sigilo', it.stealth_disadvantage ? 'Desventaja' : null);
    }
    add('Cargas', it.charges_max || null);
    add('Sintonía', it.requires_attunement ? (it.attunement_restriction || 'Sí') : null);
    add('Fuente', it.source_book);

    body.innerHTML = '';
    if (it.description) {
      const d = document.createElement('p');
      d.style.cssText = 'font-size:13px;color:var(--ink);line-height:1.55;margin:0 0 14px;';
      d.textContent = it.description;
      body.appendChild(d);
    }
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13px;';
    rows.forEach(([k, v]) => {
      const kEl = document.createElement('div');
      kEl.style.cssText = 'color:var(--ink-muted);font-weight:600;';
      kEl.textContent = k;
      const vEl = document.createElement('div');
      vEl.style.cssText = 'color:var(--ink);';
      vEl.textContent = v;
      grid.appendChild(kEl); grid.appendChild(vEl);
    });
    body.appendChild(grid);
  }

  /* ═══════════════════════════════════════════════════════════════
     MODAL: Editar monedas del tesoro
  ═══════════════════════════════════════════════════════════════ */
  async function openCurrencyModal(campId, parentEl) {
    let current = { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 };
    try {
      const res = await api.get(`/campaigns/${campId}/treasury`);
      current = res.data.currency;
    } catch (_) {}

    const overlay = buildOverlay();
    const modal = buildModal('💰 Editar monedas del tesoro');

    const coins = [
      { key:'platinum', label:'Platino (PP)', color:'#b0c4de' },
      { key:'gold',     label:'Oro (PO)',     color:'#ffd700' },
      { key:'electrum', label:'Electrum (PE)',color:'#7fffd4' },
      { key:'silver',   label:'Plata (PA)',   color:'#c0c0c0' },
      { key:'copper',   label:'Cobre (PC)',   color:'#b87333' },
    ];

    const values = { ...current };
    const inputs = {};

    coins.forEach(({ key, label, color }) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:12px;';
      const coin = document.createElement('div');
      coin.style.cssText = `width:32px;height:32px;border-radius:50%;background:${color}22;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${color};flex-shrink:0;`;
      coin.textContent = label.match(/\((\w+)\)/)?.[1] || '';
      const lbl = document.createElement('label');
      lbl.style.cssText = 'font-size:13px;color:var(--ink);min-width:120px;';
      lbl.textContent = label;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.value = current[key] || 0;
      applyInputStyle(input);
      input.style.width = '100px';
      input.addEventListener('input', () => values[key] = parseInt(input.value) || 0);
      inputs[key] = input;
      wrap.appendChild(coin);
      wrap.appendChild(lbl);
      wrap.appendChild(input);
      modal.appendChild(wrap);
    });

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:16px;';
    const cancelBtn = buildBtn('Cancelar', false);
    const saveBtn = buildBtn('Guardar', true);
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    modal.appendChild(footer);

    const close = () => overlay.remove();
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      try {
        await api.put(`/campaigns/${campId}/treasury/currency`, values);
        toast.success('Monedas actualizadas');
        close();
        loadTreasury(campId, parentEl);
      } catch (e) { toast.error(e.message); saveBtn.disabled = false; }
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  /* ═══════════════════════════════════════════════════════════════
     UI HELPERS
  ═══════════════════════════════════════════════════════════════ */
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
    const modal = document.createElement('div');
    modal.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-radius:14px;
      padding:28px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;
      animation:modalIn var(--dur-normal) var(--ease-spring);
      box-shadow:0 20px 60px rgba(0,0,0,0.6);
    `;
    const h = document.createElement('h3');
    h.style.cssText = 'font-family:var(--font-display);font-size:20px;color:var(--gold);margin:0 0 20px;';
    h.textContent = title;
    modal.appendChild(h);

    return modal;
  }

  function applyInputStyle(el) {
    el.style.cssText = `
      width:100%;box-sizing:border-box;
      background:var(--stone-light);border:1px solid var(--border);color:var(--ink);
      border-radius:8px;padding:9px 12px;font-family:var(--font-ui);font-size:13px;
      outline:none;transition:border-color var(--dur-fast);
    `;
    el.addEventListener('focus', () => el.style.borderColor = 'var(--gold-dim)');
    el.addEventListener('blur', () => el.style.borderColor = 'var(--border)');
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
      border-radius:8px;padding:8px 12px;font-family:var(--font-ui);font-size:13px;
      cursor:pointer;
    `;
    options.forEach(([val, lbl]) => {
      const o = document.createElement('option');
      o.value = val;
      o.textContent = lbl;
      sel.appendChild(o);
    });
    return sel;
  }
}
