import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { SOURCE_DOC, cleanSource, sourceReady } from '@/lib/gateway/source';
import { upstreamLive, m3uLive, readUpstreamJson } from '@/lib/gateway/catalogue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// Password kabhi wapas nahi jata — sirf "set hai" ka ishara.
const mask = (s) => ({
  mode: s.mode, name: s.name, host: s.host, url: s.url, username: s.username,
  hasPassword: Boolean(s.password), enabled: s.enabled, updatedAt: s.updatedAt,
  ready: sourceReady(s),
});

export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: true, source: mask(cleanSource({})), demo: true });
  const snap = await adminDb().collection(SOURCE_DOC.collection).doc(SOURCE_DOC.id).get();
  return json({ ok: true, source: mask(cleanSource(snap.exists ? snap.data() : {})) });
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firestore connect karein (FIREBASE_SERVICE_ACCOUNT).' }, 503);

  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const action = String(b.action || 'save');
  const db = adminDb();
  const ref = db.collection(SOURCE_DOC.collection).doc(SOURCE_DOC.id);

  try {
    if (action === 'save') {
      const prev = await ref.get();
      const old = prev.exists ? cleanSource(prev.data()) : cleanSource({});
      const body = { ...b, password: String(b.password || '') || old.password };
      const source = cleanSource({ ...body, updatedAt: Date.now() });
      if (!source.enabled) return json({ ok: false, error: 'Source adhoora hai — host/username/password ya M3U link dein.' }, 400);
      await ref.set(source, { merge: false });
      revalidateTag('iptv-source');
      return json({ ok: true, source: mask(source) });
    }

    if (action === 'test') {
      const prev = await ref.get();
      const old = prev.exists ? cleanSource(prev.data()) : cleanSource({});
      const source = cleanSource({ ...b, password: String(b.password || '') || old.password });
      if (!sourceReady(source)) return json({ ok: false, error: 'Pehle source ki detail bharein.' }, 400);

      if (source.mode === 'm3u') {
        const channels = await m3uLive(source);
        return json({ ok: true, channels: channels.length, mode: 'm3u', sample: channels.slice(0, 3).map((c) => ({ name: c.name, group: c.group })) });
      }

      const info = await readUpstreamJson(source, '');
      if (!info || !info.user_info) return json({ ok: false, error: 'Panel ne jawab nahi diya — host/username/password check karein.' }, 400);
      if (String(info.user_info.auth) === '0') return json({ ok: false, error: 'Panel ne login mana kar diya (auth 0).' }, 400);
      const channels = await upstreamLive(source);
      return json({
        ok: true,
        mode: 'xtream',
        channels: channels.length,
        account: {
          username: info.user_info.username || source.username,
          status: info.user_info.status || '',
          expired: String(info.user_info.status || '').toLowerCase() !== 'active',
          maxConnections: info.user_info.max_connections || '',
          expDate: info.user_info.exp_date || '',
        },
        sample: channels.slice(0, 3).map((c) => ({ name: c.name, group: c.group })),
      });
    }

    if (action === 'clear') {
      await ref.set(cleanSource({ enabled: false, updatedAt: Date.now() }), { merge: false });
      revalidateTag('iptv-source');
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('iptv source api:', e.message);
    return json({ ok: false, error: 'Server error' }, 500);
  }
}
