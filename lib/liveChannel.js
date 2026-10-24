// QURAN & HADITH LIVE CHANNEL (v27). Pure code: the admin panel, the server routes, the player, the m3u8 generator, the
// YouTube cast script and the tests all read THIS file, so every one of them agrees about what is on air right now.
//
// WHAT IT IS
// A 24/7 style TV channel inside the shop: live Quran tilawat, then a hadith reading, then a short product ad break,
// then it repeats - like a real channel. The Mizanora logo, a LIVE badge and a ticking PAKISTAN clock sit on top of the
// screen the whole time. The schedule (what plays when) is fully deterministic from the wall clock: two visitors who open
// the channel at the same second see the same ayah, the same hadith and the same product - exactly like a broadcast.
//
// THE LIVE M3U8 STREAM
// buildM3U8() writes a real HLS playlist of the programming (audio files of the ayat from the Islamic Network CDN, and
// the AI voiceovers of the hadith and the ads from this site). VLC, ffmpeg, any HLS player - and YouTube through the
// cast script - can play it. .github/workflows/live-channel.yml is the "action" that runs it on a schedule and pushes
// it live to YouTube with ffmpeg (see scripts/live-cast.mjs).
//
// HOW THE PROGRAM IS COMPUTED (nothing is stored, nothing can drift between visitors)
//   The wall-clock second is split into repeating cycles: [Quran tilawat | Hadith | Ad break] again and again.
//   Every cycle is numbered from the epoch, so "cycle 273891, second 420" is the same moment for everyone on earth.
//   Inside a cycle the Quran seconds of ALL cycles so far give one long, endless tilawat that walks through the whole
//   Quran (about AYAH_SEC seconds per ayah) and wraps at the end back to the admin's start surah.
//   The cycle number also chooses the hadith book/section and the advertised product, so the rotation is even and fair.
//
// Pakistan time (UTC+5, no daylight saving) is used everywhere - the windows the admin draws, the clock on the screen
// and the GitHub Action's cron all mean Pakistan time.
import { RECITERS, SURAHS, TOTAL_AYAT, audioUrl, cleanWindows, globalAyah, karachiParts, surahInfo } from './quran.js';
import { BOOKS, okLang } from './hadith.js';

export const CHANNEL_DOC = { collection: 'siteMeta', id: 'liveChannel' };
export const VOICE_DOC = { collection: 'liveVoices' }; // {id} meta + {id}/chunks/{n} audio, see lib/liveChannelServer.js

export const AYAH_SEC = 8;          // an average ayah of recitation is about this long (used for the wall-clock program)
export const MAX_ADS = 30;
export const THEMES = [['emerald', 'Emerald (green and gold)'], ['night', 'Night sky (dark blue and gold)'], ['gold', 'Cream and gold']];
export const MODES = [['schedule', 'Only at the times below (Pakistan time)'], ['always', 'Always on air'], ['off', 'Off']];
export const TTS_VOICES = ['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir', 'Leda', 'Orus', 'Zephyr'];
export const YT_PRIVACY = [['public', 'Public'], ['unlisted', 'Unlisted'], ['private', 'Private']];

const BOOK_KEYS = BOOKS.map((b) => b.key);
const RECITER_IDS = new Set(RECITERS.map((r) => r[0]));

export const CHANNEL_DEFAULT = {
  mode: 'schedule',
  windows: [{ start: '05:00', end: '12:00', days: [] }, { start: '19:00', end: '23:30', days: [] }],
  liveUntil: 0,
  title: 'Mizanora Quran & Hadith Live',
  slogan: 'Tilawat, Hadees aur Dua — poori dunya ke liye',
  theme: 'emerald',
  ticker: '',                 // custom ticker text (empty = the built-in lines)
  quranMin: 18,               // one tilawat block
  hadithMin: 6,               // one hadith reading block
  startSurah: 1,              // where the endless rotation begins
  reciter: 'ar.alafasy',
  translation: 'ur.jalandhry',
  hadith: { books: ['bukhari', 'muslim', 'nawawi'], lang: 'urd', voiceName: 'Kore' },
  ads: { enabled: true, slugs: [], seconds: 45, voiceName: 'Kore' },
  youtube: { privacy: 'public', title: '', last: null }, // last = the broadcast the admin created from the panel (id + rtmp + key)
  showClock: true,
};

