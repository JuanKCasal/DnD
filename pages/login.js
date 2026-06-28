import { api } from '../js/api.js';
import { auth } from '../js/auth.js';
import { toast } from '../js/components/toast.js';

export async function render(container) {
  /* ---- Outer page ---- */
  const page = document.createElement('div');
  page.className = 'login-page';

  const card = document.createElement('div');
  card.className = 'login-card';

  /* ---- Logo ---- */
  const logo = document.createElement('div');
  logo.className = 'login-logo fade-in stagger-1';

  const logoH1 = document.createElement('h1');
  logoH1.textContent = '᛭ DnD ᛭';

  const subtitle = document.createElement('div');
  subtitle.className = 'subtitle';
  subtitle.textContent = 'Community Manager';

  const runes = document.createElement('div');
  runes.className = 'runes';
  runes.textContent = 'ᚱ ᚢ ᚾ';

  logo.appendChild(logoH1);
  logo.appendChild(subtitle);
  logo.appendChild(runes);

  /* ---- Login form ---- */
  const loginSection = document.createElement('div');
  loginSection.id = 'login-section';

  loginSection.appendChild(createDivider('Ingresa al Gremio'));

  const usernameGroup = createFormGroup('Usuario o email', 'text',     'login_user', 'aventurero@dungeon.cl');
  const passwordGroup = createFormGroup('Contraseña',      'password', 'login_pass', '••••••••');
  usernameGroup.classList.add('fade-in', 'stagger-2');
  passwordGroup.classList.add('fade-in', 'stagger-3');

  const loginBtn = document.createElement('button');
  loginBtn.className = 'btn btn-primary btn-full fade-in stagger-4';
  loginBtn.type = 'button';
  loginBtn.textContent = 'Entrar al Gremio';

  const switchToReg = document.createElement('div');
  switchToReg.className = 'login-switch fade-in stagger-5';
  const switchToRegLink = document.createElement('a');
  switchToRegLink.textContent = '¿No tienes cuenta? Registrarse';
  switchToReg.appendChild(switchToRegLink);

  loginSection.appendChild(usernameGroup);
  loginSection.appendChild(passwordGroup);
  loginSection.appendChild(loginBtn);
  loginSection.appendChild(switchToReg);

  /* ---- Register form (hidden) ---- */
  const registerSection = document.createElement('div');
  registerSection.id = 'register-section';
  registerSection.style.display = 'none';

  registerSection.appendChild(createDivider('Crea tu cuenta'));

  const regUsernameGroup = createFormGroup('Nombre de usuario',        'text',     'reg_username', 'ThunderFist42');
  const regEmailGroup    = createFormGroup('Email',                    'email',    'reg_email',    'heroe@dungeon.cl');
  const regPasswordGroup = createFormGroup('Contraseña',               'password', 'reg_password', 'Mínimo 8 caracteres');
  const regDisplayGroup  = createFormGroup('Nombre visible (opcional)','text',     'reg_display',  'Señor de las Sombras');

  const registerBtn = document.createElement('button');
  registerBtn.className = 'btn btn-primary btn-full';
  registerBtn.type = 'button';
  registerBtn.textContent = 'Crear cuenta';

  const switchToLogin = document.createElement('div');
  switchToLogin.className = 'login-switch';
  const switchToLoginLink = document.createElement('a');
  switchToLoginLink.textContent = 'Ya tengo cuenta';
  switchToLogin.appendChild(switchToLoginLink);

  registerSection.appendChild(regUsernameGroup);
  registerSection.appendChild(regEmailGroup);
  registerSection.appendChild(regPasswordGroup);
  registerSection.appendChild(regDisplayGroup);
  registerSection.appendChild(registerBtn);
  registerSection.appendChild(switchToLogin);

  /* ---- Assemble ---- */
  card.appendChild(logo);
  card.appendChild(loginSection);
  card.appendChild(registerSection);
  page.appendChild(card);
  container.appendChild(page);

  /* ---- Switch handlers ---- */
  switchToRegLink.addEventListener('click', () => {
    loginSection.style.display = 'none';
    registerSection.style.display = 'block';
  });

  switchToLoginLink.addEventListener('click', () => {
    registerSection.style.display = 'none';
    loginSection.style.display = 'block';
  });

  /* ---- Login submit ---- */
  loginBtn.addEventListener('click', async () => {
    const usernameOrEmail = loginSection.querySelector('#login_user').value.trim();
    const password        = loginSection.querySelector('#login_pass').value;

    if (!usernameOrEmail || !password) {
      toast.error('Campos requeridos', 'Completa usuario y contraseña');
      shakeCard(card);
      return;
    }

    setLoading(loginBtn, true, 'Entrando...');

    try {
      const res = await api.post('/auth/login', {
        username_or_email: usernameOrEmail,
        password,
      });

      // Support both {data: {access_token}} and {access_token} shapes
      const token = res.data?.access_token ?? res.access_token;
      auth.setToken(token);

      try {
        const me = await api.get('/auth/me');
        auth.setUser(me.data ?? me);
      } catch {
        auth.setUser({ username: usernameOrEmail, role: 'player' });
      }

      toast.success('¡Bienvenido!', 'Entrando al gremio...');
      setTimeout(() => { location.hash = '#/dashboard'; }, 600);
    } catch (err) {
      toast.error('Error al iniciar sesión', err.message);
      shakeCard(card);
      setLoading(loginBtn, false, 'Entrar al Gremio');
    }
  });

  /* ---- Register submit ---- */
  registerBtn.addEventListener('click', async () => {
    const username    = registerSection.querySelector('#reg_username').value.trim();
    const email       = registerSection.querySelector('#reg_email').value.trim();
    const password    = registerSection.querySelector('#reg_password').value;
    const displayName = registerSection.querySelector('#reg_display').value.trim();

    if (!username || !email || !password) {
      toast.error('Campos requeridos', 'Completa todos los campos obligatorios');
      shakeCard(card);
      return;
    }
    if (password.length < 8) {
      toast.error('Contraseña muy corta', 'Mínimo 8 caracteres');
      return;
    }

    setLoading(registerBtn, true, 'Creando cuenta...');

    try {
      const body = { username, email, password };
      if (displayName) body.display_name = displayName;

      const res = await api.post('/auth/register', body);
      const token = res.data?.access_token ?? res.access_token;
      auth.setToken(token);

      try {
        const me = await api.get('/auth/me');
        auth.setUser(me.data ?? me);
      } catch {
        auth.setUser({ username, email, display_name: displayName || username, role: 'player' });
      }

      toast.success('¡Cuenta creada!', 'Bienvenido al gremio');
      setTimeout(() => { location.hash = '#/dashboard'; }, 600);
    } catch (err) {
      toast.error('Error al registrarse', err.message);
      shakeCard(card);
      setLoading(registerBtn, false, 'Crear cuenta');
    }
  });

  /* ---- Enter key support ---- */
  [loginSection, registerSection].forEach(section => {
    section.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const btn = section === loginSection ? loginBtn : registerBtn;
        btn.click();
      }
    });
  });
}

