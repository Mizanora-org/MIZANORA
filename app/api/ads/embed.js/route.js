import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

// Serves the embed script at /api/ads/embed.js (the same file also lives at
// /ads/embed.js in public/). Long cache: the script only changes on releases.
export async function GET() {
  const file = path.join(process.cwd(), 'public', 'ads', 'embed.js');
  let code = '';
  try { code = fs.readFileSync(file, 'utf8'); } catch { return new Response('/* mzads: not built */', { status: 404, headers: { 'Content-Type': 'text/javascript' } }); }
  return new Response(code, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      // v62: `s-maxage` is what makes the Vercel EDGE keep a Function response. Without it every
      // third-party site loading this embed (and every cached old Mizanora page) started a fresh
      // Function. The shop's own pages now use the static /ads/embed.js copy instead.
      'Cache-Control': 'public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