// The lines that crawl at the bottom of the channel. Short, true, with references - never invented.
export const TICKER_DEFAULT = [
  'MIZANORA — Shop Smart. Shop Halal.',
  'Quran aur Ahadees ki live tilawat — 24 ghante ke program ke sath',
  'Rasoolullah ﷺ: "Achhi baat kahna bhi sadaqa hai." (Sahih al-Bukhari 6018)',
  'Apne Rab ka zikr karo, subah aur shaam (Surah Al-Ahzab 41-42)',
  'Halal kamao, halal khao — barkat zindagi mein aati hai',
  'Har ad mein Mizanora ke asli products, seedha order WhatsApp par',
];

const txt = (v, n, d = '') => String(v == null ? d : v).replace(/<\/?[a-z][^>]*>/gi, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const intIn = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const hhmm = (v, d) => { const m = String(v || '').match(/^(\d{1,2}):(\d{2})$/); if (!m) return d; const h = Number(m[1]); const mi = Number(m[2]); return h > 23 || mi > 59 ? d : `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`; };
const slugOk = (s) => /^[A-Za-z0-9._~-]{1,120}$/.test(String(s || ''));

// The id of the AI voiceover file of one ad or one hadith reading. Same id -> same /api/live/voice/<id>.wav address.
export const adVoiceId = (slug) => `ad-${String(slug || '').toLowerCase().replace(/[^a-z0-9._~-]+/g, '-').slice(0, 56)}`;
export const hadithVoiceId = (book, section, lang) => `h-${String(book).slice(0, 16)}-${intIn(section, 1, 999, 1)}-${String(lang).slice(0, 4)}`;
export const voiceIdOk = (id) => /^(ad-[a-z0-9._~-]{1,56}|h-[a-z0-9-]{1,30})$/.test(String(id || ''));

// Cleans anything (admin form, Firestore, the AI manager) into a safe, complete setting.
export function cleanChannel(input = {}) {
  const x = input || {};
  const d = CHANNEL_DEFAULT;
  const books = [...new Set((Array.isArray(x.hadith && x.hadith.books) ? x.hadith.books : d.hadith.books).filter((b) => BOOK_KEYS.includes(b)))].slice(0, 9);
  const a = x.ads || {};
  const slugs = [...new Set((Array.isArray(a.slugs) ? a.slugs : []).map((s) => String(s || '').trim()).filter(slugOk))].slice(0, MAX_ADS);
  const y = x.youtube || {};
  return {
    mode: MODES.some((m) => m[0] === x.mode) ? x.mode : d.mode,
    windows: x.windows === undefined ? d.windows : cleanWindows(x.windows),
    liveUntil: Math.max(0, Number(x.liveUntil) || 0),
    title: txt(x.title, 60, d.title) || d.title,
    slogan: txt(x.slogan, 120, d.slogan),
    theme: THEMES.some((t) => t[0] === x.theme) ? x.theme : d.theme,
    ticker: txt(x.ticker, 600),
    quranMin: intIn(x.quranMin, 1, 120, d.quranMin),
    hadithMin: intIn(x.hadithMin, 0, 60, d.hadithMin),
    startSurah: intIn(x.startSurah, 1, 114, d.startSurah),
    reciter: RECITER_IDS.has(x.reciter) ? x.reciter : d.reciter,
    translation: typeof x.translation === 'string' && ['ur.jalandhry', 'ur.junagarhi', 'en.sahih', ''].includes(x.translation) ? x.translation : d.translation,
    hadith: {
      books: books.length ? books : d.hadith.books,
      lang: okLang(x.hadith && x.hadith.lang) ? x.hadith.lang : d.hadith.lang,
      voiceName: TTS_VOICES.includes(x.hadith && x.hadith.voiceName) ? x.hadith.voiceName : d.hadith.voiceName,
    },
    ads: {
      enabled: a.enabled !== false,
      slugs,
      seconds: intIn(a.seconds, 10, 120, d.ads.seconds),
      voiceName: TTS_VOICES.includes(a.voiceName) ? a.voiceName : d.ads.voiceName,
    },
    youtube: {
      privacy: YT_PRIVACY.some((p) => p[0] === y.privacy) ? y.privacy : d.youtube.privacy,
      title: txt(y.title, 100),
      last: cleanYtLast(y.last),
    },
    showClock: x.showClock !== false,
  };
}

// The broadcast the admin started from the panel. The stream key is kept so the cast action can pick it up.
function cleanYtLast(v) {
  if (!v || typeof v !== 'object') return null;
  const out = {
    broadcastId: txt(v.broadcastId, 60),
    streamId: txt(v.streamId, 60),
    rtmpUrl: /^rtmps?:\/\/[^\s]+$/i.test(String(v.rtmpUrl || '')) ? String(v.rtmpUrl).slice(0, 200) : '',
    streamKey: txt(v.streamKey, 120),
    watchUrl: /^https:\/\/[^\s]+$/i.test(String(v.watchUrl || '')) ? String(v.watchUrl).slice(0, 300) : '',
    createdAt: Math.max(0, Number(v.createdAt) || 0),
  };
  return out.broadcastId ? out : null;
}

// ---- The programming clock ---------------------------------------------------------------------------------------
// The whole program is a function of the wall clock. Cycle = [quran tilawat | hadith | ad break].
export function segLayout(cfg) {
  const c = cleanChannel(cfg);
  const parts = [{ kind: 'quran', sec: c.quranMin * 60 }];
  if (c.hadithMin > 0) parts.push({ kind: 'hadith', sec: c.hadithMin * 60 });
  if (c.ads.enabled && c.ads.slugs.length) parts.push({ kind: 'ad', sec: c.ads.seconds });
  const cycleSec = parts.reduce((n, p) => n + p.sec, 0);
  return { parts, cycleSec, cfg: c };
}

export function programClock(cfg, now = Date.now()) {
  const { cycleSec } = segLayout(cfg);
  const t = Math.floor(Number(now) / 1000);
  return { cycleIndex: Math.floor(t / cycleSec), offset: t % cycleSec, cycleSec };
}

// 0-based position in the whole Quran (0..6235) -> { surah, ayah }. Inverse of globalAyah().
export function ayahFromGlobal(g) {
  let n = ((Math.floor(Number(g)) % TOTAL_AYAT) + TOTAL_AYAT) % TOTAL_AYAT;
  for (let i = 0; i < SURAHS.length; i++) {
    if (n < SURAHS[i].ayat) return { surah: i + 1, ayah: n + 1 };
    n -= SURAHS[i].ayat;
  }
  return { surah: 114, ayah: SURAHS[113].ayat };
}

// Where the endless tilawat has arrived at `now`: the quran-SECONDS of every past cycle plus the quran part of this one.
export function quranPoint(cfg, now = Date.now()) {
  const { cycleIndex, offset } = programClock(cfg, now);
  const c = cleanChannel(cfg);
  const qSec = cycleIndex * c.quranMin * 60 + Math.min(offset, c.quranMin * 60);
  const startGlobal = globalAyah(c.startSurah, 1) - 1;
  return ayahFromGlobal(startGlobal + Math.floor(qSec / AYAH_SEC));
}

// The `count` ayat a tilawat block starting at `now` will recite (wrapped around the end of the Quran).
export function quranRun(cfg, now = Date.now(), count = 1) {
  const c = cleanChannel(cfg);
  const first = quranPoint(cfg, now);
  const startGlobal = globalAyah(first.surah, first.ayah) - 1;
  const out = [];
  for (let i = 0; i < Math.max(1, Math.floor(count)); i++) {
    const p = ayahFromGlobal(startGlobal + i);
    out.push({ surah: p.surah, ayah: p.ayah, au: audioUrl(c.reciter, p.surah, p.ayah), name: surahInfo(p.surah).name });
  }
  return out;
}

// Which hadith this cycle reads: the books rotate one per cycle, the section walks deeper every full round.
export function hadithPoint(cfg, now = Date.now()) {
  const { cycleIndex } = programClock(cfg, now);
  const c = cleanChannel(cfg);
  const books = c.hadith.books.length ? c.hadith.books : CHANNEL_DEFAULT.hadith.books;
  const book = books[cycleIndex % books.length];
  const section = 1 + (Math.floor(cycleIndex / books.length) % 30);
  return { book, section, lang: c.hadith.lang, voiceId: hadithVoiceId(book, section, c.hadith.lang), voiceName: c.hadith.voiceName };
}

// Which product this cycle advertises (round robin over the admin's list).
export function adPoint(cfg, now = Date.now()) {
  const { cycleIndex } = programClock(cfg, now);
  const c = cleanChannel(cfg);
  if (!c.ads.enabled || !c.ads.slugs.length) return null;
  const slug = c.ads.slugs[cycleIndex % c.ads.slugs.length];
  return { slug, voiceId: adVoiceId(slug), seconds: c.ads.seconds, voiceName: c.ads.voiceName };
}

// One segment of the program: { kind, startMs, endMs, ...payload }.
export function segmentAt(cfg, now = Date.now()) {
  const { parts, cycleSec, cfg: c } = segLayout(cfg);
  const t = Math.floor(Number(now) / 1000) * 1000;
  const cycleIndex = Math.floor(t / 1000 / cycleSec);
  const offset = (t / 1000) % cycleSec;
  let acc = 0;
  let part = parts[0];
  for (const p of parts) { if (offset < acc + p.sec) { part = p; break; } acc += p.sec; }
  const startMs = t - (offset - acc) * 1000;
  const endMs = startMs + part.sec * 1000;
  const base = { kind: part.kind, startMs, endMs, sec: part.sec, cycleIndex };
  if (part.kind === 'quran') {
    const ayat = quranRun(c, startMs, Math.ceil(part.sec / AYAH_SEC));
    return { ...base, ayat, surah: ayat[0].surah, surahName: ayat[0].name, reciter: c.reciter, translation: c.translation };
  }
  if (part.kind === 'hadith') return { ...base, ...hadithPoint(c, startMs) };
  return { ...base, ...adPoint(c, startMs) };
}

// `count` consecutive segments starting at `fromMs` (used by the m3u8 playlist and the "next on" strip).
export function segmentsFrom(cfg, fromMs = Date.now(), count = 8) {
  const out = [];
  let t = Math.max(Number(fromMs) || 0, 0);
  for (let i = 0; i < Math.max(1, Math.min(400, Math.floor(count))); i++) {
    const s = segmentAt(cfg, t);
    out.push(s);
    t = s.endMs;
  }
  return out;
}

// Is the channel on air right now? Same rules as the Quran session: windows in Pakistan time, or always, or "go live now".
export function channelStatus(cfg, now = Date.now()) {
  const c = cleanChannel(cfg);
  if (c.mode === 'off') return { onAir: false, why: 'off' };
  if (c.liveUntil > now) return { onAir: true, why: 'manual', endsAtMs: c.liveUntil };
  if (c.mode === 'always') return { onAir: true, why: 'always' };
  const { dow, minutes } = karachiParts(now);
  for (const w of c.windows) {
    const a = Number(w.start.slice(0, 2)) * 60 + Number(w.start.slice(3, 5));
    const b = Number(w.end.slice(0, 2)) * 60 + Number(w.end.slice(3, 5));
    const dayOk = (d) => !w.days.length || w.days.includes(d);
    const wraps = b < a;
    const inside = wraps ? minutes >= a || minutes < b : minutes >= a && minutes < b;
    if (!inside) continue;
    const startDay = wraps && minutes < b ? (dow + 6) % 7 : dow;
    if (!dayOk(startDay)) continue;
    const left = wraps && minutes >= a ? 1440 - minutes + b : b - minutes;
    return { onAir: true, why: 'window', endsAtMs: now + left * 60e3 - (now % 60e3) };
  }
  return { onAir: false, why: 'waiting' };
}

// How long the CAST ACTION may stay live (the "master timing" of the 24/7 stream). Returns
//   { ok, minutes, why, endsAtMs }  - minutes is the real budget: the requested amount, CUT at the end of the
//   current window (minus a 2-minute safety margin so the encoder is down before the window closes).
//   ok:false means "do not start now" (off air, or the window is about to end) - the caller comes back later.
// `force` starts anyway (a test broadcast or a special live event outside the schedule).
export const CAST_MAX_MIN = 350; // a GitHub-hosted job may run at most 6 hours; we stay well under it
export function castBudget(cfg, now = Date.now(), minutes = 45, { force = false } = {}) {
  const m = intIn(minutes, 1, CAST_MAX_MIN, 45);
  const st = channelStatus(cfg, now);
  if (!st.onAir) {
    return force ? { ok: true, minutes: m, why: 'forced', endsAtMs: 0 } : { ok: false, minutes: 0, why: st.why, endsAtMs: 0 };
  }
  if (st.endsAtMs && st.endsAtMs > now) {
    const until = Math.floor((st.endsAtMs - now) / 60000) - 2; // stop 2 minutes BEFORE the window ends
    if (until < 1) return { ok: false, minutes: 0, why: 'window-ending', endsAtMs: st.endsAtMs };
    return { ok: true, minutes: Math.min(m, until), why: st.why, endsAtMs: st.endsAtMs };
  }
  return { ok: true, minutes: m, why: st.why, endsAtMs: 0 };
}

// Everything the player needs for this moment: on-air state, the current segment (with progress) and the next two.
export function nowPlaying(cfg, now = Date.now()) {
  const c = cleanChannel(cfg);
  const st = channelStatus(c, now);
  const seg = segmentAt(c, now);
  const upcoming = segmentsFrom(c, seg.endMs, 2);
  const progress = Math.min(1, Math.max(0, (now - seg.startMs) / (seg.endMs - seg.startMs)));
  return { ...st, seg, progress, next: upcoming, cycle: programClock(c, now) };
}

// ---- The live M3U8 playlist ---------------------------------------------------------------------------------------
// resolve(item) -> a URL string. A slot whose voiceover does not exist YET falls back to more Quran audio, so the
// stream is NEVER silent. `endlist` closes the playlist (the cast script loops it with ffmpeg); without it the
// playlist is a live window.
export function buildM3U8(cfg, fromMs = Date.now(), count = 40, { base = '', resolve, endlist = false } = {}) {
  const segs = segmentsFrom(cfg, fromMs, Math.min(400, Math.max(4, Math.floor(count))));
  const items = [];
  for (const s of segs) {
    if (s.kind === 'quran') {
      for (const a of s.ayat) items.push({ url: a.au, sec: AYAH_SEC, title: `Surah ${a.name} ${a.surah}:${a.ayah}` });
    } else {
      const u = typeof resolve === 'function' ? resolve(s) : `${base}/api/live/voice/${s.voiceId || 'silence'}.wav`;
      if (u) {
        items.push({ url: u, sec: s.sec, title: s.kind === 'ad' ? `Ad: ${s.slug}` : `Hadith ${s.book} #${s.section}` });
      } else {
        for (const a of quranRun(cfg, s.startMs, Math.ceil(s.sec / AYAH_SEC))) items.push({ url: a.au, sec: AYAH_SEC, title: `Surah ${a.name} ${a.surah}:${a.ayah}` });
      }
    }
  }
  if (!items.length) return '';
  const maxSec = Math.max(...items.map((i) => Math.ceil(i.sec)));
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${maxSec}`,
    `#EXT-X-MEDIA-SEQUENCE:${Math.floor(Number(fromMs) / 1000)}`,
    '#EXT-X-INDEPENDENT-SEGMENTS',
    `#EXT-X-PROGRAM-DATE-TIME:${new Date(Number(fromMs) || Date.now()).toISOString()}`,
  ];
  for (const it of items) {
    lines.push(`#EXTINF:${Number(it.sec).toFixed(3)},`);
    lines.push(it.url);
  }
  if (endlist) lines.push('#EXT-X-ENDLIST');
  return lines.join('\n') + '\n';
}

