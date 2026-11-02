import { verifyUser } from './workerAuth';
import { adminDb } from './firebase-admin';

// Reseller panel ka gate. Reseller ka doc uske Firebase uid par hota hai
// (iptvResellers/{uid}), is liye admin panel se approve karte waqt wohi id likhni hai.
export async function verifyReseller(req) {
  const u = await verifyUser(req);
  if (!u.ok) return u;

  const snap = await adminDb().collection('iptvResellers').doc(u.uid).get();
  if (!snap.exists) {
    return { ok: false, status: 403, error: 'Reseller account nahi mila — pehle apply karein.', code: 'not_reseller', uid: u.uid };
  }

  const r = snap.data() || {};
  if (r.status !== 'approved') {
    return {
      ok: false, status: 403, uid: u.uid, code: 'pending',
      error: r.status === 'rejected' ? 'Application manzoor nahi hui.' : 'Application review mein hai — WhatsApp par follow up karein.',
      reseller: r,
    };
  }

  return { ok: true, uid: u.uid, reseller: { id: u.uid, ...r } };
}
