// Date-range rules for the file archive. Dates are inclusive Pakistan calendar days (PKT, UTC+05:00).
// This module is pure so preview, export, delete and tests agree on which version of a product wins.
export function archiveDateRange(from, to) {
  const parse = (value) => {
    const s = String(value || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
    const d = new Date(`${s}T00:00:00.000Z`);
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== s) return NaN;
    return d.getTime() - 5 * 60 * 60 * 1000;
  };
  const start = parse(from), endDay = parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(endDay) || start > endDay) throw new Error('Choose valid start and end dates (start must be on or before end).');
  return { start, end: endDay + 86400000 };
}
export function archiveTimestamp(value) {
  if (value && typeof value === 'object') {
    const sec = Number(value.seconds ?? value._seconds);
    return Number.isFinite(sec) && sec > 0 ? sec * 1000 + Math.floor(Number(value.nanoseconds ?? value._nanoseconds ?? 0) / 1e6) : 0;
  }
  if (typeof value === 'string' && !/^\d+$/.test(value)) {
    const n = Date.parse(value); return Number.isFinite(n) && n > 0 ? n : 0;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1e11 ? n * 1000 : n;
}
export const inArchiveRange = (value, range) => { const t = archiveTimestamp(value); return t > 0 && t >= range.start && t < range.end; };

// `parts` must be newest first; within each part the last occurrence wins, like archiveCards().
// Rows may be full docs or slim cards; missing dates are counted, never silently assigned today's date.
export function selectArchiveRange(parts, range) {
  const seen = new Set(), matches = []; let undated = 0;
  for (const part of parts) {
    const rows = Array.isArray(part.rows) ? part.rows : [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      if (!row || !row.id) continue;
      const id = String(row.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const at = row.createdAt ?? row.t;
      if (!archiveTimestamp(at)) undated++;
      else if (inArchiveRange(at, range)) matches.push({ row, part: part.n });
    }
  }
  return { matches, undated, total: seen.size };
}

// Canonical input to a SHA-256 digest, used to detect card/full-file mismatches with identical counts.
export function rangeSelectionKey(rows) {
  const entries = (rows || []).map((item) => { const r = item.row || item; return [String(r.id), archiveTimestamp(r.createdAt ?? r.t)]; });
  entries.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]);
  return JSON.stringify(entries);
}

// A destructive edit must never pair a full product with someone else's slim card.
export function assertArchivePair(n, rows, cards) {
  if (!Array.isArray(rows) || !Array.isArray(cards) || rows.length !== cards.length || rows.some((row, i) => String(row && row.id) !== String(cards[i] && cards[i].id))) {
    throw new Error(`Part ${n} and its cards disagree; no changes were made.`);
  }
}
// Omit every stored version of the chosen IDs, not just the most recent matching version.
export function omitArchiveIds(rows, cards, ids) {
  return {
    rows: rows.filter((row) => !ids.has(String(row && row.id))),
    cards: cards.filter((row) => !ids.has(String(row && row.id))),
  };
}
