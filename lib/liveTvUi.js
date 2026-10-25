// Pure helpers for the new Live TV interface. Keeping them out of the React component makes the
// search, quality and status rules cheap to test and keeps the player itself small.

export const TV_QUALITY = [
  ['auto', 'Auto'],
  ['high', 'High'],
  ['balanced', 'Balanced'],
  ['save', 'Data saver'],
];

// hls.js sorts levels by bitrate. Native HLS (Safari/iOS) does not expose levels: it stays on auto.
export function qualityLevel(levels, mode = 'auto') {
  const n = Array.isArray(levels) ? levels.length : Math.max(0, Number(levels) || 0);
  if (!n || mode === 'auto') return -1;
  if (mode === 'high') return n - 1;
  if (mode === 'balanced') return Math.floor((n - 1) / 2);
  if (mode === 'save') return 0;
  return -1;
}

const norm = (v) => String(v == null ? '' : v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

// One pass over the active channels: group, search, favourites and recents. Recents keep watch order.
export function filterChannels(channels, { group = 'All', query = '', favs = [], recent = [] } = {}) {
  const needle = norm(query).trim();
  const favSet = new Set(favs);
  const recentAt = new Map(recent.map((url, i) => [url, i]));
  const out = [];
  for (const c of channels || []) {
    if (!c || c.off) continue;
    if (group === 'Favourites' && !favSet.has(c.url)) continue;
    if (group === 'Recent' && !recentAt.has(c.url)) continue;
    if (group !== 'All' && group !== 'Favourites' && group !== 'Recent' && (c.group || 'Other') !== group) continue;
    if (needle && !norm(`${c.name || ''} ${c.group || ''} ${c.slug || ''}`).includes(needle)) continue;
    out.push(c);
  }
  if (group === 'Recent') out.sort((a, b) => (recentAt.get(a.url) ?? 999) - (recentAt.get(b.url) ?? 999));
  return out;
}

// Pakistan has no daylight saving, but Intl is still used so the browser's ICU data owns the timezone.
export function tvClock(at = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(at);
}

export function tvStatusLabel(status, buffering = false, kind = '') {
  if (kind === 'youtube' && status !== 'failed') return 'LIVE';
  if (status === 'playing') return buffering ? 'BUFFERING' : 'ON AIR';
  if (status === 'loading') return 'CONNECTING';
  if (status === 'blocked' || status === 'ready') return 'TAP TO PLAY';
  if (status === 'failed') return 'NO SIGNAL';
  return 'STANDBY';
}

// Only an absolute http(s) stream gets a cross-origin preconnect; relayed and malformed URLs do not.
export function streamOrigin(url) {
  try {
    const u = new URL(String(url || ''));
    return /^https?:$/.test(u.protocol) ? u.origin : '';
  } catch {
    return '';
  }
}
