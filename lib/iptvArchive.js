// GITHUB ARCHIVE — poora panel (catalogue + VOD + lines ki summary) aik commit mein GitHub repo
// mein. Password kabhi archive mein nahi jata; MAC aadha chhupa hota hai.

const clean = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const esc = (s) => String(s || '').replace(/"/g, '').replace(/[\r\n]+/g, ' ');

export const maskMac = (mac) => {
  const hex = String(mac || '').toUpperCase().replace(/[^0-9A-F]/g, '');
  if (hex.length !== 12) return '';
  return `${hex.slice(0, 6).match(/.{2}/g).join(':')}:**:**:**`;
};

/** M3U — channels + movies + series episodes, asli links ke sath (sirf archive ke liye). */
export function archiveM3U({ channels = [], movies = [], series = [] }, title = 'Mizanora IPTV') {
  const out = ['#EXTM3U', `#PLAYLIST:${esc(title)}`];
  for (const c of channels) {
    if (!c || c.off || !c.url) continue;
    out.push(`#EXTINF:-1 tvg-name="${esc(c.name)}"${c.logo ? ` tvg-logo="${esc(c.logo)}"` : ''} group-title="${esc(c.group || 'Other')}",${c.name}`);
    out.push(c.url);
  }
  for (const m of movies) {
    if (!m || m.off || !m.url) continue;
    out.push(`#EXTINF:-1 tvg-name="${esc(m.name)}"${m.poster ? ` tvg-logo="${esc(m.poster)}"` : ''} group-title="${esc(m.group || 'Movies')}",${m.name}${m.year ? ` (${m.year})` : ''}`);
    out.push(m.url);
  }
  for (const s of series) {
    if (!s || s.off) continue;
    for (const season of s.seasons || []) {
      for (const e of season.episodes || []) {
        if (!e.url) continue;
        const label = `${s.name} S${String(season.n).padStart(2, '0')}E${String(e.n).padStart(2, '0')}${e.title ? ` - ${e.title}` : ''}`;
        out.push(`#EXTINF:-1 group-title="${esc(s.group || 'Series')}",${esc(label)}`);
        out.push(e.url);
      }
    }
  }
  return `${out.join('\n')}\n`;
}

/** Lines ki CSV — username/plan/status/expiry/devices/reseller, na password na poora MAC. */
export function archiveLinesCsv(lines = []) {
  const head = 'username,client,plan,status,devices,mac,reseller,expires,created';
  const rows = (Array.isArray(lines) ? lines : []).map((l) => [
    clean(l.username, 40), clean(l.clientName || l.name, 60), clean(l.plan, 20), clean(l.status || 'active', 20),
    Number(l.maxDevices) || 1, maskMac(l.mac), clean(l.resellerName || (l.resellerId === 'admin' ? 'Mizanora' : l.resellerId), 40),
    l.expiresAt ? new Date(Number(l.expiresAt)).toISOString().slice(0, 10) : '',
    l.createdAt ? new Date(Number(l.createdAt)).toISOString().slice(0, 19) : '',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return [head, ...rows].join('\n');
}

/** Kitni movies / series / episodes hain. */
export function archiveStats({ channels = [], movies = [], series = [] } = {}) {
  return {
    channels: channels.filter((c) => c && !c.off).length,
    movies: movies.filter((m) => m && !m.off).length,
    series: series.filter((s) => s && !s.off).length,
    episodes: series.reduce((n, s) => n + (s.seasons || []).reduce((k, x) => k + (x.episodes || []).length, 0), 0),
  };
}

/**
 * GitHub par jaane wali files. Har file { path, content }.
 * stamp: "2026-11-02T10-30" — har push ka apna folder, purana data mit-ta nahi.
 */
export function buildArchiveFiles({ channels = [], movies = [], series = [], lines = [], base = 'https://mizanora.vercel.app', stamp = '' } = {}) {
  const tag = stamp || new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const stats = archiveStats({ channels, movies, series });
  const dir = `iptv/archive/${tag}`;

  const files = [
    {
      path: `${dir}/catalogue.json`,
      content: `${JSON.stringify({ savedAt: new Date().toISOString(), base, stats, channels }, null, 0)}\n`,
    },
    {
      path: `${dir}/vod.json`,
      content: `${JSON.stringify({ savedAt: new Date().toISOString(), base, stats, movies, series }, null, 0)}\n`,
    },
    { path: `${dir}/mizanora-catalogue.m3u`, content: archiveM3U({ channels, movies, series }) },
    { path: `${dir}/lines.csv`, content: `${archiveLinesCsv(lines)}\n` },
    {
      path: `${dir}/README.md`,
      content: [
        `# Mizanora IPTV archive — ${tag}`,
        '',
        `- Base: ${base}`,
        `- Channels: ${stats.channels}`,
        `- Movies: ${stats.movies}`,
        `- Series: ${stats.series} (${stats.episodes} episodes)`,
        `- Lines: ${(lines || []).length}`,
        '',
        'Passwords is archive mein **nahi** hain. MAC aadha masked hai.',
        'Yeh repo private rakhein — catalogue.json mein asli stream links hote hain.',
      ].join('\n'),
    },
    {
      path: 'iptv/latest.json',
      content: `${JSON.stringify({ tag, savedAt: new Date().toISOString(), base, stats, lines: (lines || []).length }, null, 2)}\n`,
    },
  ];
  return { files, tag, stats };
}

/** GitHub repo ka naam saaf karo ("owner/repo"). */
export function cleanRepo(v) {
  const s = String(v || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s) ? s : '';
}
