// Pure helpers for the Live TV interface. Keeping them out of the React component makes the
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

// ---------------------------------------------------------------------------
// v49: the rebuilt player's labels - exact resolution / bitrate capture,
// audio-track names, and the colourful (Tamasha-style) channel tile helpers.
// ---------------------------------------------------------------------------

/** 1080 -> "1080p", 720 -> "720p", 0/unknown -> "Auto". */
export function resLabel(height) {
  const h = Math.round(Number(height) || 0);
  if (!h) return 'Auto';
  if (h >= 2000) return '4K';
  if (h >= 1300) return '1440p';
  return `${h}p`;
}

/** bits per second -> "2.5 Mbps" / "640 kbps" / "". */
export function formatBitrate(bps) {
  const n = Number(bps) || 0;
  if (n <= 0) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)} Mbps`;
  return `${Math.round(n / 1000)} kbps`;
}

/**
 * Normalise quality levels from hls.js (h.levels) or dash.js (bitrate list) into one shape:
 * [{ i, height, width, bitrate, frameRate, label }]. `i` is the ORIGINAL index the engine
 * expects, so the menu can be displayed tallest-first without losing the mapping.
 */
export function normaliseLevels(list) {
  return (Array.isArray(list) ? list : []).map((l, i) => {
    const height = Math.round(Number(l && l.height) || 0);
    const width = Math.round(Number(l && l.width) || 0);
    const bitrate = Math.round(Number(l && (l.bitrate || l.bandwidth || l.bitrateKbps * 1000)) || 0);
    const frameRate = Math.round(Number(l && (l.frameRate || l.framerate)) || 0);
    const base = resLabel(height) + (frameRate >= 45 ? '60' : '');
    const parts = [base];
    const bits = formatBitrate(bitrate);
    return { i, height, width, bitrate, frameRate, label: bits ? `${parts[0]} · ${bits}` : parts[0] };
  });
}

/** Menu order: the best picture first (YouTube/Tamasha style), originals kept via `i`. */
export const menuLevels = (levels) => [...(levels || [])].sort((a, b) => (b.height - a.height) || (b.bitrate - a.bitrate));

export const LANG_NAMES = {
  ur: 'Urdu', urd: 'Urdu', en: 'English', eng: 'English', ar: 'Arabic', ara: 'Arabic',
  hi: 'Hindi', hin: 'Hindi', pa: 'Punjabi', pan: 'Punjabi', ps: 'Pashto', pus: 'Pashto',
  sd: 'Sindhi', snd: 'Sindhi', bn: 'Bangla', ban: 'Bangla', fa: 'Persian', per: 'Persian',
  tr: 'Turkish', tur: 'Turkish', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada',
  si: 'Sinhala', ne: 'Nepali', id: 'Indonesian', ms: 'Malay', fr: 'French', de: 'German',
  es: 'Spanish', pt: 'Portuguese', ru: 'Russian', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
};

export const langName = (code) => LANG_NAMES[String(code || '').toLowerCase().split(/[-_]/)[0]] || '';

/** An audio track as people understand it: "Urdu (ur) · Stereo". Never empty. */
export function audioLabel(track, at = 0) {
  const t = track || {};
  const lang = String(t.lang || t.language || '').trim();
  const nice = langName(lang);
  const name = String(t.name || t.label || '').trim();
  const base = nice || name || lang || `Audio ${at + 1}`;
  const suffix = [];
  if (name && norm(name) !== norm(base)) suffix.push(name);
  if (lang && !nice && norm(base) !== norm(lang)) suffix.push(lang.toUpperCase());
  const ch = Number(t.channels || (t.attrs && t.attrs.CHANNELS) || 0);
  if (ch >= 6) suffix.push('5.1');
  else if (ch === 2) suffix.push('Stereo');
  else if (ch === 1) suffix.push('Mono');
  return suffix.length ? `${base} (${suffix.join(' · ')})` : base;
}

/** A subtitle / caption track as people understand it. */
export function subLabel(track, at = 0) {
  const t = track || {};
  const lang = String(t.lang || t.language || '').trim();
  return String(t.name || t.label || '').trim() || langName(lang) || lang.toUpperCase() || `Captions ${at + 1}`;
}

/** Behind-live seconds -> "LIVE" when close to the edge, else "-12s" / "-1:05". */
export function latencyLabel(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 2.5) return 'LIVE';
  const r = Math.round(s);
  if (r < 60) return `-${r}s`;
  return `-${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
}

/** Deterministic colour per channel (0-359): the same channel always gets the same tile. */
export function channelHue(name) {
  let h = 0;
  const s = String(name || 'channel');
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** "Geo News" -> "GN", "ARY Digital" -> "AD", a single word keeps its first two letters. */
export function channelInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'TV';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Guide ordering: as saved (default), A-Z, or grouped (group A-Z, then channel A-Z). */
export function sortChannels(list, mode = 'default') {
  const arr = [...(list || [])];
  if (mode === 'az') arr.sort((a, b) => norm(a.name).localeCompare(norm(b.name)));
  else if (mode === 'group') arr.sort((a, b) => norm(a.group || 'Other').localeCompare(norm(b.group || 'Other')) || norm(a.name).localeCompare(norm(b.name)));
  return arr;
}
