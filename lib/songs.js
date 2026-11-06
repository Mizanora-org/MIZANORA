// Mizanora v54 — the Songs section.
// A song arrives from a public JioSaavn-style catalogue (saavn.dev mirrors) in a shape like:
//   { id, name, duration, year, language, url, image: [{quality, url}], downloadUrl: [...],
//     artists: { primary: [{name}] }, album: { name } }
// Everything is normalised here so the pages, the player and the sitemap all read one object.

export const SONG_QUERIES = [
  'Atif Aslam', 'Coke Studio Pakistan', 'Arijit Singh', 'Nusrat Fateh Ali Khan', 'Rahat Fateh Ali Khan',
  'Shreya Ghoshal', 'Punjabi hits', 'Bollywood 2026', 'Urdu ghazal', 'Lofi hindi', 'Ali Zafar', 'Momina Mustehsan',
];

export const songSlug = (raw) => String(raw || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

const https = (u) => {
  const v = String(u || '').trim();
  if (!/^https?:\/\//i.test(v)) return '';
  return v.replace(/^http:\/\//i, 'https://'); // https pages cannot play http audio
};

/** HTML entities that mirrors leak into titles/artist names. */
export function decodeEntities(text) {
  return String(text || '')
    .replace(/&#(\d{2,5});/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ''; } })
    .replace(/&#x([0-9a-f]{2,5});/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ''; } })
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "3:33" / "213" / 213.4 -> seconds. Some mirrors send a clock string, some a number. */
export function parseDuration(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const t = String(value || '').trim();
  if (!t) return 0;
  const clock = t.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (clock) {
    const a = Number(clock[1]);
    const b = Number(clock[2]);
    const c = clock[3] === undefined ? null : Number(clock[3]);
    return c === null ? a * 60 + b : a * 3600 + b * 60 + c;
  }
  const n = Number(t.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** The catalogue hides the year in a release date half the time. */
export function parseYear(raw) {
  const direct = Number(raw && raw.year);
  if (direct >= 1900 && direct <= 2100) return direct;
  const date = String((raw && (raw.releaseDate || raw.releasedate || raw.released)) || '');
  const m = date.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : 0;
}

/** JioSaavn sends artists as objects, but some mirrors send one comma/&/feat. string. */
export function songArtists(song) {
  const names = [];
  const push = (value) => {
    if (!value) return;
    if (Array.isArray(value)) { value.forEach(push); return; }
    if (typeof value === 'object') { push(value.name || value.title || ''); return; }
    String(value)
      .split(/\s*(?:,|&|\+\s|\bfeat\.?\s|\bft\.?\s|\bfeaturing\b|\band\b|\bx\b)\s*/i)
      .map((x) => decodeEntities(x))
      .map((x) => x.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N})\]]+$/u, ''))
      .filter(Boolean)
      .forEach((x) => names.push(x));
  };
  const a = (song && song.artists) || {};
  push(a.primary);
  push(a.featured);
  push(a.all);
  push(song.primaryArtists);
  push(song.featuredArtists);
  push(song.singers);
  push(song.artist);
  push(song.singer);
  const unique = [...new Set(names.map((n) => n.replace(/\s+/g, ' ').trim()).filter((n) => n && n.length < 60))];
  return unique.slice(0, 6);
}

/** "hindi" -> "Hindi", "urdu" -> "Urdu" (leave odd all-caps alone). */
export function cleanLanguage(value) {
  const t = decodeEntities(value);
  if (!t) return '';
  return t.length <= 3 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1);
}

/** The best available artwork. */
/** JioSaavn artwork quality is "50x50", "150x150", "500x500" — compare the actual pixel width. */
const artSize = (q) => {
  const m = String((q && q.quality) || q || '').match(/(\d+)\s*x\s*(\d+)/);
  if (m) return Number(m[1]) * Number(m[2]);
  const n = Number((q && q.quality) || 0);
  return Number.isFinite(n) ? n : 0;
};

export function songImage(song) {
  if (!song) return '';
  const list = Array.isArray(song.image) ? song.image : [];
  if (list.length) {
    const sorted = [...list].sort((a, b) => artSize(b) - artSize(a));
    const best = sorted[0] || {};
    const url = https(best.url || best.link || best.src) || https(song.image) || '';
    if (url) return url;
  }
  return https(song.image_url || (song.more_info && (song.more_info.image || song.more_info.image_url)) || song.image || '');
}

/** The best audio link (320kbps first, then 160, then whatever the mirror gave). */
export function songStream(song) {
  if (!song) return '';
  const direct = https(song.url);
  const list = Array.isArray(song.downloadUrl) ? [...song.downloadUrl] : [];
  const rank = { '320kbps': 5, '160kbps': 4, '96kbps': 3, '48kbps': 2, '12kbps': 1 };
  list.sort((a, b) => (rank[String((b && b.quality) || '').toLowerCase()] || 0) - (rank[String((a && a.quality) || '').toLowerCase()] || 0));
  // v58: mirrors disagree — some send {quality, link}, others {quality, url}. Accept both, then the
  // legacy media fields, then (last resort) the 30-second preview.
  const fromList = https((list[0] && (list[0].link || list[0].url)) || '');
  const media = https(song.media_url || song.mediaUrl || '');
  const info = (song.more_info && typeof song.more_info === 'object') ? song.more_info : {};
  const preview = https(info.vlink || info.media_url || info.media_preview_url || '');
  return fromList || direct || media || preview;
}


/** True for JioSaavn's own CDNs — those need our proxy, everything else can go through the image relay. */
const CDN_RE = /(^|\.)(saavncdn|jiosaavn)\.(com|in)$/i;

/**
 * v58 — a same-origin URL for a catalogue file.
 * Audio and artwork live on CDNs that intermittently block third-party <audio>/<img> requests, so both
 * are routed through our own routes (host-locked, range-aware, edge-cached). The visitor's browser
 * then only ever talks to mizanora.vercel.app, exactly like the reference site.
 */
export function cdnProxy(rawUrl) {
  const u = https(rawUrl);
  if (!u) return '';
  try {
    const host = new URL(u).hostname.toLowerCase();
    if (CDN_RE.test(host)) return `/api/songs/cdn?url=${encodeURIComponent(u)}`;
  } catch { /* fall through to the generic relay */ }
  return `/api/img?u=${encodeURIComponent(u)}`;
}

/** Every playable quality, best first, already routed through our domain. */
export function songAudioSources(song) {
  if (!song) return [];
  const rank = { '320kbps': 5, '160kbps': 4, '96kbps': 3, '48kbps': 2, '12kbps': 1 };
  const list = Array.isArray(song.downloadUrl) ? [...song.downloadUrl] : [];
  list.sort((a, b) => (rank[String((b && b.quality) || '').toLowerCase()] || 0) - (rank[String((a && a.quality) || '').toLowerCase()] || 0));
  const info = (song.more_info && typeof song.more_info === 'object') ? song.more_info : {};
  const urls = [song.url, ...list.map((q) => (q && (q.link || q.url)) || ''), song.media_url, info.vlink, info.media_url].map(https).filter(Boolean);
  return [...new Set(urls)].slice(0, 4).map(cdnProxy).filter(Boolean);
}

/** The artwork URL a component should render (falls back to the raw link). */
export function songImageSrc(song) {
  if (!song) return '';
  if (song.imageSrc) return song.imageSrc;
  const raw = song.image || '';
  return raw ? (cdnProxy(raw) || raw) : '';
}

/** 213 -> "3:33", 3725 -> "1:02:05". */
export function clockTime(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}

/** One raw song -> the card/page object. Returns null when there is nothing playable. */
export function cleanSong(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || raw.songId || raw.songid || '').trim();
  const title = decodeEntities(raw.name || raw.title || raw.song || '').replace(/\s+/g, ' ');
  const stream = songStream(raw);
  if (!id || !title) return null;
  const artists = songArtists(raw);
  const album = decodeEntities((raw.album && (raw.album.name || raw.album)) || raw.albumName || '');
  const duration = parseDuration(raw.duration || raw.durationSeconds || raw.length);
  const year = parseYear(raw);
  const image = songImage(raw);
  return {
    id,
    slug: `${songSlug(title) || 'song'}-${id}`.slice(0, 110),
    title: title.slice(0, 140),
    artists,
    album: album.slice(0, 120),
    year,
    language: cleanLanguage(raw.language || (raw.more_info && raw.more_info.language) || '').slice(0, 40),
    duration,
    image,
    // v58: same-origin artwork + every playable quality behind our CDN proxy (this is what fixed
    // blank album art and songs that silently refused to play on some networks).
    imageSrc: cdnProxy(image),
    audioSources: songAudioSources(raw),
    stream,
    // v57: this is what the player renders in feeds, queue and the mini player — one source of truth.
    artistLine: artists.join(', ') || 'Unknown artist',
    durationText: clockTime(duration),
    // v56: always play through our own route first — it fetches a fresh CDN token every time, so a
    // shared link never plays a dead URL, and it avoids CORS/hotlink blocks on the visitor's network.
    playUrl: `/api/songs/audio/${encodeURIComponent(id)}`,
    proxyUrl: `/api/songs/audio/${encodeURIComponent(id)}?proxy=1`,
    hasStream: Boolean(stream),
    permalink: raw.permalink || (raw.more_info && raw.more_info.permalink) || '',
    playCount: Math.max(0, Number(raw.playCount) || Number(raw.play_count) || 0),
  };
}

/** Song list from any mirror shape (results / songs / data). */
export function songsFromPayload(payload) {
  const data = payload && payload.data ? payload.data : payload;
  const list = (data && (data.results || data.songs)) || (Array.isArray(data) ? data : []) || [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const song = cleanSong(raw);
    if (!song || seen.has(song.id)) continue;
    seen.add(song.id);
    out.push(song);
  }
  return out;
}


/** "Atif Aslam" -> "atif-aslam" (used for /songs/artist/... pages). */
export const artistSlug = (name) => songSlug(String(name || '').replace(/&amp;/g, '&'));

/** "atif-aslam" -> "Atif Aslam" (best effort; the search API does the real matching). */
export const artistNameFromSlug = (slug) => String(slug || '')
  .split('-')
  .filter(Boolean)
  .map((w) => (/^(and|of|the|ka|ki)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
  .join(' ');

/** The id embedded in a /songs/<slug>-<id> address. */
export function songIdFromSlug(slug) {
  const s = String(slug || '').trim();
  const m = s.match(/-([A-Za-z0-9]{6,})$/);
  return m ? m[1] : (/^[A-Za-z0-9]{6,}$/.test(s) ? s : '');
}
