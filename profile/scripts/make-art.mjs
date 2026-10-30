// ============================================================================
// v35 - THE PROFILE ART (github.com/muaaziqbalvip)
// ----------------------------------------------------------------------------
// Generates the animated SVGs used by the profile README, in the profile's own
// palette (deep emerald + mint #64E7B0 + gold #F1C86A), dark AND light themes,
// because the README picks the file with <picture media="(prefers-color-scheme)">.
//
//   node scripts/make-profile-art.mjs            -> public/brand/profile/*.svg
//   node scripts/make-profile-art.mjs --stats j  -> use a stats JSON file
//
// Everything is CSS keyframes + one SMIL sweep inside the file: GitHub renders
// an SVG <img> and plays it, no script, no third-party service, no font
// download. The numbers marked with data-k="..." are rewritten in place by the
// profile repo's daily Action (profile/scripts/refresh-live.mjs), so the banner
// never shows a stale count.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(root, 'public', 'brand', 'profile');

// ---- live numbers ----------------------------------------------------------
// Real values (read from GitHub / the shop). They are the DEFAULTS: the daily
// Action in the profile repo replaces them without touching anything else.
const DEFAULTS = {
  repos: 92,
  stars: 12,
  followers: 6,
  products: '11,000+',
  channels: 800,
  tools: 38,
  projects: 30,
  lastPush: '2 days ago',
  topLang: 'JavaScript',
  updated: 'October 2026',
};
const argStats = process.argv.indexOf('--stats');
let STATS = DEFAULTS;
if (argStats > -1 && process.argv[argStats + 1]) {
  try { STATS = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(process.argv[argStats + 1], 'utf8')) }; } catch (e) { console.warn('stats file ignored:', e.message); }
}

const T = {
  dark: {
    mode: 'dark',
    bg1: '#060F0D', bg2: '#0A1A16', bg3: '#0E2019',
    panel: '#071310', panel2: '#0B211B',
    ink: '#EAF6F0', soft: '#A9C9BC', faint: '#5E8A78',
    mint: '#64E7B0', mintDeep: '#2EA876', gold: '#F1C86A', goldDeep: '#C08A22',
    blue: '#8CB4FF', red: '#FF6B6B',
    line: '#17392E', grid: '#BFE9D6', gridOp: 0.055,
    chip: '#0C241D', chipInk: '#CFE9DE',
    shadow: 'rgba(0,0,0,.55)',
  },
  light: {
    mode: 'light',
    bg1: '#F3FBF7', bg2: '#EAF7F0', bg3: '#E2F3EA',
    panel: '#FFFFFF', panel2: '#F6FCF9',
    ink: '#0B2A1E', soft: '#41614F', faint: '#5E8A78',
    mint: '#12A06B', mintDeep: '#0E7A52', gold: '#C08A22', goldDeep: '#8A6414',
    blue: '#2F6BD8', red: '#D94848',
    line: '#CFE7DA', grid: '#0E7A52', gridOp: 0.07,
    chip: '#FFFFFF', chipInk: '#1E4538',
    shadow: 'rgba(12,60,44,.14)',
  },
};

const SANS = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// a value the daily Action can rewrite: data-k names it, the text is the current number
const live = (key, value, attrs = '') => ` data-k="${key}"${attrs}`;

// shared <style>: all motion is here, and all of it stops for reduced motion
function css(t, extra = '') {
  return `<style>
    .spin-slow{transform-box:fill-box;transform-origin:center;animation:mz-spin 42s linear infinite}
    .spin-fast{transform-box:fill-box;transform-origin:center;animation:mz-spin 24s linear infinite reverse}
    .spin-mid{transform-box:fill-box;transform-origin:center;animation:mz-spin 33s linear infinite}
    @keyframes mz-spin{to{transform:rotate(360deg)}}
    .glow{transform-box:fill-box;transform-origin:center;animation:mz-glow 5.5s ease-in-out infinite}
    @keyframes mz-glow{0%,100%{opacity:.45;transform:scale(.96)}50%{opacity:1;transform:scale(1.05)}}
    .live-dot{transform-box:fill-box;transform-origin:center;animation:mz-live 1.5s ease-in-out infinite}
    @keyframes mz-live{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.6)}}
    .ring{transform-box:fill-box;transform-origin:center;animation:mz-ring 2.4s ease-out infinite}
    @keyframes mz-ring{0%{opacity:.6;transform:scale(.5)}100%{opacity:0;transform:scale(2.1)}}
    .bar{transform-box:fill-box;transform-origin:50% 100%;animation:mz-bar 1.2s ease-in-out infinite}
    @keyframes mz-bar{0%,100%{transform:scaleY(.2)}50%{transform:scaleY(1)}}
    .twinkle{transform-box:fill-box;transform-origin:center;animation:mz-twinkle 3s ease-in-out infinite}
    @keyframes mz-twinkle{0%,100%{opacity:.12;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}
    .float{animation:mz-float 9s ease-in-out infinite}
    @keyframes mz-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
    .scan{animation:mz-scan 5s linear infinite}
    @keyframes mz-scan{0%{transform:translateY(0);opacity:0}10%{opacity:.45}85%{opacity:.45}100%{transform:translateY(150px);opacity:0}}
    .sheen{animation:mz-sheen 6.5s ease-in-out infinite}
    @keyframes mz-sheen{0%,58%{transform:translateX(-420px)}100%{transform:translateX(720px)}}
    .tape{animation:mz-tape linear infinite}
    .tape-l{animation-direction:normal}
    .ch{opacity:1;animation:mz-ch 12s linear infinite both}
    @keyframes mz-ch{0%{opacity:0}1.2%{opacity:1}96%{opacity:1}99.5%{opacity:0}100%{opacity:0}}
    .caret{animation:mz-caret 1.05s steps(1) infinite}
    @keyframes mz-caret{0%,49%{opacity:1}50%,100%{opacity:0}}
    .fade1{opacity:1;animation:mz-fade 10.5s linear infinite both}
    .fade2,.fade3{opacity:0;animation:mz-fade 10.5s linear infinite both}
    .fade2{animation-delay:3.5s}
    .fade3{animation-delay:7s}
    @keyframes mz-fade{0%{opacity:0;transform:translateY(4px)}3%{opacity:1;transform:none}30%{opacity:1}33%{opacity:0}100%{opacity:0}}
    .pop{opacity:1;animation:mz-pop 9s ease-out infinite both}
    @keyframes mz-pop{0%{opacity:0;transform:translateY(10px) scale(.97)}6%{opacity:1;transform:none}100%{opacity:1;transform:none}}
    .grow{transform-box:fill-box;transform-origin:0 50%;animation:mz-grow 7s ease-in-out infinite}
    @keyframes mz-grow{0%{transform:scaleX(.02)}18%{transform:scaleX(1)}92%{transform:scaleX(1)}100%{transform:scaleX(.02)}}
    .fill{animation:mz-fill 8s linear infinite}
    @keyframes mz-fill{0%{width:10px}100%{width:340px}}
    .beat{animation:mz-beat 2.6s ease-in-out infinite}
    @keyframes mz-beat{0%,100%{opacity:.35}50%{opacity:.9}}
    @media (prefers-reduced-motion: reduce){
      .spin-slow,.spin-fast,.spin-mid,.glow,.live-dot,.ring,.bar,.twinkle,.float,.scan,.sheen,.tape,
      .ch,.caret,.fade1,.fade2,.fade3,.pop,.grow,.fill,.beat{animation:none!important;transform:none!important}
      .ch,.fade1,.pop{opacity:1}
    }
    ${extra}
  </style>`;
}

