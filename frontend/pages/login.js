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

  buildMagicBackground(page);   // fondo animado del gremio (detrás de la tarjeta)
  page.appendChild(card);
  container.appendChild(page);
  startMagicSparks(page.querySelector('#dndCanvas'));

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

/* ---- Fondo mágico (integrado desde intro/fondo-magico.html) ---- */

// Runas flotantes: [left%, top%, tamaño px, opacidad pico, duración s, retraso s, glifo]
const MAGIC_RUNES = [
  [16, 24, 30, 0.42, 11, 0, 'ᚦ'], [80, 30, 24, 0.36, 13, 2, 'ᚨ'],
  [22, 70, 26, 0.40, 12, 4, 'ᛟ'], [78, 66, 30, 0.38, 14, 1.5, 'ᚱ'],
  [12, 50, 22, 0.32, 15, 3, 'ᛇ'], [88, 48, 26, 0.34, 12.5, 5, 'ᛖ'],
  [34, 16, 22, 0.34, 13.5, 6.5, 'ᚷ'], [64, 18, 28, 0.40, 11.5, 8, 'ᛊ'],
  [44, 82, 24, 0.36, 12.8, 2.8, 'ᛏ'], [58, 84, 20, 0.30, 14.5, 7, 'ᛗ'],
  [6, 36, 26, 0.32, 13.2, 9.5, 'ᚹ'], [94, 38, 22, 0.30, 12.2, 4.5, 'ᚦ'],
];

const MAGIC_SEAL_SVG = `
<svg viewBox="0 0 600 600" width="100%" height="100%" style="overflow:visible;">
  <defs>
    <path id="dnd-runeRing"  d="M 300,300 m -262,0 a 262,262 0 1,1 524,0 a 262,262 0 1,1 -524,0"></path>
    <path id="dnd-runeRing2" d="M 300,300 m -224,0 a 224,224 0 1,1 448,0 a 224,224 0 1,1 -448,0"></path>
  </defs>
  <g class="dnd-rot dnd-cw70" fill="none" stroke="#8a6a12" stroke-width="1.6">
    <circle cx="300" cy="300" r="290"></circle>
    <circle cx="300" cy="300" r="238" stroke-width="1"></circle>
    <g stroke-width="1.4">
      <line x1="300" y1="8" x2="300" y2="30"></line>
      <line x1="592" y1="300" x2="570" y2="300"></line>
      <line x1="300" y1="592" x2="300" y2="570"></line>
      <line x1="8" y1="300" x2="30" y2="300"></line>
      <line x1="506" y1="94" x2="491" y2="109"></line>
      <line x1="506" y1="506" x2="491" y2="491"></line>
      <line x1="94" y1="506" x2="109" y2="491"></line>
      <line x1="94" y1="94" x2="109" y2="109"></line>
    </g>
  </g>
  <g class="dnd-rot dnd-ccw96">
    <circle cx="300" cy="300" r="262" fill="none" stroke="#8a6a12" stroke-width="0.8" opacity="0.7"></circle>
    <text fill="#6f5209" font-family="'Cinzel', serif" font-size="24" letter-spacing="9" opacity="0.95">
      <textPath href="#dnd-runeRing" startOffset="0">ᚠ ᚱ ᚦ ᚨ ᚷ ᛟ ᚹ ᚲ ᛈ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᚾ ᛁ ᛃ ᚺ ᛉ ᛇ ᚢ ᚠ ᚱ ᚦ ᚨ ᚷ ᛟ ᚹ ᚲ ᛈ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᚾ ᛁ ᛃ ᚺ ᛉ ᛇ ᚢ</textPath>
    </text>
  </g>
  <g class="dnd-rot dnd-cw74">
    <circle cx="300" cy="300" r="224" fill="none" stroke="#8a6a12" stroke-width="0.7" opacity="0.6"></circle>
    <text fill="#6f5209" font-family="'Cinzel', serif" font-size="18" letter-spacing="7" opacity="0.9">
      <textPath href="#dnd-runeRing2" startOffset="0">ᛉ ᛇ ᛃ ᛁ ᚾ ᛞ ᛜ ᛚ ᛗ ᛖ ᛒ ᛏ ᛊ ᛈ ᚲ ᚹ ᛟ ᚷ ᚨ ᚦ ᚱ ᚠ ᚢ ᚺ ᛉ ᛇ ᛃ ᛁ ᚾ ᛞ ᛜ ᛚ ᛗ ᛖ ᛒ ᛏ ᛊ ᛈ ᚲ ᚹ ᛟ ᚷ ᚨ ᚦ ᚱ ᚠ ᚢ ᚺ ᛉ ᛇ ᛃ ᛁ ᚾ ᛞ ᛜ ᛚ ᛗ ᛖ ᛒ ᛏ ᛊ ᛈ ᚲ ᚹ ᛟ ᚷ ᚨ ᚦ ᚱ ᚠ ᚢ ᚺ</textPath>
    </text>
  </g>
  <g class="dnd-rot dnd-cw52" fill="none" stroke="#8a6a12" stroke-width="1.4">
    <circle cx="300" cy="300" r="190"></circle>
    <circle cx="300" cy="300" r="150" stroke-width="1"></circle>
    <polygon points="300,110 135,395 465,395" stroke-width="1.3"></polygon>
    <polygon points="300,490 135,205 465,205" stroke-width="1.3"></polygon>
    <circle cx="300" cy="300" r="60" stroke-width="1"></circle>
  </g>
</svg>`;

