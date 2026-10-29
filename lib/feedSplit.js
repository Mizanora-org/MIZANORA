// v32: BIG CATALOGUES AND FEED FILES.
// A serverless function can only return about 4.5 MB. The shop's archive has
// 10,000+ products, so one Google / Meta feed was 9-16 MB: the platform refused
// it and the merchant got NOTHING (a silent 502 that looks like "the feed is
// broken"). The feeds and /catalog.json are now split into numbered parts that
// stay well under the limit, with the part count in the response headers.
//
//   /api/feed?part=1        /api/feed/google?part=2        /catalog.json?part=3
//
// Every part is a complete, valid feed/catalog file: add each part once in
// Merchant Center / Commerce Manager and the whole shop is covered.
export const FEED_PAGE = 2500;
export const FEED_MAX_PAGE = 5000;

export function feedPage(items, { page = 1, size = FEED_PAGE } = {}) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const per = Math.max(100, Math.min(FEED_MAX_PAGE, Math.floor(Number(size)) || FEED_PAGE));
  const pages = Math.max(1, Math.ceil(total / per));
  const p = Math.max(1, Math.min(pages, Math.floor(Number(page)) || 1));
  const from = (p - 1) * per;
  return { items: list.slice(from, from + per), total, pages, page: p, size: per, from, to: Math.min(total, from + per) };
}

// The headers tell a merchant (and our own tests) exactly what they received.
export function feedHeaders(r, selfPath = '') {
  const h = {
    'X-Feed-Total': String(r.total),
    'X-Feed-Pages': String(r.pages),
    'X-Feed-Page': String(r.page),
    'X-Feed-Items': String(r.items.length),
    'X-Feed-Page-Size': String(r.size),
  };
  if (selfPath && r.pages > 1) {
    const sep = selfPath.includes('?') ? '&' : '?';
    const links = [];
    if (r.page > 1) links.push(`<${selfPath}${sep}part=${r.page - 1}>; rel="prev"`);
    if (r.page < r.pages) links.push(`<${selfPath}${sep}part=${r.page + 1}>; rel="next"`);
    links.push(`<${selfPath}${sep}part=1>; rel="first"`, `<${selfPath}${sep}part=${r.pages}>; rel="last"`);
    h.Link = links.join(', ');
  }
  return h;
}

// A comment at the top of an XML feed: which part is this and what comes next?
export function feedNote(r, selfPath = '') {
  const more = r.pages > 1
    ? ` Part ${r.page} of ${r.pages} (products ${r.from + 1}-${r.to} of ${r.total}). ${r.page < r.pages ? `Next part: ${selfPath}?part=${r.page + 1}` : 'This is the last part.'}`
    : ` All ${r.total} products in one file.`;
  return `<!-- MIZANORA feed.${more} -->`;
}
