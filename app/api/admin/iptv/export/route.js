import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { IPTV_CATALOGUE, cleanCatalogue } from '@/lib/iptvCatalogue';
import { VOD_DOC, cleanVod } from '@/lib/iptvVod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin ke liye export / inspection (BarakatWave jaisa "apna content dekho").
//   ?what=m3u   -> poora catalogue asli URLs ke sath (sirf admin, download)
//   ?what=macs  -> MAC lines ki CSV (MAG boxes ke liye)
//   ?what=config-> portal + Xtream URLs jo customer ko dena hai
const text = (body, name, type = 'text/plain; charset=utf-8') => new Response(body, {
  status: 200,
  headers: { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="${name}"` },
});

const baseOf = (req) => {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'mizanora.vercel.app';
  return `${proto}://${host}`;
};

export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  if (!adminReady()) return NextResponse.json({ ok: false, error: 'Firestore connect karein (FIREBASE_SERVICE_ACCOUNT).' }, { status: 503 });

  const q = new URL(req.url).searchParams;
  const what = String(q.get('what') || 'config');
  const base = baseOf(req);
  const db = adminDb();

  try {
    if (what === 'm3u') {
      const [liveSnap, vodSnap] = await Promise.all([
        db.collection(IPTV_CATALOGUE.collection).doc(IPTV_CATALOGUE.id).get(),
        db.collection(VOD_DOC.collection).doc(VOD_DOC.id).get(),
      ]);
      const live = cleanCatalogue(liveSnap.exists ? liveSnap.data() : {});
      const vod = cleanVod(vodSnap.exists ? vodSnap.data() : {});
      const out = ['#EXTM3U'];
      for (const c of live.channels) {
        if (c.off) continue;
        out.push(`#EXTINF:-1 tvg-name="${c.name}"${c.logo ? ` tvg-logo="${c.logo}"` : ''} group-title="${c.group}",${c.name}`);
        out.push(c.url);
      }
      for (const m of vod.movies) {
        if (m.off) continue;
        out.push(`#EXTINF:-1 tvg-name="${m.name}"${m.poster ? ` tvg-logo="${m.poster}"` : ''} group-title="${m.group}",${m.name}`);
        out.push(m.url);
      }
      for (const s of vod.series) {
        if (s.off) continue;
        for (const season of s.seasons) {
          for (const e of season.episodes) {
            out.push(`#EXTINF:-1 group-title="${s.group}",${s.name} S${String(season.n).padStart(2, '0')}E${String(e.n).padStart(2, '0')} - ${e.title}`);
            out.push(e.url);
          }
        }
      }
      return text(out.join('\n'), 'mizanora-catalogue.m3u', 'audio/x-mpegurl; charset=utf-8');
    }

    if (what === 'macs') {
      const snap = await db.collection('iptvLines').limit(2000).get();
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((l) => l.mac)
        .map((l) => [l.mac, l.username || '', l.clientName || l.name || '', l.plan || '', l.status || '', l.expiresAt ? new Date(Number(l.expiresAt)).toISOString().slice(0, 10) : ''].join(','));
      return text(['mac,username,name,plan,status,expires', ...rows].join('\n'), 'mizanora-macs.csv', 'text/csv; charset=utf-8');
    }

    // config: customer ko kya dena hai (real URLs — admin only)
    return NextResponse.json({
      ok: true,
      portal: `${base}/c/`,
      portalPhp: `${base}/portal.php`,
      xtream: base,
      m3u: `${base}/get.php?username=USER&password=PASS&type=m3u_plus&output=ts`,
      epg: `${base}/xmltv.php?username=USER&password=PASS`,
      note: 'MAC line banate waqt MAC (00:1A:79:xx:xx:xx) zaroor daalein — MAG box usi se login karta hai.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 });
  }
}
