// v37: XTREAM CODES (XC) - the IPTV panel login everybody uses.
// Mizanora Live TV could only read an M3U file or a link. Now the admin can also type the three
// things every IPTV provider hands out - server, username, password - and the shop pulls the
// channel list itself, the same way IPTV Smarters, TiviMate and OTT Navigator do.
//
//   server    https://barakatwave.vercel.app   (or http://host:port)
//   username  the Xtream username
//   password  the Xtream password
//
// This file is the PURE model: no fetch, no fs, no secrets after use. It builds the API links,
// reads the answers, and turns them into Mizanora channels. lib/xtreamServer.js does the network
// part (with the private-address guard), and app/api/admin/tv/xtream is the admin-only route.
//
// XC API shape (v2, what every panel speaks):
//   GET {base}/player_api.php?username=..&password=..                -> { user_info, server_info }
//   GET {base}/player_api.php?username=..&password=..&action=get_live_categories
//   GET {base}/player_api.php?username=..&password=..&action=get_live_streams
//   GET {base}/player_api.php?username=..&password=..&action=get_vod_streams        (movies)
//   GET {base}/player_api.php?username=..&password=..&action=get_series             (series)
//   stream   {base}/live/{user}/{pass}/{stream_id}.m3u8
//   movie    {base}/movie/{user}/{pass}/{stream_id}.{ext}
//   episode  {base}/series/{user}/{pass}/{stream_id}.{ext}
//   playlist {base}/get.php?username=..&password=..&type=m3u_plus&output=ts
//   epg      {base}/xmltv.php?username=..&password=..

export const XTREAM_ACTIONS = {
  liveStreams: 'get_live_streams',
  liveCategories: 'get_live_categories',
  vodStreams: 'get_vod_streams',
  vodCategories: 'get_vod_categories',
  series: 'get_series',
  seriesCategories: 'get_series_categories',
};

export const XTREAM_LIMITS = { channels: 2000, name: 70, group: 40, logo: 400, url: 600 };
export const XTREAM_TIMEOUT_MS = 20000;
export const XTREAM_MAX_BYTES = 8 * 1024 * 1024; // a big panel list is ~4 MB

// ---------------------------------------------------------------------------
// input cleaning
// ---------------------------------------------------------------------------
const oneLine = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

/**
 * The server address. People paste it in every shape there is:
 *   "http://host:8080", "host:8080", "https://host/", "host/live/u/p/123.m3u8".
 * Returns { base, host, port, secure } or null when it is not usable.
 */
export function parseXtreamServer(raw) {
  const s = oneLine(raw);
  if (!s || s.length > 300) return null;
  let u;
  try {
    u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `http://${s}`);
  } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname) return null;
  // The private-address check happens in lib/xtreamServer.js, where DNS can actually be resolved.
  // keep only the origin: any path in a panel address is the portal UI, not the API root
  const base = `${u.protocol}//${u.host}`.replace(/\/+$/, '');
  return {
    base,
    host: u.hostname,
    port: u.port || (u.protocol === 'https:' ? '443' : '80'),
    secure: u.protocol === 'https:',
  };
}

