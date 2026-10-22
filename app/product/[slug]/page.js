import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Banknote, Headphones, ShieldCheck, Truck } from 'lucide-react';
import { SITE, absUrl } from '@/lib/config';
import { getProduct, getProducts } from '@/lib/products';
import { formatPKR, discountPct, slugify } from '@/lib/format';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import Gallery from '@/components/Gallery';
import ProductActions from '@/components/ProductActions';
import PriceBlock from '@/components/PriceBlock';
import ProductCard from '@/components/ProductCard';
import TrackView from '@/components/TrackView';
import VideoEmbed from '@/components/VideoEmbed';
import ShareButtons from '@/components/ShareButtons';
import WishButton from '@/components/WishButton';
import { parseVideos } from '@/lib/video';
import { getReviews } from '@/lib/reviews';
import Stars from '@/components/Stars';
import ReviewForm from '@/components/ReviewForm';
import RecentlyViewed from '@/components/RecentlyViewed';
import JsonLd from '@/components/JsonLd';

export const revalidate = 1800; // data comes from the shared cache; the admin panel refreshes pages instantly
export const dynamicParams = true; // new products work immediately, without a redeploy

// Only the newest 60 products are built ahead of time. Every other product page is built the first time someone opens it
// and is then kept (dynamicParams) - so a catalogue with thousands of products still builds fast and never runs out of memory.
export async function generateStaticParams() {
  const all = await getProducts();
  return all.slice(0, 60).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return { title: 'Product not found', robots: { index: false } };
  const desc = (p.description || `Buy ${p.name} online in Pakistan.`).replace(/\s+/g, ' ').slice(0, 155);
  return pageMeta({
    title: `Buy ${p.name} Online in Pakistan`,
    description: `${p.name} for ${formatPKR(p.price)}. ${desc} Cash on delivery across Pakistan.`.slice(0, 300),
    path: `/product/${p.slug}`,
    image: p.images[0] || '/img/hero-banner.jpg',
    type: 'website',
    other: {
      'product:price:amount': String(p.price), 'product:price:currency': 'PKR',
      'product:availability': p.inStock ? 'in stock' : 'out of stock', 'product:condition': 'new',
      'product:retailer_item_id': p.slug, ...(p.category ? { 'product:category': p.category } : {}),
    },
  });
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();

  const all = await getProducts();
  const sameCat = all.filter((x) => x.slug !== p.slug && (x.categories || []).some((c) => (p.categories || []).includes(c)));
  const related = [...sameCat, ...all.filter((x) => x.slug !== p.slug && !sameCat.includes(x))].slice(0, 4);
  const off = discountPct(p.price, p.comparePrice);
  const url = absUrl(`/product/${p.slug}`);
  const videos = parseVideos(p.videos);
  const reviews = await getReviews(p.id);
  const avg = reviews.length ? reviews.reduce((t, r) => t + r.rating, 0) / reviews.length : 0;

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: p.name,
    description: p.description || p.name,
    image: p.images.length ? p.images : [absUrl('/img/hero-banner.jpg')],
    sku: p.slug,
    category: p.categories.length ? p.categories.join(' > ') : undefined,
    brand: { '@type': 'Brand', name: SITE.name },
    ...(p.specs.length ? { additionalProperty: p.specs.slice(0, 20).map((x) => ({ '@type': 'PropertyValue', name: x.k, value: x.v })) } : {}),
    ...(p.options.find((o) => /colou?r/i.test(o.name)) ? { color: p.options.find((o) => /colou?r/i.test(o.name)).values.join(', ') } : {}),
    ...(p.options.find((o) => /size/i.test(o.name)) ? { size: p.options.find((o) => /size/i.test(o.name)).values.join(', ') } : {}),
    ...(reviews.length ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: avg.toFixed(1), reviewCount: reviews.length }, review: reviews.slice(0, 10).map((r) => ({ '@type': 'Review', author: { '@type': 'Person', name: r.name }, reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 }, reviewBody: r.text })) } : {}),
    ...(videos.some((v) => v.type === 'youtube') ? { subjectOf: videos.filter((v) => v.type === 'youtube').map((v) => ({ '@type': 'VideoObject', name: `${p.name} video`, description: p.description || p.name, thumbnailUrl: v.thumb, uploadDate: new Date(p.updatedAt || p.createdAt || Date.now()).toISOString(), embedUrl: `https://www.youtube.com/embed/${v.id}`, contentUrl: v.url })) } : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'PKR',
      price: String(p.price),
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SITE.name },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: String(SITE.shippingFee), currency: 'PKR' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'PK' },
        deliveryTime: { '@type': 'ShippingDeliveryTime', handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 2, unitCode: 'DAY' }, transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 7, unitCode: 'DAY' } },
      },
      hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', applicableCountry: 'PK', url: absUrl('/returns') },
    },
  };

  return (
    <>
      <div className="mx-auto max-w-7xl px-3 pt-6 sm:px-4">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-faint">
          <Link href="/" className="hover:text-gold">Home</Link> / <Link href="/products" className="hover:text-gold">Products</Link> / {p.category && <><Link href={`/category/${slugify(p.category)}`} className="hover:text-gold">{p.category}</Link> / </>}{p.name}
        </nav>
        <div className="grid min-w-0 gap-8 lg:grid-cols-2">
          <Gallery images={p.images} videos={videos} name={p.name} slug={p.slug} />
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3"><h1 className="text-2xl font-extrabold leading-tight sm:text-4xl">{p.name}</h1><WishButton product={p} className="shrink-0" /></div>
            {p.categories.length > 0 && <p className="mt-2 flex flex-wrap gap-1.5">{p.categories.map((c) => <Link key={c} href={`/category/${slugify(c)}`} className="rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold hover:bg-gold/20">{c}</Link>)}</p>}
            <PriceBlock id={p.id} price={p.price} comparePrice={p.comparePrice} />
            <p className="mt-1 text-sm text-dim">{SITE.shippingFee > 0 ? `Delivery ${formatPKR(SITE.shippingFee)}` : 'Free delivery'} · Cash on delivery</p>
            <ProductActions product={p} />
            <ShareButtons url={url} title={p.name} />
            <ul className="mt-6 grid gap-2.5 rounded-2xl border border-line bg-surface p-4 text-sm text-dim">
              <li className="flex items-center gap-2.5"><Banknote size={18} className="text-gold" /> Pay cash when the parcel arrives</li>
              <li className="flex items-center gap-2.5"><Truck size={18} className="text-gold" /> Delivery across Pakistan</li>
              <li className="flex items-center gap-2.5"><ShieldCheck size={18} className="text-gold" /> We confirm your order by phone or message before dispatch</li>
              <li className="flex items-center gap-2.5"><Headphones size={18} className="text-gold" /> <span>Questions? <Link href="/contact" className="text-gold underline underline-offset-4">WhatsApp support</Link> and <Link href="/returns" className="text-gold underline underline-offset-4">returns info</Link></span></li>
            </ul>
          </div>
        </div>

        {p.specs.length > 0 && (
          <section className="mt-10" aria-labelledby="specs">
            <h2 id="specs" className="section-title mb-3">Product details</h2>
            <dl className="overflow-hidden rounded-2xl border border-line bg-surface text-sm">
              {p.specs.map((x, n) => (
                <div key={x.k} className={`grid grid-cols-[2fr_3fr] gap-3 px-4 py-2.5 ${n % 2 ? 'bg-raised/60' : ''}`}><dt className="font-semibold text-dim">{x.k}</dt><dd className="min-w-0 break-words text-cream">{x.v}</dd></div>
              ))}
            </dl>
          </section>
        )}

        <section className="mt-12" aria-labelledby="rev">
          <h2 id="rev" className="section-title mb-3">Customer reviews</h2>
          {reviews.length > 0 ? (
            <div className="mb-4 flex items-center gap-3"><span className="text-4xl font-extrabold">{avg.toFixed(1)}</span><div><Stars value={avg} size={20} /><p className="text-sm text-dim">{reviews.length} review{reviews.length > 1 ? 's' : ''}</p></div></div>
          ) : <p className="mb-4 text-dim">No reviews yet. Be the first to review this product.</p>}
          <ul className="mb-5 space-y-3">
            {reviews.map((r) => <li key={r.id} className="card !p-4"><div className="flex items-center justify-between gap-2"><b>{r.name}</b><Stars value={r.rating} /></div><p className="mt-1 text-sm text-dim">{r.text}</p></li>)}
          </ul>
          <ReviewForm productId={p.id} productName={p.name} />
        </section>

        <RecentlyViewed current={p.id} />

        {videos.length > 0 && (
          <section className="mt-10" aria-labelledby="vid">
            <h2 id="vid" className="section-title mb-3">Watch the video</h2>
            <VideoEmbed videos={videos} title={p.name} />
          </section>
        )}

        {p.description && (
          <section className="mt-10 max-w-3xl" aria-labelledby="desc">
            <h2 id="desc" className="section-title mb-3">Product details</h2>
            <div className="space-y-3 whitespace-pre-line leading-8 text-[#33423A]">{p.description}</div>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-12" aria-labelledby="rel">
            <h2 id="rel" className="section-title mb-5">You may also like</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
          </section>
        )}
        <p className="mt-10 text-sm text-dim">
          Not sure about the size? Read our <Link href="/blog/tactical-boots-buying-guide" className="text-gold underline underline-offset-4">tactical boots buying guide</Link>.
        </p>
      </div>
      <TrackView product={p} />
      <JsonLd data={[productLd, breadcrumbJsonLd([['/', 'Home'], ['/products', 'Products'], [`/product/${p.slug}`, p.name]])]} />
    </>
  );
}
