import { handleStream } from '@/lib/gateway/handleStream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Query form: /api/gw/stream?kind=live&u=<user>&p=<pass>&f=12.m3u8
// (Path form — /live/:u/:p/:f — /api/gw/x/[...parts] par jata hai.)
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  return handleStream(req, {
    kind: q.get('kind') || 'live',
    username: q.get('u') || '',
    password: q.get('p') || '',
    file: q.get('f') || '',
  });
}
