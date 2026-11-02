import { handleTimeshift } from '@/lib/gateway/timeshift';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Xtream apps ka standard catch-up path:
//   /timeshift/<user>/<pass>/<minutes>/<YYYY-MM-DD:HH-MM>/<channel>[.ts]
// Path se hi sab kuch nikal lete hain — koi rewrite/query interpolation nahi,
// is liye "HH-MM" jaisa colon wala segment bhi theek chalta hai.
export async function GET(req, ctx) {
  const raw = (await ctx?.params)?.parts;
  const parts = (Array.isArray(raw) ? raw : []).map((x) => decodeURIComponent(String(x || '')));
  const [u = '', p = '', dur = '', start = '', f = ''] = parts;
  return handleTimeshift(req, { u, p, dur, start, f });
}
