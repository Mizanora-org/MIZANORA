// CIRCUIT BREAKER for the free Firebase quota. When Firestore answers "quota exceeded" (RESOURCE_EXHAUSTED / HTTP 429), every other
// read in this server process is skipped for 5 minutes instead of waiting 10 to 20 seconds to fail again. That keeps pages fast and
// stops a deployment from timing out while the daily quota is used up (the quota resets about midnight Pacific time).
let until = 0;
export const quotaTripped = () => Date.now() < until;
export function noteFirestoreError(e) {
  const m = String((e && e.message) || e || '');
  if (/RESOURCE_EXHAUSTED|Quota exceeded|quota|HTTP 429/i.test(m)) until = Date.now() + 5 * 60e3;
}
export const quotaError = () => new Error('Firestore quota is used up (skipping reads for a few minutes)');
