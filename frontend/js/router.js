import { auth } from './auth.js';

const routes = {
  '#/login':      () => import('../pages/login.js').then(m => m.render),
  '#/dashboard':  () => import('../pages/dashboard.js').then(m => m.render),
  '#/campaigns':  () => import('../pages/campaigns.js').then(m => m.render),
  '#/characters': () => import('../pages/characters.js').then(m => m.render),
  '#/sessions':   () => import('../pages/sessions.js').then(m => m.render),
  '#/inventory':  () => import('../pages/inventory.js').then(m => m.render),
  '#/members':    () => import('../pages/members.js').then(m => m.render),
};

/* ============================================
   NAV CONFIG — groups & direct links
   ============================================ */
const NAV_GROUPS = [
  {
    type: 'link',
    label: 'Dashboard',
    route: '#/dashboard',
  },
  {
    type: 'dropdown',
    label: 'Juego',
    items: [
      { icon: '🗺️', label: 'Campañas',   desc: 'Gestiona tus aventuras',    route: '#/campaigns'  },
      { icon: '🧙', label: 'Personajes',  desc: 'Fichas y stats',            route: '#/characters' },
      { icon: '📜', label: 'Sesiones',    desc: 'Crónicas y asistencia',     route: '#/sessions'   },
    ],
  },
  {
    type: 'dropdown',
    label: 'Comunidad',
    items: [
      { icon: '👥', label: 'Miembros',    desc: 'Jugadores y roles',         route: '#/members'    },
      { icon: '🎒', label: 'Inventario',  desc: 'Items, tesoro y catálogo',  route: '#/inventory'  },
    ],
  },
];

const app = document.getElementById('app');
let openDropdown = null;

/* ============================================
   BUILD SHELL
   ============================================ */
function renderShell(user) {
  if (document.querySelector('.app-shell')) return;

  const shell = document.createElement('div');
  shell.className = 'app-shell';

  /* ---- Top Nav ---- */
  const nav = document.createElement('header');
  nav.className = 'app-nav';

  const inner = document.createElement('div');
  inner.className = 'app-nav__inner';

  /* Brand */
  const brand = document.createElement('span');
  brand.className = 'nav-brand';
  brand.textContent = '᛭ DnD ᛭';
  brand.addEventListener('click', () => { location.hash = '#/dashboard'; });
  inner.appendChild(brand);

  /* Nav links (desktop) */
  const links = document.createElement('nav');
  links.className = 'nav-links';

  NAV_GROUPS.forEach(group => {
    if (group.type === 'link') {
      const a = document.createElement('a');
      a.className = 'nav-link';
      a.href = group.route;
      a.dataset.route = group.route;
      a.textContent = group.label;
      links.appendChild(a);
    } else {
      const dropdown = document.createElement('div');
      dropdown.className = 'nav-dropdown';
      dropdown.dataset.group = group.label;

      const trigger = document.createElement('button');
      trigger.className = 'nav-dropdown__trigger';
      trigger.innerHTML = `${group.label} <span class="nav-dropdown__chevron">▾</span>`;

      const panel = document.createElement('div');
      panel.className = 'nav-dropdown__panel';

      const panelLabel = document.createElement('div');
      panelLabel.className = 'nav-dropdown__label';
      panelLabel.textContent = group.label;
      panel.appendChild(panelLabel);

      group.items.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'nav-dropdown__item';
        btn.dataset.route = item.route;

        const iconWrap = document.createElement('div');
        iconWrap.className = 'nav-dropdown__icon';
        iconWrap.textContent = item.icon;

        const text = document.createElement('div');
        text.className = 'nav-dropdown__text';

        const name = document.createElement('div');
        name.className = 'nav-dropdown__item-name';
        name.textContent = item.label;

        const desc = document.createElement('div');
        desc.className = 'nav-dropdown__item-desc';
        desc.textContent = item.desc;

        text.appendChild(name);
        text.appendChild(desc);
        btn.appendChild(iconWrap);
        btn.appendChild(text);
        panel.appendChild(btn);

        btn.addEventListener('click', () => {
          location.hash = item.route;
          closeDropdowns();
        });
      });

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        closeDropdowns();
        if (!isOpen) {
          dropdown.classList.add('open');
          openDropdown = dropdown;
        }
      });

      dropdown.appendChild(trigger);
      dropdown.appendChild(panel);
      links.appendChild(dropdown);
    }
  });

  inner.appendChild(links);

  /* User info + logout */
  const userArea = document.createElement('div');
  userArea.className = 'nav-user';

  const avatar = document.createElement('div');
  avatar.className = 'nav-avatar';
  avatar.textContent = (user.display_name || user.username || 'U')[0].toUpperCase();

  const userMeta = document.createElement('div');
  const nameEl = document.createElement('div');
  nameEl.className = 'nav-username';
  nameEl.textContent = user.display_name || user.username || '';
  const roleEl = document.createElement('div');
  roleEl.className = 'nav-role';
  roleEl.textContent = user.role || 'player';
  userMeta.appendChild(nameEl);
  userMeta.appendChild(roleEl);

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'nav-logout';
  logoutBtn.textContent = 'Salir';
  logoutBtn.addEventListener('click', auth.logout);

  userArea.appendChild(avatar);
  userArea.appendChild(userMeta);
  userArea.appendChild(logoutBtn);
  inner.appendChild(userArea);

  /* Hamburger */
  const burger = document.createElement('button');
  burger.className = 'nav-burger';
  burger.setAttribute('aria-label', 'Abrir menú');
  burger.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 5h14a1 1 0 000-2H3a1 1 0 000 2zm0 6h14a1 1 0 000-2H3a1 1 0 000 2zm0 6h14a1 1 0 000-2H3a1 1 0 000 2z" clip-rule="evenodd"/></svg>`;
  burger.addEventListener('click', openDrawer);
  inner.appendChild(burger);

  nav.appendChild(inner);

  /* ---- Mobile Drawer ---- */
  const drawer = buildDrawer(user);
  drawer.id = 'nav-drawer';

  /* ---- Main content ---- */
  const main = document.createElement('main');
  main.className = 'main-content';
  main.id = 'page-content';

  shell.appendChild(nav);
  shell.appendChild(drawer);
  shell.appendChild(main);
  app.appendChild(shell);

  /* Close dropdowns on outside click */
  document.addEventListener('click', closeDropdowns);
}

