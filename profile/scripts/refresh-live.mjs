#!/usr/bin/env node
// ============================================================================
// refresh-live.mjs - keeps the profile's animated art TRUE
// ----------------------------------------------------------------------------
// Runs daily in .github/workflows/refresh.yml (and by hand: `node scripts/refresh-live.mjs`).
//
//   1. reads the public GitHub API  (repos, stars, followers, latest push, languages)
//   2. reads the shop's /api/github  (same account, already cached and normalised)
//   3. rewrites the numbers inside assets/*.svg at the tags marked data-k="..."
//      and the "Last refreshed" line in README.md
//
// Nothing else in the SVG is touched - the animation, colours and layout stay
// exactly as the generator wrote them. No token is required; GITHUB_TOKEN (which
// Actions provides for free) is used only to lift the rate limit.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const USER = process.env.GITHUB_USER || 'muaaziqbalvip';
const SHOP = (process.env.SHOP_URL || 'https://mizanora.vercel.app').replace(/\/$/, '');

export const KEYS = ['repos', 'stars', 'followers', 'lastPush', 'topLang', 'products', 'channels', 'tools', 'projects', 'updated'];

const num = (v) => Math.max(0, Math.floor(Number(v) || 0));

// "3 ghante pehle" / "2 days ago" - short, honest, no invented precision
export function ago(ms, now = Date.now()) {
  const t = Number(ms) || 0;
  if (!t) return 'just now';
  const min = Math.max(0, Math.floor((now - t) / 60000));
  if (min < 60) return min <= 1 ? 'just now' : `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.floor(h / 24);
  if (d < 31) return `${d} ${d === 1 ? 'day' : 'days'} ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} ${mo === 1 ? 'month' : 'months'} ago`;
  return `${Math.floor(mo / 12)} year${mo >= 24 ? 's' : ''} ago`;
}

export const monthYear = (ms) => new Date(Number(ms) || Date.now()).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

// ---------------------------------------------------------------------------
// replace every data-k="key">old</tspan|text> with the new value.
// Works for <text data-k="repos">92</text> and <tspan ... data-k="repos">92</tspan>.
// ---------------------------------------------------------------------------
export function applyStats(svg, stats) {
  let out = String(svg);
  for (const key of KEYS) {
    const val = stats[key];
    if (val === undefined || val === null) continue;
    const re = new RegExp(`(data-k="${key}"[^>]*>)([^<]*)(<)`, 'g');
    out = out.replace(re, (_m, a, _old, c) => `${a}${escapeText(String(val))}${c}`);
  }
  return out;
}

const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------
// the README's "Last refreshed" line
// ---------------------------------------------------------------------------
export function applyReadme(md, stats) {
  return String(md).replace(/(<span data-k="updated">)([^<]*)(<\/span>)/g, (_m, a, _o, c) => `${a}${escapeText(String(stats.updated || ''))}${c}`);
}

// ---------------------------------------------------------------------------
// gather: GitHub REST (no token needed) + the shop's cached model
// ---------------------------------------------------------------------------
async function json(url, headers = {}) {
  const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'mizanora-profile-live', ...headers }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

export async function collect({ now = Date.now(), token = process.env.GITHUB_TOKEN } = {}) {
  const stats = {};
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // 1. the shop already normalises this account (stars, languages, last push)
  try {
    const shop = await json(`${SHOP}/api/github`);
    if (shop && shop.ok) {
      stats.repos = num(shop.summary && shop.summary.repos);
      stats.stars = num(shop.summary && shop.summary.stars);
      stats.followers = num(shop.summary && shop.summary.followers);
      stats.topLang = String((shop.summary && shop.summary.topLanguage) || 'JavaScript').toUpperCase();
      if (shop.summary && shop.summary.lastPushMs) stats.lastPush = ago(shop.summary.lastPushMs, now);
    }
  } catch (e) {
    console.warn('shop /api/github:', e.message);
  }

  // 2. GitHub itself (authoritative for the account numbers)
  try {
    const [user, repos] = await Promise.all([
      json(`https://api.github.com/users/${USER}`, headers),
      json(`https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`, headers),
    ]);
    if (user && user.login) {
      stats.repos = num(user.public_repos) || stats.repos;
      stats.followers = num(user.followers);
    }
    if (Array.isArray(repos) && repos.length) {
      const own = repos.filter((r) => r && !r.fork);
      stats.stars = own.reduce((s, r) => s + num(r.stargazers_count), 0);
      const last = own.reduce((m, r) => Math.max(m, Date.parse(r.pushed_at) || 0), 0);
      if (last) stats.lastPush = ago(last, now);
      const byLang = new Map();
      for (const r of own) if (r.language) byLang.set(r.language, (byLang.get(r.language) || 0) + 1);
      const top = [...byLang.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) stats.topLang = String(top[0]).toUpperCase();
    }
  } catch (e) {
    console.warn('GitHub API:', e.message);
  }

  stats.updated = monthYear(now);
  return stats;
}

// ---------------------------------------------------------------------------
// write it
// ---------------------------------------------------------------------------
export function writeStats(dir, stats, { readme = path.join(dir, 'README.md') } = {}) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.svg'));
  let changed = 0;
  for (const f of files) {
    const p = path.join(dir, f);
    const before = fs.readFileSync(p, 'utf8');
    const after = applyStats(before, stats);
    if (after !== before) { fs.writeFileSync(p, after, 'utf8'); changed += 1; }
  }
  if (fs.existsSync(readme)) {
    const before = fs.readFileSync(readme, 'utf8');
    const after = applyReadme(before, stats);
    if (after !== before) { fs.writeFileSync(readme, after, 'utf8'); changed += 1; }
  }
  return changed;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const stats = await collect();
  if (!stats.repos) {
    console.error('could not read the account (rate limit or no network) - nothing written, try again later');
    process.exit(1);
  }
  const changed = writeStats(path.join(root, 'assets'), stats);
  console.log('stats:', JSON.stringify(stats));
  console.log(changed ? `${changed} file(s) updated` : 'already up to date');
}
