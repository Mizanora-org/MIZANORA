'use client';
import { authClient } from './firebase-client';

// Small browser-side helpers that keep the admin panel from re-reading Firestore again and again.
// Lists are kept in sessionStorage for a few minutes and updated locally after every save/delete.
const key = (n) => `mz_admin_${n}`;

export function readCache(name, ttlMs = 10 * 60 * 1000) {
  try {
    const j = JSON.parse(sessionStorage.getItem(key(name)) || 'null');
    if (j && Array.isArray(j.v) && Date.now() - j.t < ttlMs) return j.v;
  } catch (_) { /* storage unavailable: just read from Firestore */ }
  return null;
}
export function writeCache(name, value) {
  try { sessionStorage.setItem(key(name), JSON.stringify({ t: Date.now(), v: value })); } catch (_) { /* ignore */ }
}

// Tells the server to refresh the shared product/banner/reel/review cache and the public pages (1 Firestore re-read, once).
export async function revalidateSite(slug) {
  try {
    const token = await authClient().currentUser.getIdToken();
    await fetch('/api/revalidate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(slug ? { slug } : {}) });
  } catch (_) { /* the public pages also refresh by themselves after a few hours */ }
}
