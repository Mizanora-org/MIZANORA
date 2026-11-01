// v37: the network half of the Xtream Codes import (server only).
//
// The browser cannot call an IPTV panel itself: almost every panel refuses cross-site requests.
// So the shop's server does it, behind the admin check, with the same safety rules the M3U
// importer already uses:
//
//   1. the address is resolved first, and private / loopback / link-local targets are refused
//      (otherwise an admin form could be used to look inside the server's own network);
//   2. the answer is read with a hard size cap and a hard timeout;
//   3. redirects are not followed (a panel must not be able to bounce us somewhere else);
//   4. the password is never written to a log and never sent back to the browser.

import dns from 'node:dns/promises';
import net from 'node:net';
import {
  cleanXtreamCreds, readXtreamAccount, readXtreamCategories, readXtreamStreams, readXtreamVod,
  xtreamPreview, xtreamAccountUrl, xtreamApiUrl, XTREAM_ACTIONS, XTREAM_MAX_BYTES, XTREAM_TIMEOUT_MS,
  XTREAM_PART_MAX_BYTES, XTREAM_CONCURRENCY,
} from './xtream.js';

// Same rule as app/api/admin/tv-import: no private, loopback, link-local, CGNAT or multicast target.
export const isPrivateAddress = (ip) => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:');
  }
  return true;
};

/** Resolves the panel host and refuses anything inside a private network. */
export async function guardHost(hostname) {
  let addrs;
  try {
    addrs = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true });
  } catch {
    return { ok: false, error: 'This server address could not be found.' };
  }
  if (!addrs.length) return { ok: false, error: 'This server address could not be found.' };
  if (addrs.some((x) => isPrivateAddress(x.address))) {
    return { ok: false, error: 'That address is private or local. Use the public address of the panel.' };
  }
  return { ok: true };
}

/**
 * One JSON call to the panel, read as a stream so a runaway answer is cut off at maxBytes
 * instead of being pulled into memory whole. Every caller passes its own cap: a single
 * category gets a small one, the bulk fallback gets the big one.
 */
async function getJson(url, maxBytes = XTREAM_MAX_BYTES, timeoutMs = XTREAM_TIMEOUT_MS) {
  let r;
  try {
    r = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
      headers: { Accept: 'application/json, text/plain, */*', 'User-Agent': 'MizanoraTV/1.0' },
    });
  } catch (e) {
    if (e && e.name === 'TimeoutError') return { ok: false, error: 'The panel took too long to answer. Try importing fewer groups at a time.' };
    return { ok: false, error: 'Could not reach the panel. Check the server address.' };
  }
  if (!r.ok) return { ok: false, error: `The panel answered ${r.status}.` };
  const reader = r.body.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      try { await reader.cancel(); } catch { /* stop reading */ }
      return { ok: false, error: `The answer from the panel is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.` };
    }
    parts.push(value);
  }
  const text = Buffer.concat(parts).toString('utf8');
  try {
    return { ok: true, json: JSON.parse(text) };
  } catch {
    return { ok: false, error: 'The panel did not answer with JSON. Check the server address (it should end in the panel root, not /live/...).' };
  }
}

/**
 * Pull every stream of one kind.
 *
 * The naive way - one `get_live_streams` call - is 30+ MB of JSON on a big panel, which is
 * enough to time a serverless function out (or to blow its memory). So when the panel
 * publishes categories we fetch ONE CATEGORY AT A TIME: each answer is a few hundred KB, and
 * XTREAM_CONCURRENCY of them fly in parallel. Only panels with no categories at all fall back
 * to the single big fetch.
 *
 * Returns { ok, rows, byCategory: Map(id -> rows), bulk: boolean, errors: [] }.
 */
async function pullStreams(creds, kind, categoryIds, catsOk) {
  const action = kind === 'live' ? XTREAM_ACTIONS.liveStreams : kind === 'vod' ? XTREAM_ACTIONS.vodStreams : XTREAM_ACTIONS.series;
  const ids = (categoryIds || []).map(String).filter(Boolean);

  // No categories published (or the category call failed): one bulk fetch.
  if (!catsOk || !ids.length) {
    const bulk = await getJson(xtreamApiUrl(creds, action), XTREAM_MAX_BYTES, XTREAM_TIMEOUT_MS);
    if (!bulk.ok) return { ...bulk, rows: [], byCategory: new Map(), bulk: true, errors: [] };
    return { ok: true, rows: Array.isArray(bulk.json) ? bulk.json : [], byCategory: new Map(), bulk: true, errors: [] };
  }

  const urlFor = (id) => `${xtreamApiUrl(creds, action)}&category_id=${encodeURIComponent(id)}`;
  const byCategory = new Map();
  const errors = [];
  const rows = [];

  // Small pools keep the panel (and our memory) comfortable. Order is preserved.
  for (let i = 0; i < ids.length; i += XTREAM_CONCURRENCY) {
    const batch = ids.slice(i, i + XTREAM_CONCURRENCY);
    const answers = await Promise.all(batch.map(async (id) => {
      const r = await getJson(urlFor(id), XTREAM_PART_MAX_BYTES, XTREAM_TIMEOUT_MS);
      return { id, r };
    }));
    for (const { id, r } of answers) {
      if (!r.ok) { errors.push(`${id}: ${r.error}`); continue; }
      const part = Array.isArray(r.json) ? r.json : [];
      byCategory.set(id, part);
      for (const row of part) rows.push(row);
    }
    // The panel said "no such category" or is rate-limiting us: stop hammering it.
    if (errors.length > Math.max(6, Math.ceil(ids.length / 4)) && !rows.length) {
      return { ok: false, error: `The panel would not answer for these groups. ${errors[0] || ''}`.trim(), rows: [], byCategory: new Map(), bulk: false, errors };
    }
  }
  if (!rows.length && errors.length) {
    return { ok: false, error: errors[0] || 'The panel returned no channels.', rows: [], byCategory: new Map(), bulk: false, errors };
  }
  return { ok: true, rows, byCategory, bulk: false, errors };
}

