import { unstable_cache } from 'next/cache';
import { parseM3U } from '../liveTv.js';
import { fetchPublic } from '../tvProxy';
import { apiBase, getSource, sourceReady } from './source';

// IPTV GATEWAY — channels ka jaama hua catalogue.
// Do tarah ke source: (1) Xtream panel (host + user + pass), (2) seedha M3U link.
// Dono soorton mein asli link sirf server ke paas rehta hai; client ko id milti hai.
// 5 minute cache — upstream par load nahi parta.

const MAX_M3U_BYTES = 8 * 1024 * 1024;

export async function readUpstreamJson(source, query) {
  const base = apiBase(source);
  if (!base) return null;
  const url = `${base}/player_api.php?username=${encodeURIComponent(source.username)}&password=${encodeURIComponent(source.password)}${query}`;
  const { res } = await fetchPublic(url, { timeout: 12000 });
  if (!res.ok) { try { res.body && res.body.cancel(); } catch { /* ignore */ } return null; }
  const type = res.headers.get('content-type') || '';
  if (!/json/i.test(type)) { try { res.body && res.body.cancel(); } catch { /* ignore */ } return null; }
  return res.json().catch(() => null);
}

/** Upstream Xtream se live channels. */
export async function upstreamLive(source) {
  const [cats, streams] = await Promise.all([
    readUpstreamJson(source, '&action=get_live_categories'),
    readUpstreamJson(source, '&action=get_live_streams'),
  ]);
  const list = Array.isArray(streams) ? streams : [];
  const catName = new Map((Array.isArray(cats) ? cats : []).map((c) => [String(c.category_id), String(c.category_name || 'Other')]));
  return list.map((s) => ({
    id: String(s.stream_id),
    name: String(s.name || '').slice(0, 90),
    group: catName.get(String(s.category_id)) || 'Other',
    logo: String(s.stream_icon || '').slice(0, 400),
    epg: String(s.epg_channel_id || ''),
    ext: /m3u8/i.test(String(s.stream_type || '')) ? 'm3u8' : 'ts',
  })).filter((c) => c.id && c.name);
}

/** M3U link se channels (id = tarteeb, yaani stable jab tak playlist na badle). */
export async function m3uLive(source) {
  if (!source.url) return [];
  const { res } = await fetchPublic(source.url, { timeout: 15000 });
  if (!res.ok) { try { res.body && res.body.cancel(); } catch { /* ignore */ } return []; }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_M3U_BYTES) return [];
  const text = new TextDecoder().decode(buf);
  if (!/^#EXTM3U/i.test(text.trimStart())) return [];
  const { channels } = parseM3U(text);
  return channels.slice(0, 5000).map((c, i) => ({
    id: String(i + 1),
    name: c.name,
    group: c.group || 'Other',
    logo: c.logo || '',
    epg: '',
    ext: /\.m3u8(\?|$)/i.test(c.url) ? 'm3u8' : 'ts',
    url: c.url, // sirf server ke andar
  }));
}

export function groupsOf(channels = []) {
  const m = new Map();
  for (const c of channels) m.set(c.group || 'Other', (m.get(c.group || 'Other') || 0) + 1);
  let n = 1;
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ id: String(n++), name, count }));
}

const load = unstable_cache(async () => {
  const source = await getSource();
  if (!sourceReady(source)) return { ready: false, mode: source.mode, channels: [], groups: [], updatedAt: 0 };
  const channels = source.mode === 'm3u' ? await m3uLive(source) : await upstreamLive(source);
  return { ready: channels.length > 0, mode: source.mode, channels, groups: groupsOf(channels), updatedAt: Date.now() };
}, ['mz-iptv-catalogue-v1'], { revalidate: 300, tags: ['iptv-source'] });

export const getCatalogue = () => load();

/** Channel dhoondhein (id ya naam se) — stream route isi se upstream tak pahunchta hai. */
export async function findChannel(idOrName) {
  const { channels } = await getCatalogue();
  const key = String(idOrName || '');
  return channels.find((c) => c.id === key) || channels.find((c) => c.name.toLowerCase() === key.toLowerCase()) || null;
}
