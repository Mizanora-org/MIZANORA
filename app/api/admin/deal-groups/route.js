import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminReady } from '@/lib/firebase-admin';
import { applyGroup, previewGroup, undoGroup } from '@/lib/dealGroupsServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST { action: 'preview' | 'apply' | 'undo', group: {...} | id }  (admin only)
export async function POST(req) {
  const who = await verifyAdmin(req);
  if (!who.ok) return NextResponse.json({ ok: false, error: who.error }, { status: who.status });
  if (!adminReady()) return NextResponse.json({ ok: false, error: 'The server key (Firebase Admin) is not set, so prices cannot be changed from here.' }, { status: 501 });
  let b; try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  try {
    if (b.action === 'preview') return NextResponse.json(await previewGroup(b.group));
    if (b.action === 'apply') return NextResponse.json(await applyGroup(b.group));
    if (b.action === 'undo') return NextResponse.json(await undoGroup(b.id));
    return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
  } catch (e) {
    console.error('deal-groups failed:', e.message);
    return NextResponse.json({ ok: false, error: 'Could not finish. Please try again.' }, { status: 500 });
  }
}
