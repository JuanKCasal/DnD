let container = null;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function show(type, title, message, duration = 4000) {
  const c = getContainer();

  const t = document.createElement('div');
  t.className = `toast toast-${type}`;

  // Header
  const header = document.createElement('div');
  header.className = 'toast-header';
  const titleEl = document.createElement('span');
  titleEl.className = 'toast-title';
  titleEl.textContent = title;
  header.appendChild(titleEl);
  t.appendChild(header);

  // Message
  if (message) {
    const msgEl = document.createElement('div');
    msgEl.className = 'toast-message';
    msgEl.textContent = message;
    t.appendChild(msgEl);
  }

  // Progress bar
  const progress = document.createElement('div');
  progress.className = 'toast-progress';
  const bar = document.createElement('div');
  bar.className = 'toast-progress-bar';
  bar.style.animationDuration = `${duration}ms`;
  progress.appendChild(bar);
  t.appendChild(progress);

  c.appendChild(t);

  // Keep at most 3 toasts
  while (c.children.length > 3) {
    c.firstChild.remove();
  }

  let timer = setTimeout(() => { if (t.parentNode) t.remove(); }, duration);

  t.addEventListener('mouseenter', () => {
    clearTimeout(timer);
    bar.style.animationPlayState = 'paused';
  });

  t.addEventListener('mouseleave', () => {
    bar.style.animationPlayState = 'running';
    timer = setTimeout(() => { if (t.parentNode) t.remove(); }, 1000);
  });
}

export const toast = {
  success: (msg, detail)     => show('success', msg, detail),
  error:   (msg, detail)     => show('error',   msg, detail),
  info:    (msg, detail)     => show('info',    msg, detail),
  dice:    (expr, total)     => show('dice', `🎲 ${expr}`, `Resultado: ${total}`),
};
