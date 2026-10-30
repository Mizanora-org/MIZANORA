// ============================================================================
// v34 - THE ANIMATED README ART
// ----------------------------------------------------------------------------
// GitHub strips <style> and <script> from README.md, but it DOES render an SVG
// file placed with <img> and it PLAYS the animations inside that file (CSS
// keyframes and SMIL). So every moving part of the MIZANORA README lives in a
// self-hosted SVG right here in the repo: no third-party service, nothing that
// can 404 or be rate-limited, and it keeps moving forever.
//
//   node scripts/make-readme-art.mjs      -> writes public/brand/readme/*.svg
//
// Files:
//   hero.svg     the big banner: animated logo, wordmark shimmer, typing line,
//                a "live screen" with a pulsing LIVE badge, waveform and progress,
//                and a news ticker across the bottom
//   logo.svg     the MIZANORA mark on its own (crescent + star, rotating rings)
//   live.svg     "NOW PLAYING" strip: LIVE dot, three titles that cross-fade,
//                a moving progress bar
//   wave.svg     the live audio waveform (64 bars, every bar its own delay)
//   marquee.svg  the endless "SHOP SMART · SHOP HALAL" tape
//
// Everything is plain geometry + CSS keyframes: no fonts are downloaded (so it
// looks the same on every machine), no JavaScript, and every animation can be
// stopped by a visitor's "reduce motion" setting.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(root, 'public', 'brand', 'readme');

// ---- brand colours (the same ones the shop uses) ---------------------------
const C = {
  deep: '#03130D', forest: '#06281B', emerald: '#0B6B45', mint: '#34D399',
  gold: '#F2C766', goldDeep: '#C9971E', cream: '#F6F1E4', saffron: '#F29F05',
  red: '#E5484D', ink: '#0B2A1E',
};

const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const CHAR = { mono14: 8.4, mono18: 10.8 }; // monospace advance width = 0.6 * size

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A line that types itself, one character at a time, then holds and starts again.
// Monospace means the position of every letter is exact (no font measuring).
function typedLine({ text, x, y, size = 18, color = C.cream, step = 0.06, hold = 6.5, label = '' }) {
  const adv = size * 0.6;
  const chars = [...text].map((ch, i) => {
    const delay = (i * step).toFixed(3);
    return `<text class="ch" x="${(x + i * adv).toFixed(1)}" y="${y}" style="animation-delay:${delay}s" fill="${color}">${esc(ch === ' ' ? '\u00a0' : ch)}</text>`;
  }).join('');
  const caretX = (x + [...text].length * adv + 2).toFixed(1);
  return `<g font-family="${MONO}" font-size="${size}" font-weight="600"${label ? ` aria-label="${esc(label)}"` : ''}>${chars}` +
    `<rect class="caret" x="${caretX}" y="${y - size * 0.78}" width="${Math.max(2, size * 0.1).toFixed(1)}" height="${(size * 0.95).toFixed(1)}" fill="${C.gold}" rx="1"/></g>`;
}

// NOTE: every file needs its own tape width, so the keyframes are emitted with
// a unique name per file (see tapeKeyframes) instead of inline above.
function tapeGroup({ y, size = 13, color = 'rgba(246,241,228,.72)', items, speed = 26, name = 'mz-tape', pad = '   ✦   ' }) {
  const text = items.join(pad) + pad;
  const adv = size * 0.6;
  const w = Math.ceil([...text].length * adv);
  return {
    width: w,
    svg: `<g class="tape" style="animation-name:${name};animation-duration:${speed}s" font-family="${MONO}" font-size="${size}" font-weight="600" letter-spacing="0.4">` +
      `<text x="0" y="${y}" fill="${color}">${esc(text)}</text>` +
      `<text x="${w}" y="${y}" fill="${color}">${esc(text)}</text></g>`,
    kf: `@keyframes ${name}{from{transform:translateX(0)}to{transform:translateX(-${w}px)}}`,
  };
}

