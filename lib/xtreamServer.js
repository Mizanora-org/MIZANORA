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

async function getJson(url) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(XTREAM_TIMEOUT_MS),
    redirect: 'error',
    headers: { Accept: 'application/json, text/plain, */*', 'User-Agent': 'MizanoraTV/1.0' },
  });
  if (!r.ok) return { ok: false, error: `The panel answered ${r.status}.` };
  const reader = r.body.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > XTREAM_MAX_BYTES) {
      try { await reader.cancel(); } catch { /* stop reading */ }
      return { ok: false, error: 'The answer from the panel is larger than 8 MB.' };
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

  const [cats, live] = await Promise.all([
    getJson(xtreamApiUrl(creds, XTREAM_ACTIONS.liveCategories)),
    getJson(xtreamApiUrl(creds, XTREAM_ACTIONS.liveStreams)),
  ]);
  if (!live.ok) return live;
  const categories = readXtreamCategories(cats.ok ? cats.json : []);
  const streams = readXtreamStreams(live.json, creds, categories);

  return {
    ok: true,
    account,
    ...xtreamPreview({ account, live: streams.channels }),
    skipped: streams.skipped,
  };
}

/**
 * The real import. `what` picks what to pull: 'live' (default), 'vod', 'series'.
 * `categories` limits it to chosen category ids; empty means everything.
 */
export async function xtreamImport(input, opts = {}) {
  const test = await xtreamTest(input);
  if (!test.ok) return test;
  const creds = cleanXtreamCreds(input);
  const kind = opts.what === 'vod' ? 'vod' : opts.what === 'series' ? 'series' : 'live';
  const picked = Array.isArray(opts.categories) ? opts.categories : [];

  const cats = await getJson(xtreamApiUrl(creds, kind === 'live' ? XTREAM_ACTIONS.liveCategories : kind === 'vod' ? XTREAM_ACTIONS.vodCategories : XTREAM_ACTIONS.seriesCategories));
  const categories = readXtreamCategories(cats.ok ? cats.json : []);

  const list = await getJson(xtreamApiUrl(creds, kind === 'live' ? XTREAM_ACTIONS.liveStreams : kind === 'vod' ? XTREAM_ACTIONS.vodStreams : XTREAM_ACTIONS.series));
  if (!list.ok) return list;

  const channels = kind === 'live'
    ? readXtreamStreams(list.json, creds, categories, { categories: picked, hls: opts.hls !== false }).channels
    : readXtreamVod(list.json, creds, categories, kind, { categories: picked });

  return { ok: true, kind, channels, account: test.account, groups: test.groups };
}
