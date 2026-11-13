// Offline mocks for the authenticated revalidation route; production imports are untouched.
const mocks = {
  'next/server': `export const NextResponse = { json(body, { status = 200 } = {}) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }); } };`,
  'next/cache': `export const revalidateTag = (tag) => globalThis.__revalidationTest.tags.push(tag); export const revalidatePath = (...args) => globalThis.__revalidationTest.paths.push(args);`,
  '@/lib/adminAuth': `export const verifyAdmin = async (req) => req.headers.get('authorization') === 'Bearer test-admin' ? { ok: true } : { ok: false, status: 401 };`,
};
export async function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(mocks, specifier)) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
  return nextResolve(specifier, context);
}
