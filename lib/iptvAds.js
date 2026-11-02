// IPTV ADS — kisi bhi channel par apna preroll video / banner. Sab pure (testable).
export const ADS_DOC = { collection: 'siteMeta', id: 'iptvAds' };

const clean = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const httpUrl = (v, n = 500) => {
  const s = clean(v, n);
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) return '';
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.toString().slice(0, n) : ''; } catch { return ''; }
};
const ids = (v) => [...new Set((Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 2000);

export function cleanAds(input = {}) {
  const skipAfter = Math.min(30, Math.max(0, Number(input.skipAfter) || 5));
  return {
    enabled: input.enabled === true,
    all: input.all !== false,
    channels: ids(input.channels),
    prerollUrl: httpUrl(input.prerollUrl, 500),   // video ad (mp4/m3u8)
    imageUrl: httpUrl(input.imageUrl, 500),       // banner ad
    clickUrl: httpUrl(input.clickUrl, 300),
    title: clean(input.title, 80),
    note: clean(input.note, 160),
    skipAfter,
    updatedAt: Number(input.updatedAt) || 0,
  };
}

/** Is channel par ad chalega? (admin ne "all" + kuch channels off nahi kiye) */
export function adForChannel(ads, channelId) {
  const a = cleanAds(ads);
  if (!a.enabled) return null;
  if (!a.prerollUrl && !a.imageUrl) return null;
  const id = String(channelId || '');
  if (!a.all && id && !a.channels.includes(id)) return null;
  if (id && a.channels.includes(`-${id}`)) return null; // "-12" = is channel par nahi
  return { prerollUrl: a.prerollUrl, imageUrl: a.imageUrl, clickUrl: a.clickUrl, title: a.title, skipAfter: a.skipAfter };
}
