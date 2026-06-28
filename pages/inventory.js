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

/* ═══════════════════════════════════════════════════════════════
   MAIN RENDER
═══════════════════════════════════════════════════════════════ */
export async function render(container) {
  container.innerHTML = '';
  const user = auth.getUser();
  const canManage = user?.role === 'admin' || user?.role === 'dm';

  const page = document.createElement('div');
  page.className = 'page-inventory fade-in';
  page.style.cssText = 'padding:32px 40px;max-width:1100px;';

  /* ── Header ── */
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;gap:16px;flex-wrap:wrap;';

  const titleBlock = document.createElement('div');
  const title = document.createElement('h2');
  title.style.cssText = 'font-family:var(--font-display);font-size:28px;color:var(--gold);margin:0 0 4px;';
  title.textContent = '᛭ Inventario ᛭';
  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'color:var(--ink-muted);font-size:14px;margin:0;';
  subtitle.textContent = 'Equipamiento, tesoro y catálogo de items';
  titleBlock.appendChild(title);
  titleBlock.appendChild(subtitle);
  header.appendChild(titleBlock);
  page.appendChild(header);

  /* ── Tabs ── */
  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:4px;margin-bottom:24px;border-bottom:1px solid var(--border);';

  const tabs = [
    { id: 'character', label: '⚔️ Mi Inventario' },
    { id: 'treasury',  label: '💰 Tesoro' },
    { id: 'catalogue', label: '📦 Catálogo' },
  ];

  let activeTab = 'character';
  const content = document.createElement('div');

  const tabEls = {};
  tabs.forEach(t => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      padding:10px 20px;border:none;background:none;
      font-family:var(--font-ui);font-size:13px;font-weight:500;
      cursor:pointer;border-bottom:2px solid transparent;
      transition:all var(--dur-fast) var(--ease-smooth);
      color:var(--ink-muted);margin-bottom:-1px;
    `;
    btn.textContent = t.label;
    btn.addEventListener('click', () => switchTab(t.id));
    tabBar.appendChild(btn);
    tabEls[t.id] = btn;
  });

  page.appendChild(tabBar);
  page.appendChild(content);
  container.appendChild(page);

  function switchTab(id) {
    activeTab = id;
    Object.entries(tabEls).forEach(([tid, btn]) => {
      const active = tid === id;
      btn.style.color = active ? 'var(--gold)' : 'var(--ink-muted)';
      btn.style.borderBottomColor = active ? 'var(--gold)' : 'transparent';
    });
    content.innerHTML = '';
    if (id === 'character') renderCharacterTab();
    else if (id === 'treasury') renderTreasuryTab();
    else renderCatalogueTab();
  }

  switchTab('character');

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
      ['spell_scroll','📜 Pergamino'],['ring','💍 Anillo'],['wondrous','🌟 Maravilloso'],
      ['tool','🔧 Herramienta'],['gear','🎒 Equipo'],['treasure','💎 Tesoro'],['other','📦 Otro'],
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
      createBtn.addEventListener('click', () => openCreateItemModal(catalogueEl));
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
        grid.appendChild(buildCatalogueCard(item, i));
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
    if (item.is_magical) parts.push('✨ Mágico');
    if (item.requires_attunement) parts.push('🔮 Sintonía');
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
        try {
          await api.put(`/characters/${ownerId}/inventory/${item.item_id}`, { equipped: !item.equipped });
          toast.success(item.equipped ? 'Item desequipado' : 'Item equipado');
          loadCharInventory(ownerId, parentEl);
        } catch (e) { toast.error(e.message); }
      });
      actions.appendChild(equipBtn);
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

  function buildCatalogueCard(item, index) {
    const r = RARITY[item.rarity] || RARITY.common;
    const icon = TYPE_ICON[item.type] || '📦';

    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--stone);border:1px solid var(--border);border-radius:10px;
      padding:16px;cursor:default;position:relative;overflow:hidden;
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

    document.body.appendChild(overlay);
    setTimeout(() => searchInput.focus(), 50);
  }

  /* ═══════════════════════════════════════════════════════════════
     MODAL: Crear nuevo item en el catálogo
  ═══════════════════════════════════════════════════════════════ */
  function openCreateItemModal(catalogueEl) {
    const overlay = buildOverlay();
    const modal = buildModal('Nuevo item');

    const fields = [
      { label: 'NOMBRE *', key: 'name', type: 'text', required: true },
      { label: 'DESCRIPCIÓN', key: 'description', type: 'textarea' },
      { label: 'TIPO', key: 'type', type: 'select', options: Object.keys(TYPE_ICON).map(k => [k, `${TYPE_ICON[k]} ${k}`]) },
      { label: 'RAREZA', key: 'rarity', type: 'select', options: Object.entries(RARITY).map(([k, v]) => [k, v.label]) },
      { label: 'PESO (lb)', key: 'weight', type: 'number' },
      { label: 'VALOR (PO)', key: 'value_gp', type: 'number' },
      { label: 'FUENTE (libro)', key: 'source_book', type: 'text' },
    ];

    const values = {};
    fields.forEach(f => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-bottom:12px;';
      const label = document.createElement('label');
      label.style.cssText = 'display:block;margin-bottom:5px;font-size:11px;color:var(--ink-muted);font-weight:600;letter-spacing:0.05em;';
      label.textContent = f.label;
      wrap.appendChild(label);

      let el;
      if (f.type === 'textarea') {
        el = document.createElement('textarea');
        el.rows = 3;
        el.style.resize = 'vertical';
      } else if (f.type === 'select') {
        el = document.createElement('select');
        f.options.forEach(([val, lbl]) => {
          const o = document.createElement('option');
          o.value = val;
          o.textContent = lbl;
          el.appendChild(o);
        });
      } else {
        el = document.createElement('input');
        el.type = f.type;
      }
      applyInputStyle(el);
      el.addEventListener('change', () => values[f.key] = el.value);
      el.addEventListener('input', () => values[f.key] = el.value);
      values[f.key] = el.value || (f.type === 'select' ? f.options[0][0] : '');
      wrap.appendChild(el);
      modal.appendChild(wrap);
    });

    const checkRow = document.createElement('div');
    checkRow.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;';
    [['is_magical','✨ Mágico'],['is_consumable','⚡ Consumible'],['requires_attunement','🔮 Sintonía']].forEach(([key, lbl]) => {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ink);cursor:pointer;';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.style.accentColor = 'var(--gold)';
      chk.addEventListener('change', () => values[key] = chk.checked);
      values[key] = false;
      label.appendChild(chk);
      label.appendChild(document.createTextNode(lbl));
      checkRow.appendChild(label);
    });
    modal.appendChild(checkRow);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
    const cancelBtn = buildBtn('Cancelar', false);
    const saveBtn = buildBtn('Crear item', true);
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    modal.appendChild(footer);

    const close = () => overlay.remove();
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    saveBtn.addEventListener('click', async () => {
      if (!values.name?.trim()) { toast.error('El nombre es requerido'); return; }
      saveBtn.disabled = true;
      try {
        const body = { ...values };
        if (!body.weight) delete body.weight;
        if (!body.value_gp) delete body.value_gp;
        if (!body.source_book) delete body.source_book;
        if (!body.description) delete body.description;
        if (body.weight) body.weight = parseFloat(body.weight);
        if (body.value_gp) body.value_gp = parseFloat(body.value_gp);
        await api.post('/items', body);
        toast.success(`"${body.name}" creado`);
        close();
        loadCatalogue(catalogueEl, '', '', '');
      } catch (e) { toast.error(e.message); saveBtn.disabled = false; }
    });

    document.body.appendChild(overlay);
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

    const overlay = buildOverlay();
    overlay.appendChild(modal);
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
