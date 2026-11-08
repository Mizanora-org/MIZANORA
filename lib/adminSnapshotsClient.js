import { authClient } from './firebase-client';

// Admin-only helper. JSON files are edited via /api/admin/snapshots only AFTER the file is
// deployed; before capture the existing Firebase client editor remains fully backward compatible.
export async function snapshotCall(kind, action, extra = {}) {
  const user = authClient().currentUser;
  if (!user) throw new Error('Sign in again.');
  const r = await fetch('/api/admin/snapshots', { method: 'POST', cache: 'no-store', headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}`,
  }, body: JSON.stringify({ kind, action, ...extra }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `Archive error ${r.status}`);
  return j;
}
