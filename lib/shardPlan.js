// SHARDS — Firestore ka aik document 1 MB se bara nahi ho sakta, aur admin 1,00,000+ channels /
// movies rakh sakta hai. Isliye bari list tukron (shards) mein subcollection par jati hai aur
// main doc sirf gin ti hai. Yeh file pure hai — sab kuch test ho sakta hai.

export const SHARD_SIZE = 800;          // ~800 channels ≈ 120 KB per doc
export const MAX_SHARDS = 600;          // 600 × 800 = 4,80,000 entries (channels ya movies)
export const SHARD_COLLECTION = 'shards';

/** List ko barabar tukron mein todo. */
export function chunkList(list, size = SHARD_SIZE) {
  const rows = Array.isArray(list) ? list : [];
  const step = Math.max(1, Number(size) || SHARD_SIZE);
  const out = [];
  for (let i = 0; i < rows.length; i += step) out.push(rows.slice(i, i + step));
  return out;
}

/**
 * Likhne ka plan: main doc (bina bari lists) + shard docs.
 * fields: ['channels'] ya ['movies','series'].
 */
export function planSharded(data = {}, fields = ['channels'], size = SHARD_SIZE) {
  const main = { ...data };
  const shards = [];
  let count = 0;
  for (const field of fields) {
    const rows = Array.isArray(data[field]) ? data[field] : [];
    main[field] = [];
    chunkList(rows, size).forEach((part, i) => {
      shards.push({ index: `s${field[0]}${String(i).padStart(3, '0')}`, data: { field, index: i, rows: part } });
      count += part.length;
    });
  }
  main.sharded = shards.length > 0;
  main.shardCount = shards.length;
  main.shardSize = size;
  main.totalEntries = count;
  return { main, shards };
}

/** Shard docs wapas aik list mein (field ke hisab se tarteeb barqarar). */
export function mergeShards(main = {}, shardDocs = [], fields = ['channels']) {
  const out = { ...main };
  for (const field of fields) out[field] = Array.isArray(main[field]) ? [...main[field]] : [];
  const sorted = (Array.isArray(shardDocs) ? shardDocs : [])
    .map((d) => d && (d.data || d))
    .filter((d) => d && Array.isArray(d.rows))
    .sort((a, b) => Number(a.index) - Number(b.index));
  for (const doc of sorted) {
    if (!fields.includes(doc.field)) continue;
    out[doc.field].push(...doc.rows);
  }
  return out;
}

/** Shard docs se sirf aakhri index (naya shard likhne ke liye). */
export const shardIndexes = (shardDocs = []) => (Array.isArray(shardDocs) ? shardDocs : [])
  .map((d) => Number(((d && (d.data || d)) || {}).index))
  .filter(Number.isFinite);

/** Kitne shard likhne hain (0 = sab kuch main doc mein aa jayega). */
export const shardCountFor = (n, size = SHARD_SIZE) => Math.ceil(Math.max(0, Number(n) || 0) / Math.max(1, Number(size) || SHARD_SIZE));
