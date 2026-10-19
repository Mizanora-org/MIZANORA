import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Search statistics are now counted in the Realtime Database by the browser (Admin > Dashboard shows them), so this old endpoint does
// nothing and costs no Firestore writes. It stays only so older cached pages that still call it get a clean answer.
export async function POST() {
  return new NextResponse(null, { status: 204 });
}
