import { MANIFEST_PATH, buildPartFiles } from './archiveFormat.js';
import { ghBlob, ghReadFile } from './github';

// Builds the files of ONE archive part from product documents [{ id, data }].
export const buildPart = buildPartFiles;

// Manifest with the new parts added (parts with the same number are replaced).
export function mergeManifest(old, metas) {
  const parts = [...(old && Array.isArray(old.parts) ? old.parts : [])];
  for (const m of metas) { const i = parts.findIndex((p) => p.n === m.n); if (i >= 0) parts[i] = m; else parts.push(m); }
  parts.sort((a, b) => a.n - b.n);
  return { version: 1, total: parts.reduce((s, p) => s + (Number(p.count) || 0), 0), parts };
}

// The manifest in the repository (the truth), or an empty one.
export async function repoManifest() {
  try { const t = await ghReadFile(MANIFEST_PATH); return t ? JSON.parse(t) : { version: 1, total: 0, parts: [] }; } catch (e) { throw e; }
}

// Stores the two files of a part as GitHub blobs. -> [{ path, sha }]
export async function stageFiles(built) {
  const [a, b] = await Promise.all([ghBlob(built.part), ghBlob(built.cards)]);
  return [{ path: `data/catalog/${built.meta.file}`, sha: a }, { path: `data/catalog/${built.meta.cards}`, sha: b }];
}
