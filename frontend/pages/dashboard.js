import { api } from '../js/api.js';
import { auth } from '../js/auth.js';
import { toast } from '../js/components/toast.js';
import {
  animateCounter,
  formatRelative,
  abilityModifier,
  modifierStr,
  hpPercent,
  hpColor,
  classEmoji,
} from '../js/utils.js';

export async function render(container) {
  if (!auth.requireAuth()) return;
  const user = auth.getUser();

  /* ---- Page wrapper ---- */
  const page = document.createElement('div');
  page.className = 'page-enter';

  /* ---- Header ---- */
  const header = document.createElement('div');
  header.className = 'page-header';

  const h2 = document.createElement('h2');
  h2.textContent = `Bienvenido, ${user.display_name || user.username}`;

  const subtitle = document.createElement('p');
  const now = new Date();
  subtitle.textContent =
    now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' · ' + (user.role || 'Aventurero');

  header.appendChild(h2);
  header.appendChild(subtitle);
  page.appendChild(header);

  /* ---- Stats grid ---- */
  const statsGrid = document.createElement('div');
  statsGrid.className = 'grid-5';
  statsGrid.style.marginBottom = '28px';

  const statDefs = [
    { icon: '👥', label: 'Miembros',   key: 'members',    endpoint: '/members?per_page=1' },
    { icon: '🗺️', label: 'Campañas',   key: 'campaigns',  endpoint: '/campaigns?per_page=1' },
    { icon: '📅', label: 'Sesiones',   key: 'sessions',   endpoint: '/sessions?per_page=1' },
    { icon: '🧙', label: 'Personajes', key: 'characters', endpoint: '/characters?per_page=1' },
    { icon: '⚔️', label: 'Items',      key: 'items',      endpoint: '/items?per_page=1' },
  ];

  const statValueEls = {};

  statDefs.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = `card stat-card fade-in stagger-${i + 1}`;

    const iconEl = document.createElement('div');
    iconEl.className = 'stat-icon';
    iconEl.textContent = s.icon;

    const valueEl = document.createElement('div');
    valueEl.className = 'stat-value';
    valueEl.textContent = '—';
    statValueEls[s.key] = valueEl;

    const labelEl = document.createElement('div');
    labelEl.className = 'stat-label';
    labelEl.textContent = s.label;

    card.appendChild(iconEl);
    card.appendChild(valueEl);
    card.appendChild(labelEl);
    statsGrid.appendChild(card);
  });

  page.appendChild(statsGrid);

  /* ---- Bottom two-column grid ---- */
  const bottomGrid = document.createElement('div');
  bottomGrid.style.cssText =
    'display:grid;grid-template-columns:1fr 1fr;gap:20px;';

  // Recent activity
  const activityCard = document.createElement('div');
  activityCard.className = 'section-card fade-in stagger-3';
  const activityTitle = document.createElement('div');
  activityTitle.className = 'section-title';
  activityTitle.textContent = 'Actividad Reciente';
  const activityList = document.createElement('div');
  activityList.appendChild(createSpinner());
  activityCard.appendChild(activityTitle);
  activityCard.appendChild(activityList);

  // My characters
  const charsCard = document.createElement('div');
  charsCard.className = 'section-card fade-in stagger-4';
  const charsTitle = document.createElement('div');
  charsTitle.className = 'section-title';
  charsTitle.textContent = 'Mis Personajes';
  const charsList = document.createElement('div');
  charsList.appendChild(createSpinner());
  charsCard.appendChild(charsTitle);
  charsCard.appendChild(charsList);

  bottomGrid.appendChild(activityCard);
  bottomGrid.appendChild(charsCard);
  page.appendChild(bottomGrid);

  container.appendChild(page);

  /* ---- Responsive: stack on mobile ---- */
  if (window.innerWidth < 768) {
    bottomGrid.style.gridTemplateColumns = '1fr';
  }

  /* ---- Load all data in parallel ---- */
  await Promise.allSettled([
    loadStats(statDefs, statValueEls),
    loadActivity(activityList),
    loadCharacters(charsList, user),
  ]);
}

/* ============================================
   DATA LOADERS
   ============================================ */

async function loadStats(statDefs, statValueEls) {
  await Promise.allSettled(
    statDefs.map(async s => {
      try {
        const res = await api.get(s.endpoint);
        const total = res.meta?.total ?? (Array.isArray(res.data) ? res.data.length : 0);
        animateCounter(statValueEls[s.key], 0, total);
      } catch {
        statValueEls[s.key].textContent = '?';
      }
    })
  );
}

