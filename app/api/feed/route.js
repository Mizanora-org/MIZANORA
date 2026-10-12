import { getProducts } from '@/lib/products';
import { SITE, absUrl } from '@/lib/config';

export const revalidate = 600;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Product catalog feed for Meta Commerce Manager (Facebook + Instagram Shops and catalog ads).
// In Commerce Manager: Catalog > Data sources > Add items > Data feed > use this URL (/api/feed) and set a daily schedule.
// The id equals the product slug, the same id the Meta Pixel sends as content_ids, so ads match your catalog.
export async function GET() {
  const products = await getProducts();
  const items = products.filter((p) => p.images[0]).map((p) => `
    <item>
      <g:id>${esc(p.slug)}</g:id>
      <g:title>${esc(p.name.slice(0, 150))}</g:title>
      <g:description>${esc((p.description || p.name).replace(/\s+/g, ' ').slice(0, 4900))}</g:description>
      <g:link>${esc(absUrl(`/product/${p.slug}`))}</g:link>
      <g:image_link>${esc(p.images[0])}</g:image_link>${p.images.slice(1, 10).map((u) => `
      <g:additional_image_link>${esc(u)}</g:additional_image_link>`).join('')}
      <g:availability>${p.inStock ? 'in stock' : 'out of stock'}</g:availability>
      <g:condition>new</g:condition>
      <g:price>${p.comparePrice > p.price ? p.comparePrice : p.price} PKR</g:price>${p.comparePrice > p.price ? `
      <g:sale_price>${p.price} PKR</g:sale_price>` : ''}
      <g:brand>${esc(SITE.name)}</g:brand>${p.category ? `
      <g:product_type>${esc((p.categories && p.categories.length ? p.categories : [p.category]).join(' > '))}</g:product_type>` : ''}
    </item>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${esc(SITE.name)}</title>
    <link>${esc(absUrl('/'))}</link>
    <description>${esc(SITE.description)}</description>${items}
  </channel>
</rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=600' } });
}