function buildMagicBackground(page) {
  const canvas = document.createElement('canvas');
  canvas.className = 'dnd-canvas';
  canvas.id = 'dndCanvas';

  const glow = document.createElement('div');
  glow.className = 'dnd-glow';

  const seal = document.createElement('div');
  seal.className = 'dnd-seal';
  seal.setAttribute('aria-hidden', 'true');
  seal.innerHTML = MAGIC_SEAL_SVG;

  page.appendChild(canvas);
  page.appendChild(glow);
  page.appendChild(seal);

  MAGIC_RUNES.forEach(([left, top, size, peak, dur, delay, glyph]) => {
    const r = document.createElement('span');
    r.className = 'dnd-rune';
    r.setAttribute('aria-hidden', 'true');
    r.textContent = glyph;
    r.style.cssText = `left:${left}%; top:${top}%; font-size:${size}px; --peak:${peak}; animation-duration:${dur}s; animation-delay:${delay}s;`;
    page.appendChild(r);
  });
}

// Chispas doradas en canvas. Se autolimpia (RAF + listener) al salir del login.
function startMagicSparks(canvas) {
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0, particles = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  function build() {
    const count = Math.round(Math.min(180, Math.max(85, (w * h) / 11000)));
    particles = [];
    for (let i = 0; i < count; i++) {
      const big = Math.random() < 0.14;
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        r: big ? rand(2.6, 4.6) : rand(0.7, 2.0),
        sy: big ? rand(4, 9) : rand(9, 22),
        sway: rand(6, 22), swaySpeed: rand(0.2, 0.7),
        phase: Math.random() * Math.PI * 2, tw: rand(0.5, 1.6),
        base: big ? rand(0.10, 0.22) : rand(0.20, 0.55),
      });
    }
  }
  function resize() {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }
  resize();
  window.addEventListener('resize', resize);

  let last = performance.now();
  function draw(now) {
    // Detener el bucle y limpiar el listener cuando el login sale del DOM.
    if (!canvas.isConnected) { window.removeEventListener('resize', resize); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.y -= p.sy * dt;
      if (p.y < -12) { p.y = h + 12; p.x = Math.random() * w; }
      const x = p.x + Math.sin(t * p.swaySpeed + p.phase) * p.sway;
      const op = p.base * (0.55 + 0.45 * Math.sin(t * p.tw + p.phase));
      const g = ctx.createRadialGradient(x, p.y, 0, x, p.y, p.r * 4);
      g.addColorStop(0, 'rgba(203,166,80,' + op + ')');
      g.addColorStop(0.35, 'rgba(184,146,58,' + (op * 0.5) + ')');
      g.addColorStop(1, 'rgba(184,146,58,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, p.y, p.r * 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(240,222,170,' + Math.min(1, op * 1.4) + ')';
      ctx.beginPath(); ctx.arc(x, p.y, p.r * 0.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}
