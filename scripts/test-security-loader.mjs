// Offline security integration tests: private RTDB and verified admin are in-memory stubs.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mocks = {
  'next/server': `export class NextResponse extends Response {
    static json(body, { status = 200, headers = {} } = {}) {
      return new NextResponse(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
    }
    static next() { return new NextResponse(null, { status: 200 }); }
  }`,
  '@/lib/siteGate': `export const denyIf = async () => null;`,
  '@/lib/adsServer': `
    import { createHash } from 'node:crypto';
    export const hashKey = (key) => createHash('sha256').update(String(key)).digest('hex');
    export const findKeyDoc = async (key) => key === 'mza_valid' ? { id: hashKey(key), data: { allowedAds: ['camp1'], revoked: false } } : null;
    export const creditImpression = async (campaign, keyId) => { globalThis.__adsTest.impressions.push([campaign, keyId]); };
    export const creditClick = async (campaign, keyId) => { globalThis.__adsTest.clicks.push([campaign, keyId]); };
  `,
  '@/lib/orderFallback': `export const isQuotaError = (e) => /RESOURCE_EXHAUSTED|quota/i.test(String(e?.message || e));`,
  'order-fallback-products': `export const getProductsByIds = async (ids) => new Map(ids.filter((id) => id === 'sku-1').map((id) => [id, { id, name: 'Sample', price: 2500, active: true, inStock: true, images: [], options: [] }]));`,
  '@/lib/adminAuth': `export const verifyAdmin = async (req) => req.headers.get('authorization') === 'Bearer owner' ? { ok: true, uid: 'owner' } : { ok: false, status: 401, error: 'Please sign in.' };`,
  'mock-firebase-admin': `
    export const adminReady = () => true;
    export const adminDb = () => { throw new Error('Firestore must not be touched when its quota breaker is open'); };
    export const rtdbUrl = () => 'https://private-db.example';
    export const adminRtdb = () => globalThis.__securityTest.db;
    export const adminApp = () => ({});
  `,
  'firebase-admin/database': `export const ServerValue = { increment: (amount) => ({ incrementBy: amount }) };`,
  'firebase-admin/auth': `export const getAuth = () => ({ verifyIdToken: async (token) => {
    if (token === 'expired') throw Object.assign(new Error('expired'), { code: 'auth/id-token-expired' });
    return { uid: token === 'owner' ? 'owner' : 'other', email: 'x@example.com', email_verified: true };
  } });`,
};
export async function resolve(specifier, context, nextResolve) {
  const src = (specifier === './products' && context.parentURL?.endsWith('/lib/orderFallback.js') ? mocks['order-fallback-products'] : null) || mocks[specifier] || (specifier === '@/lib/firebase-admin' ? mocks['mock-firebase-admin'] : null) || ((specifier === './firebase-admin.js' || specifier === './firebase-admin') && context.parentURL?.includes('/lib/') ? mocks['mock-firebase-admin'] : null);
  if (src) return { url: `data:text/javascript,${encodeURIComponent(src)}`, shortCircuit: true };
  if (specifier.startsWith('@/')) return { url: pathToFileURL(path.join(root, `${specifier.slice(2)}.js`)).href, shortCircuit: true };
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?js$/.test(specifier) && context.parentURL) {
    return { url: new URL(`${specifier}.js`, context.parentURL).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
