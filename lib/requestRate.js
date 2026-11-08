// Cheap per-instance burst protection. Durable manual blocks live in private RTDB (securityControl).
// Serverless instances do NOT share this map: for fleet-wide bot mitigation also enable your
// hosting provider's WAF/rate rules. Never put a Firebase read/write on every media segment.
const buckets = new Map();
export function limitRequest(scope, ip, max, windowMs = 60_000, now = Date.now()) {
  if (!ip) return { allowed: true, retryAfter: 0 }; // no reliable proxy IP: never block every visitor as 'unknown'
  const key = `${scope}:${ip}`;
  const item = buckets.get(key);
  const b = item && item.until > now ? item : { count: 0, until: now + windowMs };
  b.count += 1;
  buckets.set(key, b);
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) if (v.until <= now) buckets.delete(k);
    if (buckets.size > 10000) buckets.clear();
  }
  return { allowed: b.count <= max, retryAfter: b.count <= max ? 0 : Math.max(1, Math.ceil((b.until - now) / 1000)), count: b.count };
}
