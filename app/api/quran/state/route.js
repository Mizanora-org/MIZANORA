import { NextResponse } from 'next/server';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { quotaTripped } from '@/lib/quota';
import { getQuranConfig } from '@/lib/quranServer';
import { STATE_DOC, SAVE_EVERY_MS, acceptMove, cleanState } from '@/lib/quranState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// GET  /api/quran/state          -> { ok, state: { surah, ayah, atMs } | null }   where the live recitation is right now
// POST /api/quran/state {surah, ayah}  a visitor reports the ayah being recited; the server only accepts honest steps forward.
// Reads and writes are kept small: the answer is remembered in the instance for 4 s and the write happens at most every 8 s.
let mem = null;      // { state, readAt }
let wroteAt = 0;
const hits = new Map();
const limited = (ip) => {
  const now = Date.now();
  const a = (hits.get(ip) || []).filter((t) => now - t < 60000); a.push(now); hits.set(ip, a);
  if (hits.size > 3000) hits.clear();
  return a.length > 40;
};

async function current() {
  const now = Date.now();
  if (mem && now - mem.readAt < 4000) return mem.state;
  let state = mem ? mem.state : null;
  try {
    if (adminReady() && !quotaTripped()) {
      const d = await adminDb().collection(STATE_DOC.collection).doc(STATE_DOC.id).get();
      state = d.exists ? cleanState(d.data()) : null;
      if (state && d.data().resetAtMs && !state.atMs) state.atMs = 0;
    }
  } catch (e) { console.error('quran state read failed:', e.message); }
  mem = { state, readAt: now };
  return state;
}

export async function GET() {
  const state = await current();
  return NextResponse.json({ ok: true, state }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  if (limited(ip)) return NextResponse.json({ ok: false }, { status: 429 });
  let b; try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const next = cleanState({ surah: b.surah, ayah: b.ayah, atMs: Date.now() });
  if (!next) return NextResponse.json({ ok: false }, { status: 400 });
  const cfg = await getQuranConfig();
  if (cfg.mode === 'off') return NextResponse.json({ ok: false }, { status: 409 });
  const cur = await current();
  if (!acceptMove(cur, next)) return NextResponse.json({ ok: true, state: cur, kept: true });
  mem = { state: next, readAt: Date.now() };
  const now = Date.now();
  const surahChanged = !cur || cur.surah !== next.surah;
  if ((surahChanged || now - wroteAt >= SAVE_EVERY_MS) && adminReady() && !quotaTripped()) {
    wroteAt = now;
    try { await adminDb().collection(STATE_DOC.collection).doc(STATE_DOC.id).set(next); } catch (e) { console.error('quran state write failed:', e.message); }
  }
  return NextResponse.json({ ok: true, state: next });
}
