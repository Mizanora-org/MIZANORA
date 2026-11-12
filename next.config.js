/** @type {import('next').NextConfig} */
const nextConfig = {
  // Preview/dev proxies serve the app from *.e2b.app origins; without this Next 15 warns (and in a
  // future major would block) cross-origin dev asset requests.
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],

  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  compiler: { removeConsole: { exclude: ['error', 'warn'] } },
  experimental: { optimizePackageImports: ['lucide-react'] },
  // The product archive (data/catalog/*.json) is read from disk by the server, so it must travel with the serverless functions.
  // v36: the photo manifest must travel with the serverless functions too (it is read from disk).
  // v60: SCOPED ON PURPOSE. `'/**'` copied the whole 33 MB data folder into EVERY function, so each
  // cold start and each deploy shipped the archive and the IMDb seed to functions that never read
  // them. Only the routes that really touch those files get them now.
  outputFileTracingIncludes: {
    '/api/archive/{:path*}': ['./data/catalog/**/*'],
    '/api/admin/{:path*}': ['./data/catalog/**/*', './data/snap/**/*'],
    '/api/products/{:path*}': ['./data/catalog/**/*'],
    '/category/{:slug*}': ['./data/catalog/**/*'],
    '/product/{:slug*}': ['./data/catalog/**/*'],
    '/sitemaps/{:path*}': ['./data/catalog/**/*', './data/snap/**/*', './data/*.json', './data/*.txt'],
    // v62: the index and the core sitemap also read data/imdb-ids.txt + sitemap-version.txt from
    // disk. They were missing from the tracing list, so on a Vercel Function those files could be
    // absent and the index came back with an empty catalogue. Data-only files, only these routes.
    '/sitemap-index.xml': ['./data/*.txt', './data/*.json'],
    '/sitemap.xml': ['./data/*.txt', './data/*.json'],
    '/api/{:path*}': ['./data/snap/**/*', './data/*.json'],
  },
  images: {
    // v21: photos load straight from their own host by default. The Vercel optimizer has a monthly limit on source images; when it is
    // used up, or a host refuses it, EVERY photo broke. Set NEXT_IMAGE_OPTIMIZE=1 in Vercel to use the optimizer again.
    unoptimized: process.env.NEXT_IMAGE_OPTIMIZE !== '1',
    // WebP only: AVIF is smaller but very slow to create the first time (that was a source of lag on new product photos).
    formats: ['image/webp'],
    // Fewer size variants = more cache hits, faster photos, fewer image transformations on Vercel.
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1600],
    imageSizes: [44, 64, 96, 160, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Product images can come from ImgBB, Cloudinary, etc.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async redirects() {
    // Old store URLs -> new pages (keeps Google rankings and old links alive).
    // v28: /search is NO LONGER here. It is the real site-wide search page (tools, TV, Quran, guides);
    // this redirect used to make that page and its links unreachable.
    const toProducts = ['shop', 'categories', 'new-arrivals', 'best-sellers', 'offers'];
    return [
      ...toProducts.map((s) => ({ source: `/${s}`, destination: '/products', permanent: true })),
      { source: '/order-success', destination: '/thank-you', permanent: true },
      { source: '/track-order', destination: '/track', permanent: true },
      // v48: the IPTV section is gone for good. Old links (Google, WhatsApp, printed cards)
      // land on Live TV instead of a 404, so nothing that once worked now looks broken.
      { source: '/iptv', destination: '/live', permanent: true },
      { source: '/iptv/:path*', destination: '/live', permanent: true },
      { source: '/reseller', destination: '/live', permanent: true },
      { source: '/account/iptv', destination: '/account', permanent: true },
    ];
  },
  async headers() {
    // v62: ONE YEAR AT THE EDGE, ONE HOUR IN THE BROWSER.
    // A `s-maxage` header is the difference between "one origin transfer per file per deploy" and
    // "one per visitor". Browser `max-age` stays short so a new deployment is never pinned by an
    // immutable cache in a returning visitor's browser, while the CDN keeps the bytes for a year.
    // Vercel purges the CDN automatically on deploy, so this is safe for files that ship with the app.
    const EDGE_YEAR = [{ key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400' }];
    return [
      // v60: THE VERCEL CDN MUST ANSWER, NOT THE FUNCTION.
      // Every response that comes out of a Function (or out of middleware) is billed as
      // "Fast Origin Transfer". Relayed/streamed media had no edge caching at all, so every view
      // was a fresh origin response - that is what crossed the Hobby fair-use limit on 2026-11-08
      // and paused the shop. These headers let the edge keep the answers, so the same picture or
      // the same stream piece is transferred ONCE for everyone instead of once per visitor.
      { source: '/api/img', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, s-maxage=31536000, stale-while-revalidate=604800' }] },
      { source: '/api/poster/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800' }] },
      { source: '/api/songs/cdn', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, s-maxage=31536000, immutable' }] },
      // Live TV pieces are signed, immutable addresses: one download serves every viewer.
      { source: '/api/tv/p', headers: [{ key: 'Cache-Control', value: 'public, max-age=600, s-maxage=3600' }] },
      { source: '/sw.js', headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ] },
      { source: '/service-worker.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      // v62: self-hosted assets. Before this, /fonts/* and /brand/* had NO cache header at all and
      // /icons/* + /img/* only had a browser cache (no `s-maxage`), so the CDN re-fetched them.
      // At high traffic that is pure wasted origin transfer. /ads/embed.js is now loaded directly
      // on every page with ad slots — it MUST be a cached static file, never a Function.
      { source: '/icons/:path*', headers: EDGE_YEAR },
      { source: '/img/:path*', headers: EDGE_YEAR },
      { source: '/fonts/:path*', headers: EDGE_YEAR },
      { source: '/brand/:path*', headers: EDGE_YEAR },
      { source: '/ads/:path*', headers: EDGE_YEAR },
      { source: '/favicon.ico', headers: EDGE_YEAR },
      { source: '/icon.png', headers: EDGE_YEAR },
      { source: '/apple-icon.png', headers: EDGE_YEAR },
      { source: '/(.*)', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        ...(process.env.ALLOW_PREVIEW_IFRAME === '1' ? [] : [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }]),
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // microphone=(self): the shop's own pages may ask for the mic (voice assistant). Other websites embedded in the shop still cannot.
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
      ] },
    ];
  },
};
module.exports = nextConfig;
