import { getPosts, NEWS_CATEGORIES, CATEGORY_LABELS } from '@/lib/blog';
import { SITE, absUrl } from '@/lib/config';

export const revalidate = 1800;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// v37: an RSS feed for the news desk only, so /news can be followed on its own (the main
// /blog/feed.xml stays a shopping-guides feed, which is what most subscribers signed up for).
export async function GET() {
  const items = getPosts()
    .filter((p) => NEWS_CATEGORIES.includes(p.category))
    .slice(0, 50)
    .map((p) => `<item><title>${esc(p.title)}</title><link>${absUrl(`/blog/${p.slug}`)}</link><guid isPermaLink="true">${absUrl(`/blog/${p.slug}`)}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><category>${esc(CATEGORY_LABELS[p.category] || p.category)}</category><description>${esc(p.description || '')}</description></item>`)
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(SITE.name)} news desk</title><link>${absUrl('/news')}</link><description>World news, science and technology explained for Pakistani readers.</description><language>en-pk</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' } });
}
