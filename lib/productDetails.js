// Optional customer-facing product details. Shared by the live and archive editors.
const clean = (value, limit) => String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim().slice(0, limit);
export function cleanProductDetails(data = {}) {
  const raw = Array.isArray(data.highlights) ? data.highlights : String(data.highlights || '').split('\n');
  return {
    brand: clean(data.brand, 100),
    highlights: raw.map((v) => clean(v, 180)).filter(Boolean).slice(0, 12),
    boxContents: clean(data.boxContents, 1000),
    careInstructions: clean(data.careInstructions, 1000),
    warranty: clean(data.warranty, 500),
  };
}