// the scroll tape (two copies, the group slides exactly one copy wide)
function tape({ t, y, size = 12.5, color, items, speed = 34, name = 'mz-tape', pad = '     ✦     ' }) {
  const text = items.join(pad) + pad;
  const w = Math.ceil([...text].length * size * 0.62);
  return {
    w,
    svg: `<g class="tape" style="animation-name:${name};animation-duration:${speed}s" font-family="${MONO}" font-size="${size}" font-weight="600" letter-spacing=".6" fill="${color}">
      <text x="0" y="${y}">${esc(text)}</text><text x="${w}" y="${y}">${esc(text)}</text></g>`,
    kf: `@keyframes ${name}{from{transform:translateX(0)}to{transform:translateX(-${w}px)}}`,
  };
}

// the monogram tile: rounded square, gradient, crescent + star (the Mizanora mark)
function monogram({ t, x, y, size, id }) {
  const s = size / 120;
  return `<g transform="translate(${x},${y}) scale(${s.toFixed(3)})">
    <defs>
      <linearGradient id="${id}-tile" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${t.mode === 'dark' ? '#12A975' : '#12A06B'}"/><stop offset=".6" stop-color="${t.mintDeep}"/><stop offset="1" stop-color="${t.mode === 'dark' ? '#06432F' : '#0B5A3C'}"/>
      </linearGradient>
      <linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFF0C8"/><stop offset=".5" stop-color="${t.gold}"/><stop offset="1" stop-color="${t.goldDeep}"/>
      </linearGradient>
      <mask id="${id}-cut"><rect width="120" height="120" fill="#000"/><circle cx="60" cy="60" r="33" fill="#fff"/><circle cx="74" cy="51" r="28" fill="#000"/></mask>
    </defs>
    <g class="spin-slow"><circle cx="60" cy="60" r="57" fill="none" stroke="${t.mint}" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="2 10"/></g>
    <g class="spin-fast"><circle cx="60" cy="60" r="49" fill="none" stroke="${t.gold}" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="20 14"/></g>
    <rect x="21" y="21" width="78" height="78" rx="23" fill="url(#${id}-tile)"/>
    <rect x="21" y="21" width="78" height="78" rx="23" fill="none" stroke="url(#${id}-gold)" stroke-opacity=".5"/>
    <g mask="url(#${id}-cut)"><circle cx="60" cy="60" r="33" fill="url(#${id}-gold)"/></g>
    <path d="M85 33l1.8 5.4 5.4 1.8-5.4 1.8L85 47.4l-1.8-5.4-5.4-1.8 5.4-1.8z" fill="url(#${id}-gold)"/>
  </g>`;
}

// typing line: one character per <text>, monospace means the positions are exact
function typed({ text, x, y, size, color, step = 0.055, dur = 12 }) {
  const adv = size * 0.6;
  const chars = [...text].map((c, i) => `<text class="ch" x="${(x + i * adv).toFixed(1)}" y="${y}" style="animation-delay:${(i * step).toFixed(3)}s;animation-duration:${dur}s">${esc(c === ' ' ? '\u00a0' : c)}</text>`).join('');
  const caretX = (x + [...text].length * adv + 3).toFixed(1);
  return `<g font-family="${MONO}" font-size="${size}" font-weight="600" fill="${color}">${chars}<rect class="caret" x="${caretX}" y="${y - size * 0.8}" width="${(size * 0.1).toFixed(1)}" height="${(size * 1.02).toFixed(1)}" rx="1" fill="${color}"/></g>`;
}

