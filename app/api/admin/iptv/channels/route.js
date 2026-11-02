import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { IPTV_CATALOGUE, cleanCatalogue, catalogueStats, fromM3U } from '@/lib/iptvCatalogue';
import { readShardedDoc, writeShardedDoc, shardInfo } from '@/lib/gateway/shards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB playlist — bohat bara ho to admin URL ke chunks de

// IPTV ka APNA channel catalogue (free Live TV se alag).
//   GET                       -> { channels, stats }
//   POST { action:'import', url }   -> M3U link se channels (save nahi hota)
//   POST { action:'import', text }  -> pasted M3U se channels
//   POST { action:'save', channels, enabled } -> catalogue save + cache clear
//   POST { action:'clear' }   -> catalogue khali
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: true, demo: true, channels: [], stats: { total: 0, live: 0, off: 0, groups: 0 } });

  const [data, shards] = await Promise.all([
    readShardedDoc(IPTV_CATALOGUE.collection, IPTV_CATALOGUE.id, ['channels']),
    shardInfo(IPTV_CATALOGUE.collection, IPTV_CATALOGUE.id),
  ]);
  const cat = cleanCatalogue(data || {});
  return json({ ok: true, ...cat, shards, stats: catalogueStats(cat) });
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firestore connect karein (FIREBASE_SERVICE_ACCOUNT) — phir yeh chalega.' }, 503);

  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const action = String(b.action || '');

  try {
    if (action === 'import') {
      let text = String(b.text || '');
      if (!text && b.url) {
        const url = String(b.url || '').trim();
        if (!/^https?:\/\//i.test(url)) return json({ ok: false, error: 'Link http(s) se shuru hona chahiye.' }, 400);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15000);
        try {
          const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'MizanoraIPTV/1.0' }, cache: 'no-store' });
          if (!r.ok) return json({ ok: false, error: `Playlist ne jawab nahi diya (${r.status}).` }, 400);
          const buf = await r.arrayBuffer();
          if (buf.byteLength > MAX_BYTES) return json({ ok: false, error: 'Playlist 8 MB se bari hai — chhote hisson mein import karein.' }, 413);
          text = new TextDecoder().decode(buf);
        } catch (e) {
          return json({ ok: false, error: e.name === 'AbortError' ? 'Link 15 second mein jawab nahi diya.' : 'Link khola nahi ja saka.' }, 400);
        } finally { clearTimeout(timer); }
      }
      if (!text.trim()) return json({ ok: false, error: 'M3U text ya link dein.' }, 400);
      const { channels, skipped } = fromM3U(text);
      if (!channels.length) return json({ ok: false, error: 'Is playlist mein koi http(s) channel nahi mila.' }, 400);
      return json({ ok: true, channels, skipped, stats: catalogueStats({ channels }) });
    }

    if (action === 'save') {
      const cat = cleanCatalogue({ ...b, updatedAt: Date.now() });
      if (!cat.channels.length) return json({ ok: false, error: 'Catalogue khali hai — pehle import karein.' }, 400);
      const saved = await writeShardedDoc(IPTV_CATALOGUE.collection, IPTV_CATALOGUE.id, cat, ['channels']);
      revalidateTag('iptv');
      return json({ ok: true, stats: catalogueStats(cat), shards: saved.shards });
    }

    if (action === 'clear') {
      await writeShardedDoc(IPTV_CATALOGUE.collection, IPTV_CATALOGUE.id, cleanCatalogue({ enabled: false, updatedAt: Date.now() }), ['channels']);
      revalidateTag('iptv');
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('iptv channels api:', e.message);
    return json({ ok: false, error: 'Server error' }, 500);
  }
}
