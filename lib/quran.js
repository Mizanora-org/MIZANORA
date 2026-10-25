// QURAN SESSION (v23). Pure code: used by the admin page, the server and the browser, so all three agree.
//
// WHAT IT DOES
// At the times the admin chooses (for example when the shop "opens" at 9:00) the whole website shows a beautiful Quran
// session: the ayat appear one by one with a soft animation, the recitation plays and the ayah on the screen is always the ayah
// being recited (the next ayah starts the moment the recitation of the current one ends).
//
// WHERE THE TEXT AND THE VOICE COME FROM (nothing of the Quran is typed by hand in this project)
//   * Arabic text (Uthmani script, Tanzil) + translation + verse by verse recitation: AlQuran Cloud (api.alquran.cloud),
//     audio files from cdn.islamic.network. The server fetches a surah once and keeps it for 30 days (app/api/quran/route.js).
//   * If the API cannot be reached the session simply does not start; nothing wrong is ever shown.
//
// WHAT THE ADMIN CONTROLS (Admin > Quran, stored in Firestore siteMeta/quran)
//   mode (off / on a schedule / always), the daily time windows (Pakistan time), "Start now for N minutes", which surah and
//   which ayat, the reciter, the translation, the look, how it appears (small button / sheet / full screen), volume and more.

// [roman name, number of ayat]. The numbers add up to 6236 (see scripts/test-v23.mjs).
/** @type {{ n: number, name: string, ayat: number }[]} */
export const SURAHS = [
  ['Al-Fatihah', 7], ['Al-Baqarah', 286], ['Aal-e-Imran', 200], ['An-Nisa', 176], ['Al-Maidah', 120], ['Al-Anam', 165], ['Al-Araf', 206], ['Al-Anfal', 75], ['At-Tawbah', 129], ['Yunus', 109],
  ['Hud', 123], ['Yusuf', 111], ['Ar-Rad', 43], ['Ibrahim', 52], ['Al-Hijr', 99], ['An-Nahl', 128], ['Al-Isra', 111], ['Al-Kahf', 110], ['Maryam', 98], ['Ta-Ha', 135],
  ['Al-Anbiya', 112], ['Al-Hajj', 78], ['Al-Muminun', 118], ['An-Nur', 64], ['Al-Furqan', 77], ['Ash-Shuara', 227], ['An-Naml', 93], ['Al-Qasas', 88], ['Al-Ankabut', 69], ['Ar-Rum', 60],
  ['Luqman', 34], ['As-Sajdah', 30], ['Al-Ahzab', 73], ['Saba', 54], ['Fatir', 45], ['Ya-Sin', 83], ['As-Saffat', 182], ['Sad', 88], ['Az-Zumar', 75], ['Ghafir', 85],
  ['Fussilat', 54], ['Ash-Shura', 53], ['Az-Zukhruf', 89], ['Ad-Dukhan', 59], ['Al-Jathiyah', 37], ['Al-Ahqaf', 35], ['Muhammad', 38], ['Al-Fath', 29], ['Al-Hujurat', 18], ['Qaf', 45],
  ['Adh-Dhariyat', 60], ['At-Tur', 49], ['An-Najm', 62], ['Al-Qamar', 55], ['Ar-Rahman', 78], ['Al-Waqiah', 96], ['Al-Hadid', 29], ['Al-Mujadila', 22], ['Al-Hashr', 24], ['Al-Mumtahanah', 13],
  ['As-Saff', 14], ['Al-Jumuah', 11], ['Al-Munafiqun', 11], ['At-Taghabun', 18], ['At-Talaq', 12], ['At-Tahrim', 12], ['Al-Mulk', 30], ['Al-Qalam', 52], ['Al-Haqqah', 52], ['Al-Maarij', 44],
  ['Nuh', 28], ['Al-Jinn', 28], ['Al-Muzzammil', 20], ['Al-Muddaththir', 56], ['Al-Qiyamah', 40], ['Al-Insan', 31], ['Al-Mursalat', 50], ['An-Naba', 40], ['An-Naziat', 46], ['Abasa', 42],
  ['At-Takwir', 29], ['Al-Infitar', 19], ['Al-Mutaffifin', 36], ['Al-Inshiqaq', 25], ['Al-Buruj', 22], ['At-Tariq', 17], ['Al-Ala', 19], ['Al-Ghashiyah', 26], ['Al-Fajr', 30], ['Al-Balad', 20],
  ['Ash-Shams', 15], ['Al-Layl', 21], ['Ad-Duha', 11], ['Ash-Sharh', 8], ['At-Tin', 8], ['Al-Alaq', 19], ['Al-Qadr', 5], ['Al-Bayyinah', 8], ['Az-Zalzalah', 8], ['Al-Adiyat', 11],
  ['Al-Qariah', 11], ['At-Takathur', 8], ['Al-Asr', 3], ['Al-Humazah', 9], ['Al-Fil', 5], ['Quraysh', 4], ['Al-Maun', 7], ['Al-Kawthar', 3], ['Al-Kafirun', 6], ['An-Nasr', 3],
  ['Al-Masad', 5], ['Al-Ikhlas', 4], ['Al-Falaq', 5], ['An-Nas', 6],
].map(([name, ayat], i) => ({ n: i + 1, name: String(name), ayat: Number(ayat) }));