// ---- Pakistan clock (UTC+5) ---------------------------------------------------------------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function pktClock(now = Date.now()) {
  const t = new Date(Number(now) + 5 * 3600e3);
  const p = (n) => String(n).padStart(2, '0');
  return {
    hh: p(t.getUTCHours()), mm: p(t.getUTCMinutes()), ss: p(t.getUTCSeconds()),
    time: `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`,
    hm: `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`,
    date: `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`,
    day: DAYS[t.getUTCDay()],
    tz: 'PKT',
  };
}

export const tickerLines = (cfg) => {
  const custom = cleanChannel(cfg).ticker;
  return custom ? custom.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 12) : TICKER_DEFAULT;
};

// ---- WAV helper (the AI voiceover files) ---------------------------------------------------------------------------
// PCM (what Gemini TTS returns) -> a complete WAV file. 16-bit mono.
export function pcmToWav(pcm, rate = 24000) {
  const data = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm || []);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4);           // 0-7:  RIFF + size
  h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);                    // 8-19: WAVE, 'fmt ', 16
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);                     // 20-23: PCM, mono
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);           // 24-31: sample rate, byte rate
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);                    // 32-35: block align, 16 bit
  h.write('data', 36); h.writeUInt32LE(data.length, 40);              // 36-43: 'data' + size
  return Buffer.concat([h, data]);
}

// A few seconds of silence (used by the playlist when an ad has no voiceover yet, so the rhythm keeps going).
export function silenceWav(seconds = 8, rate = 24000) {
  const n = Math.min(30, Math.max(1, Number(seconds) || 8)) * rate;
  return pcmToWav(Buffer.alloc(n * 2), rate);
}

export { BOOKS, RECITERS, SURAHS, TOTAL_AYAT, audioUrl, cleanWindows, globalAyah, karachiParts, surahInfo };
