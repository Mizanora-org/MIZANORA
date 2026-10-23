import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { BOOKS, edition, hadithUrl, okBook, okLang, parseGrades, parseSection, parseSectionNames, sectionUrl } from '@/lib/hadith';

export const runtime = 'nodejs';
export const maxDuration = 30;

// GET /api/hadith?book=bukhari&lang=urd&section=1      -> { ok, title, sections:[{n,name}], hadiths:[...] }
// GET /api/hadith?book=bukhari&lang=urd&n=7             -> one hadith by its number in the book
// GET /api/hadith?book=bukhari&lang=eng&sections=1      -> only the list of sections (names)
// Only known books and languages are accepted. A failed fetch throws inside the cache, so a failure is never stored.
const hits = new Map();
async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`hadith data ${r.status}`);
  return r.json();
}
const cachedJson = unstable_cache(getJson, ['mz-hadith-v1'], { revalidate: 30 * 24 * 3600, tags: ['hadith'] });
const tryGet = async (url) => { for (let k = 0; k < 2; k++) { try { return await cachedJson(url); } catch (e) { if (k) return null; } } return null; };

export async function GET(req) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const a = (hits.get(ip) || []).filter((t) => now - t < 60000); a.push(now); hits.set(ip, a);
  if (hits.size > 3000) hits.clear();
  if (a.length > 50) return NextResponse.json({ ok: false, error: 'slow down' }, { status: 429 });

  const u = new URL(req.url).searchParams;
  const book = u.get('book') || 'bukhari';
  const lang = u.get('lang') || 'urd';
  if (!okBook(book) || !okLang(lang)) return NextResponse.json({ ok: false, error: 'unknown book or language' }, { status: 400 });
  const headers = { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' };

  // the section names always come from the English edition (the most complete one)
  const names = async () => parseSectionNames(await tryGet(sectionUrl('eng', book, 1)).then((j) => j || tryGet(sectionUrl('ara', book, 1))));

  if (u.get('sections')) {
    const sections = await names();
    return sections.length ? NextResponse.json({ ok: true, book, sections }, { headers }) : NextResponse.json({ ok: false, error: 'The hadith data is not reachable right now.' }, { status: 502 });
  }
  const one = Number(u.get('n'));
  if (u.get('n')) {
    if (!Number.isInteger(one) || one < 1 || one > 60000) return NextResponse.json({ ok: false, error: 'bad number' }, { status: 400 });
    const j = await tryGet(hadithUrl(lang, book, one));
    const h = j && Array.isArray(j.hadiths) && j.hadiths[0];
    if (!h || !String(h.text || '').trim()) return NextResponse.json({ ok: false, error: `Hadith ${one} was not found in ${edition(lang, book)}.` }, { status: 404 });
    return NextResponse.json({ ok: true, book, lang, hadiths: [{ n: h.hadithnumber || one, text: String(h.text).replace(/\s+/g, ' ').trim().slice(0, 4000), grades: parseGrades(h.grades), book: h.reference && h.reference.book, hadith: h.reference && h.reference.hadith }] }, { headers });
  }
  const sec = Number(u.get('section') || 1);
  if (!Number.isInteger(sec) || sec < 0 || sec > 200) return NextResponse.json({ ok: false, error: 'bad section' }, { status: 400 });
  const [j, sections] = await Promise.all([tryGet(sectionUrl(lang, book, sec)), names()]);
  const parsed = parseSection(j, sec);
  if (!parsed || !parsed.hadiths.length) {
    // this language does not exist for this book (or the data is down): say it clearly so the page can offer another language
    return NextResponse.json({ ok: false, missing: true, error: `${BOOKS.find((b) => b.key === book).name} is not available in this language right now.` }, { status: 404 });
  }
  return NextResponse.json({ ok: true, book, lang, section: sec, title: (sections.find((x) => x.n === sec) || {}).name || parsed.title, sections, hadiths: parsed.hadiths }, { headers });
}
