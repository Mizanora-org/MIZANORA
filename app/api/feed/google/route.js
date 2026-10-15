import { getProducts } from '@/lib/products';
import { SITE, absUrl, shippingFor } from '@/lib/config';

export const revalidate = 600;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n) => `${Number(n).toFixed(2)} PKR`;

// Google product category (Google's own taxonomy) from the product name first, then its shop category.
const GCAT = [
  [/watch/i, 'Apparel & Accessories > Jewelry > Watches'],
  [/bag|handbag|clutch|purse/i, 'Apparel & Accessories > Handbags, Wallets & Cases > Handbags'],
  [/shoe|boot|heel|slipper|sandal|sneaker|footwear/i, 'Apparel & Accessories > Shoes'],
  [/suit|dress|kurta|kurti|jacket|shirt|trouser|fashion|abaya|scarf/i, 'Apparel & Accessories > Clothing'],
  [/toy|kid|car for kids/i, 'Toys & Games'],
  [/mobile|phone|charger|earbud|cable/i, 'Electronics > Electronics Accessories'],
  [/electronic|gadget|speaker|headphone/i, 'Electronics'],
  [/home|kitchen|tool|screwdriver/i, 'Home & Garden'],
  [/beauty|care|perfume/i, 'Health & Beauty'],
  [/sport|outdoor|binocular|tactical/i, 'Sporting Goods'],
  [/grocery|food|honey|spice/i, 'Food, Beverages & Tobacco'],
  [/auto|car|bike/i, 'Vehicles & Parts'],
];
const gcat = (p) => { const t = `${p.name} ${(p.categories || []).join(' ')}`; return (GCAT.find(([re]) => re.test(t)) || [null, ''])[1]; };
const wearable = (g) => /Apparel/.test(g);
const gender = (p) => (/\b(women|woman|ladies|girls?)\b|women's|womens/i.test(p.name) ? 'female' : /\b(men|man|boys?)\b|men's|mens/i.test(p.name) ? 'male' : 'unisex');

// Product feed for Google Merchant Center (free listings in Google Search, Shopping tab and Images).
// Merchant Center > Products > Feeds > add a "scheduled fetch" feed and use  https://YOUR-DOMAIN/api/feed/google
export async function GET() {
  const products = await getProducts();
  const items = products.filter((p) => p.images[0] && p.price > 0).map((p) => `
    <item>
      <g:id>${esc(p.slug)}</g:id>
      <g:title>${esc(p.name.slice(0, 150))}</g:title>
      <g:description>${esc((p.description || p.name).replace(/\s+/g, ' ').slice(0, 4900))}</g:description>
      <g:link>${esc(absUrl(`/product/${p.slug}`))}</g:link>
      <g:image_link>${esc(p.images[0])}</g:image_link>${p.images.slice(1, 10).map((u) => `
      <g:additional_image_link>${esc(u)}</g:additional_image_link>`).join('')}
      <g:availability>${p.inStock ? 'in_stock' : 'out_of_stock'}</g:availability>
      <g:condition>new</g:condition>
      <g:price>${money(p.comparePrice > p.price ? p.comparePrice : p.price)}</g:price>${p.comparePrice > p.price ? `
      <g:sale_price>${money(p.price)}</g:sale_price>${p.saleEndsAtMs ? `
      <g:sale_price_effective_date>${new Date().toISOString().slice(0, 19)}+00:00/${new Date(p.saleEndsAtMs).toISOString().slice(0, 19)}+00:00</g:sale_price_effective_date>` : ''}` : ''}
      <g:brand>${esc(SITE.name)}</g:brand>
      <g:identifier_exists>no</g:identifier_exists>${gcat(p) ? `
      <g:google_product_category>${esc(gcat(p))}</g:google_product_category>` : ''}${wearable(gcat(p)) ? `
      <g:gender>${gender(p)}</g:gender>
      <g:age_group>${/kid|child|baby/i.test(p.name) ? 'kids' : 'adult'}</g:age_group>` : ''}${(p.options.find((o) => /size/i.test(o.name)) || { values: [] }).values[0] && wearable(gcat(p)) ? `
      <g:size>${esc(p.options.find((o) => /size/i.test(o.name)).values[0])}</g:size>` : ''}
      <g:item_group_id>${esc(p.slug)}</g:item_group_id>${p.category ? `
      <g:product_type>${esc(p.category)}</g:product_type>` : ''}${(p.options.find((o) => /colou?r/i.test(o.name)) || { values: [] }).values[0] ? `
      <g:color>${esc(p.options.find((o) => /colou?r/i.test(o.name)).values.slice(0, 3).join('/'))}</g:color>` : ''}
      <g:shipping>
        <g:country>PK</g:country>
        <g:service>Standard</g:service>
        <g:price>${money(shippingFor(p.price))}</g:price>
      </g:shipping>
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
