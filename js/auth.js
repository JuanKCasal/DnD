const TOKEN_KEY = 'dnd_token';
const USER_KEY  = 'dnd_user';

export const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t) => localStorage.setItem(TOKEN_KEY, t),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  getUser: () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch { return null; }
  },
  setUser: (u) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  clearUser: () => localStorage.removeItem(USER_KEY),

  isLoggedIn: () => !!localStorage.getItem(TOKEN_KEY),

  getRole: () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY))?.role; }
    catch { return null; }
  },

  hasRole: (...roles) => {
    try { return roles.includes(JSON.parse(localStorage.getItem(USER_KEY))?.role); }
    catch { return false; }
  },

  requireAuth: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      location.hash = '#/login';
      return false;
    }
    return true;
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    location.hash = '#/login';
  },
};

window.addEventListener('auth:expired', () => auth.logout());
