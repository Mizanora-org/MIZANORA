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