export const cleanXtreamUser = (v) => oneLine(v).replace(/[^\w.@+-]/g, '').slice(0, 64);
// XC passwords can hold almost anything, but never whitespace and never a & (it would break the query)
export const cleanXtreamPass = (v) => oneLine(v).replace(/[&?#\s'"<>]/g, '').slice(0, 128);

/** The three inputs, cleaned together. Returns null with a reason when something is missing. */
export function cleanXtreamCreds(input = {}) {
  const server = parseXtreamServer(input.server);
  if (!server) return { ok: false, error: 'Server address is not usable. Example: http://your-panel.com:8080' };
  const username = cleanXtreamUser(input.username);
  const password = cleanXtreamPass(input.password);
  if (!username) return { ok: false, error: 'Username is required.' };
  if (!password) return { ok: false, error: 'Password is required.' };
  return { ok: true, server, username, password };
}

// ---------------------------------------------------------------------------
// link building
// ---------------------------------------------------------------------------
const qs = (pairs) => pairs.filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

export const xtreamApiUrl = (creds, action = '') => {
  const { server, username, password } = creds;
  const q = qs([['username', username], ['password', password], ...(action ? [['action', action]] : [])]);
  return `${server.base}/player_api.php?${q}`;
};

/** The account check: no action means "who am I". */
export const xtreamAccountUrl = (creds) => xtreamApiUrl(creds);

/** An M3U Plus playlist straight from the panel (handy for VLC / other players). */
export const xtreamPlaylistUrl = (creds, output = 'ts') =>
  `${creds.server.base}/get.php?${qs([['username', creds.username], ['password', creds.password], ['type', 'm3u_plus'], ['output', output]])}`;

/** The XMLTV electronic programme guide. */
export const xtreamEpgUrl = (creds) =>
  `${creds.server.base}/xmltv.php?${qs([['username', creds.username], ['password', creds.password]])}`;

/** One live stream. `.m3u8` where the panel supports HLS, `.ts` otherwise. */
export const xtreamStreamUrl = (creds, streamId, ext = 'm3u8') =>
  `${creds.server.base}/live/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${encodeURIComponent(String(streamId))}.${ext}`;

export const xtreamMovieUrl = (creds, streamId, ext = 'mkv') =>
  `${creds.server.base}/movie/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${encodeURIComponent(String(streamId))}.${ext || 'mkv'}`;

export const xtreamEpisodeUrl = (creds, streamId, ext = 'mkv') =>
  `${creds.server.base}/series/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${encodeURIComponent(String(streamId))}.${ext || 'mkv'}`;

// ---------------------------------------------------------------------------
// reading the answers
// ---------------------------------------------------------------------------
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * The account answer. A panel replies with JSON even for a failed login, so the auth flag is
 * what matters, not the HTTP status.
 */
export function readXtreamAccount(json) {
  const j = json && typeof json === 'object' ? json : {};
  const u = j.user_info && typeof j.user_info === 'object' ? j.user_info : {};
  const s = j.server_info && typeof j.server_info === 'object' ? j.server_info : {};
  if (Object.keys(u).length === 0 && Object.keys(s).length === 0) {
    return { ok: false, auth: 0, error: 'This server did not answer like an Xtream Codes panel.' };
  }
  const auth = num(u.auth);
  const status = String(u.status || '').toLowerCase();
  const expMs = num(u.exp_date) ? num(u.exp_date) * 1000 : 0;
  return {
    ok: auth === 1 && status !== 'disabled' && status !== 'banned',
    auth,
    status: status || (auth === 1 ? 'active' : 'inactive'),
    username: String(u.username || '').slice(0, 64),
    message: String(u.message || '').slice(0, 200),
    maxConnections: num(u.max_connections),
    activeConnections: num(u.active_cons),
    isTrial: num(u.is_trial) === 1,
    expiresAtMs: expMs,
    expired: expMs > 0 && expMs < Date.now(),
    allowedOutput: Array.isArray(u.allowed_output_formats) ? u.allowed_output_formats.map((x) => String(x)).slice(0, 8) : [],
    serverUrl: String(s.url || '').slice(0, 300),
    serverPort: String(s.port || '').slice(0, 8),
    httpsPort: String(s.https_port || '').slice(0, 8),
    timezone: String(s.timezone || '').slice(0, 60),
    serverTime: String(s.time_now || '').slice(0, 40),
  };
}

/** category_id -> category_name */
export function readXtreamCategories(json, max = 200) {
  const list = Array.isArray(json) ? json : [];
  const map = new Map();
  for (const c of list) {
    const id = String((c && (c.category_id != null ? c.category_id : c.id)) || '').trim();
    const name = oneLine(c && (c.category_name != null ? c.category_name : c.name)).slice(0, XTREAM_LIMITS.group);
    if (id && name && !map.has(id)) map.set(id, name);
    if (map.size >= max) break;
  }
  return map;
}

/**
 * Live streams -> Mizanora channels. `cleanChannel` from lib/liveTv does the final validation,
 * so anything malformed is dropped there rather than here.
 */
export function readXtreamStreams(json, creds, categories = new Map(), opts = {}) {
  const list = Array.isArray(json) ? json : [];
  const only = Array.isArray(opts.categories) && opts.categories.length ? new Set(opts.categories.map(String)) : null;
  const ext = opts.hls === false ? 'ts' : 'm3u8';
  const out = [];
  const skipped = { noId: 0, noName: 0, filtered: 0 };
  for (const s of list) {
    if (out.length >= XTREAM_LIMITS.channels) break;
    const id = String((s && (s.stream_id != null ? s.stream_id : s.id)) || '').trim();
    const name = oneLine(s && (s.name != null ? s.name : s.title)).slice(0, XTREAM_LIMITS.name);
    if (!id || !/^\d+$/.test(id)) { skipped.noId += 1; continue; }
    if (!name) { skipped.noName += 1; continue; }
    const catId = String((s && (s.category_id != null ? s.category_id : s.category_ids)) || '').split(',')[0].trim();
    const group = categories.get(catId) || oneLine(s.category_name).slice(0, XTREAM_LIMITS.group) || 'Live';
    if (only && !only.has(catId)) { skipped.filtered += 1; continue; }
    const logo = /^https?:\/\//i.test(String(s.stream_icon || '')) ? String(s.stream_icon).slice(0, XTREAM_LIMITS.logo) : '';
    out.push({
      name,
      url: xtreamStreamUrl(creds, id, ext),
      sources: [],
      logo,
      group,
      off: false,
      // kept for the UI + the import report; cleanChannel quietly drops what it does not keep
      xtreamId: id,
      epgId: String(s.epg_channel_id || '').slice(0, 60),
      archive: num(s.tv_archive) === 1,
    });
  }
  return { channels: out, skipped };
}

/**
 * Movies / series from the same login, folded into the same channel shape so the shop can list
 * them. They are VOD, not live TV, so they are marked and can be filtered out at import time.
 */
export function readXtreamVod(json, creds, categories = new Map(), kind = 'movie', opts = {}) {
  const list = Array.isArray(json) ? json : [];
  const only = Array.isArray(opts.categories) && opts.categories.length ? new Set(opts.categories.map(String)) : null;
  const out = [];
  for (const s of list) {
    if (out.length >= XTREAM_LIMITS.channels) break;
    const id = String((s && (s.stream_id != null ? s.stream_id : s.id)) || '').trim();
    const name = oneLine(s && s.name).slice(0, XTREAM_LIMITS.name);
    if (!id || !name) continue;
    const catId = String((s && s.category_id) || '').split(',')[0].trim();
    const group = categories.get(catId) || 'Cinema';
    if (only && !only.has(catId)) continue;
    const ext = String(s.container_extension || 'mkv').replace(/[^a-z0-9]/gi, '').slice(0, 6) || 'mkv';
    const url = kind === 'series' ? xtreamEpisodeUrl(creds, id, ext) : xtreamMovieUrl(creds, id, ext);
    out.push({
      name, url, sources: [],
      logo: /^https?:\/\//i.test(String(s.stream_icon || '')) ? String(s.stream_icon).slice(0, XTREAM_LIMITS.logo) : '',
      group, off: false, xtreamId: id, vod: kind,
    });
  }
  return out;
}

/**
 * Everything the "Test connection" button needs, in one shape.
 * `counts` is what the admin sees before importing anything.
 */
export function xtreamPreview({ account, live = [], vod = [], series = [] }) {
  const groups = new Map();
  for (const c of live) groups.set(c.group, (groups.get(c.group) || 0) + 1);
  return {
    account,
    counts: { live: live.length, vod: vod.length, series: series.length },
    groups: [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([name, count]) => ({ name, count })),
  };
}

/**
 * Merge imported channels into what the shop already has.
 *  - `replace`: the imported list becomes the channel list;
 *  - `merge`  : existing channels are kept, new ones (by stream URL) are appended, and a
 *               channel that already exists gets its logo / group refreshed, never duplicated.
 */
export function mergeXtreamChannels(existing = [], incoming = [], mode = 'merge', max = 800) {
  const old = Array.isArray(existing) ? existing : [];
  const fresh = Array.isArray(incoming) ? incoming : [];
  if (mode === 'replace') return fresh.slice(0, max);
  const byUrl = new Map();
  for (const c of old) if (c && c.url) byUrl.set(c.url, c);
  let added = 0;
  let updated = 0;
  for (const c of fresh) {
    if (!c || !c.url) continue;
    if (byUrl.has(c.url)) {
      const prev = byUrl.get(c.url);
      const next = { ...prev };
      if (!prev.logo && c.logo) { next.logo = c.logo; updated += 1; }
      if (c.group && c.group !== 'Live' && !prev.group) { next.group = c.group; updated += 1; }
      byUrl.set(c.url, next);
      continue;
    }
    if (byUrl.size >= max) break;
    byUrl.set(c.url, c);
    added += 1;
  }
  return { channels: [...byUrl.values()], added, updated };
}

/** Never log or echo a password back to the browser. */
export const maskXtream = (creds) => ({
  server: creds && creds.server ? creds.server.base : '',
  username: creds ? creds.username : '',
  password: creds && creds.password ? '•'.repeat(Math.min(12, Math.max(6, creds.password.length))) : '',
});
