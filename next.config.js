/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  compiler: { removeConsole: { exclude: ['error', 'warn'] } },
  experimental: { optimizePackageImports: ['lucide-react'] },
  // The product archive (data/catalog/*.json) is read from disk by the server, so it must travel with the serverless functions.
  outputFileTracingIncludes: { '/**': ['./data/catalog/**/*'] },
  images: {
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
    // Old store URLs -> new pages (keeps Google rankings and old links alive)
    const toProducts = ['shop', 'categories', 'new-arrivals', 'best-sellers', 'offers', 'search'];
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
