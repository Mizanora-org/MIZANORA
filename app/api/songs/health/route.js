import { NextResponse } from 'next/server';
import { mirrorHealth, mirrorSnapshot } from '@/lib/songMirrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// /api/songs/health — which music mirrors answer right now, and how fast.
// The admin Songs page and the public songs page use this to explain a silent player honestly.
export async function GET() {
  const report = await mirrorHealth(5000);
  return NextResponse.json(
    { ...report, recent: mirrorSnapshot().slice(0, 8) },
    { headers: { 'cache-control': 'no-store' } },
  );
}
