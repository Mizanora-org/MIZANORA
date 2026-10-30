// ============================================================================
// v33 - LIVE BADGES: one pure model for every "live" thing on the shop
// ----------------------------------------------------------------------------
// The badges on the home strip, the Live TV bar, the Quran & Hadith channel and
// the reels all come from here, so they always agree and always show the SAME
// moment to every visitor (the programming is a function of the wall clock).
//
// Pure code (no React, no network): the tests can run all of it.
// ============================================================================

// ---- badge tones -----------------------------------------------------------
// live  : really on air now (red pulsing dot)
// soon  : starts soon / waiting for the next window (amber)
// fresh : new content (green)
// idle  : off air (grey)
export const BADGE_STATES = ['live', 'soon', 'fresh', 'idle', 'warn'];

export function badgeTone(state) {
  const s = String(state || '').toLowerCase();
  if (s === 'live' || s === 'onair' || s === 'on-air') return 'live';
  if (s === 'soon' || s === 'waiting' || s === 'next') return 'soon';
  if (s === 'fresh' || s === 'new' || s === 'ok') return 'fresh';
  if (s === 'warn' || s === 'error' || s === 'failed') return 'warn';
  return 'idle';
}

export const STATE_LABEL = {
  live: 'LIVE',
  soon: 'SOON',
  fresh: 'NEW',
  idle: 'OFF AIR',
  warn: 'CHECK',
};

// ---- Pakistan clock (Asia/Karachi, no DST) --------------------------------
const PK_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const PK_DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', weekday: 'short' });
const PK_DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric' });

export function liveClock(now = Date.now()) {
  const d = new Date(Number(now) || Date.now());
  let time = '--:--:--';
  try { time = PK_TIME.format(d); } catch { /* very old runtime: keep the placeholder */ }
  return {
    hms: time,
    hm: time.slice(0, 5),
    day: PK_DAY.format(d),
    date: PK_DATE.format(d),
    tz: 'PKT',
    at: d.getTime(),
  };
}

