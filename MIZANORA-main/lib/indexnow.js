import { SITE, absUrl } from './config';

// Fast discovery for search engines: IndexNow tells Bing, Yandex, Seznam and Naver (and partners) about new or changed
// pages the moment they change - no waiting for a crawl. Google learns from sitemap.xml as usual.
// Set INDEXNOW_KEY (16 to 64 letters/numbers) in Vercel and the ownership file at /api/indexnow-key serves it.
// Everything here is fire-and-forget: a failure never breaks the action that triggered it.
export async function pingIndexNow(paths) {
  const key = process.env.INDEXNOW_KEY || '';
  if (!key) return { ok: false, skipped: 'INDEXNOW_KEY is not set' };
  const list = (Array.isArray(paths) ? paths : [paths]).filter(Boolean).slice(0, 500).map((p) => absUrl(String(p).startsWith('/') ? p : `/${p}`));
  if (!list.length) return { ok: false, skipped: 'no urls' };
  try {
    const host = new URL(absUrl('/')).host;
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: absUrl('/api/indexnow-key'), urlList: list }),
      signal: AbortSignal.timeout(8000),
    });
    return { ok: r.ok || r.status === 202, status: r.status, count: list.length, site: SITE.name };
  } catch (e) { return { ok: false, error: String(e.message || e).slice(0, 120) }; }
}
