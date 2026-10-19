// Mizanora APP background music (pure code: used by the admin page AND the server, so both agree).
//
// WHAT THIS IS
// The admin pastes ONE direct audio link in "Admin > Music". From then on the whole shop plays that
// track quietly in the background while people browse: home, products, categories, cart, blog...
// It is stored in Firestore in siteMeta/appMusic (readable by everyone, written only by the admin).
//
// HOW IT BEHAVES
//   - the header has a music button: the shopper can switch the music on/off, and the choice is
//     remembered on the device (localStorage key "mz_app_music")
//   - browsers do not allow sound before the first tap, so the music starts after the first touch
//   - the full-screen reels have their own music, so the background music steps aside there
//   - the volume is set by the admin (0-100%) and the shopper can still silence it
//
// The link rules live in lib/audioLink.js, shared with the reels music (lib/reelMusic.js).

import { checkAudioUrl, clampVolume, normalizeAudioUrl } from './audioLink.js';

export const APP_MUSIC_DOC = { collection: 'siteMeta', id: 'appMusic' };
export const APP_MUSIC_DEFAULT = { enabled: true, url: '', title: 'Mizanora music', volume: 20, autoplay: true };

// The shopper's on/off choice is stored on the device under this key.
export const APP_MUSIC_KEY = 'mz_app_music';

export { normalizeAudioUrl, normalizeAudioUrl as normalizeMusicUrl };

// Cleans what the admin typed. Returns { ok, value, error }.
// An empty link is allowed: it means "no music" (the switch goes off).
export function cleanAppMusic(input = {}) {
  const x = input || {};
  const enabled = x.enabled !== false;
  const autoplay = x.autoplay !== false;
  const volume = clampVolume(x.volume, APP_MUSIC_DEFAULT.volume);
  const title = String(x.title || '').replace(/\s+/g, ' ').trim().slice(0, 60) || APP_MUSIC_DEFAULT.title;
  const check = checkAudioUrl(x.url);
  if (!check.ok) {
    if (!String(x.url || '').trim()) return { ok: true, value: { enabled: false, url: '', title, volume, autoplay } };
    return { ok: false, error: check.error };
  }
  return { ok: true, value: { enabled, url: check.value, title, volume, autoplay } };
}

// Gives the browser only what it needs (volume as 0..1, no server-only fields).
export function musicForViewer(cfg) {
  const c = { ...APP_MUSIC_DEFAULT, ...(cfg || {}) };
  const url = c.enabled !== false && /^https:\/\//i.test(String(c.url || '')) ? String(c.url) : '';
  return {
    url,
    title: String(c.title || APP_MUSIC_DEFAULT.title),
    volume: Math.min(1, Math.max(0, (Number(c.volume) || 0) / 100)),
    autoplay: c.autoplay !== false,
  };
}
