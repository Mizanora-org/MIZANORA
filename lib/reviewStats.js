// REVIEW MATH + SPAM CHECK (v24). Pure code. Only REAL, admin-approved reviews are ever counted: nothing is generated or seeded.
export function summarize(reviews) {
  const list = Array.isArray(reviews) ? reviews : [];
  const dist = [0, 0, 0, 0, 0]; // index 0 = 1 star ... 4 = 5 stars
  let sum = 0;
  for (const r of list) { const n = Math.min(5, Math.max(1, Math.round(Number(r && r.rating) || 0))); if (!(Number(r && r.rating) >= 1)) continue; dist[n - 1] += 1; sum += n; }
  const count = dist.reduce((a, b) => a + b, 0);
  return { count, avg: count ? sum / count : 0, dist, pct: dist.map((d) => (count ? Math.round((d / count) * 100) : 0)) };
}

// Typical fake / spam review markers: links, phone numbers, the same word repeated, all capitals, too short. Returns '' when fine, otherwise the reason (shown to the writer).
export function reviewProblem(text) {
  const t = String(text || '').trim();
  if (t.length < 15) return 'Please write at least 15 characters about what you really experienced.';
  if (/https?:\/\/|www\.|\.com\b|\.pk\b|wa\.me/i.test(t)) return 'Links are not allowed in reviews.';
  if (/(?:\+?92|0)3\d{2}[\s-]?\d{7}/.test(t.replace(/\s+/g, ' '))) return 'Please do not put phone numbers in a review.';
  if (/(.)\1{7,}/.test(t)) return 'This looks like repeated letters. Please write a real review.';
  const words = t.toLowerCase().split(/\s+/);
  if (words.length >= 6 && new Set(words).size <= Math.ceil(words.length / 4)) return 'This looks repeated. Please write a real review.';
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length > 25 && letters === letters.toUpperCase()) return 'Please do not write in all capital letters.';
  return '';
}
