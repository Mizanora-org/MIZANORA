import { getAuth } from 'firebase-admin/auth';
import { adminApp, adminReady } from './firebase-admin';
import { SITE } from './config';

const PID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

function uidOf(token) {
  try { const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); return p.user_id || p.sub || ''; } catch { return ''; }
}

// Server-side admin check for API routes. The browser sends its Firebase ID token.
//
// 1) Admin SDK (strongest): token verify + ADMIN_UID / verified admin email.
// 2) Firestore probe (no service key needed): a collection that ONLY the admin may list
//    (`productCosts`, see firestore.rules). The token is checked by Firebase itself.
//
// v47: pehle yeh probe `orders` par tha — orders ka read customer ko apni line tak mehdood hai,
// is liye list reject hoti thi. Magar jis din rules "signed-in user orders list kar sakta hai"
// ho jate, us din har signed-in user admin ban jata. Ab sirf admin-only collection probe hoti hai.
const ADMIN_PROBE = 'productCosts';

export async function verifyAdmin(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false, status: 401, error: 'Please sign in again.' };
  const uid = uidOf(token);

  if (adminReady()) {
    try {
      const d = await getAuth(adminApp()).verifyIdToken(token);
      const byUid = Boolean(process.env.ADMIN_UID) && d.uid === process.env.ADMIN_UID;
      const byEmail = Boolean(d.email_verified) && SITE.adminEmails.includes(String(d.email || '').toLowerCase());
      if (byUid || byEmail) return { ok: true, uid: d.uid, via: 'admin-sdk' };
    } catch { /* fall through to the rules probe */ }
  }

  if (PID) {
    try {
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents/${ADMIN_PROBE}?pageSize=1`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (r.ok) return { ok: true, uid, via: 'rules' };
      if (r.status === 401) return { ok: false, status: 401, error: 'Please sign in again.' };
    } catch (e) { console.error('admin rules check failed', e.message); }
  }

  return { ok: false, status: 403, error: 'not_admin', uid };
}
