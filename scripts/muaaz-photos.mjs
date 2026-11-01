#!/usr/bin/env node
// v36: MUAZ IQBAL PHOTO PIPELINE
// Takes a folder of raw photos and writes them into the shop as self-hosted, SEO-ready images.
//
//   node scripts/muaaz-photos.mjs /path/to/raw/photos
//
// What it does for every picture:
//   1. strips EXIF (GPS, camera, date) - a person's location must never ship to the public web;
//   2. turns the phone's rotation flag into real pixels, so nothing shows sideways;
//   3. writes three sizes:
//        public/img/muaaz/<id>.jpg        full   (max 1200 px, q82)  - the gallery / Open Graph image
//        public/img/muaaz/<id>-thumb.jpg  thumb  (max  480 px, q72)  - cards and grids (fast LCP)
//        public/img/muaaz/<id>-sq.jpg     square (512x512 cover)     - avatars and round bubbles
//   4. records everything in data/muaaz-photos.json (the manifest the website reads).
//
// Why self-hosted: the old photos lived on a third-party host. Those links break, they send a
// referrer, and Google sees them as somebody else's images. Files inside /public are served by
// the shop itself at https://mizanora.vercel.app/img/muaaz/... so they are always alive, they
// carry the site's own domain (better for Google Images) and they cost nothing.
//
// Re-running is safe: the same input produces the same bytes, and the manifest is rewritten
// from scratch each time. Adding ONE new photo later: drop it in the folder and run again.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(root, 'public', 'img', 'muaaz');
const MANIFEST = path.join(root, 'data', 'muaaz-photos.json');

const PICK = /\.(jpe?g|png|webp|avif)$/i;
const MAX_FULL = 1200;
const MAX_THUMB = 480;
const SQ = 512;

const slugNum = (i) => String(i).padStart(2, '0');

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp is missing. Run:  npm install --no-save sharp');
  process.exit(1);
}

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('Usage: node scripts/muaaz-photos.mjs <folder-with-raw-photos>');
  process.exit(1);
}

const stat = fs.statSync(src);
const files = (stat.isDirectory()
  ? fs.readdirSync(src).filter((f) => PICK.test(f)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map((f) => path.join(src, f))
  : [src]);

if (!files.length) { console.error('No pictures found in ' + src); process.exit(1); }

fs.mkdirSync(OUT_DIR, { recursive: true });
// Clear old output so a deleted source photo cannot leave a ghost file behind.
for (const f of fs.readdirSync(OUT_DIR)) if (PICK.test(f)) fs.rmSync(path.join(OUT_DIR, f));

const out = [];
let i = 0;
for (const file of files) {
  i += 1;
  const id = `muaaz-iqbal-${slugNum(i)}`;
  const full = path.join(OUT_DIR, `${id}.jpg`);
  const thumb = path.join(OUT_DIR, `${id}-thumb.jpg`);
  const sq = path.join(OUT_DIR, `${id}-sq.jpg`);

  // .rotate() with no argument = "trust the EXIF orientation, then forget it".
  const base = sharp(file, { failOn: 'none' }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) { console.warn(`  skipped (not a readable picture): ${path.basename(file)}`); i -= 1; continue; }

  await sharp(file, { failOn: 'none' }).rotate().resize({ width: MAX_FULL, height: MAX_FULL, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true, chromaSubsampling: '4:2:0' }).toFile(full);
  await sharp(file, { failOn: 'none' }).rotate().resize({ width: MAX_THUMB, height: MAX_THUMB, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72, progressive: true, mozjpeg: true }).toFile(thumb);
  await sharp(file, { failOn: 'none' }).rotate().resize({ width: SQ, height: SQ, fit: 'cover', position: 'attention' })
    .jpeg({ quality: 78, progressive: true, mozjpeg: true }).toFile(sq);

  const fm = await sharp(full).metadata();
  const sm = await sharp(sq).metadata();
  const kb = (f) => Math.round(fs.statSync(f).size / 1024);
  out.push({
    id,
    src: `/img/muaaz/${id}.jpg`,
    thumb: `/img/muaaz/${id}-thumb.jpg`,
    square: `/img/muaaz/${id}-sq.jpg`,
    width: fm.width, height: fm.height,
    atMs: Math.floor(fs.statSync(file).mtimeMs),
    // Honest, editable alt text. Fix these lines in data/muaaz-photos.json once you know
    // exactly what each picture shows - good alt text is how Google Images finds you.
    title: `Muaaz Iqbal - photo ${slugNum(i)}`,
    alt: `Muaaz Iqbal, founder and developer of Mizanora, Kasur Punjab Pakistan (photo ${slugNum(i)})`,
    caption: '',
    group: 'muaaz',
  });
  console.log(`  ${id}  ${meta.width}x${meta.height} -> ${fm.width}x${fm.height} ${kb(full)}kB + thumb ${kb(thumb)}kB + square ${sm.width}x${sm.height} ${kb(sq)}kB`);
}

const manifest = { updatedAt: new Date().toISOString(), group: 'muaaz', photos: out };
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

const total = out.reduce((a, p) => a + fs.statSync(path.join(root, 'public', p.src)).size + fs.statSync(path.join(root, 'public', p.thumb)).size + fs.statSync(path.join(root, 'public', p.square)).size, 0);
console.log(`\n${out.length} photos -> public/img/muaaz/  (${(total / 1024 / 1024).toFixed(2)} MB on disk)`);
console.log(`manifest -> data/muaaz-photos.json (edit titles and alt text there)`);
