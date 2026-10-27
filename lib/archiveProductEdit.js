import { splitMedia } from './media.js';
import { cleanProductDetails } from './productDetails.js';
import { archiveTimestamp } from './archiveRange.js';

const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const PRIVATE = ['id', 'kw', 'catSlugs', 'hiddenReason', 'cost', 'profit', 'supplierSku', 'sourceUrl'];
const FIELDS = ['name', 'price', 'comparePrice', 'description', 'images', 'videos', 'categories', 'category', 'inStock', 'featured', 'active', 'affOn', 'affRate', 'options', 'sizes', 'specs', 'brand', 'highlights', 'boxContents', 'careInstructions', 'warranty'];

// Keep the newest stored document's unedited fields and original creation date. Only known editable fields
// may be overwritten; private supplier fields must never enter the public GitHub archive.
export function mergeArchiveProduct(existing = {}, changes = {}, now = Date.now()) {
  const data = { ...existing };
  for (const key of FIELDS) if (Object.prototype.hasOwnProperty.call(changes, key)) data[key] = changes[key];
  PRIVATE.forEach((key) => delete data[key]);
  const media = splitMedia(
    (Array.isArray(data.images) ? data.images : []).map((u) => clip(u, 500)),
    (Array.isArray(data.videos) ? data.videos : []).map((u) => clip(u, 500)),
  );
  const categories = (Array.isArray(data.categories) ? data.categories : String(data.categories || '').split(','))
    .map((c) => clip(c, 60).trim()).filter(Boolean).slice(0, 6);
  const out = {
    ...data,
    name: clip(data.name, 160).trim(), price: Math.max(0, Math.floor(Number(data.price) || 0)), comparePrice: Math.max(0, Math.floor(Number(data.comparePrice) || 0)),
    description: clip(data.description, 10000), images: media.images, videos: media.videos.slice(0, 12),
    categories, category: categories[0] || clip(data.category, 60),
    inStock: data.inStock !== false, featured: Boolean(data.featured), active: data.active !== false,
    affOn: data.affOn !== false, affRate: Math.max(0, Math.min(50, Math.floor(Number(data.affRate) || 0))),
    ...cleanProductDetails(data),
    // 0 stays unknown rather than becoming today's date on an old product.
    createdAt: archiveTimestamp(existing.createdAt), updatedAt: now,
  };
  if (Array.isArray(data.options)) out.options = data.options.slice(0, 6).map((o) => ({ name: clip(o?.name, 40), values: (Array.isArray(o?.values) ? o.values : []).slice(0, 60).map((v) => clip(v, 40)) }));
  if (Array.isArray(data.specs)) out.specs = data.specs.slice(0, 40).map((s) => clip(s, 180));
  return out;
}