/**
 * "Test connection": who is this account, and what is on it.
 * Returns the account plus the channel counts and groups, but never the password.
 */
export async function xtreamTest(input) {
  const creds = cleanXtreamCreds(input);
  if (!creds.ok) return creds;
  const guard = await guardHost(creds.server.host);
  if (!guard.ok) return guard;

  const acc = await getJson(xtreamAccountUrl(creds));
  if (!acc.ok) return acc;
  const account = readXtreamAccount(acc.json);
  if (!account.ok) {
    return {
      ok: false,
      auth: account.auth,
      error: account.message || `The panel refused this login (status: ${account.status}).`,
      expired: account.expired,
    };
  }

  // The counts come from the categories, so a "test" never has to parse 100,000 channels.
  const cats = await getJson(xtreamApiUrl(creds, XTREAM_ACTIONS.liveCategories));
  const categories = readXtreamCategories(cats.ok ? cats.json : []);
  const ids = [...categories.keys()];
  const live = await pullStreams(creds, 'live', ids, cats.ok);
  if (!live.ok) return live;

  const groupCounts = new Map();
  if (live.bulk) {
    // No categories published: group the rows by whatever group name is on the row itself.
    const streams = readXtreamStreams(live.rows, creds, categories);
    for (const c of streams.channels) groupCounts.set(c.group, (groupCounts.get(c.group) || 0) + 1);
  } else {
    for (const [id, rows] of live.byCategory) {
      const name = categories.get(id) || 'Live';
      groupCounts.set(name, (groupCounts.get(name) || 0) + rows.length);
    }
  }

  return {
    ok: true,
    account,
    ...xtreamPreview({ account, live: [...groupCounts.entries()].map(([group, n]) => ({ group, count: n })) }),
    counts: { live: live.rows.length, vod: 0, series: 0 },
    groups: [...groupCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    partial: live.errors.length > 0,
    errors: live.errors.slice(0, 3),
  };
}

/**
 * The real import. `what` picks what to pull: 'live' (default), 'vod', 'series'.
 * `categories` limits it to chosen category ids; empty means everything.
 */
export async function xtreamImport(input, opts = {}) {
  const creds = cleanXtreamCreds(input);
  if (!creds.ok) return creds;
  const guard = await guardHost(creds.server.host);
  if (!guard.ok) return guard;

  const acc = await getJson(xtreamAccountUrl(creds));
  if (!acc.ok) return acc;
  const account = readXtreamAccount(acc.json);
  if (!account.ok) {
    return { ok: false, auth: account.auth, error: account.message || `The panel refused this login (status: ${account.status}).`, expired: account.expired };
  }

  const kind = opts.what === 'vod' ? 'vod' : opts.what === 'series' ? 'series' : 'live';
  const picked = (Array.isArray(opts.categories) ? opts.categories : []).map(String).filter(Boolean);

  const cats = await getJson(xtreamApiUrl(creds, kind === 'live' ? XTREAM_ACTIONS.liveCategories : kind === 'vod' ? XTREAM_ACTIONS.vodCategories : XTREAM_ACTIONS.seriesCategories));
  const categories = readXtreamCategories(cats.ok ? cats.json : []);
  const ids = picked.length ? picked.filter((id) => categories.has(id)) : [...categories.keys()];

  const list = await pullStreams(creds, kind, ids, cats.ok);
  if (!list.ok) return list;

  const channels = kind === 'live'
    ? readXtreamStreams(list.rows, creds, categories, { categories: picked, hls: opts.hls !== false }).channels
    : readXtreamVod(list.rows, creds, categories, kind, { categories: picked });

  return {
    ok: true, kind, channels, account,
    // How the list was fetched: useful when a huge panel only partly answers.
    fetched: list.bulk ? 'bulk' : 'by-group',
    groupsTried: ids.length,
    partial: list.errors.length > 0,
    errors: list.errors.slice(0, 3),
  };
}
