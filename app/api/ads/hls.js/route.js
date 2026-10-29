import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

// hls.js for the ADS player (.m3u8 video ads and live links).
// Served by the shop itself so an ad on ANY website can play HLS without a
// third-party CDN. The embed script falls back to jsDelivr if this 404s.
// hls.js is MIT licensed; the file comes from the installed dependency.
export async function GET() {
  const tries = [
    path.join(process.cwd(), 'node_modules', 'hls.js', 'dist', 'hls.min.js'),
    path.join(process.cwd(), 'node_modules', 'hls.js', 'dist', 'hls.light.min.js'),
  ];
  for (const file of tries) {
    try {
      const code = fs.readFileSync(file, 'utf8');
      return new Response(code, {
        headers: {
          'Content-Type': 'text/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
          'X-Content-Type-Options': 'nosniff',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch { /* try the next file */ }
  }
  return new Response('/* hls.js not bundled */', {
    status: 404,
    headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' },
  });
}
