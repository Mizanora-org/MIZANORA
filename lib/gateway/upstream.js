import { parseM3U } from '../liveTv.js';
import { fetchPublic } from '../tvProxy';
import { apiBase } from './sourceConfig';

// OPTIONAL upstream backup — kabhi kabhi kisi purane Xtream panel ya M3U se channels jaldi
// chahiye hote hain. Ye alag file hai taake asli gateway (apna catalogue) is par depend na kare:
// agar admin apna content rakh raha hai to ye kabhi chalta hi nahi.

const MAX_M3U_BYTES = 8 * 1024 * 1024;

export async function readUpstreamJson(source, query = '') {
  const base = apiBase(source);
  if (!base) return null;
  const url = `${base}/player_api.php?username=${encodeURIComponent(source.username)}&password=${encodeURIComponent(source.password)}${query}`;
  const { res } = await fetchPublic(url, { timeout: 12000 });
  if (!res.ok) { try { res.body && res.body.cancel(); } catch { /* ignore */ } return null; }
  const type = res.headers.get('content-type') || '';
  if (!/json/i.test(type)) { try { res.body && res.body.cancel(); } catch { /* ignore */ } return null; }
  return res.json().catch(() => null);
}

/** Upstream Xtream se live channels (sirf admin ke "test" ke liye). */
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

/** M3U link se channels — admin isay import kar ke apne catalogue mein daal sakta hai. */
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
