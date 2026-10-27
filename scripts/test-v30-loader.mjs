// Test-only module loader for the archive route. Production auth and GitHub are never replaced.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mocks = {
  'next/server': `export const NextResponse = { json: (body, { status = 200, headers = {} } = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } }) };`,
  'next/cache': `export const revalidateTag = () => {};`,
  '@/lib/adminAuth': `export const verifyAdmin = async (req) => req.headers.get('authorization') === 'Bearer test-admin' ? { ok: true } : { ok: false, status: 401, error: 'Please sign in again.' };`,
  '@/lib/archive': `export const archiveManifest = async () => JSON.parse(globalThis.__rangeTest.files['data/catalog/manifest.json']);`,
  '@/lib/archiveBuild': `export const repoManifest = async (ref) => { globalThis.__rangeTest.readRefs.push(ref); return JSON.parse(globalThis.__rangeTest.files['data/catalog/manifest.json']); };`,
  '@/lib/indexnow': `export const pingIndexNow = async () => {};`,
  '@/lib/github': `
    const state = () => globalThis.__rangeTest;
    export const ghReady = () => state().connected;
    export const ghHead = async () => state().head;
    export const ghReadFile = async (path, ref) => { state().readRefs.push(ref); return state().files[path] ?? null; };
    export const ghListDir = async (path, ref) => { state().readRefs.push(ref); return Object.keys(state().files).filter((f) => f.startsWith(path + '/')).map((f) => f.slice(path.length + 1)); };
    export const ghBlob = async (data) => { const key = 'mock-blob-' + state().blobs.size; state().blobs.set(key, data); return key; };
    export const ghCommit = async (files, message, expectedHead) => {
      if (state().head !== expectedHead) { const e = new Error('Repository changed'); e.status = 409; throw e; }
      state().writes.push({ files, message, expectedHead });
      for (const f of files) state().files[f.path] = state().blobs.get(f.sha);
      state().head = 'c'.repeat(40); return state().head;
    };
  `,
};
export async function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(mocks, specifier)) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
  if (specifier.startsWith('@/')) return { url: pathToFileURL(path.join(root, `${specifier.slice(2)}.js`)).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
