import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { ghHead, ghInfo, ghReady } from '@/lib/github';
import { snapshotGet, snapshotList, SNAPSHOT_TYPES } from '@/lib/snapshot';
import { captureSetting, liveSetting, readSetting, remoteSetting, revisionOf, saveArchivedSetting } from '@/lib/snapshotStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'private, no-store' } });

// Public configs only. Every action is behind the same verified admin auth as the other tools.
// Capture is *explicit*, does one fresh Firestore read then a GitHub commit, NEVER deletes data.
// The file becomes active only after the deployment contains it. From then on every edit commits
// a new version and makes ZERO Firestore reads/writes. Private/dynamic information stays private.
export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Invalid JSON.' }, 400); }
  const action = String(b?.action || 'status');
  const kind = String(b?.kind || '');
  if (action !== 'status' && !Object.hasOwn(SNAPSHOT_TYPES, kind)) return json({ ok: false, error: 'Unknown setting.' }, 400);
  try {
    if (action === 'status') return json({ ok: true, types: await snapshotList(), github: { ready: ghReady(), ...ghInfo() } });
    if (action === 'read') {
      const r = await readSetting(kind);
      return json({ ok: true, ...r, deployed: r.source === 'archive' });
    }
    if (action === 'verify') {
      const deployed = await snapshotGet(kind);
      if (!deployed) return json({ ok: false, error: 'No deployed archive file yet. Wait for the deployment before verifying.' }, 409);
      const head = ghReady() ? await ghHead() : '';
      const remote = head ? await remoteSetting(kind, head) : null;
      const repoMatches = Boolean(remote && revisionOf(remote.data) === revisionOf(deployed.data));
      // Verify reads the old Firestore source ONCE because the admin explicitly asked, not on page views.
      let liveMatches = null, liveError = '';
      try { liveMatches = revisionOf(await liveSetting(kind)) === revisionOf(deployed.data); }
      catch (e) { liveError = e.message; }
      return json({ ok: true, kind, deployed: true, repoMatches, liveMatches, liveError,
        count: Array.isArray(deployed.data) ? deployed.data.length : Array.isArray(deployed.data.channels) ? deployed.data.channels.length : Array.isArray(deployed.data.customMovies) ? deployed.data.customMovies.length : 1,
        message: repoMatches ? 'The deployed file matches the current GitHub copy. Public reads now use this file and not Firestore.' : 'GitHub has a newer/different setting; wait for the next deployment.' });
    }
    if (action === 'capture') {
      const result = await captureSetting(kind, b.confirm);
      return json({ ok: true, ...result, message: `Committed ${kind} to ${result.branch}. Wait for the website deployment, then open this page again. The old Firestore data was NOT deleted.` });
    }
    if (action === 'save') {
      if (!b.data || typeof b.data !== 'object') return json({ ok: false, error: 'Setting data is required.' }, 400);
      const result = await saveArchivedSetting(kind, b.data);
      return json({ ok: true, ...result, message: `Saved in the repo. The public page will update AFTER ${result.branch} is deployed (not instantly). No Firebase write was made.` });
    }
    if (action === 'upsert' || action === 'delete') {
      if (kind !== 'banners' && kind !== 'reels') return json({ ok: false, error: 'This action is only for banners or reels.' }, 400);
      const s = await snapshotGet(kind);
      if (!s || !Array.isArray(s.data)) return json({ ok: false, error: 'Deploy the snapshot before editing it.' }, 409);
      const id = String(b.id || '').slice(0, 120);
      if (!id || id.includes('/')) return json({ ok: false, error: 'Invalid item ID.' }, 400);
      const rows = s.data.filter((r) => r.id !== id);
      if (action === 'upsert') rows.push({ id, data: b.data });
      const result = await saveArchivedSetting(kind, rows);
      return json({ ok: true, ...result, message: `Saved to the repo, visible after ${result.branch} deploys.` });
    }
    return json({ ok: false, error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error('snapshot admin action failed:', action, kind, e.message);
    return json({ ok: false, error: e.message || 'Archive failed.' }, e.status >= 400 && e.status < 600 ? e.status : 500);
  }
}