const style = (extra = '') => `<style>
  text{white-space:pre}
  .spin-slow,.spin-rev,.glow,.twinkle,.live-dot,.ring,.pulse-soft,.aurora{transform-box:fill-box;transform-origin:center}
  .ch{opacity:0;animation-name:mz-ch;animation-duration:7s;animation-iteration-count:infinite;animation-timing-function:linear;animation-fill-mode:both}
  @keyframes mz-ch{0%{opacity:0}1.6%{opacity:1}92%{opacity:1}97%{opacity:0}100%{opacity:0}}
  .caret{animation:mz-caret 1s steps(1) infinite}
  @keyframes mz-caret{0%,49%{opacity:1}50%,100%{opacity:0}}
  .spin-slow{animation:mz-spin 26s linear infinite;transform-origin:center}
  .spin-rev{animation:mz-spin 18s linear infinite reverse;transform-origin:center}
  @keyframes mz-spin{to{transform:rotate(360deg)}}
  .glow{animation:mz-glow 3.6s ease-in-out infinite}
  @keyframes mz-glow{0%,100%{opacity:.35;transform:scale(.94)}50%{opacity:.85;transform:scale(1.06)}}
  .twinkle{animation:mz-twinkle 2.8s ease-in-out infinite}
  @keyframes mz-twinkle{0%,100%{opacity:.15;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}
  .live-dot{animation:mz-live 1.5s ease-in-out infinite;transform-origin:center}
  @keyframes mz-live{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.62)}}
  .ring{animation:mz-ring 2.2s ease-out infinite;transform-origin:center}
  @keyframes mz-ring{0%{opacity:.55;transform:scale(.55)}100%{opacity:0;transform:scale(1.9)}}
  .bar{transform-box:fill-box;transform-origin:50% 100%;animation:mz-bar 1.15s ease-in-out infinite}
  @keyframes mz-bar{0%,100%{transform:scaleY(.22)}50%{transform:scaleY(1)}}
  .aurora{animation:mz-drift 16s ease-in-out infinite alternate}
  @keyframes mz-drift{from{transform:translate(-24px,10px) scale(1)}to{transform:translate(26px,-16px) scale(1.12)}}
  .sheen{animation:mz-sheen 5.5s ease-in-out infinite}
  @keyframes mz-sheen{0%,55%{transform:translateX(-320px)}100%{transform:translateX(620px)}}
  .scan{animation:mz-scan 4.5s linear infinite}
  @keyframes mz-scan{0%{transform:translateY(0);opacity:0}12%{opacity:.5}88%{opacity:.5}100%{transform:translateY(168px);opacity:0}}
  .fill{animation:mz-fill 7s linear infinite}
  @keyframes mz-fill{0%{width:14px}100%{width:452px}}
  .fade1,.fade2,.fade3{opacity:0;animation:mz-fade 9s linear infinite both}
  .fade2{animation-delay:3s}
  .fade3{animation-delay:6s}
  @keyframes mz-fade{0%{opacity:0}3%{opacity:1}30%{opacity:1}33%{opacity:0}100%{opacity:0}}
  .pulse-soft{animation:mz-soft 4s ease-in-out infinite}
  @keyframes mz-soft{0%,100%{opacity:.5}50%{opacity:1}}
  @media (prefers-reduced-motion: reduce){
    .ch,.caret,.spin-slow,.spin-rev,.glow,.twinkle,.live-dot,.ring,.bar,.aurora,.sheen,.scan,.fill,.fade1,.fade2,.fade3,.pulse-soft,.tape{animation:none!important}
    .ch,.fade1,.fade2,.fade3{opacity:1}
    .tape{transform:none}
  }
  ${extra}
</style>`;

