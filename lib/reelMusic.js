// Mizanora background music for the reels (pure code: used by the admin page AND the server, so both agree).
//
// The admin pastes a DIRECT audio link (ends in .mp3 / .m4a / .aac / .ogg / .wav). While a reel is playing:
//   - a reel WITH sound  -> the Mizanora music stays silent (the reel's own audio wins)
//   - a reel WITHOUT sound (silent .mp4) -> the Mizanora music plays behind it
// Stored in Firestore: siteMeta/reelMusic  (readable by everyone, written only by the admin).
//
// The link rules live in lib/audioLink.js, shared with the app background music (lib/appMusic.js).

import { checkAudioUrl, clampVolume, normalizeAudioUrl } from './audioLink.js';

export const REEL_MUSIC_DOC = { collection: 'siteMeta', id: 'reelMusic' };
export const REEL_MUSIC_DEFAULT = { enabled: true, url: '', title: 'Mizanora music', volume: 35 };

// Google Drive and Dropbox "share" pages are web pages, not audio files. Turn them into direct links when we can.
// The old name (normalizeMusicUrl) is kept as well, so nothing that imported it before breaks.
export { normalizeAudioUrl, normalizeAudioUrl as normalizeMusicUrl };

// Cleans what the admin typed. Returns { ok, value, error }. Nothing unsafe gets saved (only http(s) links).
export function cleanReelMusic(input = {}) {
  const x = input || {};
  const enabled = x.enabled !== false;
  const volume = clampVolume(x.volume, REEL_MUSIC_DEFAULT.volume);
  const title = String(x.title || '').replace(/\s+/g, ' ').trim().slice(0, 60) || REEL_MUSIC_DEFAULT.title;
  const check = checkAudioUrl(x.url);
  if (!check.ok) {
    // An EMPTY link is not an error: it simply means "no music".
    if (!String(x.url || '').trim()) return { ok: true, value: { enabled: false, url: '', title, volume } };
    return { ok: false, error: check.error };
  }
  return { ok: true, value: { enabled, url: check.value, title, volume } };
}

// Gives the viewer only what it needs (volume as 0..1).
export function musicForViewer(cfg) {
  const c = { ...REEL_MUSIC_DEFAULT, ...(cfg || {}) };
  const url = c.enabled !== false && /^https:\/\//i.test(String(c.url || '')) ? String(c.url) : '';
  return { url, title: String(c.title || REEL_MUSIC_DEFAULT.title), volume: Math.min(1, Math.max(0, (Number(c.volume) || 0) / 100)) };
}
