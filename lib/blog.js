import fs from 'fs';
import path from 'path';

const DIR = path.join(process.cwd(), 'content', 'blog');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (t) =>
  esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, a, b) => `<a href="${b.replace(/&amp;/g, '&')}">${a}</a>`);

function md(src) {
  let html = '', list = null, para = [];
  const heads = [];
  const flushP = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>\n`; para = []; } };
  const flushL = () => { if (list) { html += `</${list}>\n`; list = null; } };
  let code = null; // v26: ``` fenced code blocks (Asaan Lang examples, commands)
  for (const raw of src.split('\n')) {
    const l = raw.trimEnd();
    if (code !== null) { if (l.trim().startsWith('```')) { html += `<pre class="my-4 overflow-x-auto rounded-xl bg-[#0b1f17] p-4 text-sm leading-6 text-emerald-100"><code>${esc(code.join('\n'))}</code></pre>\n`; code = null; } else code.push(raw); continue; }
    if (l.trim().startsWith('```')) { flushP(); flushL(); code = []; continue; }
    if (!l.trim()) { flushP(); flushL(); continue; }
    if (l.trim() === '{{cta}}') { flushP(); flushL(); html += '<!--cta-->\n'; continue; }
    let m;
    if ((m = l.match(/^!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)$/))) { flushP(); flushL(); html += `<figure class="my-6"><img src="${esc(m[2])}" alt="${esc(m[1])}" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="mx-auto max-h-[28rem] w-auto max-w-full rounded-2xl" /></figure>\n`; continue; }
    if ((m = l.match(/^## (.+)/))) {
      flushP(); flushL();
      const id = m[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      heads.push({ id, text: m[1] });
      html += `<h2 id="${id}">${inline(m[1])}</h2>\n`;
    } else if ((m = l.match(/^### (.+)/))) { flushP(); flushL(); html += `<h3>${inline(m[1])}</h3>\n`; }
    else if ((m = l.match(/^> (.+)/))) { flushP(); flushL(); html += `<div class="callout"><p>${inline(m[1])}</p></div>\n`; }
    else if ((m = l.match(/^- (.+)/))) { flushP(); if (list !== 'ul') { flushL(); html += '<ul>\n'; list = 'ul'; } html += `<li>${inline(m[1])}</li>\n`; }
    else if ((m = l.match(/^\d+\. (.+)/))) { flushP(); if (list !== 'ol') { flushL(); html += '<ol>\n'; list = 'ol'; } html += `<li>${inline(m[1])}</li>\n`; }
    else para.push(l.trim());
  }
  flushP(); flushL();
  return { html, heads };
}

let cache = null;
export function getPosts() {
  if (cache) return cache;
  if (!fs.existsSync(DIR)) return [];
  cache = fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => {
    const raw = fs.readFileSync(path.join(DIR, f), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) throw new Error(`Bad front matter in ${f}`);
    const meta = {};
    m[1].split('\n').forEach((x) => { const i = x.indexOf(':'); if (i > 0) meta[x.slice(0, i).trim()] = x.slice(i + 1).trim(); });
    const body = md(m[2]);
    const words = m[2].split(/\s+/).length;
    return { ...meta, slug: meta.slug || f.replace(/\.md$/, ''), author: meta.author || 'Muaaz Iqbal', ...body, words, mins: Math.max(2, Math.round(words / 200)) };
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return cache;
}
export const getPost = (slug) => getPosts().find((p) => p.slug === slug) || null;