/* ---- Helpers ---- */

function createFormGroup(labelText, type, id, placeholder) {
  const group = document.createElement('div');
  group.className = 'form-group';

  const label = document.createElement('label');
  label.className = 'form-label';
  label.htmlFor = id;
  label.textContent = labelText;

  const input = document.createElement('input');
  input.className = 'input';
  input.type = type;
  input.id = id;
  input.name = id;
  input.placeholder = placeholder;
  input.autocomplete = type === 'password' ? 'current-password' : 'on';

  group.appendChild(label);
  group.appendChild(input);
  return group;
}

function createDivider(text) {
  const d = document.createElement('div');
  d.className = 'login-divider';

  const line1 = document.createElement('span');
  line1.className = 'line';

  const rune = document.createElement('span');
  rune.className = 'rune';
  rune.textContent = text;

  const line2 = document.createElement('span');
  line2.className = 'line';

  d.appendChild(line1);
  d.appendChild(rune);
  d.appendChild(line2);
  return d;
}

function setLoading(btn, loading, label) {
  btn.disabled = loading;
  if (loading) {
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.style.cssText = 'width:14px;height:14px;border-width:2px;';
    btn.textContent = '';
    btn.appendChild(spinner);
    btn.appendChild(document.createTextNode(' ' + label));
  } else {
    btn.textContent = label;
  }
}

function shakeCard(el) {
  el.classList.remove('shake');
  // Force reflow to restart animation
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}
