import { auth } from './auth.js';

const routes = {
  '#/login':      () => import('../pages/login.js').then(m => m.render),
  '#/dashboard':  () => import('../pages/dashboard.js').then(m => m.render),
  '#/campaigns':  () => import('../pages/campaigns.js').then(m => m.render),
  '#/characters': () => import('../pages/characters.js').then(m => m.render),
  '#/sessions':   () => import('../pages/sessions.js').then(m => m.render),
  '#/inventory':  () => import('../pages/inventory.js').then(m => m.render),
};

const app = document.getElementById('app');

function renderShell(user) {
  if (document.querySelector('.app-shell')) return;

  const shell = document.createElement('div');
  shell.className = 'app-shell';

  /* ---- Sidebar ---- */
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';

  // Brand
  const brand = document.createElement('div');
  brand.className = 'sidebar-brand';
  const brandH1 = document.createElement('h1');
  brandH1.textContent = '᛭ DnD ᛭';
  const brandSub = document.createElement('div');
  brandSub.className = 'runes';
  brandSub.textContent = 'Community Manager';
  brand.appendChild(brandH1);
  brand.appendChild(brandSub);

  // User section
  const userDiv = document.createElement('div');
  userDiv.className = 'sidebar-user';

  const avatar = document.createElement('div');
  avatar.className = 'sidebar-avatar';
  avatar.textContent = (user.display_name || user.username || 'U')[0].toUpperCase();

  const userInfo = document.createElement('div');
  userInfo.className = 'sidebar-user-info';
  const nameEl = document.createElement('div');
  nameEl.className = 'name';
  nameEl.textContent = user.display_name || user.username || '';
  const rankEl = document.createElement('div');
  rankEl.className = 'rank';
  rankEl.textContent = user.role || 'player';
  userInfo.appendChild(nameEl);
  userInfo.appendChild(rankEl);

  userDiv.appendChild(avatar);
  userDiv.appendChild(userInfo);

  // Navigation
  const nav = document.createElement('nav');
  nav.className = 'sidebar-nav';

  const navItems = [
    { section: 'Principal' },
    { label: 'Dashboard',  icon: '⚔️', route: '#/dashboard' },
    { section: 'Comunidad' },
    { label: 'Miembros',   icon: '👥', route: '#/members' },
    { label: 'Clanes',     icon: '🏰', route: '#/clans' },
    { label: 'Campañas',   icon: '🗺️', route: '#/campaigns' },
    { label: 'Personajes', icon: '🧙', route: '#/characters' },
    { label: 'Sesiones',   icon: '📜', route: '#/sessions' },
    { label: 'Inventario', icon: '🎒', route: '#/inventory' },
    { section: 'Actividad' },
    { label: 'Chat',       icon: '💬', route: '#/chat' },
    { label: 'Eventos',    icon: '📅', route: '#/events' },
  ];

  navItems.forEach(item => {
    if (item.section) {
      const label = document.createElement('span');
      label.className = 'nav-section-label';
      label.textContent = item.section;
      nav.appendChild(label);
    } else {
      const a = document.createElement('a');
      a.className = 'nav-item';
      a.href = item.route;
      a.dataset.route = item.route;

      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = item.icon;
      a.appendChild(icon);
      a.appendChild(document.createTextNode(' ' + item.label));
      nav.appendChild(a);
    }
  });

  // Footer / logout
  const footer = document.createElement('div');
  footer.className = 'sidebar-footer';
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn-logout';
  logoutBtn.textContent = 'Cerrar sesión';
  logoutBtn.addEventListener('click', auth.logout);
  footer.appendChild(logoutBtn);

  sidebar.appendChild(brand);
  sidebar.appendChild(userDiv);
  sidebar.appendChild(nav);
  sidebar.appendChild(footer);

  /* ---- Main content ---- */
  const main = document.createElement('main');
  main.className = 'main-content';
  main.id = 'page-content';

  shell.appendChild(sidebar);
  shell.appendChild(main);
  app.appendChild(shell);
}

function updateActiveNav(hash) {
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.route === hash);
  });
}

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
