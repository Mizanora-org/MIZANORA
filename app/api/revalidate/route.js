import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Called by the admin panel after saving a product or banner so the public pages update immediately.
export async function POST(req) {
  const admin = await verifyAdmin(req);
  if (!admin.ok) return NextResponse.json({ ok: false }, { status: admin.status });
  const { slug, tags } = await req.json().catch(() => ({}));
  // A settings-only save invalidates its tagged data and dependent routes. Invalidating the
  // entire root layout as well would make unrelated pages regenerate (and burn ISR writes).
  // Images and ads are included because their admin screens already send these tags.
  const LIGHT = ['quran', 'deals-config', 'inject', 'theme', 'app-music', 'reel-music', 'feed-posts', 'livetv', 'github', 'images', 'ads'];
  if (Array.isArray(tags) && tags.length) {
    const allowed = [...new Set(tags.filter((t) => LIGHT.includes(t)))];
    if (!allowed.length) return NextResponse.json({ ok: false, error: 'No supported cache tags.' }, { status: 400 });
    allowed.forEach((t) => revalidateTag(t));
    return NextResponse.json({ ok: true, light: true });
  }
  // Clear the shared data cache first (this is the ONE Firestore re-read), then rebuild every page from it.
  revalidateTag('catalog');
  revalidateTag('reviews');
  revalidateTag('reel-music');
  revalidateTag('app-music');
  revalidateTag('theme');
  revalidateTag('feed-posts');
  revalidateTag('quran');
  revalidateTag('livetv');
  revalidateTag('deals-config');
  revalidateTag('inject');
  revalidateTag('github');
  revalidatePath('/', 'layout');
  ['/sitemap.xml', '/api/search-index', '/api/feed'].forEach((p) => revalidatePath(p));
  if (slug) revalidatePath(`/product/${String(slug).slice(0, 80)}`);
  return NextResponse.json({ ok: true });
}
