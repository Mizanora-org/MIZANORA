// Keep only the cheapest few matching products instead of sorting a whole large catalogue
// separately for every home-page shelf. Equal prices keep their original order.
export function lowestPriced(products, matches, limit) {
  if (limit <= 0) return [];
  const best = [];
  for (const product of products) {
    if (!matches(product)) continue;
    const at = best.findIndex((current) => product.price < current.price);
    if (at < 0) {
      if (best.length < limit) best.push(product);
    } else {
      best.splice(at, 0, product);
      if (best.length > limit) best.pop();
    }
  }
  return best;
}
