import { getCategories } from '@/lib/products';
import { SITE, absUrl } from '@/lib/config';
import { PAY_METHODS, PREPAID_PERCENT } from '@/lib/payments';

export const revalidate = 3600;

// llms.txt: a plain-text guide that tells AI assistants what this store sells and where the clean data is.
export async function GET() {
  const cats = await getCategories();
  const pay = PAY_METHODS.map((m) => m.label).join(', ');
  const text = `# ${SITE.name}
> ${SITE.description}

Pakistani online store. Prices are in PKR. Delivery across Pakistan (about 2-7 days). Payment: ${pay}.${PREPAID_PERCENT ? ` ${PREPAID_PERCENT}% off when paying before delivery.` : ''}
Orders are confirmed by phone or message before dispatch. Support is on WhatsApp: https://wa.me/${SITE.whatsapp}

## Machine-readable data
- [Full product catalog (JSON, paged)](${absUrl('/catalog.json')}): every active product with price, stock, options and images.
  The shop has 10,000+ products, so the file is split into parts: read 'total', 'part', 'pages' and follow 'next',
  or ask for one part directly: '/catalog.json?part=2'.
- [Google/Meta product feed (XML, paged)](${absUrl('/api/feed')}): the same parts, numbered '?part=1..N'
  ('X-Feed-Pages' header, and a comment at the top of each file). '/api/feed/google' is the Google Merchant version.
- [Sitemap](${absUrl('/sitemap.xml')})

## Shop
- [All products](${absUrl('/products')}): search understands English, Roman Urdu and Urdu, for example "laal suit 2000 se kam"
${cats.slice(0, 40).map((c) => `- [${c.name}](${absUrl(`/category/${c.slug}`)}): ${c.count} products`).join('\n')}

## More
- [Deals: every discounted product in one list](${absUrl('/deals')})
- [Quran: 114 surahs with Urdu translation and recitation](${absUrl('/quran')})
- [Islamic reminders](${absUrl('/islamic')})
- [Muaaz Iqbal, founder and developer of Mizanora (Kasur, Pakistan)](${absUrl('/muaaz-iqbal')})
- [Blog](${absUrl('/blog')})

## Policies
- [Returns](${absUrl('/returns')})
- [Terms](${absUrl('/terms')})
- [Privacy](${absUrl('/privacy-policy')})
- [FAQ](${absUrl('/faq')})
- [How to order](${absUrl('/how-to-order')})
`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600' } });
}
