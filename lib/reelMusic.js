// Mizanora background music for the reels (pure code: used by the admin page AND the server, so both agree).
//
// The admin pastes a DIRECT audio link (ends in .mp3 / .m4a / .aac / .ogg / .wav / .opus). While a reel is playing:
//   - a reel WITH sound  -> the Mizanora music stays silent (the reel's own audio wins)
//   - a reel WITHOUT sound (silent .mp4) -> the Mizanora music plays behind it
// Stored in Firestore: siteMeta/reelMusic  (readable by everyone, written only by the admin).

export const REEL_MUSIC_DOC = { collection: 'siteMeta', id: 'reelMusic' };
export const REEL_MUSIC_DEFAULT = { enabled: true, url: '', title: 'Mizanora music', volume: 35 };

const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav)(\?|#|$)/i;

// Google Drive and Dropbox "share" pages are web pages, not audio files. Turn them into direct links when we can.
export function normalizeMusicUrl(raw) {
  const u = String(raw || '').trim();
  let m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/i) || u.match(/drive\.google\.com\/open\?id=([\w-]+)/i);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  if (/dropbox\.com\//i.test(u)) return u.replace(/^https?:\/\/(www\.)?dropbox\.com\//i, 'https://dl.dropboxusercontent.com/').replace(/([?&])dl=0/, '$1raw=1');
  return u;
}

// Cleans what the admin typed. Returns { ok, value, error }. Nothing unsafe gets saved (only http(s) links).
export function cleanReelMusic(input = {}) {
  const x = input || {};
  const url = normalizeMusicUrl(x.url);
  const enabled = x.enabled !== false;
  let volume = Math.round(Number(x.volume));
  if (!Number.isFinite(volume)) volume = REEL_MUSIC_DEFAULT.volume;
  volume = Math.min(100, Math.max(0, volume));
  const title = String(x.title || '').replace(/\s+/g, ' ').trim().slice(0, 60) || REEL_MUSIC_DEFAULT.title;
  if (!url) return { ok: true, value: { enabled: false, url: '', title, volume } };
  if (!/^https:\/\/[^\s]+$/i.test(url)) return { ok: false, error: 'The music link must start with https://' };
  if (url.length > 600) return { ok: false, error: 'The music link is too long.' };
  if (!AUDIO_EXT.test(url) && !/dl\.dropboxusercontent\.com|drive\.google\.com\/uc/i.test(url)) {
    return { ok: false, error: 'This does not look like a direct audio file link. It should end with .mp3, .m4a, .ogg or .wav (for example from Cloudinary or your own hosting).' };
  }
  return { ok: true, value: { enabled, url, title, volume } };
}

// Gives the viewer only what it needs (volume as 0..1).
export function musicForViewer(cfg) {
  const c = { ...REEL_MUSIC_DEFAULT, ...(cfg || {}) };
  const url = c.enabled !== false && /^https:\/\//i.test(String(c.url || '')) ? String(c.url) : '';
  return { url, title: String(c.title || REEL_MUSIC_DEFAULT.title), volume: Math.min(1, Math.max(0, (Number(c.volume) || 0) / 100)) };
}
