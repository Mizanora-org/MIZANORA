import { NextResponse } from 'next/server';
import { geminiCall, loadAssistant, textOf } from '@/lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// OPTIONAL AI helper powered by Google Gemini. Works only when GEMINI_API_KEY is set in Vercel;
// otherwise the shop simply uses its built-in smart search. It sees only the search sentence, never customer data.
const hits = new Map();
const SYSTEM = 'You turn a shopper\'s search sentence (English, Roman Urdu or Hindi) into JSON for a Pakistani online shop. Reply with JSON only, in this shape: {"keywords":["english product words"],"colors":["english colour names"],"minPrice":0,"maxPrice":0,"sort":""}. sort is "low" (cheapest first), "high" (most expensive first), "new" or "". Translate Roman Urdu to English product words (joota = shoes, kapray = clothes, ghari = watch, suit = suit). Prices are in Pakistani rupees; 0 means no limit.';

export async function POST(req) {
  const { cfg, keys } = await loadAssistant();
  if (!keys.length) return NextResponse.json({ ok: false }, { status: 501 });
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000); arr.push(now); hits.set(ip, arr);
  if (hits.size > 3000) hits.clear();
  if (arr.length > 12) return NextResponse.json({ ok: false }, { status: 429 });

  let q = '';
  try { q = String((await req.json()).q || '').slice(0, 120); } catch { /* ignore */ }
  if (q.trim().length < 3) return NextResponse.json({ ok: false }, { status: 400 });

  // Uses the same pool of Gemini keys as the assistant (admin panel keys + Vercel variables), with automatic key switching.
  const r = await geminiCall(cfg.model, {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: q }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 600 },
  }, { timeoutMs: 8000 });
  if (!r.ok) { console.error('Gemini search HTTP', r.status); return NextResponse.json({ ok: false }, { status: 502 }); }
  try {
    const m = textOf(r.json).match(/\{[\s\S]*\}/);
    const o = m ? JSON.parse(m[0]) : null;
    if (!o) return NextResponse.json({ ok: false });
    const list = (v) => (Array.isArray(v) ? v.map((x) => String(x).toLowerCase().slice(0, 30)).slice(0, 8) : []);
    return NextResponse.json({ ok: true, intent: { words: list(o.keywords), colors: list(o.colors), min: Math.max(0, Number(o.minPrice) || 0), max: Math.max(0, Number(o.maxPrice) || 0), sort: ['low', 'high', 'new'].includes(o.sort) ? o.sort : '' } });
  } catch (e) {
    console.error('Gemini search failed', e.message);
    return NextResponse.json({ ok: false });
  }
}