export const TOTAL_AYAT = 6236;
export const surahInfo = (n) => SURAHS[Math.min(114, Math.max(1, Math.floor(Number(n)) || 1)) - 1];
export const slugOfSurah = (n) => `${surahInfo(n).n}-${surahInfo(n).name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}`;

// Reciters (identifiers of AlQuran Cloud audio editions) and translations (Urdu first, because the shop speaks Urdu).
export const RECITERS = [
  ['ar.alafasy', 'Mishary Rashid Alafasy'],
  ['ar.abdurrahmaansudais', 'Abdurrahman As-Sudais'],
  ['ar.abdulbasitmurattal', 'Abdul Basit (Murattal)'],
  ['ar.husary', 'Mahmoud Khalil Al-Husary'],
  ['ar.minshawi', 'Mohamed Siddiq Al-Minshawi'],
  ['ar.saoodshuraym', 'Saud Ash-Shuraim'],
  ['ar.mahermuaiqly', 'Maher Al-Muaiqly'],
];
export const TRANSLATIONS = [
  ['ur.jalandhry', 'Urdu: Fateh Muhammad Jalandhry'],
  ['ur.junagarhi', 'Urdu: Muhammad Junagarhi'],
  ['en.sahih', 'English: Saheeh International'],
  ['', 'No translation (Arabic only)'],
];
const RECITER_IDS = new Set(RECITERS.map((r) => r[0]));
const TRANS_IDS = new Set(TRANSLATIONS.map((r) => r[0]));
export const STYLES = [['emerald', 'Emerald (green and gold)'], ['night', 'Night sky (dark blue and gold)'], ['gold', 'Cream and gold']];
export const ANIMATIONS = [['glow', 'Glow (words light up while recited)'], ['rise', 'Rise (ayah floats up)'], ['type', 'Write (ayah is written word by word)'], ['float', 'Float (slow drifting light)']];
export const DISPLAYS = [['pill', 'Small floating button (visitor taps to open)'], ['sheet', 'Opens as a bottom sheet by itself'], ['full', 'Opens full screen by itself']];
export const MODES = [['schedule', 'Only at the times below'], ['always', 'Always (a button on every page)'], ['off', 'Off']];

