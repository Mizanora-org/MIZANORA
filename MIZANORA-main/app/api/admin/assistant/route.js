import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { DEFAULT_CFG, clearAssistantCache, explainError, geminiCall, keyState, ladderFor, loadAssistant, splitKeys } from '@/lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const mask = (k) => (k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : '****');

// Admin-only: assistant settings and the list of Gemini API keys. Keys are stored in Firestore where ONLY this server can
// read them (the public rules deny everything), and the browser only ever receives a masked version.
async function snapshot() {
  const { cfg, keys } = await loadAssistant(true);
  const rest = keyState();
  return {
    ok: true, cfg, defaults: DEFAULT_CFG,
    keys: keys.map((k) => ({ id: k.id, label: k.label, masked: mask(k.key), fromEnv: k.id.startsWith('env'), resting: Boolean(rest[k.id]) })),
  };
}

export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  if (!adminReady()) return NextResponse.json({ ok: false, error: 'Firebase Admin is not set up (FIREBASE_SERVICE_ACCOUNT). Keys cannot be saved without it, but GEMINI_API_KEYS in Vercel still works.' }, { status: 503 });
  return NextResponse.json(await snapshot());
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  if (!adminReady()) return NextResponse.json({ ok: false, error: 'Firebase Admin is not set up.' }, { status: 503 });
  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 }); }
  const db = adminDb();
  try {
    if (b.action === 'saveConfig') {
      await db.collection('assistantConfig').doc('main').set({ ...b.cfg, updatedAtMs: Date.now() }, { merge: true });
    } else if (b.action === 'addKey') {
      // One key or many at once (new lines / commas). Old AIza... keys and new AQ.... keys (they contain a dot) both work.
      const list = splitKeys(b.key);
      if (!list.length) return NextResponse.json({ ok: false, error: 'That does not look like a Gemini API key. Copy the whole key from aistudio.google.com/apikey (it starts with AQ. or AIza and has no spaces).' }, { status: 400 });
      const have = new Set((await db.collection('assistantKeys').get()).docs.map((d) => String(d.data().key || '')));
      const fresh = list.filter((k) => !have.has(k));
      if (!fresh.length) return NextResponse.json({ ok: false, error: 'This key is already added.' }, { status: 400 });
      let n = 0;
      for (const key of fresh.slice(0, 20)) { n += 1; await db.collection('assistantKeys').add({ key, label: String(b.label || '').slice(0, 40) || (fresh.length > 1 ? `Key ${n}` : ''), active: true, createdAtMs: Date.now() }); }
    } else if (b.action === 'deleteKey') {
      if (String(b.id).startsWith('env')) return NextResponse.json({ ok: false, error: 'This key comes from a Vercel variable. Remove it in Vercel.' }, { status: 400 });
      await db.collection('assistantKeys').doc(String(b.id)).delete();
    } else if (b.action === 'testKey') {
      const { keys, cfg } = await loadAssistant(true);
      const k = keys.find((x) => x.id === b.id);
      if (!k) return NextResponse.json({ ok: false, error: 'Key not found.' }, { status: 404 });
      const r = await geminiCall(ladderFor(cfg, 'fast'), { contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }], generationConfig: { maxOutputTokens: 20 } }, { keys: [k], timeoutMs: 12000, deadlineMs: 20000 });
      return NextResponse.json({ ok: true, works: r.ok, detail: r.ok ? `Key works (model: ${r.model}).` : `Failed (HTTP ${r.status}). ${explainError(r.status, r.error)}` });
    } else return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (e) { return NextResponse.json({ ok: false, error: `Could not save: ${e.message}` }, { status: 500 }); }
  clearAssistantCache();
  try { revalidateTag('assistant'); } catch { /* ignore */ }
  return NextResponse.json(await snapshot());
}
