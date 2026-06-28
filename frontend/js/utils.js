export function abilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

export function modifierStr(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelative(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return 'ahora';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

export function hpPercent(hp, max) {
  return max > 0 ? Math.round((hp / max) * 100) : 0;
}

export function hpColor(percent) {
  if (percent > 60) return 'var(--success)';
  if (percent > 30) return 'var(--gold)';
  return 'var(--crimson)';
}

export function rarityColor(r) {
  return ({
    common:    'var(--ink-muted)',
    uncommon:  'var(--success)',
    rare:      '#4A90D9',
    very_rare: '#9B59B6',
    legendary: 'var(--gold)',
    artifact:  'var(--crimson)',
  })[r] || 'var(--ink-muted)';
}

export function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

export function animateCounter(el, from, to, duration = 800) {
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * ease);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export function rollDice(expression) {
  const match = expression.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  const [, count, sides, mod] = match;
  const rolls = Array.from(
    { length: +count },
    () => Math.floor(Math.random() * +sides) + 1
  );
  const modifier = mod ? parseInt(mod) : 0;
  return {
    expression,
    rolls,
    modifier,
    total: rolls.reduce((a, b) => a + b, 0) + modifier,
  };
}

export function classEmoji(cls) {
  const map = {
    barbarian: '⚔️',
    bard:      '🎸',
    cleric:    '✝️',
    druid:     '🌿',
    fighter:   '🛡️',
    monk:      '👊',
    paladin:   '⚜️',
    ranger:    '🏹',
    rogue:     '🗡️',
    sorcerer:  '✨',
    warlock:   '👁️',
    wizard:    '🔮',
  };
  return map[(cls || '').toLowerCase()] || '🧙';
}
