import { SITE, absUrl } from './config';
import { PAY_METHODS } from './payments';

// One helper so every page gets a canonical URL, Open Graph and Twitter tags the same way.
export function pageMeta({ title, description, path = '/', image = '/img/hero-banner.jpg', noindex = false, type = 'website', other }) {
  const abs = title && typeof title === 'object';
  const ogTitle = abs ? title.absolute : title ? `${title} | Mizanora` : undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    other,
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type, title: ogTitle, description, url: path, siteName: 'Mizanora', locale: 'en_PK',
      images: [{ url: image }],
    },
    twitter: { card: 'summary_large_image', title: ogTitle, description, images: [image] },
  };
}

// The founder is part of the organisation data, so Google can connect the store with the person who built it.
export const founderJsonLd = () => ({
  '@type': 'Person',
  name: 'Muaaz Iqbal',
  jobTitle: 'Founder & Developer',
  worksFor: { '@id': absUrl('/#org') },
  url: absUrl('/team'),
  address: { '@type': 'PostalAddress', addressLocality: 'Kasur', addressRegion: 'Punjab', addressCountry: 'PK' },
});

export const orgJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'OnlineStore',
  '@id': absUrl('/#org'),
  name: SITE.name,
  url: absUrl('/'),
  logo: absUrl('/icons/icon-512.png'),
  image: absUrl('/img/hero-banner.jpg'),
  description: SITE.description,
  telephone: `+${SITE.whatsapp}`,
  email: SITE.email,
  address: { '@type': 'PostalAddress', addressLocality: 'Kasur', addressRegion: 'Punjab', addressCountry: 'PK' },
  areaServed: 'PK',
  currenciesAccepted: 'PKR',
  paymentAccepted: PAY_METHODS.map((m) => m.label).join(', '),
  sameAs: SITE.social.filter((s) => s.url).map((s) => s.url),
  contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', telephone: `+${SITE.whatsapp}`, availableLanguage: ['en', 'ur'] },
  founder: founderJsonLd(),
  numberOfEmployees: { '@type': 'QuantitativeValue', minValue: 1 },
  knowsAbout: ['online shopping Pakistan', 'cash on delivery', 'Urdu voice assistant', 'worker commission programme'],
});

export const websiteJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': absUrl('/#website'),
  name: SITE.name,
  url: absUrl('/'),
  inLanguage: 'en-PK',
  publisher: { '@id': absUrl('/#org') },
  potentialAction: { '@type': 'SearchAction', target: `${absUrl('/products')}?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
});

export const breadcrumbJsonLd = (crumbs) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map(([path, name], i) => ({ '@type': 'ListItem', position: i + 1, name, item: absUrl(path) })),
});

export const faqJsonLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});
