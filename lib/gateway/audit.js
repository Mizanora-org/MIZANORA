import { adminDb, adminReady } from '../firebase-admin';
import { clientIp } from './security';

// ADMIN AUDIT LOG — kaun sa admin kab kya kar gaya.
// `iptvEvents` mein `type: 'admin_action'` ke sath likha jata hai (wohi collection jo stream events rakhta hai),
// is liye alag index/collection ki zaroorat nahi. Read sirf admin API se hota hai.

export async function logAdmin(req, uid, action, extra = {}) {
  if (!adminReady()) return;
  try {
    await adminDb().collection('iptvEvents').add({
      type: 'admin_action',
      action: String(action || '').slice(0, 60),
      uid: String(uid || ''),
      ip: clientIp(req),
      ...extra,
      at: Date.now(),
    });
  } catch { /* audit fail ho to kaam na rukay */ }
}

export async function recentAudit(limit = 40) {
  if (!adminReady()) return [];
  try {
    const snap = await adminDb().collection('iptvEvents').where('type', '==', 'admin_action').limit(120).get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0))
      .slice(0, Math.max(1, Math.min(200, Number(limit) || 40)));
  } catch {
    return [];
  }
}

/** Audit entry ko ek line mein padhne layak banao (UI ke liye). */
export const auditText = (e = {}) => {
  const who = e.uid ? `admin ${String(e.uid).slice(0, 6)}…` : 'admin';
  const what = String(e.action || 'action');
  const target = e.username || e.id || e.value || '';
  return `${who} → ${what}${target ? ` · ${target}` : ''}`;
};
