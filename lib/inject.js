// SITE STUDIO (v23): animation presets + your own code snippets (CSS / JavaScript / HTML) added to the whole shop from the admin panel,
// without touching the repository. Pure code, shared by the admin page, the AI manager, the server and the browser.
//
// WHO CAN CHANGE IT: only the admin (Firestore rules: siteMeta is written by the admin only) and the AI manager, which can only PREPARE a
// snippet; you press Confirm. Snippets never run inside /admin, and "?noinject=1" at the end of any shop address opens the shop with all of
// them switched off (use it if a snippet ever breaks a page; then fix or delete it in Admin > Studio).

export const INJECT_DOC = { collection: 'siteMeta', id: 'inject' };

// The ready-made animations (no code needed). The browser code of each one lives in components/SiteFx.js and app/globals.css.
export const EFFECTS = [
  { id: 'reveal', label: 'Rise on scroll', desc: 'Cards and sections glide up softly when they come into view.' },
  { id: 'sparkle', label: 'Golden sparkle trail', desc: 'A light trail of gold sparkles follows the finger or mouse.' },
  { id: 'lanterns', label: 'Hanging lanterns', desc: 'Two swinging lanterns in the top corners (Ramadan / Eid feel).' },
  { id: 'confetti', label: 'Confetti', desc: 'A burst of confetti on "Add to cart" and when an order is placed.' },
  { id: 'tilt', label: '3D card tilt', desc: 'Product cards tilt toward the mouse (computers only).' },
  { id: 'shimmer', label: 'Shimmering discount badges', desc: 'A moving shine on the red discount badges.' },
  { id: 'glow', label: 'Glowing main buttons', desc: 'A soft pulsing glow on the green main buttons.' },
  { id: 'progress', label: 'Scroll progress bar', desc: 'A thin gold bar at the top shows how far the page is read.' },
  { id: 'smooth', label: 'Smooth scrolling and instant taps', desc: 'Smooth anchor scrolling and no 300 ms tap delay.' },
];
export const EFFECT_IDS = EFFECTS.map((e) => e.id);

export const TYPES = [['css', 'CSS (looks and animations)'], ['js', 'JavaScript (behaviour)'], ['html', 'HTML (a banner or a block, no scripts)']];
export const MAX_ITEMS = 24;
export const MAX_CODE = 24000;

const txt = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

// Where a snippet runs: 'all', 'home', or a list of paths that the address must start with (for example "/products,/deals").
export function cleanPages(v) {
  if (v === 'home') return 'home';
  const s = String(v == null ? 'all' : v).trim();
  if (!s || s === 'all') return 'all';
  const list = s.split(/[\s,]+/).map((p) => (p.startsWith('/') ? p : `/${p}`)).map((p) => p.replace(/[^\w\-/.]/g, '').slice(0, 80)).filter((p) => p.length > 1 && !p.startsWith('/admin')).slice(0, 12);
  return list.length ? list.join(',') : 'all';
}
export function pageMatches(pages, path) {
  if (!pages || pages === 'all') return true;
  if (pages === 'home') return path === '/';
  return pages.split(',').some((p) => path === p || path.startsWith(`${p}/`));
}

// HTML snippets may not carry scripts: scripts, event handlers, javascript: links, iframes and forms are removed.
export function safeHtml(html) {
  return String(html || '')
    .replace(/<\s*(script|iframe|object|embed|form|meta|link|base)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/<\s*(script|iframe|object|embed|form|meta|link|base)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|xlink:href)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '$1="#"');
}
export const safeCss = (css) => String(css || '').replace(/<\/?style[^>]*>/gi, '').replace(/@import[^;]*;?/gi, '').replace(/expression\s*\(/gi, '(');

export function cleanItem(x = {}) {
  const type = ['css', 'js', 'html'].includes(x.type) ? x.type : '';
  if (!type) return null;
  let code = String(x.code == null ? '' : x.code).slice(0, MAX_CODE);
  if (type === 'css') code = safeCss(code);
  if (type === 'html') code = safeHtml(code);
  if (!code.trim()) return null;
  const id = String(x.id || '').replace(/[^\w-]/g, '').slice(0, 40) || `s${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  return {
    id, type, code,
    name: txt(x.name, 60) || (type === 'css' ? 'Custom CSS' : type === 'js' ? 'Custom script' : 'Custom block'),
    pages: cleanPages(x.pages),
    where: x.where === 'top' ? 'top' : 'end', // html blocks only: 'top' = above the page, 'end' = below the page
    enabled: x.enabled !== false,
    by: x.by === 'ai' ? 'ai' : 'admin',
    atMs: Number(x.atMs) || Date.now(),
  };
}

export function cleanInject(x = {}) {
  const o = x || {};
  const seen = new Set();
  const items = [];
  for (const it of (Array.isArray(o.items) ? o.items : []).slice(0, MAX_ITEMS)) {
    const c = cleanItem(it);
    if (c && !seen.has(c.id)) { seen.add(c.id); items.push(c); }
  }
  return {
    disabled: Boolean(o.disabled),                                  // master switch: everything off
    effects: [...new Set((Array.isArray(o.effects) ? o.effects : []).filter((e) => EFFECT_IDS.includes(e)))],
    items,
  };
}

// What the browser receives: nothing when disabled, only the snippets that are switched on.
export function injectForViewer(cfg) {
  const c = cleanInject(cfg);
  if (c.disabled) return { effects: [], items: [] };
  return { effects: c.effects, items: c.items.filter((i) => i.enabled).map(({ id, type, code, pages, where }) => ({ id, type, code, pages, where })) };
}
