// MIZANORA IPTV — the IPTV section's OWN channel list.
//
// Free Live TV (siteMeta/liveTv) aur IPTV (siteMeta/iptvCatalogue) do alag cheezein hain:
// free TV sab ke liye khula hai, IPTV woh catalogue hai jo sirf lines ke saath chalta hai.
// Agar IPTV ka catalogue khali ho to section free Live TV ki list se kaam chala leta hai
// (taake din 1 par page khali na lage), magar admin jab apni list save karta hai to wohi chalti hai.

import { cleanChannel, parseM3U } from './liveTv.js';

export const IPTV_CATALOGUE = { collection: 'siteMeta', id: 'iptvCatalogue' };
export const MAX_IPTV_CHANNELS = 480000; // shards: 600 × 800

const clean = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Catalogue document ko saaf karta hai: duplicate URL hatao, naam/groups theek karo. */
export function cleanCatalogue(input = {}) {
  const seen = new Set();
  const channels = [];
  for (const c of Array.isArray(input.channels) ? input.channels : []) {
    const k = cleanChannel(c);
    if (!k || seen.has(k.url)) continue;
    seen.add(k.url);
    // id stable rakhein: tarteeb se 1,2,3... — gateway isi id se stream dhoondta hai.
    // v45: `epg` = EPG mapping (misaal "geo.pk"); `nowPlaying` guide ke fallback slot ke liye.
    channels.push({
      ...k,
      group: k.group || 'Other',
      id: String(channels.length + 1),
      epg: String((c && c.epg) || '').replace(/[<>"]/g, '').slice(0, 80),
      nowPlaying: String((c && c.nowPlaying) || '').replace(/[<>]/g, '').slice(0, 90),
    });
    if (channels.length >= MAX_IPTV_CHANNELS) break;
  }
  return {
    enabled: input.enabled === true,
    title: clean(input.title, 60) || 'Mizanora IPTV',
    note: clean(input.note, 160),
    channels,
    updatedAt: Number(input.updatedAt) || 0,
  };
}

/** Groups + counts, bade se chhote. */
export function catalogueGroups(channels = []) {
  const m = new Map();
  for (const c of channels) {
    if (c.off) continue;
    const g = (c.group || 'Other').trim() || 'Other';
    m.set(g, (m.get(g) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

/** M3U text se channels (server par validation ke saath). */
export function fromM3U(text) {
  const { channels, skipped } = parseM3U(text);
  return { channels: cleanCatalogue({ channels }).channels, skipped };
}

/** Catalogue ka chhota khulasa — admin panel aur public page dono ke liye. */
export function catalogueStats(catalogue = {}) {
  const channels = Array.isArray(catalogue.channels) ? catalogue.channels : [];
  const live = channels.filter((c) => !c.off);
  return {
    total: channels.length,
    live: live.length,
    off: channels.length - live.length,
    groups: catalogueGroups(channels).length,
    updatedAt: Number(catalogue.updatedAt) || 0,
  };
}
