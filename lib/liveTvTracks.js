// Mizanora v53 — the Live TV "track engine".
// These are the pure decisions behind quality / audio / caption switching, kept out of the
// component so they can be tested without a browser. One rule: the player must apply a choice
// on WHICHEVER engine is actually running (hls.js, dash.js or the browser's own player) and
// then check that the engine really did it.

/** Human names for the playback engines, used in the UI ("HLS", "DASH", "MP4"). */
export const ENGINE_LABEL = {
  hls: 'HLS',
  dash: 'DASH',
  video: 'MP4',
  audio: 'Audio',
  youtube: 'YouTube',
  unsupported: 'Unsupported',
  playlist: 'Playlist',
};

/**
 * The order of engines to try for one stream, most likely first.
 * A stream that is really HLS but does not say so (.m3u8 missing from the link) gets HLS first,
 * then the browser's own player. A plain MP4 gets the browser first, then HLS (some "mp4" links
 * are actually playlists). A dead DASH manifest still gets two more chances.
 */
export function engineLadder(kind) {
  switch (String(kind || '').toLowerCase()) {
    case 'dash': return ['dash', 'hls', 'video'];
    case 'hls': return ['hls', 'video'];
    case 'video':
    case 'audio': return ['video', 'hls'];
    case 'youtube': return ['youtube'];
    case 'unsupported':
    case 'playlist': return [];
    default: return ['hls', 'video'];
  }
}

/**
 * Label for the failure screen: what has been tried plus what comes next — "DASH → HLS",
 * and the full chain once the last engine is in play.
 */
export function engineChainLabel(kind, step = 0) {
  const ladder = engineLadder(kind);
  if (!ladder.length) return ENGINE_LABEL[String(kind || '').toLowerCase()] || 'Unknown';
  const upto = Math.min(ladder.length, Math.max(2, Number(step) + 2));
  return ladder.slice(0, upto).map((k) => ENGINE_LABEL[k] || k).join(' → ');
}

/**
 * Which exact level a quality MODE means, by resolution (not by list position).
 * HLS sorts its levels by bitrate, DASH and native lists do not, so sorting here is what makes
 * "High / Balanced / Data saver" mean the same thing on every engine.
 * Returns -1 for auto (and for an empty list).
 */
export function modeIndex(levels, mode = 'auto') {
  if (!Array.isArray(levels) || !levels.length) return -1;
  if (mode === 'auto' || !mode) return -1;
  const order = levels
    .map((_, i) => i)
    .sort((a, b) => (Number(levels[a] && levels[a].height) || 0) - (Number(levels[b] && levels[b].height) || 0)
      || (Number(levels[a] && levels[a].bitrate) || 0) - (Number(levels[b] && levels[b].bitrate) || 0));
  if (mode === 'high') return order[order.length - 1];
  if (mode === 'save') return order[0];
  return order[Math.floor((order.length - 1) / 2)];
}

const LANG_ALIASES = {
  urdu: 'ur', english: 'en', hindi: 'hi', arabic: 'ar', punjabi: 'pa', sindhi: 'sd', pashto: 'ps',
  bengali: 'bn', bangla: 'bn', turkish: 'tr', persian: 'fa', farsi: 'fa', french: 'fr', german: 'de',
  spanish: 'es', russian: 'ru', chinese: 'zh', malayalam: 'ml', tamil: 'ta', telugu: 'te',
};

/** "ur-PK" -> "ur", "Urdu" -> "ur", "" -> "". */
export function normLang(code) {
  const v = String(code == null ? '' : code).trim().toLowerCase().split(/[-_]/)[0];
  if (!v) return '';
  return LANG_ALIASES[v] || v.slice(0, 5);
}

/** Language order used when the visitor has never picked an audio track on this host. */
export const AUTO_AUDIO_ORDER = ['ur', 'en', 'hi', 'ar'];

/**
 * The audio track a fresh stream should start on: the remembered language first, then the
 * visitor's language order, then the stream's default flag, then the first track.
 * Returns -1 when there is nothing to switch (a single track).
 */
export function preferredAudioIndex(tracks, prefs = AUTO_AUDIO_ORDER) {
  if (!Array.isArray(tracks) || !tracks.length) return -1;
  if (tracks.length === 1) return -1; // nothing to switch to
  const want = (Array.isArray(prefs) ? prefs : [prefs]).map(normLang).filter(Boolean);
  for (const w of want) {
    const i = tracks.findIndex((t) => normLang(t && t.lang) === w);
    if (i >= 0) return i;
  }
  const def = tracks.findIndex((t) => t && (t.default === true || t.isDefault === true || t.autoselect === true));
  if (def >= 0) return def;
  return tracks.length > 1 ? 0 : -1;
}

/** A short fingerprint of a track list, so the player only re-reads the menu when it changed. */
export function trackSignature(tracks) {
  return (Array.isArray(tracks) ? tracks : [])
    .map((t) => `${normLang(t && t.lang)}:${String((t && t.name) || '').slice(0, 24)}`)
    .join('|');
}

/** Did the engine really land on the index we asked for? -1 (auto) is never "confirmed". */
export function isSwitched(current, wanted) {
  return Number.isInteger(current) && Number.isInteger(wanted) && wanted >= 0 && current === wanted;
}

/** "1080p", used where a level object may be missing. */
export function levelText(level, fallback = 'Auto') {
  const h = Number(level && level.height) || 0;
  if (!h) return fallback;
  if (h >= 2000) return '4K';
  return `${h}p`;
}

/** Does this engine let us change the picture at all? (native single-file MP4 does not) */
export function engineCanSwitch(engine, levelCount) {
  if (engine === 'hls' || engine === 'dash') return levelCount > 1;
  return false;
}