/* ============================================
   MOBILE DRAWER
   ============================================ */
function buildDrawer(user) {
  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';

  const backdrop = document.createElement('div');
  backdrop.className = 'nav-drawer__backdrop';
  backdrop.addEventListener('click', closeDrawer);

  const panel = document.createElement('div');
  panel.className = 'nav-drawer__panel';

  /* Header */
  const hdr = document.createElement('div');
  hdr.className = 'nav-drawer__header';

  const drawerBrand = document.createElement('span');
  drawerBrand.className = 'nav-drawer__brand';
  drawerBrand.textContent = '᛭ DnD ᛭';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'nav-drawer__close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeDrawer);

  hdr.appendChild(drawerBrand);
  hdr.appendChild(closeBtn);
  panel.appendChild(hdr);

  /* Nav items */
  NAV_GROUPS.forEach(group => {
    if (group.type === 'link') {
      const a = buildDrawerLink({ icon: '⚔️', label: group.label, route: group.route });
      panel.appendChild(a);
    } else {
      const section = document.createElement('div');
      section.className = 'nav-drawer__section';
      section.textContent = group.label;
      panel.appendChild(section);

      group.items.forEach(item => {
        panel.appendChild(buildDrawerLink(item));
      });
    }
  });

  /* User + logout */
  const userRow = document.createElement('div');
  userRow.className = 'nav-drawer__user';
  const da = document.createElement('div');
  da.className = 'nav-avatar';
  da.textContent = (user.display_name || user.username || 'U')[0].toUpperCase();
  const dn = document.createElement('div');
  dn.innerHTML = `<div class="nav-username">${user.display_name || user.username || ''}</div><div class="nav-role">${user.role || 'player'}</div>`;
  userRow.appendChild(da);
  userRow.appendChild(dn);
  panel.appendChild(userRow);

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'nav-drawer__logout';
  logoutBtn.textContent = 'Cerrar sesión';
  logoutBtn.addEventListener('click', auth.logout);
  panel.appendChild(logoutBtn);

  drawer.appendChild(backdrop);
  drawer.appendChild(panel);
  return drawer;
}

function buildDrawerLink(item) {
  const btn = document.createElement('button');
  btn.className = 'nav-drawer__link';
  btn.dataset.route = item.route;

  const iconWrap = document.createElement('div');
  iconWrap.className = 'nav-drawer__link-icon';
  iconWrap.textContent = item.icon;

  btn.appendChild(iconWrap);
  btn.appendChild(document.createTextNode(item.label));

  btn.addEventListener('click', () => {
    location.hash = item.route;
    closeDrawer();
  });

  return btn;
}

function openDrawer() {
  const drawer = document.getElementById('nav-drawer');
  if (drawer) drawer.classList.add('open');
}

function closeDrawer() {
  const drawer = document.getElementById('nav-drawer');
  if (drawer) drawer.classList.remove('open');
}

function closeDropdowns() {
  document.querySelectorAll('.nav-dropdown.open').forEach(d => d.classList.remove('open'));
  openDropdown = null;
}

/* ============================================
   ACTIVE STATE
   ============================================ */
function updateActiveNav(hash) {
  /* Direct links */
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.route === hash);
  });

  /* Dropdown items */
  document.querySelectorAll('.nav-dropdown__item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === hash);
  });

  /* Dropdown trigger — highlight if any child matches */
  document.querySelectorAll('.nav-dropdown').forEach(dd => {
    const hasActive = dd.querySelector(`.nav-dropdown__item[data-route="${hash}"]`);
    dd.querySelector('.nav-dropdown__trigger')?.classList.toggle('active', !!hasActive);
  });

  /* Drawer links */
  document.querySelectorAll('.nav-drawer__link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === hash);
  });
}

/* ============================================
   ROUTER
   ============================================ */
async function navigate() {
  const hash = location.hash || '#/login';
  const isPublic = hash === '#/login';

  if (!isPublic && !auth.requireAuth()) return;

  if (isPublic) {
    const shell = document.querySelector('.app-shell');
    if (shell) shell.remove();
    app.innerHTML = '';
  } else {
    const user = auth.getUser();
    if (!user) { auth.logout(); return; }
    if (!document.querySelector('.app-shell')) {
      app.innerHTML = '';
    }
    renderShell(user);
    updateActiveNav(hash);
    closeDropdowns();
    closeDrawer();
  }

  const loader = routes[hash] || routes['#/dashboard'];
  const container = isPublic ? app : document.getElementById('page-content');
  if (!container) return;

  try {
    const renderFn = await loader();
    container.innerHTML = '';
    await renderFn(container);
  } catch (e) {
    console.error('Route error:', e);
    container.innerHTML = '';
    const errEl = document.createElement('div');
    errEl.style.cssText = 'padding:40px;color:var(--crimson);font-size:14px;';
    errEl.textContent = 'Error al cargar la página: ' + e.message;
    container.appendChild(errEl);
  }
}

window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', navigate);
