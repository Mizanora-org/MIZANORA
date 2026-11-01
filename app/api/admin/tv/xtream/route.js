import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { xtreamTest, xtreamImport } from '@/lib/xtreamServer';
import { cleanXtreamCreds, maskXtream, mergeXtreamChannels, XTREAM_LIMITS } from '@/lib/xtream';
import { readTvAll, writeTvAll } from '@/lib/liveTvStore';
import { MAX_CHANNELS } from '@/lib/liveTv';
import { revalidatePath, revalidateTag } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// How many channels may travel to the BROWSER in one go. Above this the list is too big to
// shuttle through a tab; the admin uses action: 'commit' instead, which writes straight into
// the shop's shards and only sends back the counts.
const BROWSER_IMPORT_CAP = 20000;

// Admin only. XTREAM CODES import (Admin > Live TV > "Connect an Xtream Codes panel").
//   POST { action: 'test',  server, username, password }
//        -> who the account is + how many channels and which groups are on it
//   POST { action: 'import', server, username, password, what, categories, hls }
//        -> the channels themselves. NOTHING is saved here: the admin reviews, then presses Save.
//
// The password is used for this one request and is never stored, never logged and never sent
// back. The channel links the shop keeps do contain it, exactly like every IPTV app does -
// that is how the Xtream protocol works, and it is why the panel is entered by the admin only.
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }

  const creds = cleanXtreamCreds(b);
  if (!creds.ok) return json({ ok: false, error: creds.error }, 400);
  const asked = String(b.action || 'test');
  const action = ['import', 'commit'].includes(asked) ? asked : 'test';
  if (action === 'commit' && !adminReady()) return json({ ok: false, error: 'The database is not configured on the server.' }, 503);

  try {
    if (action === 'test') {
      const r = await xtreamTest(b);
      if (!r.ok) return json({ ok: false, error: r.error, expired: r.expired, creds: maskXtream(creds) }, 502);
      return json({
        ok: true,
        creds: maskXtream(creds),
        account: r.account,
        counts: r.counts,
        groups: r.groups,
      });
    }

    const r = await xtreamImport(b, {
      what: ['live', 'vod', 'series'].includes(b.what) ? b.what : 'live',
      categories: Array.isArray(b.categories) ? b.categories.map(String).slice(0, XTREAM_LIMITS.categories) : [],
      hls: b.hls !== false,
    });
    if (!r.ok) return json({ ok: false, error: r.error, partial: r.partial, errors: r.errors }, 502);
    if (r.channels.length > BROWSER_IMPORT_CAP) {
      return json({
        ok: false,
        tooBig: true,
        count: r.channels.length,
        error: `${r.channels.length.toLocaleString('en-PK')} channels is too many to load into this page. Press "Import straight into the shop" instead: it writes them into the database here on the server and only tells you the counts.`,
      }, 413);
    }
    return json({
      ok: true,
      creds: maskXtream(creds),
      kind: r.kind,
      channels: r.channels,
      account: r.account,
      count: r.channels.length,
      fetched: r.fetched,
      partial: r.partial,
      errors: r.errors,
    });
    // ---------------------------------------------------------------------
    // v38: IMPORT STRAIGHT INTO THE SHOP.
    // A 100,000-channel panel is ~25 MB of JSON. Pushing that through the admin's browser
    // would freeze the tab, so 'commit' does the whole job on the server: pull from the panel,
    // merge with what the shop already has, write the shards, revalidate /live. Only the
    // counts come back.
    // ---------------------------------------------------------------------
    if (action === 'commit') {
      const mode = b.mode === 'replace' ? 'replace' : 'merge';
      const r = await xtreamImport(b, {
        what: ['live', 'vod', 'series'].includes(b.what) ? b.what : 'live',
        categories: Array.isArray(b.categories) ? b.categories.map(String).slice(0, XTREAM_LIMITS.categories) : [],
        hls: b.hls !== false,
      });
      if (!r.ok) return json({ ok: false, error: r.error, partial: r.partial, errors: r.errors }, 502);

      const { config, channels: current, legacy } = await readTvAll(adminDb());
      if (!legacy && Number(config?.count) > current.length) {
        return json({ ok: false, error: 'Existing channels could not all be read. Try again before importing.' }, 409);
      }
      const merged = mergeXtreamChannels(current, r.channels, mode, MAX_CHANNELS);
      const list = Array.isArray(merged) ? merged : merged.channels;
      if (list.length > MAX_CHANNELS) {
        return json({ ok: false, error: `That would take the shop to ${list.length.toLocaleString('en-PK')} channels. The limit is ${MAX_CHANNELS.toLocaleString('en-PK')}.` }, 400);
      }
      const w = await writeTvAll(adminDb(), { ...(config || {}), channels: list });
      try { revalidateTag('livetv'); revalidatePath('/live'); } catch (_) { /* ignore */ }
      return json({
        ok: true,
        creds: maskXtream(creds),
        mode,
        fetched: r.fetched,
        pulled: r.channels.length,
        added: Array.isArray(merged) ? list.length : merged.added,
        updated: Array.isArray(merged) ? 0 : merged.updated,
        total: w.channels.length,
        parts: w.parts,
        partial: r.partial,
        errors: r.errors,
        message: mode === 'replace'
          ? `Replaced the list with ${w.channels.length.toLocaleString('en-PK')} channels from the panel, stored in ${w.parts} shard${w.parts === 1 ? '' : 's'}. /live updates within seconds.`
          : `Added ${(Array.isArray(merged) ? list.length : merged.added).toLocaleString('en-PK')} channel${(Array.isArray(merged) ? list.length : merged.added) === 1 ? '' : 's'} from the panel. The shop now holds ${w.channels.length.toLocaleString('en-PK')} channels in ${w.parts} shard${w.parts === 1 ? '' : 's'}. /live updates within seconds.`,
      });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    // never echo the address+credentials back with an error
    console.error('xtream import failed:', e.message);
    return json({ ok: false, error: 'Could not reach the panel. Check the server address, username and password, then try again.' }, 502);
  }
}
