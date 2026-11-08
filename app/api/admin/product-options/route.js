import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { archiveCards } from '@/lib/archive';
import { getProducts } from '@/lib/products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lightweight name list for the reels editor. The archived catalogue stays in repo files;
// downloading every Firestore product to the browser on each visit is unnecessary.
export async function GET(req) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  try {
    const [archived, live] = await Promise.all([archiveCards(), getProducts()]);
    const options = new Map(archived.list.map((p) => [p.id, { id: p.id, name: p.name }]));
    for (const p of live) options.set(p.id, { id: p.id, name: p.name });
    return NextResponse.json({ ok: true, options: [...options.values()].sort((a, b) => a.name.localeCompare(b.name)) },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
}
