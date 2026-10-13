import { getAuth } from 'firebase-admin/auth';
import { adminApp, adminDb, adminReady } from './firebase-admin';

// Signed-in user from the Bearer token (any customer account). Returns { ok, uid, email } or { ok:false, status, error }.
export async function verifyUser(req) {
  if (!adminReady()) return { ok: false, status: 503, error: 'The store is not fully set up yet.' };
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false, status: 401, error: 'Please sign in first.' };
  try {
    const d = await getAuth(adminApp()).verifyIdToken(token);
    return { ok: true, uid: d.uid, email: String(d.email || '').toLowerCase() };
  } catch { return { ok: false, status: 401, error: 'Please sign in again.' }; }
}

// An APPROVED worker (status approved), or an error to return.
export async function verifyWorker(req) {
  const u = await verifyUser(req);
  if (!u.ok) return u;
  const snap = await adminDb().collection('workers').doc(u.uid).get();
  if (!snap.exists) return { ok: false, status: 403, error: 'You have not joined the worker program yet.' };
  const w = snap.data();
  if (w.status !== 'approved') return { ok: false, status: 403, error: 'Your worker account is not approved.' };
  return { ok: true, uid: u.uid, worker: w };
}

export async function findWorkerByCode(db, code) {
  if (!code) return null;
  const q = await db.collection('workers').where('code', '==', code).limit(1).get();
  if (q.empty) return null;
  const d = q.docs[0];
  const w = d.data();
  return w.status === 'approved' ? { id: d.id, ...w } : null;
}
