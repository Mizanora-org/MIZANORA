import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/movies/refresh?slug=tt0111161
//
// The "Retry now" button on a title page whose IMDb metadata could not be fetched. It throws away
// the cached render of that page (and the hub lists) and sends the visitor back to a fresh one.
// Without this, a cached empty page stayed empty for up to an hour even after IMDb recovered.
export async function GET(req) {
  const slug = String(req.nextUrl.searchParams.get('slug') || '').trim().toLowerCase().slice(0, 90);
  const safe = /^(tt\d{6,10}|[a-z0-9-]{2,90})$/.test(slug) ? slug : '';
  if (safe) {
    try {
      revalidatePath(`/movies/${safe}`);
      revalidatePath('/movies');
    } catch { /* not in a request scope — the redirect still helps */ }
  }
  return NextResponse.redirect(new URL(safe ? `/movies/${safe}` : '/movies', req.url), { status: 307 });
}
