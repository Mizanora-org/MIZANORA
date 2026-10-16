import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { geminiCall, ladderFor, loadAssistant, textOf } from '@/lib/gemini';
import { getCategories } from '@/lib/products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// OPTIONAL AI helper powered by Google Gemini. It turns a hard / long / vague search sentence into plain filters.
// The normal in-browser search runs first and costs nothing; this route is only called when that search is weak.
// RATE-LIMIT SAVERS: (1) every answer is remembered on the server for 24 h (same sentence = zero Gemini calls),
// (2) identical requests made at the same moment share ONE call, (3) the cheap "lite" model is tried first,
// (4) when Google says "slow down" the browser is told how long to wait and stops asking.
const hits = new Map();
const cache = new Map();   // normalized sentence -> { t, intent }
const inflight = new Map();
const TTL = 24 * 3600e3;
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff ]+/g, ' ').replace(/\s+/g, ' ').trim();

const SYSTEM = (cats) => `You turn a shopper's search sentence (English, Roman Urdu, Urdu script or Hindi, spelling mistakes allowed) into JSON for a Pakistani online shop. Reply with JSON only: {"keywords":["..."],"colors":["..."],"minPrice":0,"maxPrice":0,"sort":""}.
keywords = 1 to 6 short ENGLISH words that would appear in product names or category names of this shop (translate: joota=shoes, kapray=clothes, ghari=watch, jewellery=jewelry, chashma=sunglasses, topi=cap, jarabain=socks, khilone=toys, bartan=cookware). For gifts, occasions or needs think of the products: "shaadi ke liye" = bridal, party dress, jewelry; "gift for mother" = shawl, perfume, bag, suit; "sardi ke liye" = jacket, sweater, shawl, boots.
colors = English colour names only. Prices are Pakistani rupees; 0 = no limit; "5k" = 5000, "hazar" = 1000. sort = "low" (cheap/sasta/budget), "high" (expensive/premium), "new" or "".
${cats ? `This shop's categories: ${cats}. Prefer words from them when they fit.` : ''}`;

async function ask(q) {
  const { cfg } = await loadAssistant();
  let cats = '';
  try { cats = (await getCategories()).slice(0, 40).map((c) => c.name).join(', '); } catch { /* the search works without it */ }
  const r = await geminiCall(ladderFor(cfg, 'fast'), {
    systemInstruction: { parts: [{ text: SYSTEM(cats) }] },
    contents: [{ role: 'user', parts: [{ text: q }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 300 },
  }, { timeoutMs: 6500, deadlineMs: 11000, maxTries: 3 });
  if (!r.ok) return { fail: r };
  const m = textOf(r.json).match(/\{[\s\S]*\}/);
  const o = m ? JSON.parse(m[0]) : null;
  if (!o) return { fail: { status: 502 } };
  const list = (v) => (Array.isArray(v) ? v.map((x) => String(x).toLowerCase().slice(0, 30)).filter(Boolean).slice(0, 8) : []);
  return { intent: { words: list(o.keywords), colors: list(o.colors), min: Math.max(0, Number(o.minPrice) || 0), max: Math.max(0, Number(o.maxPrice) || 0), sort: ['low', 'high', 'new'].includes(o.sort) ? o.sort : '' } };
}

export async function POST(req) {
  const closed = await denyIf('aiSearch');
  if (closed) return closed;
  const { keys } = await loadAssistant();
  if (!keys.length) return NextResponse.json({ ok: false }, { status: 501 });
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const t0 = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => t0 - t < 60000); arr.push(t0); hits.set(ip, arr);
  if (hits.size > 3000) hits.clear();
  if (arr.length > 15) return NextResponse.json({ ok: false, wait: 30 }, { status: 429 });

  let q = '';
  try { q = String((await req.json()).q || '').slice(0, 120); } catch { /* ignore */ }
  const key = norm(q);
  if (key.length < 3) return NextResponse.json({ ok: false }, { status: 400 });

  const hit = cache.get(key);
  if (hit && t0 - hit.t < TTL) return NextResponse.json({ ok: true, intent: hit.intent, cached: true }, { headers: { 'Cache-Control': 'private, max-age=3600' } });

  let job = inflight.get(key);
  if (!job) { job = ask(key).finally(() => inflight.delete(key)); inflight.set(key, job); }
  try {
    const res = await job;
    if (res.intent) {
      if (cache.size > 3000) cache.clear();
      cache.set(key, { t: Date.now(), intent: res.intent });
      return NextResponse.json({ ok: true, intent: res.intent });
    }
    const f = res.fail || {};
    if (f.status === 429) return NextResponse.json({ ok: false, wait: Math.min(300, f.retryAfter || 45) }, { status: 429 });
    console.error('Gemini search HTTP', f.status);
    return NextResponse.json({ ok: false }, { status: 502 });
  } catch (e) {
    console.error('Gemini search failed', e.message);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