// ---- the mark: a rounded emerald tile, a gold crescent and an 8-point star ---
function mark({ x, y, size, id = 'm', rings = true }) {
  const s = size / 120; // the art below is drawn on a 120x120 grid
  return `<g transform="translate(${x},${y}) scale(${s.toFixed(3)})">
  <defs>
    <linearGradient id="${id}-tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#12905C"/><stop offset=".55" stop-color="${C.emerald}"/><stop offset="1" stop-color="#04361F"/>
    </linearGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFEFC4"/><stop offset=".5" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.goldDeep}"/>
    </linearGradient>
    <radialGradient id="${id}-aura"><stop offset="0" stop-color="${C.gold}" stop-opacity=".55"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient>
    <mask id="${id}-cut"><rect width="120" height="120" fill="#000"/><circle cx="60" cy="60" r="34" fill="#fff"/><circle cx="74" cy="52" r="29" fill="#000"/></mask>
  </defs>
  <circle class="glow" cx="60" cy="60" r="58" fill="url(#${id}-aura)"/>
  ${rings ? `<g class="spin-slow"><circle cx="60" cy="60" r="57" fill="none" stroke="${C.gold}" stroke-opacity=".5" stroke-dasharray="2 9" stroke-width="1.6"/></g>
  <g class="spin-rev"><circle cx="60" cy="60" r="50" fill="none" stroke="${C.mint}" stroke-opacity=".28" stroke-dasharray="22 12" stroke-width="1.4"/></g>` : ''}
  <rect x="20" y="20" width="80" height="80" rx="24" fill="url(#${id}-tile)" stroke="url(#${id}-gold)" stroke-opacity=".55" stroke-width="1.4"/>
  <g mask="url(#${id}-cut)"><circle cx="60" cy="60" r="34" fill="url(#${id}-gold)"/></g>
  <path d="M84 34l1.9 5.6 5.6 1.9-5.6 1.9L84 49l-1.9-5.6L76.5 41.5l5.6-1.9z" fill="url(#${id}-gold)"/>
  <g fill="#FFF8DC">
    <circle class="twinkle" cx="26" cy="30" r="1.6"/>
    <circle class="twinkle" cx="96" cy="88" r="1.2" style="animation-delay:.9s"/>
    <circle class="twinkle" cx="30" cy="94" r="1" style="animation-delay:1.7s"/>
  </g>
</g>`;
}

