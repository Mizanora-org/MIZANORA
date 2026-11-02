import { adminDb, adminReady } from '../firebase-admin';
import { ACCESS_DOC, EMPTY_ACCESS, cleanAccess, accessVerdict, applyAccessChange } from '../iptvAccess';

// BLACKLIST / WHITELIST ka gateway side.
// Rules `siteMeta/iptvAccess` mein hote hain (browser se read nahi ho sakte — firestore.rules dekhen).
// Har instance 20 second cache rakhta hai, is liye stream par Firestore ka bojh nahi parta.

const TTL = 20_000;
let cache = { at: 0, rules: EMPTY_ACCESS };

export function primeAccessRules(rules) {
  cache = { at: Date.now(), rules: cleanAccess(rules) };
  return cache.rules;
}

export function cachedAccessRules() { return cache.rules; }

export async function getAccessRules(force = false) {
  if (!force && cache.at && Date.now() - cache.at < TTL) return cache.rules;
  if (!adminReady()) { primeAccessRules(EMPTY_ACCESS); return cache.rules; }
  try {
    const snap = await adminDb().collection(ACCESS_DOC.collection).doc(ACCESS_DOC.id).get();
    const rules = cleanAccess(snap.exists ? snap.data() : EMPTY_ACCESS);
    primeAccessRules(rules);
    return rules;
  } catch {
    // Firestore fail ho to purana cache — kabhi sab ko block na karein
    return cache.rules;
  }
}

export async function saveAccessRules(rules) {
  const clean = cleanAccess({ ...rules, updatedAt: Date.now() });
  if (!adminReady()) return { ok: false, error: 'Firestore connect karein (FIREBASE_SERVICE_ACCOUNT).' };
  await adminDb().collection(ACCESS_DOC.collection).doc(ACCESS_DOC.id).set(clean, { merge: false });
  primeAccessRules(clean);
  return { ok: true, rules: clean };
}

/** Ek change apply karke save karo (add / remove / mode / clear / note). */
export async function changeAccessRules(change) {
  const current = await getAccessRules(true);
  const res = applyAccessChange(current, change);
  if (!res.ok) return res;
  return saveAccessRules(res.rules);
}

/** @returns {{blocked:boolean, reason:string, list?:string}} */
export async function accessDenied(subject = {}) {
  const rules = await getAccessRules();
  return accessVerdict(rules, subject);
}
