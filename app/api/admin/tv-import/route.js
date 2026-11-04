import { NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import net from 'node:net';
import { verifyAdmin } from '@/lib/adminAuth';
import { parseM3U } from '@/lib/liveTv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin only. POST { url } -> downloads an M3U playlist from a link (the browser cannot, most
// playlist servers refuse cross-site requests) and returns { channels, skipped }.
// Safety: no private / local addresses (checked on EVERY hop, including redirects, so this
// cannot be used to look inside the server's own network), 32 MB at most, 45 seconds at most.
// Nothing is saved here: the admin reviews the list and presses Save.
//
// v49 fixes (the reasons "M3U link se channels load nahi ho rahe" kept happening):
//  - redirects are now followed BY HAND (checked each hop) instead of refused outright:
//    panel links, github.io lists and short links almost all answer with a redirect first;
//  - plain http:// playlist links work too (most home panels are http://host:8080/get.php...),
//    they were refused before with the whole import failing silently behind one message;
//  - the size cap grew 2 MB -> 32 MB and the timeout 15 s -> 45 s, so a big panel playlist
//    (an Xtream get.php link, a whole-country list) no longer dies half-way;
//  - a plain list of stream links (no #EXTINF header) is accepted when it parses to channels.
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const MAX_BYTES = 32 * 1024 * 1024;
const priv = (ip) => {
  if (net.isIPv4(ip)) { const [a, b] = ip.split('.').map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  if (net.isIPv6(ip)) { const l = ip.toLowerCase(); return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:'); }
  return true;
};
async function assertPublic(hostname) {
  const addrs = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true });
  if (!addrs.length) throw new Error('not-found');
  if (addrs.some((x) => priv(x.address))) throw new Error('private');
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  let u; try { u = new URL(String(b.url || '').trim()); } catch { return json({ ok: false, error: 'This is not a link. Paste the full playlist address, starting with http:// or https://.' }, 400); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return json({ ok: false, error: 'The playlist link must start with http:// or https://.' }, 400);

  try {
    // Follow redirects by hand (max 5), resolving and checking the address on every hop.
    const signal = AbortSignal.timeout(45000);
    let cur = u;
    let r = null;
    for (let hop = 0; hop < 6; hop++) {
      try { await assertPublic(cur.hostname); } catch (e) {
        return json({ ok: false, error: e.message === 'private' ? 'This address is private or local, so it cannot be loaded from here. Use the public playlist link.' : 'This address could not be found. Check the link for spelling mistakes.' }, 400);
      }
      r = await fetch(cur.href, {
        signal,
        redirect: 'manual',
        headers: { Accept: 'audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain, */*', 'Accept-Encoding': 'gzip, deflate', 'User-Agent': 'MizanoraTV/2.0 (Live TV import)' },
      });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get('location');
        try { r.body && r.body.cancel(); } catch { /* stop */ }
        if (!loc) return json({ ok: false, error: `The playlist server answered ${r.status} with nowhere to go.` }, 502);
        if (hop === 5) return json({ ok: false, error: 'The playlist link keeps redirecting. Open it once in a browser and paste the final address instead.' }, 502);
        try { cur = new URL(loc, cur); } catch { return json({ ok: false, error: 'The playlist server sent us to an unusable address.' }, 502); }
        if (cur.protocol !== 'https:' && cur.protocol !== 'http:') return json({ ok: false, error: 'The playlist server sent us to an unusable address.' }, 502);
        r = null;
        continue;
      }
      break;
    }
    if (!r) return json({ ok: false, error: 'The playlist could not be loaded.' }, 502);
    if (!r.ok) return json({ ok: false, error: `The playlist server answered ${r.status}. The link may be expired, or the panel may need its password again.` }, 502);
    const reader = r.body.getReader(); const parts = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { try { await reader.cancel(); } catch { /* stop */ } return json({ ok: false, error: 'The playlist is bigger than 32 MB. Download it, split it, or import fewer groups from the Xtream panel instead.' }, 413); }
      parts.push(value);
    }
    const text = Buffer.concat(parts).toString('utf8');
    const out = parseM3U(text);
    if (!out.channels.length) {
      return json({ ok: false, error: /<html|<!doctype/i.test(text.slice(0, 300))
        ? 'That link gave a web page, not a playlist. You need the M3U address itself (often it ends in .m3u, or it is the panel "get.php?type=m3u_plus" link).'
        : 'No channel could be read from that link. Stream links inside must start with http:// or https://.' }, 422);
    }
    return json({ ok: true, channels: out.channels, skipped: out.skipped, count: out.channels.length, from: cur.host });
  } catch (e) {
    const slow = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return json({ ok: false, error: slow
      ? 'The playlist server took longer than 45 seconds. Try again, or download the playlist and upload the file instead.'
      : 'The playlist could not be loaded (the server may be down or refusing the request). Download it and upload the file instead.' }, 502);
  }
}
