import { getAuth } from 'firebase-admin/auth';
import { adminApp, adminReady } from './firebase-admin';
import { SITE } from './config';
import { noteFirestoreError } from './quota';
import { logSecurityEvent } from './securityControl';

// An ID token is NOT proof of admin status by itself. Verify it with Firebase Authentication,
// then compare the verified identity with the store owner's configured UID/email. Neither
// verification path below reads Firestore; a used-up Firestore quota cannot lock out the owner.
const identityConfigured = () => Boolean(process.env.ADMIN_UID || SITE.adminEmails.length);
const allowed = ({ uid, email, emailVerified }) =>
  (Boolean(process.env.ADMIN_UID) && uid === process.env.ADMIN_UID)
  || (emailVerified === true && SITE.adminEmails.includes(String(email || '').toLowerCase()));
const deny = (status, error) => ({ ok: false, status, error });

async function lookupIdentity(token) {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
    cache: 'no-store',
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) {
    if (r.status === 400 || r.status === 401) return deny(401, 'Please sign in again.');
    return deny(503, 'Firebase Authentication is temporarily unavailable. Please try again.');
  }
  const user = (await r.json()).users?.[0];
  if (!user?.localId) return deny(401, 'Please sign in again.');
  return { uid: user.localId, email: user.email, emailVerified: user.emailVerified === true, via: 'identity-toolkit' };
}

// Legacy fallback for a site that explicitly opts in and has not yet configured ADMIN_UID or
// NEXT_PUBLIC_ADMIN_EMAIL. Firestore rules MUST make productCosts admin-only. Disabled by default:
// an accidentally permissive ruleset must not make any signed-in customer an admin.
async function rulesProbe(token) {
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (process.env.ADMIN_RULES_FALLBACK !== '1' || !project) {
    return deny(503, 'Set ADMIN_UID (recommended) or NEXT_PUBLIC_ADMIN_EMAIL in Vercel to enable admin access without Firestore reads.');
  }
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/productCosts?pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(6000),
    });
    if (r.ok) return { ok: true, uid: '', via: 'rules-legacy' };
    if (r.status === 401) return deny(401, 'Please sign in again.');
    if (r.status === 429 || r.status >= 500) {
      noteFirestoreError(new Error(`Firestore HTTP ${r.status}`));
      return deny(503, 'Firestore quota or service is unavailable. Configure ADMIN_UID to stop depending on Firestore for admin login.');
    }
    return deny(403, 'not_admin');
  } catch {
    return deny(503, 'Could not verify admin access. Try again, or set ADMIN_UID to avoid Firestore reads.');
  }
}

// Every /api/admin/* endpoint calls this function. Never trust a UID parsed from an unverified JWT,
// never log or return the token, and never fall back to a rules probe after a VERIFIED non-admin.
export async function verifyAdmin(req) {
  const rejected = async (status, message, kind, reason) => {
    await logSecurityEvent(req, kind, { reason, severity: status === 403 ? 'high' : 'medium' });
    return deny(status, message);
  };
  const h = req.headers.get('authorization') || '';
  if (!/^Bearer\s+[^\s]+$/i.test(h) || h.length > 10000) return rejected(401, 'Please sign in again.', 'admin-auth-missing', 'missing-bearer');
  const token = h.replace(/^Bearer\s+/i, '');
  let user = null;

  if (adminReady()) {
    try {
      const d = await getAuth(adminApp()).verifyIdToken(token);
      user = { uid: d.uid, email: d.email, emailVerified: d.email_verified === true, via: 'admin-sdk' };
    } catch (e) {
      // Invalid/revoked/expired tokens cannot be rescued by any fallback. Only broken SDK
      // configuration/network may use Identity Toolkit as a separate, real verifier.
      const code = String(e?.code || '');
      if (/auth\/(?:argument-error|invalid|id-token|user-disabled|user-not-found|token-expired|session-cookie|revoked)/i.test(code)) {
        return rejected(401, 'Please sign in again.', 'admin-token-invalid', 'invalid-token');
      }
      console.error('admin token verifier unavailable:', code || 'configuration');
    }
  }

  if (!user) {
    try {
      const result = await lookupIdentity(token);
      if (result && result.ok === false) return result.status === 401
        ? rejected(401, result.error, 'admin-token-invalid', 'invalid-token') : result;
      user = result;
    } catch {
      return deny(503, 'Firebase Authentication is temporarily unavailable. Please try again.');
    }
  }
  if (user) {
    if (identityConfigured()) {
      return allowed(user) ? { ok: true, uid: user.uid, email: String(user.email || '').toLowerCase(), via: user.via }
        : rejected(403, 'not_admin', 'admin-access-denied', 'non-admin');
    }
    // Rules mode (opt-in) has to verify this *valid* identity against the admin-only collection.
    const probed = await rulesProbe(token);
    return probed.status === 403 ? rejected(403, probed.error, 'admin-access-denied', 'rules-probe') : probed;
  }
  // No Admin SDK and no public API key: fail closed, not "admin because token has an email".
  return deny(503, 'Firebase Authentication is not configured on the server.');
}