// ---------------------------------------------------------------------------
// HERO - 1200 x 420
// ---------------------------------------------------------------------------
function hero(t) {
  const W = 1200, H = 420;
  const bars = Array.from({ length: 20 }, (_, i) => {
    const h = 9 + ((i * 41) % 26);
    return `<rect class="bar" x="${846 + i * 12}" y="${252 - h}" width="6" height="${h}" rx="3" fill="${i % 3 ? t.mint : t.gold}" opacity=".85" style="animation-delay:${(i * 0.085).toFixed(2)}s"/>`;
  }).join('');
  const chips = [
    { label: 'OPEN TO WORK', solid: true },
    { label: 'KASUR · PAKISTAN', solid: false },
    { label: '17 Y/O · ICS', solid: false },
  ];
  let cx = 198;
  const chipSvg = chips.map((c) => {
    const adv = 6.6; // monospace 10.5px + letter-spacing: a little extra for wider fallback fonts
    const tw = c.label.length * adv;
    const w = Math.round(tw + (c.solid ? 60 : 36));
    const ink = c.solid ? (t.mode === 'dark' ? '#04170F' : '#FFFFFF') : t.chipInk;
    const g = `<g>
      <rect x="${cx}" y="${312}" width="${w}" height="28" rx="14" fill="${c.solid ? t.mint : t.chip}" stroke="${c.solid ? 'none' : t.line}"/>
      ${c.solid ? `<circle class="live-dot" cx="${cx + 15}" cy="326" r="3.8" fill="${ink}"/>` : ''}
      <text x="${cx + (c.solid ? 25 : 13)}" y="330" font-family="${MONO}" font-size="10.5" font-weight="700" letter-spacing="1.1" fill="${ink}">${c.label}</text>
    </g>`;
    cx += w + 10;
    return g;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="hTitle hDesc">
<title id="hTitle">Muaaz Iqbal — full-stack developer, AI builder and founder of Mizanora</title>
<desc id="hDesc">Animated banner: Muaaz Iqbal, Kasur Pakistan, 17 years old, open to work. A live card shows the Mizanora live channel with repositories, stars and followers.</desc>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg1}"/><stop offset=".45" stop-color="${t.bg2}"/><stop offset="1" stop-color="${t.bg3}"/></linearGradient>
  <linearGradient id="ink" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.ink}"/><stop offset=".62" stop-color="${t.ink}"/><stop offset="1" stop-color="${t.gold}"/></linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.gold}"/><stop offset="1" stop-color="${t.mint}"/></linearGradient>
  <linearGradient id="sweep" x1="-.4" y1="0" x2="0" y2="0">
    <stop offset="0" stop-color="#FFF" stop-opacity="0"/><stop offset=".5" stop-color="#FFF" stop-opacity=".55"/><stop offset="1" stop-color="#FFF" stop-opacity="0"/>
    <animate attributeName="x1" values="-0.6;1.6" dur="7s" repeatCount="indefinite"/><animate attributeName="x2" values="0.1;2.3" dur="7s" repeatCount="indefinite"/>
  </linearGradient>
  <radialGradient id="glowA"><stop offset="0" stop-color="${t.mint}" stop-opacity=".22"/><stop offset="1" stop-color="${t.mint}" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowB"><stop offset="0" stop-color="${t.gold}" stop-opacity=".18"/><stop offset="1" stop-color="${t.gold}" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowC"><stop offset="0" stop-color="${t.blue}" stop-opacity=".14"/><stop offset="1" stop-color="${t.blue}" stop-opacity="0"/></radialGradient>
  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="${t.grid}" stroke-opacity="${t.gridOp}" stroke-width="1"/></pattern>
  <pattern id="dots" width="19" height="19" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" fill="${t.mint}" fill-opacity="${t.mode === 'dark' ? 0.2 : 0.16}"/></pattern>
  <clipPath id="hclip"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="26"/></clipPath>
  <clipPath id="cardclip"><rect x="676" y="62" width="452" height="266" rx="20"/></clipPath>
  <clipPath id="nameclip"><text x="196" y="182" font-family="${SANS}" font-size="72" font-weight="800" letter-spacing="-2.5">Muaaz Iqbal</text></clipPath>
</defs>
${css(t)}
<g clip-path="url(#hclip)">
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <circle cx="1010" cy="70" r="250" fill="url(#glowA)" class="float"/>
  <circle cx="120" cy="420" r="240" fill="url(#glowB)" class="float" style="animation-delay:-4s"/>
  <circle cx="640" cy="30" r="180" fill="url(#glowC)" class="beat"/>

  <!-- left: the mark, the name, the line -->
  ${monogram({ t, x: 66, y: 62, size: 96, id: 'hm' })}
  <text x="196" y="118" font-family="${MONO}" font-size="11.5" font-weight="700" letter-spacing="3.6" fill="${t.mint}">FULL-STACK DEVELOPER · AI BUILDER</text>
  <text x="196" y="182" font-family="${SANS}" font-size="72" font-weight="800" letter-spacing="-2.5" fill="url(#ink)">Muaaz Iqbal</text>
  <g clip-path="url(#nameclip)"><rect class="sheen" x="-200" y="112" width="150" height="86" fill="url(#sweep)"/></g>
  <text x="198" y="216" font-family="${SANS}" font-size="19" font-weight="600" fill="${t.soft}">Founder of <tspan font-weight="800" fill="${t.gold}">Mizanora</tspan> · creator of <tspan font-weight="800" fill="${t.gold}">Asaan Lang</tspan></text>

  <!-- the typed line -->
  ${typed({ text: 'Works on a cheap phone, or it is not finished.', x: 198, y: 250, size: 13.5, color: t.mode === 'dark' ? '#B9D9CB' : '#2F5546', step: 0.05, dur: 13 })}

  <!-- the rotating third line -->
  <g font-family="${MONO}" font-size="12.5" font-weight="600" fill="${t.faint}">
    <text x="198" y="281">currently</text>
    <text class="fade1" x="278" y="281" fill="${t.mint}">building Mizanora, Asaan Lang &amp; BarakatWave TV</text>
    <text class="fade2" x="278" y="281" fill="${t.mint}">shipping Urdu-first products on a free tier</text>
    <text class="fade3" x="278" y="281" fill="${t.mint}">open to freelance work, collabs &amp; internships</text>
  </g>

  <!-- the chips -->
  ${chipSvg}

  <!-- right: the live card -->
  <g>
    <rect x="676" y="62" width="452" height="266" rx="20" fill="${t.panel}" stroke="${t.line}"/>
    <g clip-path="url(#cardclip)">
      <rect x="676" y="62" width="452" height="266" fill="url(#bg)" opacity=".85"/>
      <rect x="676" y="62" width="452" height="266" fill="url(#dots)" opacity=".5"/>
      <rect class="scan" x="676" y="120" width="452" height="2" fill="${t.mint}" opacity=".4"/>
      <!-- LIVE -->
      <g>
        <rect x="696" y="80" width="84" height="25" rx="12.5" fill="${t.red}"/>
        <circle class="live-dot" cx="710" cy="92.5" r="4.2" fill="#fff"/>
        <circle class="ring" cx="710" cy="92.5" r="4.2" fill="none" stroke="#fff" stroke-width="1.4"/>
        <text x="722" y="97" font-family="${SANS}" font-size="10.5" font-weight="800" letter-spacing="1.5" fill="#fff">LIVE</text>
      </g>
      <text x="794" y="97" font-family="${MONO}" font-size="10" letter-spacing="1.1" fill="${t.mint}" opacity=".9">mizanora · live channel</text>
      <text x="1112" y="97" text-anchor="end" font-family="${MONO}" font-size="9.5" letter-spacing="1.2" fill="${t.faint}">NOW PLAYING</text>
      <g font-family="${SANS}" font-size="17" font-weight="800" fill="${t.ink}">
        <text class="fade1" x="696" y="148">Quran Tilawat · Al-Baqarah 2:255</text>
        <text class="fade2" x="696" y="148">Hadees · Sahih al-Bukhari 6018</text>
        <text class="fade3" x="696" y="148">Noor AI · “sasta laal joota under 2k”</text>
      </g>
      <text x="696" y="170" font-family="${MONO}" font-size="10" letter-spacing="1" fill="${t.faint}">24/7 · PAKISTAN TIME</text>
      ${bars}
      <rect x="696" y="268" width="412" height="6" rx="3" fill="${t.line}"/>
      <rect class="fill" x="696" y="268" width="340" height="6" rx="3" fill="url(#gold)"/>
      <!-- the numbers -->
      <g font-family="${MONO}" font-size="11" font-weight="700" fill="${t.soft}">
        <text x="696" y="302"><tspan font-size="17" font-weight="800" fill="${t.mint}"${live('repos', STATS.repos)}>${STATS.repos}</tspan> repos</text>
        <text x="820" y="302"><tspan font-size="17" font-weight="800" fill="${t.gold}"${live('stars', STATS.stars)}>${STATS.stars}</tspan> stars</text>
        <text x="930" y="302"><tspan font-size="17" font-weight="800" fill="${t.ink}"${live('followers', STATS.followers)}>${STATS.followers}</tspan> followers</text>
      </g>
    </g>
  </g>

  <!-- lights -->
  <g fill="${t.mint}">
    <circle class="twinkle" cx="620" cy="48" r="1.6" style="animation-delay:.3s"/>
    <circle class="twinkle" cx="1146" cy="352" r="1.4" style="animation-delay:1.1s"/>
    <circle class="twinkle" cx="52" cy="352" r="1.2" style="animation-delay:1.9s"/>
  </g>
</g>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="26" fill="none" stroke="${t.line}"/>
</svg>
`;
}

// ---------------------------------------------------------------------------
// TICKER - 1200 x 68 (animated marquee)
// ---------------------------------------------------------------------------
function ticker(t) {
  const W = 1200, H = 68;
  const tp = tape({
    t, y: 42, size: 13.5, speed: 40, name: 'mz-tape-ticker',
    color: t.mode === 'dark' ? '#CFE9DE' : '#1E4538',
    items: ['MIZANORA', 'ASAAN LANG', 'BARAKATWAVE TV', 'SIRAVEX', 'MI TRADE MASTER', 'NOOR AI', 'HIJRIANCHOR', 'MUSLIM ISLAM', 'KASUR, PAKISTAN'],
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="tkTitle">
<title id="tkTitle">Mizanora ecosystem — Mizanora, Asaan Lang, BarakatWave TV, SIRAVEX, MI Trade Master, Noor AI, HijriAnchor</title>
<defs>
  <linearGradient id="tkbg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.bg1}"/><stop offset=".5" stop-color="${t.mode === 'dark' ? '#0C231C' : '#FFFFFF'}"/><stop offset="1" stop-color="${t.bg1}"/></linearGradient>
  <linearGradient id="fadeL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.bg1}" stop-opacity="1"/><stop offset="1" stop-color="${t.bg1}" stop-opacity="0"/></linearGradient>
  <linearGradient id="fadeR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.bg1}" stop-opacity="0"/><stop offset="1" stop-color="${t.bg1}" stop-opacity="1"/></linearGradient>
  <linearGradient id="tkline" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.mint}" stop-opacity="0"/><stop offset=".25" stop-color="${t.mint}" stop-opacity=".6"/><stop offset=".75" stop-color="${t.gold}" stop-opacity=".5"/><stop offset="1" stop-color="${t.gold}" stop-opacity="0"/></linearGradient>
  <clipPath id="tkwin"><rect width="${W}" height="${H}" rx="18"/></clipPath>
</defs>
${css(t, tp.kf)}
<g clip-path="url(#tkwin)">
  <rect width="${W}" height="${H}" fill="url(#tkbg)"/>
  <line x1="0" y1=".6" x2="${W}" y2=".6" stroke="url(#tkline)"/>
  <line x1="0" y1="${H - 0.6}" x2="${W}" y2="${H - 0.6}" stroke="url(#tkline)"/>
  <g class="live-dot"><circle cx="34" cy="34" r="4.5" fill="${t.mint}"/></g>
  ${tp.svg}
  <rect x="0" y="0" width="90" height="${H}" fill="url(#fadeL)"/>
  <rect x="${W - 90}" y="0" width="90" height="${H}" fill="url(#fadeR)"/>
</g>
</svg>
`;
}

