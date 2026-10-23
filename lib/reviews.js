import { unstable_cache } from 'next/cache';
import { restQuery, restReady } from './firestore-rest';

// Approved reviews for one product (public). Cached for 6 hours (and cleared by the admin panel
// when a review is approved / removed) so product pages do not query Firestore on every refresh.
// Errors are thrown inside the cached function so a failure is never cached; the outer function never throws.
const fetchReviews = unstable_cache(async (productId) => {
  const docs = await restQuery('reviews', [['productId', productId], ['approved', true]]);
  return docs.map(({ id, data: x }) => ({ id, name: x.name || 'Customer', rating: Number(x.rating) || 5, text: x.text || '', createdAtMs: Number(x.createdAtMs) || 0 }))
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}, ['mz-reviews-v2'], { revalidate: 6 * 60 * 60, tags: ['reviews'] });

export async function getReviews(productId) {
  if (!restReady() || !productId) return [];
  try { return await fetchReviews(String(productId)); } catch (e) { console.error(e.message); return []; }
}

// v24: the latest approved reviews of the whole shop (for /reviews). Cached 1 hour; a failure is never cached.
const fetchRecent = unstable_cache(async () => {
  const docs = await restQuery('reviews', [['approved', true]], 200);
  return docs.map(({ id, data: x }) => ({ id, productId: x.productId || '', productName: String(x.productName || '').slice(0, 120), name: x.name || 'Customer', rating: Number(x.rating) || 5, text: x.text || '', createdAtMs: Number(x.createdAtMs) || 0 }))
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}, ['mz-reviews-recent-v1'], { revalidate: 3600, tags: ['reviews'] });

export async function getRecentReviews() {
  if (!restReady()) return [];
  try { return await fetchRecent(); } catch (e) { console.error(e.message); return []; }
}