// ---- "how long ago" in plain Roman Urdu -----------------------------------
export function timeAgo(ms, now = Date.now()) {
  const t = Number(ms) || 0;
  if (!t) return { text: 'kabhi nahi', short: '-', tone: 'idle' };
  const diff = Math.max(0, Number(now) - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return { text: 'abhi abhi', short: 'abhi', tone: 'live' };
  if (min < 60) return { text: `${min} minute pehle`, short: `${min}m`, tone: min < 10 ? 'live' : 'fresh' };
  const h = Math.floor(min / 60);
  if (h < 24) return { text: `${h} ghante pehle`, short: `${h}h`, tone: h < 6 ? 'fresh' : 'idle' };
  const d = Math.floor(h / 24);
  if (d < 30) return { text: `${d} din pehle`, short: `${d}d`, tone: 'idle' };
  const mo = Math.floor(d / 30);
  if (mo < 12) return { text: `${mo} mahine pehle`, short: `${mo}mo`, tone: 'idle' };
  return { text: `${Math.floor(mo / 12)} saal pehle`, short: `${Math.floor(mo / 12)}y`, tone: 'idle' };
}

// Is this timestamp recent? (a "NEW" badge for a fresh repo / reel / post)
export function isFresh(ms, now = Date.now(), maxAgeMs = 7 * 86400000) {
  const t = Number(ms) || 0;
  return t > 0 && Number(now) - t < maxAgeMs && Number(now) >= t;
}

export const formatCount = (n) => {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v < 1000) return String(v);
  if (v < 1000000) return `${(v / 1000).toFixed(v < 10000 ? 1 : 0).replace(/\.0$/, '')}k`;
  return `${(v / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
};

// ---- what is playing right now -------------------------------------------
// segment shapes come from lib/liveChannel.js:
//   { kind:'quran', surah, ayah(s), surahName, ayat:[...] }
//   { kind:'hadith', book, section }
//   { kind:'ad', slug }
export function segmentTitle(seg) {
  if (!seg) return { title: 'Kuch nahi chal raha', sub: 'Channel off air hai' };
  if (seg.kind === 'quran') {
    const first = seg.surah || (seg.ayat && seg.ayat[0] && seg.ayat[0].surah);
    const ayah = seg.ayah || (seg.ayat && seg.ayat[0] && seg.ayat[0].ayah);
    const name = seg.surahName || (seg.ayat && seg.ayat[0] && seg.ayat[0].name) || (first ? `Surah ${first}` : 'Tilawat');
    return { title: 'Quran Tilawat', sub: ayah ? `${name} ${first}:${ayah}` : name };
  }
  if (seg.kind === 'hadith') {
    const book = String(seg.book || 'hadith').replace(/(^|-)/g, (m) => (m === '-' ? ' ' : ''));
    return { title: 'Hadees Tilawat', sub: `${book} · hissa ${seg.section || 1}` };
  }
  if (seg.kind === 'ad') return { title: 'Product Ad', sub: String(seg.slug || '').replace(/-/g, ' ').slice(0, 60) };
  return { title: 'Mizanora', sub: '' };
}

// The channel banner: on air or not, why, and what is next.
export function channelBanner(playing, now = Date.now()) {
  if (!playing || !playing.onAir) {
    const why = playing && playing.why;
    return {
      onAir: false,
      tone: 'soon',
      label: why === 'off' ? 'OFF AIR' : why === 'waiting' ? 'SCHEDULED' : 'OFF AIR',
      title: 'Channel abhi off air hai',
      sub: why === 'waiting' ? 'Schedule ke mutabiq agli baar khulega' : 'Admin > Live Channel se on karein',
      progress: 0,
      nextInMs: 0,
      nextTitle: '',
    };
  }
  const seg = playing.seg || null;
  const t = segmentTitle(seg);
  const next = Array.isArray(playing.next) && playing.next[0] ? segmentTitle(playing.next[0]) : null;
  const endMs = seg ? Number(seg.endMs) : 0;
  return {
    onAir: true,
    tone: 'live',
    label: 'LIVE',
    title: t.title,
    sub: t.sub,
    progress: Math.max(0, Math.min(1, Number(playing.progress) || 0)),
    nextInMs: endMs ? Math.max(0, endMs - Number(now)) : 0,
    nextTitle: next ? `${next.title}${next.sub ? ` · ${next.sub}` : ''}` : '',
    why: playing.why || '',
  };
}

// ---- Live TV channel cards -------------------------------------------------
// A pool of numbers written by the admin (lv.channels[].no) marks a channel as a
// 24/7 number; an IPTV playlist channel is marked "STREAM".
export function tvChannelBadge(channel, now = Date.now()) {
  const c = channel || {};
  if (c.off) return { state: 'idle', label: 'OFF' };
  const name = String(c.name || '').toLowerCase();
  const isNews = /news|khabar|akhar|geo|ary|express|dawn|samaa|bol|dunya|hum ?news/i.test(name);
  return { state: 'live', label: isNews ? 'LIVE NEWS' : 'LIVE', group: c.group || 'Other' };
}

// ---- the whole strip, as plain data ---------------------------------------
// { channel, tv, playing, now, tickers } -> everything the strip renders.
export function stripModel({ playing = null, tv = null, now = Date.now(), tickers = [], channelTitle = 'Mizanora Live Channel' } = {}) {
  const banner = channelBanner(playing, now);
  const channels = ((tv && tv.channels) || [])
    .filter((c) => c && !c.off)
    .slice(0, 14)
    .map((c) => ({ name: String(c.name || 'Channel').slice(0, 40), slug: c.slug || '', badge: tvChannelBadge(c, now) }));
  return {
    clock: liveClock(now),
    banner,
    channelTitle,
    tvCount: channels.length,
    channels,
    tickers: (Array.isArray(tickers) ? tickers : []).filter(Boolean).map((s) => String(s).slice(0, 140)).slice(0, 12),
    liveNow: Boolean(banner.onAir),
  };
}

// ---- reels ----------------------------------------------------------------
// Short badges for a reel card: trending / new / deal / provider.
export function reelBadges(reel, index = 0, now = Date.now()) {
  const r = reel || {};
  const out = [];
  if (index === 0) out.push({ state: 'live', label: 'TRENDING' });
  else if (isFresh(r.createdAt || r.at || 0, now, 7 * 86400000)) out.push({ state: 'fresh', label: 'NEW' });
  if (r.price > 0 && r.comparePrice > r.price) {
    const off = Math.round(((r.comparePrice - r.price) / r.comparePrice) * 100);
    if (off >= 5) out.push({ state: 'soon', label: `${off}% OFF` });
  }
  return out.slice(0, 2);
}