export const QURAN_DOC = { collection: 'siteMeta', id: 'quran' };
export const QURAN_DEFAULT = {
  mode: 'schedule',
  windows: [{ start: '09:00', end: '09:30', days: [] }],
  liveUntil: 0,
  surah: 1, from: 1, to: 0,
  continuous: false, loop: true,
  reciter: 'ar.alafasy', translation: 'ur.jalandhry',
  showArabic: true, size: 'm', volume: 85,
  style: 'emerald', animation: 'glow', display: 'sheet',
  autoStart: true, pauseMusic: true,
  title: 'Tilawat-e-Quran', message: 'Dukaan ka aaghaaz Allah ke kalaam se',
  pages: 'all',
  closedPlay: true,   // v24: the recitation keeps playing while the shop is closed (outside shop hours or shut down)
  allowChoice: true,  // visitors may pick translation / voice / text size (kept on their own device)
  source: 'ayah',     // 'ayah' = ayah by ayah with synced text (default) | 'stream' = an existing live stream link
  streamUrl: '',      // https link of a live audio stream (mp3/aac) or a YouTube live / channel link
  streamTitle: '',
};

const intIn = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const txt = (v, n, d = '') => String(v == null ? d : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const hhmm = (v, d) => { const m = String(v || '').match(/^(\d{1,2}):(\d{2})$/); if (!m) return d; const h = Number(m[1]); const mi = Number(m[2]); return h > 23 || mi > 59 ? d : `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`; };

export function cleanWindows(list) {
  const out = [];
  for (const w of (Array.isArray(list) ? list : []).slice(0, 8)) {
    if (!w) continue;
    const start = hhmm(w.start, ''); const end = hhmm(w.end, '');
    if (!start || !end || start === end) continue;
    const days = [...new Set((Array.isArray(w.days) ? w.days : []).map((d) => Math.floor(Number(d))).filter((d) => d >= 0 && d <= 6))].sort();
    out.push({ start, end, days });
  }
  return out;
}

// Cleans anything (what the admin typed, what the AI manager sent, what Firestore holds) into a safe, complete setting.
export function cleanQuran(input = {}) {
  const x = input || {};
  const d = QURAN_DEFAULT;
  const surah = intIn(x.surah, 1, 114, d.surah);
  const max = surahInfo(surah).ayat;
  const from = intIn(x.from, 1, max, 1);
  const to = x.to === undefined || x.to === null || Number(x.to) <= 0 ? 0 : Math.max(from, intIn(x.to, 1, max, max));
  const windows = x.windows === undefined ? d.windows : cleanWindows(x.windows);
  return {
    mode: ['off', 'schedule', 'always'].includes(x.mode) ? x.mode : d.mode,
    windows,
    liveUntil: Math.max(0, Number(x.liveUntil) || 0),
    surah, from, to: to >= max ? 0 : to,
    continuous: Boolean(x.continuous),
    loop: x.loop !== false,
    reciter: RECITER_IDS.has(x.reciter) ? x.reciter : d.reciter,
    translation: x.translation === undefined ? d.translation : TRANS_IDS.has(x.translation) ? x.translation : d.translation,
    showArabic: x.showArabic !== false,
    size: ['s', 'm', 'l'].includes(x.size) ? x.size : d.size,
    volume: intIn(x.volume, 0, 100, d.volume),
    style: STYLES.some((s) => s[0] === x.style) ? x.style : d.style,
    animation: ANIMATIONS.some((s) => s[0] === x.animation) ? x.animation : d.animation,
    display: DISPLAYS.some((s) => s[0] === x.display) ? x.display : d.display,
    autoStart: x.autoStart !== false,
    pauseMusic: x.pauseMusic !== false,
    title: txt(x.title, 60, d.title) || d.title,
    message: txt(x.message, 140, d.message),
    pages: x.pages === 'home' ? 'home' : 'all',
    closedPlay: x.closedPlay !== false,
    allowChoice: x.allowChoice !== false,
    source: x.source === 'stream' && /^https:\/\//i.test(String(x.streamUrl || '')) ? 'stream' : 'ayah',
    streamUrl: /^https:\/\/[^\s<>"']{4,380}$/i.test(String(x.streamUrl || '').trim()) ? String(x.streamUrl).trim() : '',
    streamTitle: txt(x.streamTitle, 60),
  };
}

// ---- Pakistan time (UTC+5, no daylight saving)
export function karachiParts(now = Date.now()) {
  const t = new Date(Number(now) + 5 * 3600e3);
  return { dow: t.getUTCDay(), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
}
const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

// Is the session on right now? Returns { live, why, endsAtMs?, next? }.
export function quranStatus(cfg, now = Date.now()) {
  const c = cleanQuran(cfg);
  if (c.mode === 'off') return { live: false, why: 'off' };
  if (c.liveUntil > now) return { live: true, why: 'manual', endsAtMs: c.liveUntil };
  if (c.mode === 'always') return { live: true, why: 'always' };
  const { dow, minutes } = karachiParts(now);
  for (const w of c.windows) {
    const a = toMin(w.start); const b = toMin(w.end);
    const dayOk = (d) => !w.days.length || w.days.includes(d);
    const wraps = b < a;
    const inside = wraps ? minutes >= a || minutes < b : minutes >= a && minutes < b;
    if (!inside) continue;
    const startDay = wraps && minutes < b ? (dow + 6) % 7 : dow; // after midnight the window belongs to the day it started
    if (!dayOk(startDay)) continue;
    const left = (wraps && minutes >= a ? 1440 - minutes + b : b - minutes);
    return { live: true, why: 'window', endsAtMs: now + left * 60e3 - (now % 60e3) };
  }
  return { live: false, why: 'waiting' };
}

// The text on the admin page that explains the windows in plain words.
export const describeWindows = (ws) => (ws.length ? ws.map((w) => `${w.start} to ${w.end}${w.days.length ? ` (${w.days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')})` : ' (every day)'}`).join('; ') : 'no time set');

// ---- The ayat of a range, and the web addresses of the data
export function rangeOf(cfg) {
  const c = cleanQuran(cfg);
  const max = surahInfo(c.surah).ayat;
  return { surah: c.surah, from: c.from, to: c.to || max };
}
export const apiUrl = (surah, reciter, translation) => `https://api.alquran.cloud/v1/surah/${surahInfo(surah).n}/editions/quran-uthmani${translation ? `,${translation}` : ''},${reciter}`;

// Number of a verse in the whole Quran (1..6236). The audio files of the CDN are named by it.
export function globalAyah(surah, ayah) { let n = 0; for (let i = 0; i < surahInfo(surah).n - 1; i++) n += SURAHS[i].ayat; return n + ayah; }
// The recitation of every ayah is a plain file whose address is known from the ayah number alone: it never depends on an API answer.
export const audioUrl = (reciter, surah, ayah) => `https://cdn.islamic.network/quran/audio/128/${RECITER_IDS.has(reciter) ? reciter : 'ar.alafasy'}/${globalAyah(surah, ayah)}.mp3`;
export const fallbackAudio = (surah, ayah, reciter = 'ar.alafasy') => audioUrl(reciter, surah, ayah);
// One edition of one surah (the text, a translation or a reciter): small, separate requests, so one failing never takes the others down.
export const editionUrl = (surah, edition) => `https://api.alquran.cloud/v1/surah/${surahInfo(surah).n}/${edition}`;
export function parseEdition(json) {
  const d = json && json.data;
  return d && Array.isArray(d.ayahs) && d.ayahs.length ? d : null;
}
// Builds the surah the player uses from whatever parts arrived: { ar, tr, au } are edition answers (or null). The audio addresses are always
// there (computed), the Arabic text may be missing (then only the voice plays), the translation may be missing (then it is simply not shown).
export function assembleSurah(n, { ar, tr, au } = {}, reciter = 'ar.alafasy') {
  const s = surahInfo(n);
  const count = s.ayat;
  const ays = [];
  for (let i = 0; i < count; i++) {
    const a = ar && ar.ayahs[i];
    const first = a && i === 0 && s.n !== 1 && s.n !== 9 ? splitBismillah(a.text) : { bism: false, text: a ? String(a.text || '').trim() : '' };
    const audio = au && au.ayahs && au.ayahs[i] && au.ayahs[i].audio;
    ays.push({
      n: i + 1, ar: first.text, bism: first.bism,
      tr: tr && tr.ayahs && tr.ayahs[i] ? String(tr.ayahs[i].text || '').trim() : '',
      au: typeof audio === 'string' && /^https:\/\//.test(audio) ? audio : audioUrl(reciter, s.n, i + 1),
    });
  }
  return { surah: s.n, name: s.name, ar: ar ? String(ar.name || '') : '', meaning: ar ? String(ar.englishNameTranslation || '') : '', ayahs: ays, arOk: Boolean(ar), trOk: Boolean(tr) };
}

// Strip marks so that the first words of ayah 1 can be compared with the Bismillah (the API puts it in front of ayah 1 of most surahs).
const bare = (s) => String(s || '').replace(/[ـً-ٰٟۖ-ۭ]/g, '').replace(/ٱ/g, 'ا').replace(/\s+/g, ' ').trim();
export function splitBismillah(text) {
  const words = String(text || '').trim().split(/\s+/);
  if (words.length > 4 && /^بسم ا?لله ا?لرحم\S* ا?لرحيم$/.test(bare(words.slice(0, 4).join(' ')))) return { bism: true, text: words.slice(4).join(' ') };
  return { bism: false, text: String(text || '').trim() };
}

// Turns the AlQuran Cloud answer into the small shape the player uses: [{ n, ar, tr, au }].
export function parseSurahResponse(json, { reciter, translation } = {}) {
  const eds = (json && json.data) || [];
  const by = (id) => eds.find((e) => e && e.edition && e.edition.identifier === id);
  const text = by('quran-uthmani') || eds[0];
  if (!text || !Array.isArray(text.ayahs) || !text.ayahs.length) return null;
  const tr = translation ? by(translation) : null;
  const au = by(reciter);
  const s = surahInfo(text.number || 1);
  const ayahs = text.ayahs.map((a, i) => {
    const n = a.numberInSurah || i + 1;
    const first = n === 1 && s.n !== 1 && s.n !== 9 ? splitBismillah(a.text) : { bism: false, text: String(a.text || '').trim() };
    const audio = au && au.ayahs && au.ayahs[i] && au.ayahs[i].audio;
    return {
      n, ar: first.text, bism: first.bism,
      tr: tr && tr.ayahs && tr.ayahs[i] ? String(tr.ayahs[i].text || '').trim() : '',
      au: typeof audio === 'string' && /^https:\/\//.test(audio) ? audio : fallbackAudio(s.n, n),
    };
  });
  return { surah: s.n, name: s.name, ar: String(text.name || ''), meaning: String(text.englishNameTranslation || ''), ayahs };
}

// How the words of an ayah are lit up while it is recited: each word gets a share of the time that is proportional to its length.
export function wordShares(ar) {
  const words = String(ar || '').split(/\s+/).filter(Boolean);
  const w = words.map((x) => Math.max(2, bare(x).length));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return words.map((word, i) => { const start = acc / sum; acc += w[i]; return { word, start }; });
}

// A ready-made live stream chosen by the admin: a YouTube live / video / channel link, or a direct live audio stream (mp3 / aac / icecast).
export function streamTarget(url) {
  const u = String(url || '').trim();
  if (!/^https:\/\//i.test(u)) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
  if (m) return { kind: 'youtube', src: `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0&playsinline=1` };
  m = u.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/i);
  if (m) return { kind: 'youtube', src: `https://www.youtube.com/embed/live_stream?channel=${m[1]}&autoplay=1&rel=0&playsinline=1` };
  if (/youtube\.com|youtu\.be/i.test(u)) return null; // a youtube address we cannot turn into a player (for example an @handle)
  return { kind: 'audio', src: u };
}
