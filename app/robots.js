import { absUrl } from '@/lib/config';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/checkout', '/thank-you', '/cart', '/offline', '/account/iptv'] }],
    sitemap: absUrl('/sitemap.xml'),
  };
}
