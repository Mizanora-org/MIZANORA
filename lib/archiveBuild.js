import { MANIFEST_PATH, cardsFile, partFile, buildPartFiles } from './archiveFormat.js';
import { ghBlob, ghListDir, ghReadFile } from './github';

// Builds the files of ONE archive part from product documents [{ id, data }].
export const buildPart = buildPartFiles;

// Manifest with the new parts added (parts with the same number are replaced).
export function mergeManifest(old, metas) {
  const parts = [...(old && Array.isArray(old.parts) ? old.parts : [])];
  for (const m of metas) { const i = parts.findIndex((p) => p.n === m.n); if (i >= 0) parts[i] = m; else parts.push(m); }
  parts.sort((a, b) => a.n - b.n);
  return { version: 1, total: parts.reduce((s, p) => s + (Number(p.count) || 0), 0), parts };
}

// The manifest in the repository (the truth).
// SELF-HEALING: if manifest.json is missing, empty, or was replaced by an upgrade, the parts are found by listing the
// data/catalog folder itself - so the products you already added on GitHub can never vanish because of one bad file.
export async function repoManifest() {
  const t = await ghReadFile(MANIFEST_PATH).catch((e) => { throw e; });
  let m = null;
  try { m = t ? JSON.parse(t) : null; } catch { m = null; }
  if (m && Array.isArray(m.parts) && m.parts.length) return m;

  const names = await ghListDir('data/catalog').catch(() => []);
  const nums = names.map((f) => (f.match(/^cards-(\d{4})\.json$/) || [])[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
  const parts = [];
  for (const n of nums.slice(-200)) {
    let count = 0;
    try { count = (JSON.parse((await ghReadFile(`data/catalog/${cardsFile(n)}`)) || '[]') || []).length; } catch { /* count stays 0 */ }
    parts.push({ n, file: partFile(n), cards: cardsFile(n), count, at: Date.now() });
  }
  if (parts.length) console.error(`catalogue manifest was empty: rebuilt from ${parts.length} part file(s) in the repository`);
  return { version: 1, total: parts.reduce((s2, p) => s2 + (Number(p.count) || 0), 0), parts };
}

// Stores the two files of a part as GitHub blobs. -> [{ path, sha }]
export async function stageFiles(built) {
  const [a, b] = await Promise.all([ghBlob(built.part), ghBlob(built.cards)]);
  return [{ path: `data/catalog/${built.meta.file}`, sha: a }, { path: `data/catalog/${built.meta.cards}`, sha: b }];
}
