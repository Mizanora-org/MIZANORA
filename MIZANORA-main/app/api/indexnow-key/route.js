// IndexNow ownership file (Bing, Yandex and others learn about new/changed pages instantly). Set INDEXNOW_KEY in Vercel to any random text of 16 to 64 letters/numbers.
export const dynamic = 'force-dynamic';
export async function GET() {
  const key = process.env.INDEXNOW_KEY || '';
  return new Response(key, { status: key ? 200 : 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
