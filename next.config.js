/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  compiler: { removeConsole: { exclude: ['error', 'warn'] } },
  experimental: { optimizePackageImports: ['lucide-react'] },
  // The product archive (data/catalog/*.json) is read from disk by the server, so it must travel with the serverless functions.
  // v36: the photo manifest must travel with the serverless functions too (it is read from disk).
  outputFileTracingIncludes: { '/**': ['./data/catalog/**/*', './data/*.json'] },
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
  async rewrites() {
    // IPTV GATEWAY (v42) — Xtream players apne aap in paths ko maangte hain, is liye
    // /player_api.php, /get.php, /xmltv.php aur /live/<user>/<pass>/<id>.m3u8 ko hamare
    // API routes par bhej diya jata hai. /live/<slug> (free TV) par koi asar nahi: rewrite
    // sirf teen hisson wale path par lagta hai.
    return [
      { source: '/player_api.php', destination: '/api/gw/player' },
      { source: '/panel_api.php', destination: '/api/gw/player' },
      { source: '/get.php', destination: '/api/gw/playlist' },
      { source: '/xmltv.php', destination: '/api/gw/epg' },
      { source: '/portal.php', destination: '/api/gw/portal' },
      { source: '/server/load.php', destination: '/api/gw/portal' },
      { source: '/stalker_portal/server/load.php', destination: '/api/gw/portal' },
      // MAG box portal root: /c/ aur /magload.php bhi isi handler par (MAC se auth hota hai).
      { source: '/c/:path*', destination: '/api/gw/portal' },
      { source: '/magload.php', destination: '/api/gw/portal' },
      { source: '/stalker_portal/c/:path*', destination: '/api/gw/portal' },
      { source: '/live/:u/:p/:f', destination: '/api/gw/x/live/:u/:p/:f' },
      { source: '/movie/:u/:p/:f', destination: '/api/gw/x/movie/:u/:p/:f' },
      { source: '/series/:u/:p/:f', destination: '/api/gw/x/series/:u/:p/:f' },
    ];
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
    ];
  },
  async headers() {
    return [
      { source: '/sw.js', headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ] },
      { source: '/icons/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }] },
      { source: '/img/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }] },
      { source: '/service-worker.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      { source: '/(.*)', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // microphone=(self): the shop's own pages may ask for the mic (voice assistant). Other websites embedded in the shop still cannot.
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
      ] },
    ];
  },
};
module.exports = nextConfig;
