import { NextResponse } from 'next/server';
import { OK_HEADERS, MISS_HEADERS, handlePhoto } from '@/lib/photoServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// MIZANORA v60 - THE PHOTO SMALLENER.
//
// GET /api/photo?u=https%3A%2F%2Fhost%2Fbig.jpg&w=400
//
// Why: every product photo in the catalogue is a full-size JPEG on a supplier CDN. A card shows
// 200 px, a phone needs 400 - but the file was 150-500 KB and 800-2000 px wide. On a 4G phone that
// single mistake is worth several seconds of Largest Contentful Paint.
//
// This route fetches the original once, resizes it to the asked width, converts it to WebP and
// serves it from mizanora's own domain with a one-year cache. The next visitor (and the CDN) get
// the small file for free.
//
// All of the decisions (https only, no private hosts / SSRF, image-content check, size + time caps,
// the optional NEXT_PHOTO_HOSTS allow-list, and "never break a picture" fallbacks) live in
// lib/photoServer.js -> handlePhoto(), which is unit-tested by scripts/test-v60.mjs.
//
// Switch it off with NEXT_PHOTO_RESIZE=0 (lib/photo.js then returns the original links).
export async function GET(req) {
  const out = await handlePhoto(req.nextUrl.searchParams.get('u'), req.nextUrl.searchParams.get('w'));
  if (out.redirect) return NextResponse.redirect(out.redirect, 307);
  const headers = { ...out.headers };
  if (Buffer.isBuffer(out.body)) headers['Content-Length'] = String(out.body.length);
  return new NextResponse(out.body, { status: out.status, headers });
}