// ============================================================================
// 1. hero.svg - 1200 x 430
// ============================================================================
function hero() {
  const W = 1200, H = 430;
  const tape = tapeGroup({
    y: 390, size: 13, speed: 30, name: 'mz-tape-hero', color: 'rgba(246,241,228,.66)',
    items: ['SHOP SMART', 'SHOP HALAL', 'CASH ON DELIVERY ACROSS PAKISTAN', 'QURAN & HADITH LIVE CHANNEL', 'REELS', 'FREE TOOLS', 'GITHUB LIVE'],
  });
  const bars = Array.from({ length: 22 }, (_, i) => {
    const h = 10 + ((i * 37) % 30);
    return `<rect class="bar" x="${874 + i * 11}" y="${252 - h}" width="6" height="${h}" rx="3" fill="${i % 3 === 0 ? C.gold : C.mint}" opacity=".9" style="animation-delay:${(i * 0.09).toFixed(2)}s"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="MIZANORA — Shop Smart, Shop Halal. Animated banner with the live channel.">
<title>MIZANORA — Shop Smart. Shop Halal.</title>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#03130D"/><stop offset=".5" stop-color="#06281B"/><stop offset="1" stop-color="#084A31"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFF3D0"/><stop offset=".45" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.goldDeep}"/>
  </linearGradient>
  <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0A3D2A"/><stop offset="1" stop-color="#031710"/>
  </linearGradient>
  <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${C.deep}" stop-opacity="0"/><stop offset="1" stop-color="${C.deep}"/>
  </linearGradient>
  <radialGradient id="a1"><stop offset="0" stop-color="${C.mint}" stop-opacity=".38"/><stop offset="1" stop-color="${C.mint}" stop-opacity="0"/></radialGradient>
  <radialGradient id="a2"><stop offset="0" stop-color="${C.gold}" stop-opacity=".30"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient>
  <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
    <circle cx="1.4" cy="1.4" r="1.1" fill="${C.gold}" fill-opacity=".22"/>
  </pattern>
  <clipPath id="cardclip"><rect x="640" y="56" width="504" height="252" rx="20"/></clipPath>
  <clipPath id="tickclip"><rect x="0" y="366" width="${W}" height="40" rx="12"/></clipPath>
  <clipPath id="panelclip"><rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="26"/></clipPath>
</defs>
${style(tape.kf)}
<g clip-path="url(#panelclip)">
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="url(#bg)"/>
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="url(#dots)"/>
  <circle class="aurora" cx="150" cy="60" r="230" fill="url(#a1)"/>
  <circle class="aurora" cx="1010" cy="390" r="260" fill="url(#a2)" style="animation-delay:-6s"/>
  <circle class="aurora" cx="880" cy="20" r="180" fill="url(#a1)" style="animation-delay:-11s"/>

  <!-- the mark + the name -->
  ${mark({ x: 56, y: 58, size: 96, id: 'hero' })}
  <g>
    <text x="176" y="106" font-family="${SANS}" font-size="54" font-weight="800" letter-spacing="7" fill="url(#gold)">MIZANORA</text>
    <text x="180" y="132" font-family="${MONO}" font-size="12.5" font-weight="700" letter-spacing="3.4" fill="${C.mint}" opacity=".9">QURAN · HADITH · LIVE TV · REELS · TOOLS</text>
  </g>

  <!-- typing line -->
  ${typedLine({ text: 'Shop smart. Shop halal. Cash on delivery.', x: 180, y: 182, size: 17, color: C.cream, label: 'Shop smart. Shop halal. Cash on delivery.' })}

  <!-- the pills -->
  <g font-family="${MONO}" font-size="10.5" font-weight="700" letter-spacing="1">
    ${(() => {
      // Monospace again: the pill is exactly as wide as its text can be, so it can never overflow.
      let x = 180;
      const adv = 10.5 * 0.6 + 1;
      return [['CASH ON DELIVERY', true], ['NEXT.JS 15', false], ['KASUR · PAKISTAN', false]].map(([t, solid]) => {
        const w = Math.round(t.length * adv + 24);
        const g = `<rect x="${x}" y="208" width="${w}" height="25" rx="12.5" fill="${solid ? C.gold : '#0A3D2A'}" stroke="${C.gold}" stroke-opacity="${solid ? 0 : 0.38}"/>
      <text x="${x + w / 2}" y="224.5" text-anchor="middle" fill="${solid ? '#10301F' : C.gold}">${t}</text>`;
        x += w + 12;
        return g;
      }).join('');
    })()}
  </g>

  <!-- the live screen -->
  <g>
    <rect x="640" y="56" width="504" height="252" rx="20" fill="#04190F" stroke="${C.gold}" stroke-opacity=".28"/>
    <g clip-path="url(#cardclip)">
      <rect x="640" y="56" width="504" height="252" fill="url(#screen)"/>
      <!-- LIVE badge -->
      <g>
        <rect x="660" y="72" width="86" height="26" rx="13" fill="${C.red}"/>
        <circle class="live-dot" cx="674" cy="85" r="4.6" fill="#fff"/>
        <circle class="ring" cx="674" cy="85" r="4.6" fill="none" stroke="#fff" stroke-width="1.4"/>
        <text x="686" y="90" font-family="${SANS}" font-size="11.5" font-weight="800" letter-spacing="1.6" fill="#fff">LIVE</text>
      </g>
      <text x="760" y="90" font-family="${MONO}" font-size="11" letter-spacing="1.2" fill="${C.mint}" opacity=".85">mizanora live channel</text>
      <text x="1124" y="90" text-anchor="end" font-family="${MONO}" font-size="11" letter-spacing="1" fill="${C.cream}" opacity=".8">PKT 17<tspan class="pulse-soft">:</tspan>04</text>
      <!-- the picture: a slow scan line over a soft glow -->
      <rect x="660" y="110" width="464" height="150" rx="12" fill="#071F15"/>
      <circle cx="892" cy="186" r="86" fill="url(#a2)" opacity=".7"/>
      <rect class="scan" x="660" y="110" width="464" height="2" fill="${C.mint}" opacity=".35"/>
      <text x="892" y="176" text-anchor="middle" font-family="${SANS}" font-size="19" font-weight="800" fill="${C.cream}" opacity=".92">Quran Tilawat</text>
      <text x="892" y="198" text-anchor="middle" font-family="${MONO}" font-size="11.5" fill="${C.gold}" opacity=".9">Al-Baqarah 2:255</text>
      ${bars}
      <!-- the progress + the tape -->
      <rect x="660" y="270" width="464" height="7" rx="3.5" fill="#0C3626"/>
      <rect class="fill" x="660" y="270" width="452" height="7" rx="3.5" fill="url(#gold)" opacity=".95"/>
      <rect x="660" y="286" width="464" height="1" fill="${C.gold}" opacity=".14"/>
    </g>
  </g>

  <!-- bottom tape -->
  <g clip-path="url(#tickclip)"><rect x="0" y="366" width="${W}" height="40" fill="#03110B" opacity=".92"/>${tape.svg}<rect x="1090" y="366" width="110" height="40" fill="url(#fade)"/></g>
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="26" fill="none" stroke="${C.gold}" stroke-opacity=".18"/>
</g>
<rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="26" fill="none" stroke="${C.gold}" stroke-opacity=".22"/>
</svg>
`;
}

// ============================================================================
// 2. logo.svg - 260 x 260
// ============================================================================
function logo() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 260" width="260" height="260" role="img" aria-label="MIZANORA logo">
<title>MIZANORA</title>
${style()}
<rect width="260" height="260" rx="44" fill="#03130D"/>
${mark({ x: 10, y: 10, size: 240, id: 'logo' })}
</svg>
`;
}

// ============================================================================
// 3. live.svg - 1200 x 150 : the "now playing" bar
// ============================================================================
function live() {
  const W = 1200, H = 150;
  const tape = tapeGroup({ y: 133, size: 11, speed: 34, name: 'mz-tape-live', color: 'rgba(246,241,228,.55)', items: ['QURAN 24/7', 'HADEES', 'PRODUCT ADS', 'PAKISTAN TIME', 'LIVE 24 GHANTE'] });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Mizanora live channel now playing">
<title>Mizanora Live — now playing</title>
<defs>
  <linearGradient id="lbg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#04190F"/><stop offset=".55" stop-color="#06281B"/><stop offset="1" stop-color="#0A3D2A"/></linearGradient>
  <linearGradient id="lgold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFF3D0"/><stop offset="1" stop-color="${C.gold}"/></linearGradient>
  <clipPath id="liveclip"><rect x="0" y="0" width="${W}" height="${H}" rx="22"/></clipPath>
</defs>
${style(tape.kf)}
<g clip-path="url(#liveclip)">
  <rect width="${W}" height="${H}" fill="url(#lbg)"/>
  <!-- LIVE -->
  <rect x="26" y="26" width="92" height="30" rx="15" fill="${C.red}"/>
  <circle class="live-dot" cx="42" cy="41" r="5" fill="#fff"/>
  <circle class="ring" cx="42" cy="41" r="5" fill="none" stroke="#fff" stroke-width="1.5"/>
  <text x="56" y="46" font-family="${SANS}" font-size="12.5" font-weight="800" letter-spacing="1.8" fill="#fff">LIVE</text>
  <text x="132" y="46" font-family="${MONO}" font-size="11.5" letter-spacing="1.4" fill="${C.mint}" opacity=".85">NOW PLAYING</text>

  <!-- three titles that take turns -->
  <g font-family="${SANS}" font-size="26" font-weight="800" fill="${C.cream}">
    <text class="fade1" x="132" y="86">Quran Tilawat · Al-Baqarah 2:255</text>
    <text class="fade2" x="132" y="86">Hadees · Sahih al-Bukhari 6018</text>
    <text class="fade3" x="132" y="86">Mizanora product ad · naya stock</text>
  </g>

  <!-- right: the clock -->
  <text x="1150" y="74" text-anchor="end" font-family="${MONO}" font-size="26" font-weight="700" fill="${C.gold}">17:04<tspan class="pulse-soft">:</tspan>00</text>
  <text x="1150" y="94" text-anchor="end" font-family="${MONO}" font-size="10.5" letter-spacing="1.6" fill="${C.cream}" opacity=".65">PAKISTAN TIME · PKT</text>

  <!-- progress -->
  <rect x="132" y="104" width="464" height="8" rx="4" fill="#0C3626"/>
  <rect class="fill" x="132" y="104" width="452" height="8" rx="4" fill="url(#lgold)"/>
  <circle class="pulse-soft" cx="560" cy="108" r="6" fill="#FFF3D0" opacity=".9"/>

  ${tape.svg}
</g>
<rect width="${W}" height="${H}" rx="22" fill="none" stroke="${C.gold}" stroke-opacity=".2"/>
</svg>
`;
}

// ============================================================================
// 4. wave.svg - 1200 x 120 : the live audio waveform
// ============================================================================
function wave() {
  const W = 1200, H = 120;
  const wave = Array.from({ length: 58 }, (_, i) => {
    const h = 16 + ((i * 53) % 56);
    const x = 292 + i * 13;
    return `<rect class="bar" x="${x}" y="${76 - h / 2}" width="6" height="${h}" rx="3" fill="url(#wg)" style="animation-delay:${(i * 0.045).toFixed(3)}s;animation-duration:${(0.9 + (i % 5) * 0.12).toFixed(2)}s"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Mizanora live audio waveform">
<title>Mizanora live audio</title>
<defs>
  <linearGradient id="wg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.mint}"/></linearGradient>
  <clipPath id="wclip"><rect width="${W}" height="${H}" rx="20"/></clipPath>
</defs>
${style()}
<g clip-path="url(#wclip)">
  <rect width="${W}" height="${H}" fill="#04190F"/>
  <g font-family="${SANS}" font-size="12" font-weight="800" letter-spacing="2" fill="${C.gold}">
    <circle class="live-dot" cx="40" cy="60" r="6" fill="${C.red}"/>
    <text x="58" y="64">AUDIO LIVE</text>
  </g>
  <text x="58" y="86" font-family="${MONO}" font-size="10.5" letter-spacing="1.2" fill="${C.cream}" opacity=".6">tilawat · hadees · voice ads</text>
  ${wave}
  <g font-family="${MONO}" font-size="10.5" letter-spacing="1.2" fill="${C.cream}" opacity=".6">
    <text x="1160" y="52" text-anchor="end">STEREO</text>
    <text x="1160" y="70" text-anchor="end">44.1 kHz</text>
  </g>
  <circle class="live-dot" cx="1130" cy="90" r="4" fill="${C.red}"/>
</g>
<rect width="${W}" height="${H}" rx="20" fill="none" stroke="${C.gold}" stroke-opacity=".18"/>
</svg>
`;
}

// ============================================================================
// 5. marquee.svg - 1200 x 84 : the endless tape
// ============================================================================
function marquee() {
  const W = 1200, H = 84;
  const tape = tapeGroup({
    y: 52, size: 19, speed: 22, name: 'mz-tape-band', color: C.cream,
    items: ['SHOP SMART', 'SHOP HALAL', 'CASH ON DELIVERY', 'QURAN & HADITH', 'LIVE TV', 'REELS', 'MIZANORA'],
    pad: '     ✦     ',
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Shop smart, shop halal">
<title>Shop Smart · Shop Halal</title>
<defs>
  <linearGradient id="mbg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#073D28"/><stop offset=".5" stop-color="${C.emerald}"/><stop offset="1" stop-color="#073D28"/></linearGradient>
  <clipPath id="mclip"><rect width="${W}" height="${H}" rx="18"/></clipPath>
</defs>
${style(tape.kf)}
<g clip-path="url(#mclip)">
  <rect width="${W}" height="${H}" fill="url(#mbg)"/>
  ${tape.svg}
</g>
<rect width="${W}" height="${H}" rx="18" fill="none" stroke="${C.gold}" stroke-opacity=".3"/>
</svg>
`;
}

const FILES = {
  'hero.svg': hero(),
  'logo.svg': logo(),
  'live.svg': live(),
  'wave.svg': wave(),
  'marquee.svg': marquee(),
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, xml] of Object.entries(FILES)) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, xml, 'utf8');
  console.log(`wrote public/brand/readme/${name} (${(xml.length / 1024).toFixed(1)} kB)`);
}
console.log('done - these SVG files animate inside a GitHub README <img>.');
