// IPTV GATEWAY — source config ke PURE helpers (koi next/cache, koi Firestore nahi).
// Test aur server dono yahi use karte hain.

export const SOURCE_DOC = { collection: 'siteMeta', id: 'iptvSource' };

const clean = (s, n) => String(s == null ? '' : s).replace(/[<>\s"]/g, '').trim().slice(0, n);
const cleanUrl = (v) => {
  const s = String(v || '').trim();
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(s)) return '';
  return s.replace(/\/+$/, '');
};

/** Source config ko saaf karta hai (kisi bhi browser input se). */
export function cleanSource(input = {}) {
  const mode = input.mode === 'm3u' ? 'm3u' : 'xtream';
  return {
    mode,
    name: String(input.name || '').replace(/[<>]/g, '').trim().slice(0, 40) || 'Mizanora source',
    host: cleanUrl(input.host),
    username: clean(input.username, 60),
    password: clean(input.password, 120),
    url: cleanUrl(input.url),
    enabled: input.enabled !== false && (mode === 'm3u' ? Boolean(cleanUrl(input.url)) : Boolean(cleanUrl(input.host) && input.username && input.password)),
    updatedAt: Number(input.updatedAt) || 0,
  };
}

export const sourceReady = (s) => Boolean(s && s.enabled && (s.mode === 'm3u' ? s.url : s.host && s.username && s.password));

/** Upstream ka base — `/player_api.php` ke baghair. */
export const apiBase = (s) => (s && s.host ? s.host.replace(/\/player_api\.php.*$/i, '').replace(/\/+$/, '') : '');

/** Xtream style stream URL (sirf server ke andar use hota hai). */
export function upstreamStreamUrl(source, kind, id, ext = 'ts') {
  const base = apiBase(source);
  const u = encodeURIComponent(source.username);
  const p = encodeURIComponent(source.password);
  const safeExt = String(ext || 'ts').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'ts';
  const folder = kind === 'movie' ? 'movie' : kind === 'series' ? 'series' : 'live';
  return `${base}/${folder}/${u}/${p}/${encodeURIComponent(String(id))}.${safeExt}`;
}
