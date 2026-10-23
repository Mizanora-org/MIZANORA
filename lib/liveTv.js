// LIVE TV SESSION (v24.1). Pure code, shared by the admin page, the server, the player and the tests.
// The admin loads channels from an M3U playlist (a file or a link) or adds them one by one, then chooses the PRODUCTS whose ad plays while
// the visitor switches channel (next / previous / pick from the list). Nothing here ships with any channel: the shop shows only what the
// admin put in. Use only streams you have the right to show (your own, or ones whose owner allows embedding).
// Browsers block plain "http://" streams on an https website, so only https links are kept.

export const TV_DOC = { collection: 'siteMeta', id: 'liveTv' };
export const MAX_CHANNELS = 800;
export const TV_DEFAULT = {
  enabled: false, title: 'Mizanora Live TV', note: '',
  channels: [],
  autoplay: true,
  ads: { enabled: true, slugs: [], seconds: 6, skipAfter: 3, onStart: true },
};

const txt = (v, n, d = '') => String(v == null ? d : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const httpsUrl = (v, n = 600) => { const u = String(v || '').trim(); return /^https:\/\/[^\s<>"']{4,}$/i.test(u) && u.length <= n ? u : ''; };
const intIn = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

export function cleanChannel(c) {
  const url = httpsUrl(c && c.url);
  const name = txt(c && c.name, 70);
  if (!url || !name) return null;
  return { name, url, logo: httpsUrl(c && c.logo, 400), group: txt(c && c.group, 40), off: Boolean(c && c.off) };
}
export function cleanTv(input = {}) {
  const x = input || {};
  const seen = new Set();
  const channels = [];
  for (const c of Array.isArray(x.channels) ? x.channels : []) {
    const k = cleanChannel(c);
    if (!k || seen.has(k.url)) continue;
    seen.add(k.url); channels.push(k);
    if (channels.length >= MAX_CHANNELS) break;
  }
  const a = x.ads || {};
  const slugs = [...new Set((Array.isArray(a.slugs) ? a.slugs : []).map((s) => String(s || '').trim().slice(0, 120)).filter((s) => /^[A-Za-z0-9._~-]+$/.test(s)))].slice(0, 30);
  return {
    enabled: x.enabled === true,
    title: txt(x.title, 60, TV_DEFAULT.title) || TV_DEFAULT.title,
    note: txt(x.note, 160),
    channels,
    autoplay: x.autoplay !== false,
    ads: {
      enabled: a.enabled !== false,
      slugs,
      seconds: intIn(a.seconds, 3, 20, TV_DEFAULT.ads.seconds),
      skipAfter: intIn(a.skipAfter, 0, 10, TV_DEFAULT.ads.skipAfter),
      onStart: a.onStart !== false,
    },
  };
}

// ---- M3U / M3U8 playlist -> channels. Returns { channels, skipped } (skipped = lines that were not a usable https stream).
export function parseM3U(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = []; let skipped = 0; let meta = null;
  const attr = (s, k) => { const m = s.match(new RegExp(`${k}="([^"]*)"`, 'i')); return m ? m[1] : ''; };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#EXTINF/i.test(line)) {
      const comma = line.indexOf(',');
      meta = { name: comma >= 0 ? line.slice(comma + 1) : '', tvgName: attr(line, 'tvg-name'), logo: attr(line, 'tvg-logo'), group: attr(line, 'group-title') };
    } else if (/^#EXTGRP:/i.test(line)) {
      meta = { ...(meta || {}), group: line.slice(8) };
    } else if (!line.startsWith('#')) {
      const c = cleanChannel({ name: (meta && (meta.name || meta.tvgName)) || line.split('/').pop().split('?')[0], url: line, logo: meta && meta.logo, group: meta && meta.group });
      if (c) out.push(c); else skipped++;
      meta = null;
      if (out.length >= MAX_CHANNELS * 2) break;
    }
  }
  return { channels: out, skipped };
}

// How a link is played: a YouTube live / video, a HLS stream (.m3u8), an audio stream or a plain video file.
export function channelTarget(url) {
  const u = String(url || '').trim();
  if (!/^https:\/\//i.test(u)) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
  if (m) return { kind: 'youtube', src: `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0&playsinline=1` };
  m = u.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/i);
  if (m) return { kind: 'youtube', src: `https://www.youtube.com/embed/live_stream?channel=${m[1]}&autoplay=1&rel=0&playsinline=1` };
  if (/youtube\.com|youtu\.be/i.test(u)) return null;
  const path = u.split('?')[0].toLowerCase();
  if (/\.(mp3|aac|m4a|ogg|oga|opus)$/.test(path)) return { kind: 'audio', src: u };
  if (/\.(mp4|webm|m4v|mov)$/.test(path)) return { kind: 'video', src: u };
  return { kind: 'hls', src: u }; // .m3u8 and anything else: the player tries HLS first, then plays it natively
}

// Wrap-around next / previous among the channels that are switched on.
export function stepIndex(channels, from, dir) {
  const n = channels.length;
  if (!n) return -1;
  for (let k = 1; k <= n; k++) {
    const i = (((from + dir * k) % n) + n) % n;
    if (!channels[i].off) return i;
  }
  return from;
}
// Ad rotation: the counter goes 0,1,2... and walks through the chosen products again and again.
export const pickAd = (ads, counter) => (ads && ads.length ? ads[((counter % ads.length) + ads.length) % ads.length] : null);

// ---- v25: a web address for every channel (so each channel can be found on Google) and the channel groups ----
export function tvSlug(s, max = 60) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '');
}
// One slug per channel, same order as the channel list. Equal names get -2, -3. Channels without latin letters get "channel-<number>".
export function channelSlugs(channels) {
  const seen = new Map();
  return (channels || []).map((c, i) => {
    const base = tvSlug(c && c.name) || `channel-${i + 1}`;
    const n = (seen.get(base) || 0) + 1; seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}
// Groups with their channel counts, biggest first (channels that are switched off do not count).
export function channelGroups(channels, max = 14) {
  const m = new Map();
  for (const c of channels || []) { if (c.off) continue; const g = (c.group || '').trim() || 'Other'; m.set(g, (m.get(g) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([name, count]) => ({ name, count }));
}
// The iptv-org project publishes free public playlists of channels. These are only SHORTCUTS for the admin: nothing is loaded until the admin presses Load.
export const TV_PRESETS = [
  ['Pakistan', 'https://iptv-org.github.io/iptv/countries/pk.m3u'],
  ['Islamic / Religion', 'https://iptv-org.github.io/iptv/categories/religion.m3u'],
  ['News', 'https://iptv-org.github.io/iptv/categories/news.m3u'],
  ['Kids', 'https://iptv-org.github.io/iptv/categories/kids.m3u'],
  ['Sports', 'https://iptv-org.github.io/iptv/categories/sports.m3u'],
  ['Music', 'https://iptv-org.github.io/iptv/categories/music.m3u'],
  ['Urdu language', 'https://iptv-org.github.io/iptv/languages/urd.m3u'],
  ['India', 'https://iptv-org.github.io/iptv/countries/in.m3u'],
  ['Saudi Arabia', 'https://iptv-org.github.io/iptv/countries/sa.m3u'],
  ['UAE', 'https://iptv-org.github.io/iptv/countries/ae.m3u'],
  ['Turkey', 'https://iptv-org.github.io/iptv/countries/tr.m3u'],
  ['United Kingdom', 'https://iptv-org.github.io/iptv/countries/uk.m3u'],
  ['USA', 'https://iptv-org.github.io/iptv/countries/us.m3u'],
];
