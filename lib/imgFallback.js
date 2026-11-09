// v32: ONE PLACE FOR "this photo will not load".
// The shop shows photos straight from their own hosts. When a host blocks
// hotlinking (or the link is http / expired), the browser fails and the picture
// disappears. These helpers retry the SAME picture through the shop's own relay
// (/api/img) so the visitor still sees an image.
//
// v60 — THE RELAY IS NOT FREE.
// Every relayed photo is bytes that leave a Vercel Function and travel through the CDN;
// Vercel bills that as "Fast Origin Transfer" (Hobby: 10 GB / rolling 30 days). The old
// version relayed photo after photo for whole hosts that simply refuse hotlinking, and the
// songs artwork was relayed BEFORE it was ever known to be broken. On 2026-11-08 that took
// the Hobby team over the fair-use limit and Vercel paused every deployment for 30 days.
//
// So now the relay is a LAST RESORT, not a default:
//   * a picture is shown from its own host first (0 bytes through us),
//   * the relay is only used after the browser has actually failed on that picture,
//   * once a host fails, it is remembered for the session, so the NEXT photo from that host
//     goes straight to the relay instead of wasting a second failed request,
//   * hosts you already know are hotlink-blocking can be declared once:
//         NEXT_PUBLIC_IMAGE_RELAY_HOSTS="imgbb.com,ibb.co,some-cdn.example"
//     (or NEXT_PUBLIC_IMAGE_RELAY=always to relay everything, off to switch it off).
//     These are NEXT_PUBLIC_ values: they are baked in at build time, so a redeploy is needed.

const BROKEN_KEY = 'mizanora:img-broken-hosts';
// In-memory list too: sessionStorage can be blocked (private mode, embedded webviews), and the
// server-side tests import this module. The memory copy is enough for the current page.
const memBroken = new Set();

// 'fallback' (default) = relay only after a real failure / a declared bad host.
// 'always'            = relay every remote picture (the old v32 behaviour; costs origin transfer).
// 'off'               = never relay (the photo is hidden instead). Use when the limit is tight.
export function relayMode() {
  const m = String(process.env.NEXT_PUBLIC_IMAGE_RELAY || '').trim().toLowerCase();
  if (m === 'always' || m === 'on' || m === '1') return 'always';
  if (m === 'off' || m === 'never' || m === '0') return 'off';
  return 'fallback';
}

/** Hosts declared as hotlink-blocking, from NEXT_PUBLIC_IMAGE_RELAY_HOSTS. */
export function declaredRelayHosts() {
  return String(process.env.NEXT_PUBLIC_IMAGE_RELAY_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean);
}

const hostOf = (url) => {
  try {
    const u = new URL(String(url).startsWith('//') ? `https:${url}` : String(url));
    return u.hostname.toLowerCase();
  } catch {
    return '';
  }
};

const hostMatches = (host, list) => Boolean(host) && list.some((d) => host === d || host.endsWith(`.${d}`));

/** Hosts that already failed in this browser session (a failed photo is never retried raw). */
export function brokenHosts() {
  const fromStore = (() => {
    try {
      if (typeof sessionStorage === 'undefined') return [];
      const list = JSON.parse(sessionStorage.getItem(BROKEN_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  })();
  return [...new Set([...memBroken, ...fromStore])];
}

export function markBrokenHost(url) {
  const host = hostOf(url);
  if (!host || memBroken.has(host)) return;
  memBroken.add(host);
  try {
    if (typeof sessionStorage === 'undefined') return;
    const list = brokenHosts();
    if (hostMatches(host, list)) return;
    sessionStorage.setItem(BROKEN_KEY, JSON.stringify([...list, host].slice(-60)));
  } catch {
    /* storage blocked: the relay is still used for this picture */
  }
}

/**
 * Should this picture go straight through the relay (before the browser tries it)?
 * Only when you asked for it, or when the host is already known to be broken.
 */
export function shouldRelay(url) {
  const mode = relayMode();
  if (mode === 'off') return false;
  if (mode === 'always') return true;
  const host = hostOf(url);
  if (!host) return false;
  return hostMatches(host, declaredRelayHosts()) || hostMatches(host, brokenHosts());
}

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
// v60: a host that fails is remembered, so the rest of the page skips the failed request.
export function imgFallback(e, { wrap = false } = {}) {
  const el = e && e.currentTarget;
  if (!el) return;
  const src = el.getAttribute('src') || el.src || '';
  const mode = relayMode();
  if (!src || isProxyUrl(src) || mode === 'off') {
    if (src && mode !== 'off') markBrokenHost(src);
    el.setAttribute('data-dead', '1');
    try { el.style.display = 'none'; } catch { /* ignore */ }
    if (wrap) {
      const box = el.closest('[data-dead-wrap]');
      if (box) box.setAttribute('data-dead', '1');
    }
    return;
  }
  // The picture that just failed tells us its host is not hotlink-friendly: remember it,
  // then serve this picture (and its siblings) through the relay.
  markBrokenHost(src);
  el.setAttribute('src', proxyImage(src));
}
