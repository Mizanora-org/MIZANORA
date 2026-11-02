import { handleStream } from '@/lib/gateway/handleStream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Path form (next.config rewrites yahan bhejta hai):
//   /live/:u/:p/:f   -> /api/gw/x/live/:u/:p/:f
//   /movie/...       -> /api/gw/x/movie/...
//   /series/...      -> /api/gw/x/series/...
export async function GET(req, ctx) {
  const parts = (ctx && ctx.params && (await ctx.params).parts) || [];
  const [kind = 'live', username = '', password = '', file = ''] = parts;
  return handleStream(req, { kind, username, password, file });
}
