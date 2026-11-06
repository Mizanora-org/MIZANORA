import { absUrl } from '@/lib/config';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/checkout', '/thank-you', '/cart', '/offline'] }],
    // v54: the index lists the core /sitemap.xml AND every IMDb movie/series chunk
    // (/sitemaps/movies-0.xml …), so Google can discover the whole catalogue.
    sitemap: [absUrl('/sitemap-index.xml'), absUrl('/sitemap.xml')],
  };
}
