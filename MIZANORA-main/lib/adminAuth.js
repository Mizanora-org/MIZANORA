import { getAuth } from 'firebase-admin/auth';
import { adminApp, adminReady } from './firebase-admin';
import { SITE } from './config';

const PID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

function uidOf(token) {
  try { const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); return p.user_id || p.sub || ''; } catch { return ''; }
}

// Server-side admin check for API routes. The browser sends its Firebase ID token.
// 1) Ask Firestore itself (same rules that protect orders). Needs no service-account key and no ADMIN_UID.
// 2) Fallback: Admin SDK + ADMIN_UID / NEXT_PUBLIC_ADMIN_EMAIL.
export async function verifyAdmin(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false, status: 401, error: 'Please sign in again.' };
  const uid = uidOf(token);

  if (PID) {
    try {
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents/orders?pageSize=1`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (r.ok) return { ok: true, uid };
      if (r.status === 401) return { ok: false, status: 401, error: 'Please sign in again.' };
    } catch (e) { console.error('rules check failed', e.message); }
  }

  if (adminReady()) {
    try {
      const d = await getAuth(adminApp()).verifyIdToken(token);
      const byUid = Boolean(process.env.ADMIN_UID) && d.uid === process.env.ADMIN_UID;
      const byEmail = Boolean(d.email_verified) && SITE.adminEmails.includes(String(d.email || '').toLowerCase());
      if (byUid || byEmail) return { ok: true, uid: d.uid };
    } catch { /* fall through */ }
  }
  return { ok: false, status: 403, error: 'not_admin', uid };
}