// ---------------------------------------------------------------------------
// LIVE - 1200 x 132 (the "right now" strip)
// ---------------------------------------------------------------------------
function liveStrip(t) {
  const W = 1200, H = 124;
  const bars = Array.from({ length: 22 }, (_, i) => {
    const h = 10 + ((i * 47) % 26);
    return `<rect class="bar" x="${618 + i * 11}" y="${86 - h}" width="5" height="${h}" rx="2.5" fill="${i % 4 ? t.mint : t.gold}" opacity=".85" style="animation-delay:${(i * 0.07).toFixed(2)}s"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="lvTitle">
<title id="lvTitle">Live right now — Mizanora live channel, Quran and Hadith 24/7, plus the latest code push</title>
<defs>
  <linearGradient id="lvg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.bg1}"/><stop offset=".55" stop-color="${t.bg3}"/><stop offset="1" stop-color="${t.bg1}"/></linearGradient>
  <linearGradient id="lvbar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.mint}"/><stop offset="1" stop-color="${t.gold}"/></linearGradient>
  <clipPath id="lvwin"><rect width="${W}" height="${H}" rx="20"/></clipPath>
</defs>
${css(t)}
<g clip-path="url(#lvwin)">
  <rect width="${W}" height="${H}" fill="url(#lvg)"/>
  <rect width="${W}" height="${H}" fill="${t.mode === 'dark' ? '#000' : '#fff'}" opacity=".05"/>
  <!-- row 1: LIVE + the channel name, right: the newest push -->
  <rect x="26" y="22" width="92" height="27" rx="13.5" fill="${t.red}"/>
  <circle class="live-dot" cx="42" cy="35.5" r="4.6" fill="#fff"/>
  <circle class="ring" cx="42" cy="35.5" r="4.6" fill="none" stroke="#fff" stroke-width="1.4"/>
  <text x="56" y="40" font-family="${SANS}" font-size="11" font-weight="800" letter-spacing="1.6" fill="#fff">LIVE</text>
  <text x="132" y="40" font-family="${MONO}" font-size="11" letter-spacing="1.5" fill="${t.mint}">MIZANORA LIVE CHANNEL · 24/7</text>
  <text x="1174" y="30" text-anchor="end" font-family="${MONO}" font-size="9.5" letter-spacing="1.2" fill="${t.faint}">LATEST PUSH</text>
  <text x="1174" y="48" text-anchor="end" font-family="${SANS}" font-size="13" font-weight="800" fill="${t.gold}">MIZANORA <tspan font-family="${MONO}" font-size="10" font-weight="600" fill="${t.soft}"${live('lastPush', STATS.lastPush)}>· ${STATS.lastPush}</tspan></text>

  <!-- row 2: what is playing (three titles take turns) -->
  <g font-family="${SANS}" font-size="21" font-weight="800" fill="${t.ink}">
    <text class="fade1" x="26" y="88">Quran Tilawat · Al-Baqarah 2:255</text>
    <text class="fade2" x="26" y="88">Hadees · Sahih al-Bukhari 6018</text>
    <text class="fade3" x="26" y="88">Noor AI finds “sasta laal joota under 2k”</text>
  </g>

  <!-- row 3: the waveform, the progress, the small print -->
  ${bars}
  <rect x="618" y="94" width="242" height="5" rx="2.5" fill="${t.line}"/>
  <rect class="fill" x="618" y="94" width="240" height="5" rx="2.5" fill="url(#lvbar)"/>
  <text x="26" y="108" font-family="${MONO}" font-size="9.5" letter-spacing="1.1" fill="${t.faint}">QURAN · HADEES · PRODUCT ADS · PAKISTAN TIME</text>
  <text x="1174" y="94" text-anchor="end" font-family="${MONO}" font-size="9.5" letter-spacing="1.1" fill="${t.faint}"><tspan${live('topLang', String(STATS.topLang).toUpperCase())}>${String(STATS.topLang).toUpperCase()}</tspan> · <tspan${live('repos', STATS.repos)}>${STATS.repos}</tspan> REPOS</text>
  <text x="1174" y="110" text-anchor="end" font-family="${MONO}" font-size="9.5" letter-spacing="1.1" fill="${t.faint}"><tspan${live('stars', STATS.stars)}>${STATS.stars}</tspan> STARS · <tspan${live('followers', STATS.followers)}>${STATS.followers}</tspan> FOLLOWERS</text>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="20" fill="none" stroke="${t.line}"/>
</svg>
`;
}

// ---------------------------------------------------------------------------
// STATS - 1200 x 300 (product numbers + code numbers)
// ---------------------------------------------------------------------------
function stats(t) {
  const W = 1200, H = 300;
  const cells = [
    { k: 'repos', v: STATS.repos, label: 'PUBLIC REPOS', color: t.mint },
    { k: 'stars', v: STATS.stars, label: 'STARS EARNED', color: t.gold },
    { k: 'products', v: STATS.products, label: 'PRODUCTS IN MIZANORA', color: t.mint },
    { k: 'channels', v: STATS.channels, label: 'LIVE TV CHANNELS', color: t.gold },
    { k: 'tools', v: STATS.tools, label: 'FREE TOOLS', color: t.mint },
    { k: 'projects', v: STATS.projects, label: 'PROJECTS SHIPPED', color: t.gold },
  ];
  const cw = 372, gap = 18, x0 = 28, y0 = 66, ch = 96;
  const cards = cells.map((c, i) => {
    const x = x0 + (i % 3) * (cw + gap);
    const y = y0 + Math.floor(i / 3) * (ch + gap);
    return `<g class="pop" style="animation-delay:${(i * 0.5).toFixed(2)}s">
      <rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="18" fill="${t.panel}" stroke="${t.line}"/>
      <rect x="${x}" y="${y}" width="4" height="${ch}" rx="2" fill="${c.color}" opacity=".8"/>
      <text x="${x + 26}" y="${y + 54}" font-family="${SANS}" font-size="34" font-weight="800" fill="${c.color}"${live(c.k, c.v)}>${c.v}</text>
      <text x="${x + 26}" y="${y + 76}" font-family="${MONO}" font-size="10.5" font-weight="700" letter-spacing="1.4" fill="${t.faint}">${c.label}</text>
      <circle class="twinkle" cx="${x + cw - 24}" cy="${y + 24}" r="2.2" fill="${c.color}" style="animation-delay:${(i * 0.3).toFixed(2)}s"/>
    </g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="stTitle">
<title id="stTitle">By the numbers — public repositories, stars, Mizanora products, live channels, free tools and shipped projects</title>
<defs>
  <linearGradient id="stg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg1}"/><stop offset="1" stop-color="${t.bg3}"/></linearGradient>
  <pattern id="stdots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" fill="${t.mint}" fill-opacity="${t.mode === 'dark' ? 0.16 : 0.12}"/></pattern>
  <clipPath id="stclip"><rect width="${W}" height="${H}" rx="22"/></clipPath>
</defs>
${css(t)}
<g clip-path="url(#stclip)">
  <rect width="${W}" height="${H}" fill="url(#stg)"/>
  <rect width="${W}" height="${H}" fill="url(#stdots)"/>
  <g font-family="${SANS}">
    <circle class="live-dot" cx="34" cy="36" r="5" fill="${t.mint}"/>
    <text x="50" y="41" font-size="14" font-weight="800" letter-spacing=".4" fill="${t.ink}">By the numbers</text>
    <text x="1172" y="41" text-anchor="end" font-family="${MONO}" font-size="10.5" letter-spacing="1.2" fill="${t.faint}">UPDATED ${String(STATS.updated || '').toUpperCase()}</text>
  </g>
  ${cards}
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="22" fill="none" stroke="${t.line}"/>
</svg>
`;
}

// ---------------------------------------------------------------------------
// LANGUAGES - 1200 x 210 (animated share bar, real numbers)
// ---------------------------------------------------------------------------
function languages(t) {
  const W = 1200, H = 210;
  // Share of REPOSITORIES (not bytes): honest, and it is what /api/github counts.
  const langs = [
    { name: 'HTML', pct: 38, color: t.mint },
    { name: 'Python', pct: 24, color: t.blue },
    { name: 'JavaScript', pct: 22, color: t.gold },
    { name: 'Kotlin', pct: 14, color: '#A97BFF' },
    { name: 'TypeScript', pct: 1, color: '#4FA3F7' },
    { name: 'CSS', pct: 1, color: '#7FA7FF' },
  ];
  const total = langs.reduce((s, l) => s + l.pct, 0);
  const barW = W - 56;
  let x = 28;
  const segs = langs.map((l, i) => {
    const w = (l.pct / total) * barW;
    const seg = `<rect x="${x.toFixed(1)}" y="86" width="${w.toFixed(1)}" height="16" rx="3" fill="${l.color}" opacity=".92"><animate attributeName="height" values="0;16" dur=".7s" begin="${(0.25 + i * 0.12).toFixed(2)}s" fill="freeze"/><animate attributeName="y" values="94;86" dur=".7s" begin="${(0.25 + i * 0.12).toFixed(2)}s" fill="freeze"/></rect>`;
    x += w;
    return seg;
  }).join('');
  const legend = langs.map((l, i) => {
    const lx = 28 + (i % 3) * 390;
    const ly = 138 + Math.floor(i / 3) * 30;
    return `<g class="pop" style="animation-delay:${(0.3 + i * 0.18).toFixed(2)}s">
      <circle cx="${lx + 5}" cy="${ly}" r="5" fill="${l.color}"/>
      <text x="${lx + 18}" y="${ly + 4.5}" font-family="${SANS}" font-size="13" font-weight="700" fill="${t.ink}">${l.name}</text>
      <text x="${lx + 178}" y="${ly + 4.5}" font-family="${MONO}" font-size="12" font-weight="700" fill="${l.faint}">${l.pct}%</text>
    </g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="lgTitle">
<title id="lgTitle">Language mix across every public repository — HTML 38%, Python 24%, JavaScript 22%, Kotlin 14%, TypeScript 1%, CSS 1%</title>
<defs>
  <linearGradient id="lgg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg1}"/><stop offset="1" stop-color="${t.bg3}"/></linearGradient>
  <clipPath id="lgclip"><rect width="${W}" height="${H}" rx="22"/></clipPath>
</defs>
${css(t)}
<g clip-path="url(#lgclip)">
  <rect width="${W}" height="${H}" fill="url(#lgg)"/>
  <text x="28" y="46" font-family="${SANS}" font-size="15" font-weight="800" fill="${t.ink}">What the code is written in</text>
  <text x="${W - 28}" y="46" text-anchor="end" font-family="${MONO}" font-size="10.5" letter-spacing="1.2" fill="${t.faint}">EVERY PUBLIC REPO · ${STATS.repos} REPOSITORIES</text>
  <text x="28" y="74" font-family="${MONO}" font-size="10.5" letter-spacing="1.3" fill="${t.faint}">SHARE OF REPOSITORIES · NOT BYTES</text>
  <rect x="28" y="86" width="${barW}" height="16" rx="8" fill="${t.line}" opacity=".6"/>
  ${segs}
  ${legend}
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="22" fill="none" stroke="${t.line}"/>
</svg>
`;
}


// ---------------------------------------------------------------------------
// PROJECTS - 1200 x 320 (six cards, revealed one by one)
// ---------------------------------------------------------------------------
function projects(t) {
  const W = 1200, H = 320;
  const items = [
    { name: 'Mizanora', what: 'halal marketplace · 11,000+ products · COD', stack: 'Next.js · Firebase · PWA', color: t.mint },
    { name: 'Asaan Lang', what: 'Urdu programming language · MIT', stack: 'Python · playground', color: t.gold },
    { name: 'BarakatWave TV', what: '800 live channels · IMDb engine', stack: 'hls.js · FFmpeg', color: t.blue },
    { name: 'SIRAVEX', what: 'privacy-first player · IndexedDB', stack: 'TypeScript · Shaka', color: '#A97BFF' },
    { name: 'MI Trade Master', what: 'learn trading · paper only', stack: 'Kotlin · Compose', color: t.mint },
    { name: 'Trade Bot', what: '24/7 signals · no server', stack: 'Python · Actions', color: t.gold },
  ];
  const cw = 372, gap = 18, x0 = 28, ch = 118;
  const cards = items.map((it, i) => {
    const x = x0 + (i % 3) * (cw + gap);
    const y = 46 + Math.floor(i / 3) * (ch + 16);
    return `<g class="pop" style="animation-delay:${(i * 0.55).toFixed(2)}s">
      <rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="16" fill="${t.panel}" stroke="${t.line}"/>
      <circle cx="${x + 24}" cy="${y + 26}" r="5" fill="${it.color}"/>
      <text x="${x + 38}" y="${y + 31}" font-family="${SANS}" font-size="15.5" font-weight="800" fill="${t.ink}">${it.name}</text>
      <text x="${x + 24}" y="${y + 56}" font-family="${SANS}" font-size="11.5" font-weight="600" fill="${t.soft}">${it.what}</text>
      <rect x="${x + 22}" y="${y + 72}" width="${Math.round(it.stack.length * 5.9 + 22)}" height="24" rx="12" fill="${t.chip}" stroke="${t.line}"/>
      <text x="${x + 33}" y="${y + 88}" font-family="${MONO}" font-size="9.5" font-weight="700" letter-spacing=".8" fill="${t.chipInk}">${esc(it.stack.toUpperCase())}</text>
      <circle class="twinkle" cx="${x + cw - 20}" cy="${y + 22}" r="2" fill="${it.color}" style="animation-delay:${(i * 0.4).toFixed(2)}s"/>
    </g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="pjTitle">
<title id="pjTitle">Featured projects — Mizanora, Asaan Lang, BarakatWave TV, SIRAVEX, MI Trade Master and the MI Trade Master bot</title>
<defs>
  <linearGradient id="pjg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg1}"/><stop offset="1" stop-color="${t.bg3}"/></linearGradient>
  <clipPath id="pjclip"><rect width="${W}" height="${H}" rx="20"/></clipPath>
</defs>
${css(t)}
<g clip-path="url(#pjclip)">
  <rect width="${W}" height="${H}" fill="url(#pjg)"/>
  <g font-family="${MONO}" font-size="10" letter-spacing="1.4" fill="${t.faint}">
    <text x="28" y="28">FEATURED WORK · SIX OF THEM</text>
    <text x="${W - 28}" y="28" text-anchor="end">EACH REPO HAS ITS OWN HONEST README</text>
  </g>
  ${cards}
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="20" fill="none" stroke="${t.line}"/>
</svg>
`;
}

// ---------------------------------------------------------------------------
// TECH STACK - 1200 x 250 (four shelves of pills)
// ---------------------------------------------------------------------------
function techStack(t) {
  const W = 1200, H = 250;
  const rows = [
    { label: 'LANGUAGES', items: ['Python', 'TypeScript', 'JavaScript', 'Kotlin', 'Java', 'HTML', 'CSS', 'Bash'], color: t.mint },
    { label: 'FRAMEWORKS', items: ['React', 'Next.js', 'Tailwind', 'Jetpack Compose', 'Node', 'Flask', 'Vite'], color: t.gold },
    { label: 'AI', items: ['Groq', 'Gemini', 'OpenAI', 'Claude', 'Qwen', 'Whisper', 'edge-tts', 'Vision AI'], color: t.blue },
    { label: 'SHIP & STREAM', items: ['Firebase', 'Firestore', 'Vercel', 'GitHub Actions', 'FFmpeg', 'hls.js', 'Shaka', 'PWA'], color: '#A97BFF' },
  ];
  let pills = '';
  rows.forEach((row, ri) => {
    const y = 62 + ri * 46;
    let x = 156;
    pills += `<text x="28" y="${y + 15}" font-family="${MONO}" font-size="9.5" font-weight="700" letter-spacing="1.4" fill="${t.faint}">${esc(row.label)}</text>`;
    row.items.forEach((it, i) => {
      const w = Math.round(it.length * 6.3 + 26);
      pills += `<g class="pop" style="animation-delay:${(0.15 + ri * 0.22 + i * 0.07).toFixed(2)}s">
        <rect x="${x}" y="${y}" width="${w}" height="27" rx="13.5" fill="${t.chip}" stroke="${t.line}"/>
        <circle cx="${x + 13}" cy="${y + 13.5}" r="2.6" fill="${row.color}" opacity=".9"/>
        <text x="${x + 21}" y="${y + 17.5}" font-family="${SANS}" font-size="11.5" font-weight="700" fill="${t.chipInk}">${esc(it)}</text>
      </g>`;
      x += w + 8;
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="tsTitle">
<title id="tsTitle">Technology stack — Python, TypeScript, JavaScript, Kotlin, Java, HTML, CSS, Bash; React, Next.js, Tailwind, Jetpack Compose, Node, Flask, Vite; Groq, Gemini, OpenAI, Claude, Qwen, Whisper, edge-tts, Vision AI; Firebase, Firestore, Vercel, GitHub Actions, FFmpeg, hls.js, Shaka, PWA</title>
<defs>
  <linearGradient id="tsg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg1}"/><stop offset="1" stop-color="${t.bg3}"/></linearGradient>
  <clipPath id="tsclip"><rect width="${W}" height="${H}" rx="20"/></clipPath>
</defs>
${css(t)}
<g clip-path="url(#tsclip)">
  <rect width="${W}" height="${H}" fill="url(#tsg)"/>
  <g font-family="${SANS}" font-size="13" font-weight="800" fill="${t.ink}">
    <circle class="live-dot" cx="34" cy="30" r="4.5" fill="${t.mint}"/>
    <text x="48" y="35">Tools I actually use</text>
  </g>
  <text x="${W - 28}" y="35" text-anchor="end" font-family="${MONO}" font-size="9.5" letter-spacing="1.3" fill="${t.faint}">NOT A WISHLIST · WHAT I SHIP WITH</text>
  ${pills}
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="20" fill="none" stroke="${t.line}"/>
</svg>
`;
}

// ---------------------------------------------------------------------------
// PHILOSOPHY - 1200 x 140 (the line, and the three rules under it)
// ---------------------------------------------------------------------------
function philosophy(t) {
  const W = 1200, H = 190;
  const rules = ['think in years, act in days', 'build for your own people first', 'be honest in public'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="phTitle">
<title id="phTitle">Unchi soch, chhote qadam — high thinking, small steps. Think in years, act in days. Build for your own people first. Be honest in public.</title>
<defs>
  <linearGradient id="phg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.bg1}"/><stop offset=".5" stop-color="${t.bg3}"/><stop offset="1" stop-color="${t.bg1}"/></linearGradient>
  <linearGradient id="phline" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.mint}"/><stop offset="1" stop-color="${t.gold}"/></linearGradient>
  <clipPath id="phclip"><rect width="${W}" height="${H}" rx="20"/></clipPath>
</defs>
${css(t)}
<g clip-path="url(#phclip)">
  <rect width="${W}" height="${H}" fill="url(#phg)"/>
  ${Array.from({ length: 9 }, (_, i) => `<circle class="twinkle" cx="${60 + i * 135}" cy="${22 + (i % 3) * 12}" r="1.5" fill="${t.mint}" style="animation-delay:${(i * 0.35).toFixed(2)}s"/>`).join('')}
  <text x="${W / 2}" y="62" text-anchor="middle" font-family="${SANS}" font-size="31" font-weight="800" letter-spacing="-.7" fill="${t.ink}">Unchi soch. Chhote qadam.</text>
  <g class="grow"><rect x="${W / 2 - 160}" y="74" width="320" height="3" rx="1.5" fill="url(#phline)"/></g>
  <text x="${W / 2}" y="98" text-anchor="middle" font-family="${MONO}" font-size="10.5" letter-spacing="2.6" fill="${t.faint}">HIGH THINKING · SMALL STEPS</text>
  ${rules.map((r, i) => `<text class="pop" x="${W / 2}" y="${130 + i * 20}" text-anchor="middle" font-family="${MONO}" font-size="11.5" font-weight="600" fill="${i === 0 ? t.mint : i === 1 ? t.gold : t.soft}" style="animation-delay:${(0.5 + i * 0.7).toFixed(2)}s">${r}</text>`).join('')}
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="20" fill="none" stroke="${t.line}"/>
</svg>
`;
}

// ---------------------------------------------------------------------------
// LOGO - 220 x 220 (used in the README top and the footer)
// ---------------------------------------------------------------------------
function logo(t) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220" role="img" aria-label="Muaaz Iqbal — Mizanora mark">
<title>Muaaz Iqbal</title>
${css(t)}
<rect width="220" height="220" rx="48" fill="${t.bg1}"/>
${monogram({ t, x: 30, y: 30, size: 160, id: 'lg' })}
</svg>
`;
}

// ---------------------------------------------------------------------------
// write everything
// ---------------------------------------------------------------------------
const FILES = {
  'hero.svg': hero(T.dark),
  'hero-light.svg': hero(T.light),
  'ticker.svg': ticker(T.dark),
  'ticker-light.svg': ticker(T.light),
  'live.svg': liveStrip(T.dark),
  'live-light.svg': liveStrip(T.light),
  'stats.svg': stats(T.dark),
  'stats-light.svg': stats(T.light),
  'languages.svg': languages(T.dark),
  'languages-light.svg': languages(T.light),
  'logo.svg': logo(T.dark),
  'logo-light.svg': logo(T.light),
  'projects.svg': projects(T.dark),
  'projects-light.svg': projects(T.light),
  'tech-stack.svg': techStack(T.dark),
  'tech-stack-light.svg': techStack(T.light),
  'philosophy.svg': philosophy(T.dark),
  'philosophy-light.svg': philosophy(T.light),
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, xml] of Object.entries(FILES)) {
  fs.writeFileSync(path.join(OUT, name), xml, 'utf8');
  console.log(`wrote public/brand/profile/${name} (${(Buffer.byteLength(xml) / 1024).toFixed(1)} kB)`);
}
console.log(`stats used: ${JSON.stringify(STATS)}`);
