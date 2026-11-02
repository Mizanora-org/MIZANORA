import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from '../firebase-admin';
import { fetchPublic } from '../tvProxy';
import { epgIdFor, generatedGuide, mergeGuides, parseXmltv, scopedGuide } from '../iptvEpg';

// EPG GUIDE — do level:
//   1) admin ne XMLTV link(s) diye  -> asli programmes (cache 10 min)
//   2) jis channel ka programme na mile -> generated 2-ghante slots (guide khali nahi lagti)
// Mapping: siteMeta/iptvEpg { sources:[{url}], map:{channelId: epgId}, updatedAt }

export const EPG_DOC = { collection: 'siteMeta', id: 'iptvEpg' };
export const MAX_EPG_BYTES = 12 * 1024 * 1024;

export async function readEpgDoc() {
  if (!adminReady()) return { sources: [], map: {}, updatedAt: 0 };
  const snap = await adminDb().collection(EPG_DOC.collection).doc(EPG_DOC.id).get().catch(() => null);
  const d = snap && snap.exists ? snap.data() || {} : {};
  return {
    sources: (Array.isArray(d.sources) ? d.sources : []).filter((s) => s && /^https?:\/\//i.test(String(s.url || ''))).slice(0, 8),
    map: d.map && typeof d.map === 'object' ? d.map : {},
    updatedAt: Number(d.updatedAt) || 0,
  };
}

/** Aik XMLTV link padho (SSRF guard ke sath) — admin ke "Test" aur cache dono isi se. */
export async function fetchGuideSource(url, timeout = 15000) {
  if (!/^https?:\/\//i.test(String(url || ''))) return { ok: false, error: 'Link http(s) se shuru hona chahiye.' };
  try {
    const { res } = await fetchPublic(url, { timeout });
    if (!res.ok) return { ok: false, error: `Guide ne jawab nahi diya (${res.status}).` };
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_EPG_BYTES) return { ok: false, error: 'Guide 12 MB se bari hai.' };
    const text = new TextDecoder().decode(buf);
    if (!/<tv[\s>]/i.test(text)) return { ok: false, error: 'Yeh XMLTV file nahi lagti.' };
    const guide = parseXmltv(text);
    return { ok: true, ...guide, bytes: buf.byteLength };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'Guide 15 second mein nahi aayi.' : 'Guide kholi nahi ja saki.' };
  }
}

export async function fetchAllSources(sources = []) {
  const list = (Array.isArray(sources) ? sources : []).filter((s) => s && /^https?:\/\//i.test(String(s.url || ''))).slice(0, 8);
  const results = await Promise.all(list.map((s) => fetchGuideSource(s.url).catch(() => null)));
  const ok = results.filter((r) => r && r.ok);
  const merged = mergeGuides(ok);
  return { guide: merged, fetched: ok.length, failed: list.length - ok.length };
}

const cached = unstable_cache(async () => {
  const doc = await readEpgDoc();
  const { guide, fetched, failed } = await fetchAllSources(doc.sources);
  return { map: doc.map, sources: doc.sources, guide, fetched, failed, updatedAt: doc.updatedAt };
}, ['mz-iptv-epg-v2'], { revalidate: 600, tags: ['iptv', 'iptv-epg'] });

export const getEpg = () => cached();

/**
 * Hamare channels ke liye taiyar guide: mapping lagao, asli programmes rakho,
 * jahan khali ho wahan generated slots daal do.
 */
export function guideForChannels(channels = [], epg = {}) {
  const map = (epg && epg.map) || {};
  const mapped = channels.map((c) => ({ ...c, epg: String(map[String(c.id)] || c.epg || epgIdFor(c)) }));
  const real = scopedGuide(mapped, (epg && epg.guide) || { channels: [], programmes: [] }, { hours: 36 });
  const have = new Set(real.programmes.map((p) => p.channel));
  const missing = mapped.filter((c) => !c.off && !have.has(epgIdFor(c)));
  const fallback = generatedGuide(missing, { hours: 12, slotMinutes: 120 });
  const programmes = [...real.programmes, ...fallback].sort((a, b) => a.start - b.start);

  return {
    channels: mapped.map((c) => ({ id: epgIdFor(c), name: c.name || '', logo: c.logo || '' })),
    programmes,
    real: real.programmes.length,
    generated: fallback.length,
  };
}
