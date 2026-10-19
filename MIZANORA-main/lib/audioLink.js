// ONE place for all the rules about "give me a direct audio file link".
//
// Both the reels music (lib/reelMusic.js) and the app background music (lib/appMusic.js) use these
// helpers, so the admin always gets the same message and the same conversion.
//
// WHAT COUNTS AS A DIRECT LINK
//   https://host/song.mp3        yes
//   https://host/song.mp3?x=1    yes (the query string is allowed)
//   https://host/page.html       no  (a web page is not an audio file)
//   http://host/song.mp3         no  (the shop is https, so http would be blocked as mixed content)
//
// SHARED LINKS THAT ARE CONVERTED AUTOMATICALLY
//   Google Drive  -> drive.google.com/uc?export=download&id=...
//   Dropbox       -> dl.dropboxusercontent.com/...&raw=1
//
// NOTE: a link is only CHECKED here (extension + https). The browser still decides whether it can
// play the file, so the admin should always use the "Test play" button before saving.

const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav)(\?|#|$)/i;
// Hosts we accept even without a file extension in the link (their direct links look like a page).
const KNOWN_HOSTS = /dl\.dropboxusercontent\.com|drive\.google\.com\/uc/i;

/** True when the text looks like a link to an audio FILE we can play in the browser. */
export function isAudioLink(url) {
  return AUDIO_EXT.test(String(url || '')) || KNOWN_HOSTS.test(String(url || ''));
}

/**
 * Turns a share link into a direct download link when we can.
 * Google Drive and Dropbox give a web page for shared files; the browser cannot play that.
 */
export function normalizeAudioUrl(raw) {
  const u = String(raw || '').trim();
  const m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/i) || u.match(/drive\.google\.com\/open\?id=([\w-]+)/i);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  if (/dropbox\.com\//i.test(u)) {
    return u
      .replace(/^https?:\/\/(www\.)?dropbox\.com\//i, 'https://dl.dropboxusercontent.com/')
      .replace(/([?&])dl=0/, '$1raw=1');
  }
  return u;
}

/**
 * The one check used by every music form.
 * Returns { ok: true, value: { url, ... } } or { ok: false, error: 'why it is not accepted' }.
 * `value.url` is the CONVERTED link, so the admin sees exactly what the shop will use.
 */
export function checkAudioUrl(raw) {
  const url = normalizeAudioUrl(raw);
  if (!url) return { ok: false, error: 'No link yet.' };
  if (!/^https:\/\/[^\s]+$/i.test(url)) return { ok: false, error: 'The music link must start with https://' };
  if (url.length > 600) return { ok: false, error: 'The music link is too long.' };
  if (!isAudioLink(url)) {
    return {
      ok: false,
      error: 'This does not look like a direct audio file link. It should end with .mp3, .m4a, .ogg or .wav (for example from Cloudinary or your own hosting).',
    };
  }
  return { ok: true, value: url };
}

/** Volume from the admin form: a whole number between 0 and 100. */
export function clampVolume(v, fallback = 30) {
  let n = Math.round(Number(v));
  if (!Number.isFinite(n)) n = fallback;
  return Math.min(100, Math.max(0, n));
}