async function loadActivity(container) {
  container.innerHTML = '';

  const actionIcons = {
    session_created:   '📅',
    character_created: '🧙',
    campaign_created:  '🗺️',
    member_joined:     '👤',
    item_added:        '⚔️',
    level_up:          '⬆️',
  };

  try {
    let events = [];
    try {
      const res = await api.get('/events?per_page=8');
      events = Array.isArray(res.data) ? res.data : [];
    } catch {
      // Events endpoint may not exist yet — show empty state gracefully
    }

    if (events.length === 0) {
      container.appendChild(emptyState('📜', 'Sin actividad reciente'));
      return;
    }

    events.forEach(ev => {
      const item = document.createElement('div');
      item.className = 'event-item';

      const icon = document.createElement('div');
      icon.className = 'event-icon';
      icon.textContent = actionIcons[ev.action] || '📌';

      const content = document.createElement('div');
      content.className = 'event-content';

      const action = document.createElement('div');
      action.className = 'event-action';
      action.textContent = ev.description || ev.action || 'Evento';

      const meta = document.createElement('div');
      meta.className = 'event-meta';
      meta.textContent = ev.created_at ? formatRelative(ev.created_at) : '';

      content.appendChild(action);
      content.appendChild(meta);
      item.appendChild(icon);
      item.appendChild(content);
      container.appendChild(item);
    });
  } catch (err) {
    container.innerHTML = '';
    const errEl = document.createElement('div');
    errEl.style.cssText = 'color:var(--ink-muted);font-size:13px;padding:16px 0;';
    errEl.textContent = 'No se pudo cargar la actividad';
    container.appendChild(errEl);
  }
}

async function loadCharacters(container, user) {
  container.innerHTML = '';

  try {
    let characters = [];

    // Try member-scoped endpoint first, then fall back to global
    const endpoints = user.id
      ? [`/members/${user.id}/characters`, '/characters?per_page=6']
      : ['/characters?per_page=6'];

    for (const ep of endpoints) {
      try {
        const res = await api.get(ep);
        const all = Array.isArray(res.data) ? res.data : [];
        // Filter to own if using global endpoint
        characters = ep.includes('/characters?') && user.id
          ? all.filter(c => c.member_id === user.id)
          : all;
        if (characters.length >= 0) break; // break even if empty — endpoint worked
      } catch {
        continue;
      }
    }

    if (characters.length === 0) {
      container.appendChild(emptyState('🧙', 'No tienes personajes aún'));
      return;
    }

    characters.slice(0, 4).forEach(char => {
      const stats  = char.stats_json || {};
      const hp     = stats.hp ?? 0;
      const maxHp  = stats.max_hp ?? Math.max(hp, 1);
      const pct    = hpPercent(hp, maxHp);

      const card = document.createElement('div');
      card.className = 'card character-card';
      card.style.marginBottom = '12px';

      /* Portrait + info row */
      const hdr = document.createElement('div');
      hdr.className = 'character-card__header';

      const portrait = document.createElement('div');
      portrait.className = 'character-card__portrait';
      portrait.textContent = classEmoji(char.class);

      const info = document.createElement('div');
      info.className = 'character-card__info';

      const name = document.createElement('div');
      name.className = 'character-card__name';
      name.textContent = char.name || 'Sin nombre';

      const meta = document.createElement('div');
      meta.className = 'character-card__meta';
      meta.textContent =
        `Nivel ${char.level || 1} ${char.race || ''} ${char.class || ''}`.trim();

      /* HP bar */
      const hpBar = document.createElement('div');
      hpBar.className = 'hp-bar';
      const hpFill = document.createElement('div');
      hpFill.className = 'hp-bar-fill';
      hpFill.style.width   = `${pct}%`;
      hpFill.style.background = hpColor(pct);
      hpBar.appendChild(hpFill);

      info.appendChild(name);
      info.appendChild(meta);
      info.appendChild(hpBar);
      hdr.appendChild(portrait);
      hdr.appendChild(info);
      card.appendChild(hdr);

      /* Stats grid — only if we have stat data */
      const statKeys   = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      const statLabels = { str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' };
      const hasStats   = statKeys.some(k => stats[k] != null);

      if (hasStats) {
        const statsGrid = document.createElement('div');
        statsGrid.className = 'character-card__stats';

        statKeys.forEach(k => {
          const val = stats[k] ?? 10;
          const mod = abilityModifier(val);

          const statEl = document.createElement('div');
          statEl.className = 'character-card__stat';

          const valEl = document.createElement('div');
          valEl.className = 'character-card__stat-value';
          valEl.textContent = '0';

          const labelEl = document.createElement('div');
          labelEl.className = 'character-card__stat-label';
          labelEl.textContent = `${statLabels[k]} (${modifierStr(mod)})`;

          statEl.appendChild(valEl);
          statEl.appendChild(labelEl);
          statsGrid.appendChild(statEl);

          // Animate counter after a short delay so the card renders first
          setTimeout(() => animateCounter(valEl, 0, val, 600), 150);
        });

        card.appendChild(statsGrid);
      }

      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '';
    const errEl = document.createElement('div');
    errEl.style.cssText = 'color:var(--ink-muted);font-size:13px;padding:16px 0;';
    errEl.textContent = 'No se pudieron cargar los personajes';
    container.appendChild(errEl);
  }
}

/* ============================================
   HELPERS
   ============================================ */

function createSpinner() {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  const spinner = document.createElement('div');
  spinner.className = 'spinner spinner-lg';
  overlay.appendChild(spinner);
  return overlay;
}

function emptyState(icon, text) {
  const el = document.createElement('div');
  el.className = 'empty-state';

  const iconEl = document.createElement('div');
  iconEl.className = 'empty-icon';
  iconEl.textContent = icon;

  const textEl = document.createElement('p');
  textEl.textContent = text;

  el.appendChild(iconEl);
  el.appendChild(textEl);
  return el;
}
