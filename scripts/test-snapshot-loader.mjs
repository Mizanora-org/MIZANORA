// Offline snapshot integration tests: in-memory GitHub + Firebase, real reader/store/route.
// No production credentials, network requests, repository writes or Firestore mutations.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mocks = {
  'next/server': `export const NextResponse = { json: (body, { status = 200, headers = {} } = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } }) };`,
  'next/cache': `export const unstable_cache = (fn) => fn; export const revalidateTag = () => {}; export const revalidatePath = () => {};`,
  '@/lib/adminAuth': `export const verifyAdmin = async (req) => req.headers.get('authorization') === 'Bearer test-admin' ? { ok: true, uid: 'test-admin' } : { ok: false, status: 401, error: 'Please sign in.' };`,
  '@/lib/github': `
    const s = () => globalThis.__snapshotTest;
    export const ghReady = () => s().connected;
    export const ghHead = async () => s().head;
    export const ghInfo = () => ({ repo: 'test/public-repo', branch: 'test-branch' });
    export const ghReadFile = async (file) => s().files[file] ?? null;
    export const ghBlob = async (data) => { const id = 'blob-' + s().blobs.size; s().blobs.set(id, data); return id; };
    export const ghCommit = async (files, message, expectedHead) => {
      await Promise.resolve(); // let parallel edits race on the expected head
      if (s().head !== expectedHead) { const e = new Error('Repository changed while you were working.'); e.status = 409; throw e; }
      for (const f of files) s().files[f.path] = s().blobs.get(f.sha);
      s().writes.push({ files, message, expectedHead });
      s().head = String(s().writes.length).padStart(40, 'c'); return s().head;
    };
  `,
  '@/lib/firebase-admin': `export const adminReady = () => Boolean(globalThis.__snapshotTest?.db); export const adminDb = () => globalThis.__snapshotTest.db;`,
};
export async function resolve(specifier, context, nextResolve) {
  const mock = mocks[specifier] || ((specifier === './github' || specifier === './github.js') && context.parentURL?.endsWith('/lib/snapshotStore.js') ? mocks['@/lib/github'] : null)
    || (specifier === './firebase-admin' || specifier === './firebase-admin.js' ? mocks['@/lib/firebase-admin'] : null);
  if (mock) return { url: `data:text/javascript,${encodeURIComponent(mock)}`, shortCircuit: true };
  if (specifier.startsWith('@/')) return { url: pathToFileURL(path.join(root, `${specifier.slice(2)}.js`)).href, shortCircuit: true };
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?js$/.test(specifier) && context.parentURL) {
    return { url: new URL(`${specifier}.js`, context.parentURL).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
