// Product links are still navigable without a prefetch. Bound speculative requests so a
// moving mouse or a scrolling finger cannot generate dozens of unused product pages at once.
const MAX_PER_MINUTE = 6;
const WINDOW_MS = 60_000;
const MAX_SEEN = 500;

export function createPrefetchBudget(prefetch, { now = Date.now, connection = () => null } = {}) {
  const seen = new Set();
  const recent = [];
  return (href) => {
    if (typeof href !== 'string' || !href || seen.has(href)) return false;
    const network = connection();
    const type = String(network?.effectiveType || '').toLowerCase();
    if (network?.saveData || type === 'slow-2g' || type === '2g') return false;

    const at = now();
    while (recent.length && at - recent[0] >= WINDOW_MS) recent.shift();
    if (recent.length >= MAX_PER_MINUTE) return false;
    try {
      const pending = prefetch(href);
      // Next normally returns void, but do not leave an unhandled rejection if that changes.
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } catch (_) { return false; }
    recent.push(at);
    seen.add(href);
    if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value);
    return true;
  };
}
