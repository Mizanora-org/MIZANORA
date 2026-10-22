// THE LIVE POSITION OF THE QURAN SESSION (v23.1) - pure code, shared by the server route and the tests.
// One shared pointer { surah, ayah, atMs } (Firestore siteMeta/quranState). Everybody who opens the session joins at that place,
// the recitation goes on surah after surah, and when the admin's window ends the pointer stays where it was: the next window
// continues from exactly there instead of starting again.
import { SURAHS, TOTAL_AYAT, globalAyah, surahInfo } from './quran.js';

export const STATE_DOC = { collection: 'siteMeta', id: 'quranState' };
export const STALE_MS = 90 * 1000;      // nobody moved the pointer for this long: the next person may move it anywhere
export const SAVE_EVERY_MS = 8 * 1000;  // the server writes at most this often (visitors report every ayah)

export function cleanState(x) {
  const surah = Math.floor(Number(x && x.surah));
  if (!(surah >= 1 && surah <= 114)) return null;
  const max = surahInfo(surah).ayat;
  const ayah = Math.min(max, Math.max(1, Math.floor(Number(x && x.ayah)) || 1));
  return { surah, ayah, atMs: Math.max(0, Number(x && x.atMs) || 0) };
}
export const posOf = (s) => globalAyah(s.surah, s.ayah);

// Is `next` an honest step forward from `cur` (same ayah, the following ones, or the wrap 114 -> 1)? Anything else is refused,
// unless the stored pointer is old. So one visitor can never throw the whole radio to another surah.
export function acceptMove(cur, next, now = Date.now()) {
  if (!next) return false;
  if (!cur) return true;
  if (now - cur.atMs > STALE_MS) return true;
  const a = posOf(cur), b = posOf(next);
  const d = b - a;
  return (d >= 0 && d <= 3) || (a > TOTAL_AYAT - 4 && b <= 4);
}

// The place where a new window starts: the saved pointer, or the admin's own start when there is none.
export function startPoint(cfg, saved) {
  const s = cleanState(saved);
  if (s) return { surah: s.surah, ayah: s.ayah, resumed: true };
  return { surah: cfg.surah, ayah: cfg.from || 1, resumed: false };
}
export { SURAHS };
