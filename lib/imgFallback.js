// v32: ONE PLACE FOR "this photo will not load".
// The shop shows photos straight from their own hosts. When a host blocks
// hotlinking (or the link is http / expired), the browser fails and the picture
// disappears. These helpers retry the SAME picture through the shop's own relay
// (/api/img) so the visitor still sees an image.

// A picture that already points at our relay is left alone (no loops).
export function isProxyUrl(url) {
  const s = String(url || '');
  return s.startsWith('/api/img?') || s.includes('/api/img?u=');
}

// -> "/api/img?u=<encoded>" or the original link when relaying makes no sense.
export function proxyImage(url) {
  const s = String(url || '').trim();
  if (!s || isProxyUrl(s)) return s;
  if (!/^https?:\/\//i.test(s) && !s.startsWith('//')) return s; // data:, blob: and local files are fine as they are
  const full = s.startsWith('//') ? `https:${s}` : s;
  return `/api/img?u=${encodeURIComponent(full)}`;
}

// The last step for any <img>: try the relay, then hide the picture (and the
// element marked with [data-dead-wrap]) instead of showing a broken icon.
export function imgFallback(e, { wrap = false } = {}) {
  const el = e && e.currentTarget;
  if (!el) return;
  const src = el.getAttribute('src') || el.src || '';
  if (!src || isProxyUrl(src)) {
    el.setAttribute('data-dead', '1');
    try { el.style.display = 'none'; } catch { /* ignore */ }
    if (wrap) {
      const box = el.closest('[data-dead-wrap]');
      if (box) box.setAttribute('data-dead', '1');
    }
    return;
  }
  el.setAttribute('src', proxyImage(src));
}
