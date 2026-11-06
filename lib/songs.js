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

/** The best available artwork. */
/** JioSaavn artwork quality is "50x50", "150x150", "500x500" — compare the actual pixel width. */
const artSize = (q) => {
  const m = String((q && q.quality) || q || '').match(/(\d+)\s*x\s*(\d+)/);
  if (m) return Number(m[1]) * Number(m[2]);
  const n = Number((q && q.quality) || 0);
  return Number.isFinite(n) ? n : 0;
};

export function songImage(song) {
  const list = Array.isArray(song && song.image) ? song.image : [];
  const sorted = [...list].sort((a, b) => artSize(b) - artSize(a));
  return https((sorted[0] && sorted[0].url) || (song && song.image) || '');
}

/** The best audio link (320kbps first, then 160, then whatever the mirror gave). */
export function songStream(song) {
  const direct = https(song && song.url);
  if (direct) return direct;
  const list = Array.isArray(song && song.downloadUrl) ? [...song.downloadUrl] : [];
  const rank = { '320kbps': 3, '160kbps': 2, '96kbps': 1, '48kbps': 0 };
  list.sort((a, b) => (rank[String((b && b.quality) || '').toLowerCase()] || 0) - (rank[String((a && a.quality) || '').toLowerCase()] || 0));
  return https((list[0] && list[0].link) || '');
}

export function songArtists(song) {
  const a = (song && song.artists) || {};
  const list = []
    .concat(Array.isArray(a.primary) ? a.primary : [])
    .concat(Array.isArray(a.featured) ? a.featured : [])
    .map((x) => String((x && x.name) || x || '').trim())
    .filter(Boolean);
  return [...new Set(list)].slice(0, 6);
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
  const id = String(raw.id || raw.songId || '').trim();
  const title = String(raw.name || raw.title || raw.song || '').trim().replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const stream = songStream(raw);
  if (!id || !title) return null;
  const artists = songArtists(raw);
  const album = String((raw.album && (raw.album.name || raw.album)) || '').trim();
  const duration = Math.max(0, Math.round(Number(raw.duration) || 0));
  return {
    id,
    slug: `${songSlug(title) || 'song'}-${id}`.slice(0, 110),
    title: title.slice(0, 140),
    artists,
    album: album.slice(0, 120),
    year: Math.max(1900, Math.min(2100, Number(raw.year) || 0)) || 0,
    language: String(raw.language || '').trim().slice(0, 40),
    duration,
    image: songImage(raw),
    stream,
    hasStream: Boolean(stream),
    permalink: raw.permalink || '',
    playCount: Math.max(0, Number(raw.playCount) || 0),
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
