// IndexNow ownership file (Bing, Yandex and others learn about new/changed pages instantly). Set INDEXNOW_KEY in Vercel to any random text of 16 to 64 letters/numbers.
export const dynamic = 'force-dynamic';
export async function GET() {
  const key = process.env.INDEXNOW_KEY || '';
  // v62: a verification file is checked by crawlers repeatedly. Without `s-maxage` each check was a
  // fresh Vercel Function invocation; now one answer sits on the CDN for a year (purged on deploy).
  return new Response(key, { status: key ? 200 : 404, headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400',
  } });
}
