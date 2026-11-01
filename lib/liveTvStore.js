import { TV_DOC, TV_PART, cleanTv, cleanChannel } from './liveTv.js';

// ---------------------------------------------------------------------------
// v38: HOW 100,000 CHANNELS FIT.
//
// A Firestore document may hold 1 MB. One channel is 200-1200 bytes depending on its logo and
// its backup links, so anything past ~2,000 channels would blow straight through that limit if
// the list lived inside the setting document the way it used to.
//
// So the list is SHARDED:
//
//   siteMeta/liveTv                     <- the setting: enabled, title, theme, ads, count, parts
//   siteMeta/liveTv/channels/p0         <- { n: 2000, channels: [ ... ] }
//   siteMeta/liveTv/channels/p1         <- { n: 2000, channels: [ ... ] }
//   ...
//
// A subcollection does not count towards the size of its parent document, so the setting stays
// a few hundred bytes no matter how many channels there are.
//
// Old installs are read as-is: if the setting document still carries a `channels` array, it is
// used and nothing has to be migrated. The next Save rewrites it into parts.
//
// Every function here is PURE-ish: it takes a Firestore handle (admin or client SDK - both have
// the same .collection().doc() shape) and does no caching. lib/liveTvServer.js adds the cache.
// ---------------------------------------------------------------------------

const estBytes = (c) => {
  if (!c) return 0;
  let n = 120; // the field names and the JSON scaffolding around one channel
  n += String(c.name || '').length * 2;
  n += String(c.url || '').length * 2;
  n += String(c.logo || '').length * 2;
  n += String(c.group || '').length * 2;
  if (Array.isArray(c.sources)) for (const s of c.sources) n += String(s || '').length * 2 + 8;
  return n;
};

/**
 * Split a channel list into parts. Returns [{ id, n, channels }].
 * A new part starts when EITHER the count cap OR the byte budget is reached, so a list of
 * fat channels (logos + backups) never sneaks past the 1 MB document limit.
 */
export function packChannels(channels, part = TV_PART) {
  const parts = [];
  let cur = [];
  let bytes = 0;
  for (const c of channels || []) {
    const b = estBytes(c);
    if (cur.length && (cur.length >= part.perPart || bytes + b > part.maxBytes)) {
      parts.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(c);
    bytes += b;
  }
  if (cur.length) parts.push(cur);
  return parts.map((channels2, i) => ({ id: `${part.prefix}${i}`, n: channels2.length, channels: channels2 }));
}

export const partsRef = (db) => db.collection(TV_DOC.collection).doc(TV_DOC.id).collection(TV_PART.sub);
export const configRef = (db) => db.collection(TV_DOC.collection).doc(TV_DOC.id);

/**
 * Read the setting AND its channels, following the shards.
 * Returns { config, channels, legacy } where `config` has no `channels` key on it.
 * A failed shard read must throw: treating a database error as an empty list could cause data loss.
 */
export async function readTvAll(db) {
  const snap = await configRef(db).get();
  const raw = snap && snap.data ? snap.data() : null;
  if (!raw) return { config: null, channels: [], legacy: false };

  const { channels: inline, ...meta } = raw;
  // Legacy: the channels were stored inside the setting document.
  if (Array.isArray(inline)) {
    const clean = cleanTv(raw);
    return { config: { ...clean, channels: undefined }, channels: clean.channels, legacy: true, meta };
  }

  const ps = await partsRef(db).get();
  const parts = (ps.docs || [])
      .map((d) => ({ id: d.id, data: d.data() }))
      .filter((x) => x.data && Array.isArray(x.data.channels))
      // p2 must come after p10, so sort by the NUMBER in the id, not as text
      .sort((a, b) => (Number(String(a.id).replace(/^\D+/, '')) || 0) - (Number(String(b.id).replace(/^\D+/, '')) || 0));

  const seen = new Set();
  const channels = [];
  for (const p of parts) {
    for (const c of p.data.channels) {
      const k = cleanChannel(c);
      if (!k || seen.has(k.url)) continue;
      seen.add(k.url);
      channels.push(k);
    }
  }
  const config = { ...cleanTv({ ...meta, channels: [] }), channels: undefined, count: Number(meta.count) || 0, parts: Number(meta.parts) || 0 };
  return { config, channels, legacy: false, meta };
}

/** How many parts a list of this many channels would need (used by the UI, and by the tests). */
export const partsNeeded = (count, perPart = TV_PART.perPart) => Math.max(count > 0 ? 1 : 0, Math.ceil((Number(count) || 0) / perPart));

/**
 * Write the setting and its channel shards.
 *  - the setting document carries NO channels any more (just `count` and `parts`);
 *  - parts are written in batches of 20 so a 50-part write is 3 round trips, not 50;
 *  - parts left over from a longer previous list are deleted, so shrinking the list cannot
 *    leave orphan channels that would silently reappear.
 */
export async function writeTvAll(db, cfg) {
  const clean = cleanTv(cfg || {});
  const channels = clean.channels;
  const parts = packChannels(channels);
  const batchLimit = 20;
  // Verify the existing shards can be enumerated before changing any of them.
  const ps = await partsRef(db).get();

  for (let i = 0; i < parts.length; i += batchLimit) {
    const b = db.batch();
    for (const p of parts.slice(i, i + batchLimit)) b.set(partsRef(db).doc(p.id), { n: p.n, channels: p.channels });
    await b.commit();
  }

  // Delete parts that no longer exist (the list got shorter).
  const liveIds = new Set(parts.map((p) => p.id));
  const stale = (ps.docs || []).map((d) => d.id).filter((id) => !liveIds.has(id));
  for (let i = 0; i < stale.length; i += batchLimit) {
    const b = db.batch();
    for (const id of stale.slice(i, i + batchLimit)) b.delete(partsRef(db).doc(id));
    await b.commit();
  }

  const config = {
    enabled: clean.enabled,
    title: clean.title,
    note: clean.note,
    theme: clean.theme,
    autoplay: clean.autoplay,
    ads: clean.ads,
    count: channels.length,
    parts: parts.length,
    updatedAtMs: Date.now(),
  };
  await configRef(db).set(config);
  return { config, channels, parts: parts.length, removed: stale.length };
}

/** Delete every channel shard and empty the list. The setting itself is kept. */
export async function clearTvChannels(db) {
  const snap = await configRef(db).get();
  const { channels: _inline, ...config } = (snap && snap.data && snap.data()) || {};
  const ps = await partsRef(db).get();
  const ids = (ps.docs || []).map((d) => d.id);
  for (let i = 0; i < ids.length; i += 20) {
    const b = db.batch();
    for (const id of ids.slice(i, i + 20)) b.delete(partsRef(db).doc(id));
    await b.commit();
  }
  await configRef(db).set({ ...config, count: 0, parts: 0, updatedAtMs: Date.now() });
  return { removed: ids.length };
}
