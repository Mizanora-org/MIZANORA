// EPG — XMLTV parse/build. Sab pure (network admin API mein hota hai), taake test ho sake.
//
// Har channel ka apna `epg` id hota hai (catalogue mein). Guide do jagah se aati hai:
//   1) admin ne XMLTV link diya  -> asli programmes
//   2) kuch na ho to generated slots (BarakatWave jaisa) — app mein guide khali nahi dikhti.

const pad = (n) => String(n).padStart(2, '0');

/** "20261102143000 +0500" yaa ISO -> epoch ms (na samajh aaye to 0). */
export function parseXmltvDate(s) {
  const v = String(s || '').trim();
  let m = v.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?\s*([+-]\d{4})?$/);
  if (m) {
    const [, y, mo, d, h = '00', mi = '00', se = '00', tz] = m;
    const off = tz ? (tz[0] === '-' ? -1 : 1) * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5))) : 0;
    const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
    return utc - off * 60_000;
  }
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

/** epoch ms -> "20261102143000 +0000" */
export function xmltvDate(ms) {
  const d = new Date(Number(ms) || 0);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())} +0000`;
}

const unescape = (s) => String(s || '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d)))
  .replace(/&amp;/g, '&');

const escape = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const tag = (block, name) => {
  const m = String(block).match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? unescape(m[1].replace(/<[^>]+>/g, '')).trim() : '';
};
const attr = (block, name) => {
  const m = String(block).match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return m ? unescape(m[1]).trim() : '';
};

/** XMLTV text -> { channels, programmes }. Bara file bhi cap ke andar. */
export function parseXmltv(text, opts = {}) {
  const maxChannels = Number(opts.maxChannels) || 5000;
  const maxProgrammes = Number(opts.maxProgrammes) || 60000;
  const src = String(text || '').slice(0, Number(opts.maxBytes) || 12_000_000);

  const channels = [];
  const programmes = [];

  for (const m of src.matchAll(/<channel[^>]*>([\s\S]*?)<\/channel>/gi)) {
    if (channels.length >= maxChannels) break;
    const block = m[0];
    const id = attr(block, 'id');
    if (!id) continue;
    const name = tag(block, 'display-name') || id;
    const icon = attr(block.match(/<icon[^>]*>/i)?.[0] || '', 'src');
    channels.push({ id, name: name.slice(0, 90), logo: icon.slice(0, 400) });
  }

  for (const m of src.matchAll(/<programme[^>]*>([\s\S]*?)<\/programme>/gi)) {
    if (programmes.length >= maxProgrammes) break;
    const block = m[0];
    const channel = attr(block.match(/<programme[^>]*>/i)?.[0] || block, 'channel');
    const start = parseXmltvDate(attr(block.match(/<programme[^>]*>/i)?.[0] || block, 'start'));
    const stop = parseXmltvDate(attr(block.match(/<programme[^>]*>/i)?.[0] || block, 'stop'));
    if (!channel || !start) continue;
    programmes.push({
      channel, start, stop: stop || start + 30 * 60_000,
      title: (tag(block, 'title') || '').slice(0, 140),
      desc: (tag(block, 'desc') || '').slice(0, 300),
      category: (tag(block, 'category') || '').slice(0, 40),
    });
  }

  programmes.sort((a, b) => a.start - b.start);
  return { channels: dedupeChannels(channels), programmes };
}

function dedupeChannels(list) {
  const seen = new Set();
  return list.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

/** Channel ka guide id — admin ne jo diya, warna apna. */
export const epgIdFor = (channel = {}) => String(channel.epg || '').trim() || `mz-${channel.id || 'ch'}.tv`;

/**
 * Generated guide — har channel ke liye 2-ghante ke slots (aage 12 ghante).
 * Asli guide na ho to bhi app mein TV guide bhara dikhta hai.
 */
export function generatedGuide(channels = [], opts = {}) {
  const now = Number(opts.now) || Date.now();
  const hours = Math.min(48, Math.max(2, Number(opts.hours) || 12));
  const slotMs = Math.min(6 * 3600_000, Math.max(15 * 60_000, Number(opts.slotMinutes || 120) * 60_000));
  const base = Math.floor(now / slotMs) * slotMs;
  const rows = [];
  for (const ch of Array.isArray(channels) ? channels : []) {
    if (!ch || ch.off) continue;
    const id = epgIdFor(ch);
    const label = String(ch.nowPlaying || ch.name || 'Live').slice(0, 100);
    for (let t = base - slotMs; t < base + hours * 3600_000; t += slotMs) {
      rows.push({
        channel: id, start: t, stop: t + slotMs,
        title: label,
        desc: `${ch.group || 'Live TV'} · ${ch.name || ''}`.slice(0, 200),
        category: String(ch.group || 'Live TV').slice(0, 40),
      });
    }
  }
  return rows;
}

/** Do guides (ya zyada) merge — duplicate (channel+start) hata kar. */
export function mergeGuides(guides = []) {
  const channels = new Map();
  const programmes = new Map();
  for (const g of guides) {
    for (const c of (g && g.channels) || []) if (c && c.id && !channels.has(c.id)) channels.set(c.id, c);
    for (const p of (g && g.programmes) || []) {
      if (!p || !p.channel || !p.start) continue;
      const key = `${p.channel}|${p.start}`;
      if (!programmes.has(key)) programmes.set(key, p);
    }
  }
  return {
    channels: [...channels.values()],
    programmes: [...programmes.values()].sort((a, b) => a.start - b.start),
  };
}

/** Sirf un programmes ko rakho jo hamare channels ke ids par hain. */
export function scopedGuide(channels = [], guide = {}, opts = {}) {
  const idMap = new Map();
  for (const ch of channels) idMap.set(epgIdFor(ch), ch);
  const keep = new Set(idMap.keys());
  const now = Number(opts.now) || Date.now();
  const from = now - 6 * 3600_000;
  const to = now + (Number(opts.hours) || 36) * 3600_000;
  return {
    channels: channels.map((ch) => ({ id: epgIdFor(ch), name: ch.name || '', logo: ch.logo || '' })),
    programmes: (guide.programmes || []).filter((p) => keep.has(p.channel) && p.stop > from && p.start < to),
  };
}

/** XMLTV text banao (hamare channels + programmes). */
export function toXmltv(channels = [], programmes = [], opts = {}) {
  const out = ['<?xml version="1.0" encoding="UTF-8"?>'];
  out.push(`<tv generator-info-name="${escape(opts.generator || 'Mizanora IPTV')}"${opts.siteUrl ? ` generator-info-url="${escape(opts.siteUrl)}"` : ''}>`);
  for (const c of channels) {
    out.push(`  <channel id="${escape(c.id)}">`);
    out.push(`    <display-name>${escape(c.name || c.id)}</display-name>`);
    if (c.logo) out.push(`    <icon src="${escape(c.logo)}" />`);
    out.push('  </channel>');
  }
  for (const p of programmes) {
    out.push(`  <programme start="${xmltvDate(p.start)}" stop="${xmltvDate(p.stop)}" channel="${escape(p.channel)}">`);
    out.push(`    <title lang="en">${escape(p.title || 'Live')}</title>`);
    if (p.desc) out.push(`    <desc lang="en">${escape(p.desc)}</desc>`);
    if (p.category) out.push(`    <category lang="en">${escape(p.category)}</category>`);
    out.push('  </programme>');
  }
  out.push('</tv>');
  return `${out.join('\n')}\n`;
}

/** Naam se channel mapping — admin ko manual mapping kam karni pare. */
export function autoMap(channels = [], epgChannels = []) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const byName = new Map();
  for (const e of epgChannels) {
    const k = norm(e.name);
    if (k && !byName.has(k)) byName.set(k, e.id);
  }
  const map = {};
  const unmatched = [];
  for (const ch of channels) {
    const hit = byName.get(norm(ch.name));
    if (hit) map[ch.id] = hit;
    else unmatched.push(ch.id);
  }
  return { map, unmatched };
}

/** Player ke liye: aik channel ka "abhi chal raha" + aage ka schedule. */
export function nowNext(guide = {}, epgId, now = Date.now()) {
  const rows = (guide.programmes || []).filter((p) => p.channel === epgId).sort((a, b) => a.start - b.start);
  const i = rows.findIndex((p) => p.start <= now && p.stop > now);
  return { now: i >= 0 ? rows[i] : null, next: i >= 0 ? rows[i + 1] || null : rows.find((p) => p.start > now) || null };
}
