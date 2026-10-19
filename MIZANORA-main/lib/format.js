export function formatPKR(n) {
  const v = Math.round(Number(n) || 0);
  return `Rs. ${v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
export function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
export function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function discountPct(price, compare) {
  if (!compare || compare <= price) return 0;
  return Math.round(((compare - price) / compare) * 100);
}
