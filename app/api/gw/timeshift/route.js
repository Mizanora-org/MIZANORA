import { handleTimeshift } from '@/lib/gateway/timeshift';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Query style: /api/gw/timeshift?u=..&p=..&dur=60&start=2026-11-01:20-00&f=12
// (next.config /streaming/timeshift.php bhi isi par aata hai.)
export async function GET(req) {
  const url = new URL(req.url);
  return handleTimeshift(req, {
    u: url.searchParams.get('u') || url.searchParams.get('username') || '',
    p: url.searchParams.get('p') || url.searchParams.get('password') || '',
    f: url.searchParams.get('f') || url.searchParams.get('id') || '',
    start: url.searchParams.get('start') || '',
    dur: url.searchParams.get('dur') || url.searchParams.get('minutes') || '',
  });
}
