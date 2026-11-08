import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { cleanTv, cleanChannel, MAX_CHANNELS } from '@/lib/liveTv';
import { readTvAll, writeTvAll, clearTvChannels, packChannels } from '@/lib/liveTvStore';
import { snapshotGet } from '@/lib/snapshot';
import { ensureNoPendingCapture, saveArchivedSetting } from '@/lib/snapshotStore';
import { revalidatePath, revalidateTag } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Admin > Live TV, load and save.
//
//   POST { action: 'load' }                 -> the setting plus EVERY channel (shards followed)
//   POST { action: 'save', cfg }            -> validates, then writes the shards and the setting
//   POST { action: 'clear' }                -> deletes every channel shard, keeps the setting
//
// Saving used to happen straight from the browser with the client SDK. It happens here now so
// that a 100,000-channel list can be split into shard documents (a single Firestore document
// holds 1 MB, which ~2,000 channels already exceed) and so the validation cannot be skipped.

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

const badUrl = (value, allowCreds = false) => {
  const text = String(value == null ? '' : value).trim();
  if (!text || text.length > 600 || /\s/.test(text)) return true;
  try {
    const u = new URL(text);
    if (!['http:', 'https:'].includes(u.protocol)) return true;
    // A channel link must not smuggle in credentials of its own: the shop's own relay refuses
    // them too, and an admin pasting someone else's login is never the intent.
    if (!allowCreds && (u.username || u.password)) return true;
    return false;
  } catch { return true; }
};

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const action = String(b.action || 'load');

  try {
    const archived = await snapshotGet('livetv');
    if (!archived && !adminReady()) return json({ ok: false, error: 'Firebase Admin is not configured; capture and deploy a Live TV archive to use it without the database.' }, 503);
    if (!archived) await ensureNoPendingCapture('livetv');
    if (action === 'load') {
      if (archived) {
        const cfg = cleanTv(archived.data);
        return json({ ok: true, cfg: { ...cfg, count: cfg.channels.length, parts: 0 }, source: 'archive', count: cfg.channels.length, recorded: cfg.channels.length, parts: 0, legacy: false });
      }
      const { config, channels, legacy } = await readTvAll(adminDb());
      if (!config) return json({ ok: true, cfg: { ...cleanTv({}), channels: [] }, legacy: false, empty: true, parts: 0 });
      // `parts` has to travel with the config: it is how the admin page shows how many shard
      // documents the database is holding. cleanTv() only keeps the setting fields, so it is
      // put back on afterwards.
      // `count` is what the DATABASE recorded at the last save; `loaded` is what we actually
      // managed to read back. They can differ (a shard that will not read), and the admin page
      // treats that gap as a warning: saving a short list would delete what it could not see.
      return json({
        ok: true,
        cfg: { ...cleanTv({ ...config, channels }), channels, parts: Number(config.parts) || 0, count: Number(config.count) || 0 },
        legacy,
        count: channels.length,
        recorded: Number(config.count) || 0,
        parts: Number(config.parts) || 0,
      });
    }

    if (action === 'clear') {
      if (archived) {
        const cfg = cleanTv(archived.data);
        const saved = await saveArchivedSetting('livetv', { ...cfg, channels: [] });
        return json({ ok: true, removed: cfg.channels.length, source: 'archive', commit: saved.commit, message: 'Empty channel list saved to GitHub. It becomes visible after deployment.' });
      }
      const r = await clearTvChannels(adminDb());
      try { revalidateTag('livetv'); revalidatePath('/live'); } catch (_) { /* ignore */ }
      return json({ ok: true, removed: r.removed, message: `All channels deleted (${r.removed} shard${r.removed === 1 ? '' : 's'} removed).` });
    }

    if (action === 'save') {
      const raw = b.cfg && typeof b.cfg === 'object' ? b.cfg : null;
      if (!raw || !Array.isArray(raw.channels)) return json({ ok: false, error: 'Nothing to save.' }, 400);
      if (raw.channels.length > MAX_CHANNELS) {
        return json({ ok: false, error: `The shop holds at most ${MAX_CHANNELS.toLocaleString('en-PK')} channels. You are saving ${raw.channels.length.toLocaleString('en-PK')}.` }, 400);
      }

      // Validate every channel here, not only in the browser. The first failure names itself.
      const seen = new Set();
      for (let i = 0; i < raw.channels.length; i += 1) {
        const c = raw.channels[i];
        if (!c || typeof c !== 'object') return json({ ok: false, error: `Channel ${i + 1} is not readable.` }, 400);
        if (!String(c.name || '').trim()) return json({ ok: false, error: `Channel ${i + 1} has no name.` }, 400);
        if (badUrl(c.url)) return json({ ok: false, error: `Channel "${c.name}" has an unusable stream link. It must be one http(s) address with no spaces and no login inside it.` }, 400);
        const url = String(c.url).trim();
        if (seen.has(url)) return json({ ok: false, error: `Two channels use the same stream link: "${c.name}". Give each one a different link, or delete the extra.` }, 400);
        seen.add(url);
        if (Array.isArray(c.sources) && c.sources.length > 7) return json({ ok: false, error: `Channel "${c.name}" has more than 7 backup links.` }, 400);
        for (const s of Array.isArray(c.sources) ? c.sources : []) {
          if (String(s || '').trim() && badUrl(s)) return json({ ok: false, error: `Channel "${c.name}" has a backup link that is not a usable http(s) address.` }, 400);
        }
      }

      const cfg = archived ? cleanTv(raw) : null;
      const saved = archived ? await saveArchivedSetting('livetv', cfg) : null;
      const r = archived ? { config: cfg, channels: cfg.channels, parts: 0, removed: 0 } : await writeTvAll(adminDb(), raw);
      const kept = r.channels.filter((c) => cleanChannel(c)).length;
      try { revalidateTag('livetv'); revalidatePath('/live'); } catch (_) { /* ignore */ }
      return json({
        ok: true,
        cfg: { ...r.config, channels: r.channels, parts: r.parts },
        count: kept,
        parts: r.parts,
        removedParts: r.removed,
        source: archived ? 'archive' : 'firestore',
        ...(saved ? { commit: saved.commit } : {}),
        message: archived ? `Saved ${kept.toLocaleString('en-PK')} channels in GitHub; /live updates after the deployment (not instantly).` : `Saved ${kept.toLocaleString('en-PK')} channels in ${r.parts} shard${r.parts === 1 ? '' : 's'}. /live updates within seconds.`,
      });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('admin tv config failed:', e.message);
    return json({ ok: false, error: e.status ? e.message : 'Could not save Live TV. Try again.' }, e.status || 500);
  }
}

// A dry run the admin UI uses to show how many shards a list will need, without writing anything.
export async function PUT(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const channels = Array.isArray(b.channels) ? b.channels : [];
  const parts = packChannels(channels);
  return json({ ok: true, parts: parts.length, sizes: parts.map((p) => p.n) });
}
