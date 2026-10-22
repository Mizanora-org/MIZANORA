// Only what a product card and the search need is sent to the browser (not the full description, all photos, videos, ...).
// A catalogue of hundreds of products becomes a much smaller page, which parses and hydrates much faster on phones.
export function toCard(p) {
  return {
    id: p.id, slug: p.slug, name: p.name, price: p.price, comparePrice: p.comparePrice,
    images: p.images.slice(0, 1), videos: (p.videos || []).slice(0, 1), hasOptions: p.sizes.length > 0, inStock: p.inStock,
    category: p.category, categories: p.categories, affOn: p.affOn !== false, affRate: Number(p.affRate) || 0, createdAt: p.createdAt || 0,
    // search-only fields (kept short)
    description: (p.description || '').slice(0, 200),
    options: p.options.map((o) => ({ name: o.name, values: o.values })),
    specs: p.specs.slice(0, 12).map((x) => x.v),
  };
}
