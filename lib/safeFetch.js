import dns from 'node:dns/promises';
import net from 'node:net';
import { Agent, fetch as pinnedFetch } from 'undici';

// A DNS pre-check followed by ordinary fetch is NOT SSRF-safe: DNS can change before the
// connection. The undici connector below checks *all* answers at socket-creation time and
// hands the verified IP directly to the socket. Redirects are checked one hop at a time.
const blocked = new net.BlockList();
for (const [ip, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]) blocked.addSubnet(ip, prefix, 'ipv4');
// IPv6: public global unicast only; exclude documentation, Teredo, 6to4 and ORCHID.
for (const [ip, prefix] of [
  ['2001:db8::', 32], ['2001::', 32], ['2001:10::', 28],
  ['2001:20::', 28], ['2002::', 16],
]) blocked.addSubnet(ip, prefix, 'ipv6');

export function isPrivateIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return blocked.check(ip, 'ipv4');
  if (family === 6) return !/^[23][0-9a-f]{3}:/i.test(ip) || blocked.check(ip, 'ipv6');
  return true;
}

export function publicUrl(raw, { httpsOnly = false, hosts = null, exactHosts = false, maxLength = 2000 } = {}) {
  if (typeof raw !== 'string' || !raw || raw.length > maxLength || /[\s\x00-\x1f]/.test(raw)) throw new Error('bad public URL');
  let u; try { u = new URL(raw); } catch { throw new Error('bad public URL'); }
  if ((httpsOnly && u.protocol !== 'https:') || (!httpsOnly && !['http:', 'https:'].includes(u.protocol))) throw new Error('bad protocol');
  if (u.username || u.password || !u.hostname || u.hash) throw new Error('bad public URL');
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.onion') || !h.includes('.') && !net.isIP(h)) throw new Error('private address');
  if (net.isIP(h) && isPrivateIp(h)) throw new Error('private address');
  if (hosts && !hosts.some((allowed) => exactHosts ? h === allowed : (allowed.startsWith('*.') ? h.endsWith(allowed.slice(1)) : h === allowed || h.endsWith(`.${allowed}`)))) throw new Error('host not allowed');
  return u;
}

export async function resolvePublicHost(host, lookup = dns.lookup) {
  const h = String(host || '').replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) throw new Error('private address');
  const all = net.isIP(h) ? [{ address: h, family: net.isIP(h) }] : await lookup(h, { all: true });
  if (!Array.isArray(all) || !all.length || all.some(({ address }) => isPrivateIp(address))) throw new Error('private address');
  return all;
}

// Every new socket uses this lookup. Never cache a public DNS decision independently from the
// actual connection: hostnames resolving to 127.0.0.1 on a later request must be refused.
const dispatcher = new Agent({ connections: 8, keepAliveTimeout: 10000, connect: {
  lookup(host, options, cb) {
    resolvePublicHost(host).then((addrs) => {
      if (options?.all) cb(null, addrs);
      else cb(null, addrs[0].address, addrs[0].family);
    }).catch((err) => cb(err));
  },
} });
export const assertPublicHost = async (host) => { await resolvePublicHost(host); };

export async function safePublicFetch(raw, { headers = {}, timeout = 10000, signal, httpsOnly = false, hosts = null, exactHosts = false, maxRedirects = 4, transport = pinnedFetch } = {}) {
  let cur = String(raw || '');
  const deadline = AbortSignal.timeout(Math.max(100, Math.min(30000, timeout)));
  const abort = signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, deadline]) : deadline;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = publicUrl(cur, { httpsOnly, hosts, exactHosts });
    // A literal IP may bypass lookup in the connector: publicUrl already checked it.
    const res = await transport(u.href, { dispatcher, redirect: 'manual', signal: abort, headers });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      try { await res.body?.cancel(); } catch { /* a redirect has no useful body */ }
      cur = new URL(res.headers.get('location'), u).href;
      continue;
    }
    return { res, finalUrl: u.href };
  }
  throw new Error('too many redirects');
}

// Never trust Content-Length: a server can omit it or lie. Stop reading after maxBytes.
export async function readLimited(res, maxBytes) {
  const length = Number(res.headers.get('content-length') || 0);
  if (length > maxBytes) { try { await res.body?.cancel(); } catch { /* ignore */ } throw new Error('response too large'); }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('empty response');
  const chunks = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) throw new Error('response too large');
      chunks.push(value);
    }
    return Buffer.concat(chunks, total);
  } finally { try { await reader.cancel(); } catch { /* body already finished */ } }
}
