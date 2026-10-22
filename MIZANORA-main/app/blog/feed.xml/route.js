import { getPosts } from '@/lib/blog';
import { SITE, absUrl } from '@/lib/config';

export const revalidate = 3600;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// RSS feed of the shopping blog: lets Google, Bing and feed readers discover every new guide quickly.
export async function GET() {
  const items = getPosts().slice(0, 50).map((p) => `<item><title>${esc(p.title)}</title><link>${absUrl(`/blog/${p.slug}`)}</link><guid isPermaLink="true">${absUrl(`/blog/${p.slug}`)}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${esc(p.description || '')}</description></item>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(SITE.name)} shopping blog</title><link>${absUrl('/blog')}</link><description>${esc(SITE.description)}</description><language>en-pk</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}
