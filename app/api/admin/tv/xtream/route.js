import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { xtreamTest, xtreamImport } from '@/lib/xtreamServer';
import { cleanXtreamCreds, maskXtream, mergeXtreamChannels, XTREAM_LIMITS } from '@/lib/xtream';
import { readTvAll, writeTvAll } from '@/lib/liveTvStore';
import { MAX_CHANNELS, cleanTv } from '@/lib/liveTv';
import { snapshotGet } from '@/lib/snapshot';
import { ensureNoPendingCapture, saveArchivedSetting } from '@/lib/snapshotStore';
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
//   POST { action: 'commit', ..., mode: 'merge' | 'replace' }
//        -> the server pulls the panel, merges it with the shop's list and writes the shards
//           itself. Only the counts come back (this is the way in for 10,000+ channels).
//
// v49 BUG FIX: 'commit' used to sit BELOW an unconditional `return` in the import branch, so
// it could never run at all - "Straight into the shop" quietly behaved like a browser import
// and looped back with "too big, press Straight into the shop". Each action now has its own
// branch and returns from inside it; nothing is unreachable.
//
// The password is used for this one request and is never stored, never logged and never sent
// back. The channel links the shop keeps do contain it, exactly like every IPTV app does -
// that is how the Xtream protocol works, and it is why the panel is entered by the admin only.
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const importOpts = (b) => ({
  what: ['live', 'vod', 'series'].includes(b.what) ? b.what : 'live',
  // `categories` accepts group ids (the UI since v49) and, for older tabs, group names too -
  // lib/xtreamServer resolves both against the panel's category table.
  categories: Array.isArray(b.categories) ? b.categories.map(String).slice(0, XTREAM_LIMITS.categories) : [],
  hls: b.hls !== false,
});

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }

  const creds = cleanXtreamCreds(b);
  if (!creds.ok) return json({ ok: false, error: creds.error }, 400);
  const asked = String(b.action || 'test');
  const action = ['import', 'commit'].includes(asked) ? asked : 'test';
  const archived = action === 'commit' ? await snapshotGet('livetv') : null;
  if (action === 'commit' && !archived && !adminReady()) return json({ ok: false, error: 'Configure Firebase Admin or deploy a Live TV archive first.' }, 503);

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

    // ---------------------------------------------------------------------
    // IMPORT STRAIGHT INTO THE SHOP.
    // A 100,000-channel panel is ~25 MB of JSON. Pushing that through the admin's browser
    // would freeze the tab, so 'commit' does the whole job on the server: pull from the
    // panel, merge with what the shop already has, write the shards, revalidate /live.
    // ---------------------------------------------------------------------
    if (action === 'commit') {
      const mode = b.mode === 'replace' ? 'replace' : 'merge';
      if (!archived) await ensureNoPendingCapture('livetv');
      const r = await xtreamImport(b, importOpts(b));
      if (!r.ok) return json({ ok: false, error: r.error, partial: r.partial, errors: r.errors }, 502);
      if (!r.channels.length) return json({ ok: false, error: 'That selection has no channels on the panel. Nothing was changed.' }, 422);

      const { config, channels: current, legacy } = archived
        ? { config: { ...cleanTv(archived.data), count: archived.data.channels.length }, channels: archived.data.channels, legacy: false }
        : await readTvAll(adminDb());
      if (!legacy && Number(config?.count) > current.length) {
        return json({ ok: false, error: 'Existing channels could not all be read. Try again before importing.' }, 409);
      }
      const merged = mergeXtreamChannels(current, r.channels, mode, MAX_CHANNELS);
      const list = Array.isArray(merged) ? merged : merged.channels;
      if (list.length > MAX_CHANNELS) {
        return json({ ok: false, error: `That would take the shop to ${list.length.toLocaleString('en-PK')} channels. The limit is ${MAX_CHANNELS.toLocaleString('en-PK')}.` }, 400);
      }
      const cfg = cleanTv({ ...(config || {}), channels: list });
      const saved = archived ? await saveArchivedSetting('livetv', cfg) : null;
      const w = archived ? { channels: cfg.channels, parts: 0 } : await writeTvAll(adminDb(), cfg);
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
        source: archived ? 'archive' : 'firestore',
        ...(saved ? { commit: saved.commit } : {}),
        partial: r.partial,
        errors: r.errors,
        message: archived ? `Committed ${w.channels.length.toLocaleString('en-PK')} channels to the public archive. /live will update after the deployment. Streams containing account credentials cannot be archived.` : mode === 'replace'
          ? `Replaced the list with ${w.channels.length.toLocaleString('en-PK')} channels from the panel, stored in ${w.parts} shard${w.parts === 1 ? '' : 's'}. /live updates within seconds.`
          : `Added ${(Array.isArray(merged) ? list.length : merged.added).toLocaleString('en-PK')} channel${(Array.isArray(merged) ? list.length : merged.added) === 1 ? '' : 's'} from the panel. The shop now holds ${w.channels.length.toLocaleString('en-PK')} channels in ${w.parts} shard${w.parts === 1 ? '' : 's'}. /live updates within seconds.`,
      });
    }

    // Import into the browser editor (review first, then Save). Refused past the browser cap.
    const r = await xtreamImport(b, importOpts(b));
    if (!r.ok) return json({ ok: false, error: r.error, partial: r.partial, errors: r.errors }, 502);
    if (r.channels.length > BROWSER_IMPORT_CAP) {
      return json({
        ok: false,
        tooBig: true,
        count: r.channels.length,
        error: `${r.channels.length.toLocaleString('en-PK')} channels is too many to load into this page. Press "Straight into the shop" instead: it writes them into the database here on the server and only tells you the counts.`,
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
  } catch (e) {
    // Panel URLs may contain a password; never put untrusted error text into logs or a response.
    if (e.status) return json({ ok: false, error: e.message }, e.status);
    console.error('xtream import failed (details redacted)');
    return json({ ok: false, error: 'Could not reach the panel. Check the server address, username and password, then try again.' }, 502);
  }
}
