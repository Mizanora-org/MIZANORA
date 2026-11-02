import { adminDb } from '../firebase-admin';
import { planSharded, mergeShards, SHARD_COLLECTION } from '../shardPlan';

// Firestore par bari list (channels/movies/series) shards mein rakhi jati hai.
// Likhna: main doc (counts) + shard docs. Padhna: dono jod kar wapas poori list.
// Batch limit 500 writes hai, is liye commit tukron mein hota hai.

const COMMIT_CHUNK = 380;

async function commitAll(ops) {
  const db = adminDb();
  for (let i = 0; i < ops.length; i += COMMIT_CHUNK) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + COMMIT_CHUNK)) {
      if (op.type === 'delete') batch.delete(op.ref);
      else batch.set(op.ref, op.data, { merge: false });
    }
    await batch.commit();
  }
}

/** Poore doc ko (main + shards) padho. */
export async function readShardedDoc(collection, id, fields = ['channels']) {
  const ref = adminDb().collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return {};
  const main = snap.data() || {};
  if (!main.sharded) return main;
  const shardSnap = await ref.collection(SHARD_COLLECTION).get();
  return mergeShards(main, shardSnap.docs.map((d) => ({ data: d.data() })), fields);
}

/** Poora doc likho — chhoti list main doc mein, bari list shards mein. */
export async function writeShardedDoc(collection, id, data, fields = ['channels']) {
  const db = adminDb();
  const ref = db.collection(collection).doc(id);
  const { main, shards } = planSharded(data, fields);

  const old = await ref.collection(SHARD_COLLECTION).get().catch(() => null);
  const ops = [];
  if (old) for (const d of old.docs) ops.push({ type: 'delete', ref: d.ref });
  ops.push({ type: 'set', ref, data: main });
  for (const sh of shards) ops.push({ type: 'set', ref: ref.collection(SHARD_COLLECTION).doc(sh.index), data: sh.data });

  await commitAll(ops);
  return { shards: shards.length, entries: Number(main.totalEntries) || 0 };
}

/** Sirf shards ki ginti (admin ko "kitna data" dikhane ke liye). */
export async function shardInfo(collection, id) {
  const ref = adminDb().collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { sharded: false, shardCount: 0, totalEntries: 0 };
  const d = snap.data() || {};
  return { sharded: Boolean(d.sharded), shardCount: Number(d.shardCount) || 0, totalEntries: Number(d.totalEntries) || 0, updatedAt: Number(d.updatedAt) || 0 };
}
