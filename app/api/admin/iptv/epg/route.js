import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { IPTV_CATALOGUE, cleanCatalogue } from '@/lib/iptvCatalogue';
import { readShardedDoc } from '@/lib/gateway/shards';
import { EPG_DOC, fetchGuideSource, readEpgDoc } from '@/lib/gateway/epg';
import { autoMap, epgIdFor, generatedGuide, nowNext } from '@/lib/iptvEpg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 55;

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// EPG ADMIN — XMLTV link(s), auto mapping, preview.
//   GET  -> { sources, map, channels, preview }
//   POST { action:'test', url }        -> channels/programmes count
//   POST { action:'addSource', url }   -> save source + auto-map
//   POST { action:'removeSource', url }
//   POST { action:'map', map }         -> manual mapping (channelId -> epgId)
//   POST { action:'clear' }
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: true, demo: true, sources: [], map: {}, channels: [], preview: [] });

  const [doc, live] = await Promise.all([
    readEpgDoc(),
    readShardedDoc(IPTV_CATALOGUE.collection, IPTV_CATALOGUE.id, ['channels']).catch(() => ({})),
  ]);
  const cat = cleanCatalogue(live || {});
  const channels = cat.channels.slice(0, 2000).map((c) => ({
    id: c.id, name: c.name, group: c.group, epg: String(doc.map[c.id] || c.epg || ''),
  }));
  const mapped = channels.filter((c) => c.epg).length;
  const guide = generatedGuide(cat.channels.slice(0, 200), { hours: 4 });
  const preview = cat.channels.slice(0, 6).map((c) => {
    const id = String(doc.map[c.id] || c.epg || epgIdFor(c));
    const nn = nowNext({ programmes: guide }, id);
    return { id: c.id, name: c.name, epgId: id, now: nn.now?.title || '—' };
  });

  return json({
    ok: true,
    sources: doc.sources,
    map: doc.map,
    updatedAt: doc.updatedAt,
    counts: { channels: cat.channels.length, mapped, previewed: guide.length },
    channels,
    preview,
  });
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);

  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const action = String(b.action || '');

  if (action === 'test') {
    const r = await fetchGuideSource(String(b.url || ''));
    if (!r.ok) return json({ ok: false, error: r.error }, 400);
    return json({ ok: true, channels: r.channels.length, programmes: r.programmes.length, sample: r.channels.slice(0, 5) });
  }

  if (!adminReady()) return json({ ok: false, error: 'Firestore connect karein (FIREBASE_SERVICE_ACCOUNT).' }, 503);
  const db = adminDb();
  const ref = db.collection(EPG_DOC.collection).doc(EPG_DOC.id);
  const doc = await readEpgDoc();

  try {
    if (action === 'addSource') {
      const url = String(b.url || '').trim();
      if (doc.sources.some((s) => s.url === url)) return json({ ok: false, error: 'Yeh link pehle se hai.' }, 400);
      const r = await fetchGuideSource(url);
      if (!r.ok) return json({ ok: false, error: r.error }, 400);

      const live = cleanCatalogue(await readShardedDoc(IPTV_CATALOGUE.collection, IPTV_CATALOGUE.id, ['channels']).catch(() => ({})));
      const { map, unmatched } = autoMap(live.channels, r.channels);
      const mergedMap = { ...doc.map, ...map };

      await ref.set({
        sources: [...doc.sources, { url, addedAt: Date.now(), channels: r.channels.length, programmes: r.programmes.length }].slice(0, 8),
        map: mergedMap,
        updatedAt: Date.now(),
      }, { merge: true });
      revalidateTag('iptv-epg');

      return json({
        ok: true, added: url, channels: r.channels.length, programmes: r.programmes.length,
        mapped: Object.keys(map).length, unmatched: unmatched.length,
      });
    }

    if (action === 'removeSource') {
      const url = String(b.url || '');
      await ref.set({ sources: doc.sources.filter((s) => s.url !== url), updatedAt: Date.now() }, { merge: true });
      revalidateTag('iptv-epg');
      return json({ ok: true, sources: doc.sources.filter((s) => s.url !== url) });
    }

    if (action === 'map') {
      const next = { ...doc.map };
      for (const [channelId, epgId] of Object.entries(b.map || {})) {
        if (!channelId) continue;
        if (String(epgId || '').trim()) next[String(channelId)] = String(epgId).slice(0, 80);
        else delete next[String(channelId)];
      }
      await ref.set({ map: next, updatedAt: Date.now() }, { merge: true });
      revalidateTag('iptv-epg');
      return json({ ok: true, mapped: Object.keys(next).length });
    }

    if (action === 'clear') {
      await ref.set({ sources: [], map: {}, updatedAt: Date.now() }, { merge: false });
      revalidateTag('iptv-epg');
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('admin epg:', e.message);
    return json({ ok: false, error: e.message || 'Server error' }, 500);
  }
}
