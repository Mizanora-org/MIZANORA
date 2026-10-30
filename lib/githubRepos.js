// ============================================================================
// v33 - GITHUB, CONNECTED PROPERLY TO THE WEBSITE
// ----------------------------------------------------------------------------
// The shop shows the owner's real GitHub work: avatar, follower count, every
// repository, stars, languages and the last push - read from the public GitHub
// API (server side, cached) and refreshed by itself.
//
// This file is PURE: it turns GitHub's JSON into the shapes the pages use, and
// falls back to the projects already written in the code when GitHub cannot be
// reached (rate limit, offline build, a renamed account...). The page can then
// never show an empty box.
// ============================================================================
import { isFresh } from './liveBadges.js';

export const GH_USER = process.env.GITHUB_USER || 'muaaziqbalvip';
export const GH_URL = `https://github.com/${GH_USER}`;

// GitHub's own language colours (the ones developers expect to see).
export const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', HTML: '#e34c26', CSS: '#563d7c',
  Kotlin: '#A97BFF', Java: '#b07219', Dart: '#00B4AB', Swift: '#F05138', 'C++': '#f34b7d',
  C: '#555555', Shell: '#89e051', Ruby: '#701516', PHP: '#4F5D95', Go: '#00ADD8', Rust: '#dea584',
  Vue: '#41b883', 'Jupyter Notebook': '#DA5B0B', CSharp: '#178600', 'C#': '#178600',
};
export const langColor = (name) => LANG_COLORS[String(name || '')] || '#8b949e';

// The projects already known in the code, used when GitHub does not answer.
export const FALLBACK_REPOS = [
  { name: 'asan-lang', description: 'Urdu aur Roman-Urdu programming language (likho, agar, warna, har, kaam). Open source, MIT.', language: 'Python', stars: 2, homepage: 'https://asaan-lang.vercel.app' },
  { name: 'BarakatWave-TV', description: 'Live TV streaming web app for Pakistan and India.', language: 'JavaScript', stars: 0 },
  { name: 'MIZANORA', description: 'Mizanora online marketplace: Next.js, Firebase, cash on delivery, AI assistant.', language: 'JavaScript', stars: 0, homepage: 'https://mizanora.vercel.app' },
  { name: 'MIZANORAOT', description: 'Order tracking with tracking IDs and a Vercel API.', language: 'JavaScript', stars: 0 },
  { name: 'MI-TRADE-MASTER-TELE-BOT', description: 'Trading tools and a Telegram bot.', language: 'Python', stars: 0 },
  { name: 'Mizanoraandroid', description: 'Android panel and APK build pipeline for the store.', language: 'Java', stars: 0 },
];

export const FALLBACK_PROFILE = {
  login: GH_USER,
  name: 'MUAAZ IQBAL',
  bio: 'Android developer, AI apps and the founder of Mizanora.',
  avatar: '',
  url: GH_URL,
  followers: 0,
  following: 0,
  repos: 92,
  location: 'Kasur, Punjab, Pakistan',
  createdMs: 0,
  blog: 'https://mizanora.vercel.app',
};

const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v) => Math.max(0, Math.floor(Number(v) || 0));
const ms = (v) => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? t : 0; };

// GitHub user JSON -> the profile the page shows.
export function normaliseProfile(raw) {
  if (!raw || typeof raw !== 'object' || !raw.login) return { ...FALLBACK_PROFILE, fallback: true };
  return {
    login: txt(raw.login, 60),
    name: txt(raw.name || raw.login, 80),
    bio: txt(raw.bio, 240),
    avatar: /^https:\/\//i.test(String(raw.avatar_url || '')) ? String(raw.avatar_url).slice(0, 300) : '',
    url: /^https:\/\/github\.com\//i.test(String(raw.html_url || '')) ? String(raw.html_url) : `https://github.com/${txt(raw.login, 60)}`,
    followers: num(raw.followers),
    following: num(raw.following),
    repos: num(raw.public_repos),
    location: txt(raw.location, 80),
    createdMs: ms(raw.created_at),
    blog: txt(raw.blog, 200),
    fallback: false,
  };
}

// One repository JSON -> the card shape (only public fields).
export function shapeRepo(raw) {
  const r = raw || {};
  const name = txt(r.name, 80);
  if (!name) return null;
  const stars = num(r.stargazers_count);
  const forks = num(r.forks_count);
  const issues = num(r.open_issues_count);
  return {
    name,
    url: `https://github.com/${txt(r.full_name || `${GH_USER}/${name}`, 140)}`,
    description: txt(r.description, 200),
    homepage: /^https?:\/\//i.test(String(r.homepage || '')) ? String(r.homepage).slice(0, 300) : '',
    language: txt(r.language, 30),
    stars,
    forks,
    issues,
    size: num(r.size),
    topics: Array.isArray(r.topics) ? r.topics.map((t) => txt(t, 30)).filter(Boolean).slice(0, 6) : [],
    licence: txt(r.license && (r.license.spdx_id || r.license.name), 30),
    archived: Boolean(r.archived),
    fork: Boolean(r.fork),
    createdMs: ms(r.created_at),
    pushedMs: ms(r.pushed_at),
    updatedMs: ms(r.updated_at),
    score: stars * 10 + forks * 4,
  };
}

// All repos -> a clean list: no forks, newest push first, hidden ones removed.
export function cleanRepos(list, { hide = [], includeForks = false } = {}) {
  const hidden = new Set((hide || []).map((s) => String(s).toLowerCase()));
  return (Array.isArray(list) ? list : [])
    .filter((r) => r && r.name && !hidden.has(String(r.name).toLowerCase()))
    .filter((r) => includeForks || !r.fork)
    .slice(0, 100)
    .sort((a, b) => b.pushedMs - a.pushedMs || b.score - a.score);
}

// How much of each language: [{ name, count, pct, color }] (top N, rest grouped).
export function languageStats(repos, top = 6) {
  const by = new Map();
  for (const r of Array.isArray(repos) ? repos : []) {
    const l = String(r.language || '').trim();
    if (!l) continue;
    by.set(l, (by.get(l) || 0) + 1);
  }
  const total = [...by.values()].reduce((s, n) => s + n, 0);
  if (!total) return [];
  const all = [...by.entries()].map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100), color: langColor(name) }))
    .sort((a, b) => b.count - a.count);
  if (all.length <= top) return all;
  const head = all.slice(0, top);
  const rest = all.slice(top).reduce((s, x) => s + x.count, 0);
  const restPct = Math.max(1, Math.round((rest / total) * 100) - (100 - head.reduce((s, x) => s + x.pct, 0)));
  head.push({ name: 'Other', count: rest, pct: Math.max(1, restPct), color: '#8b949e' });
  return head;
}

// The headline numbers of the whole account.
export function repoSummary(profile, repos) {
  const list = Array.isArray(repos) ? repos : [];
  const stars = list.reduce((s, r) => s + (r.stars || 0), 0);
  const forks = list.reduce((s, r) => s + (r.forks || 0), 0);
  const langs = languageStats(list, 8);
  const lastPushMs = list.reduce((m, r) => Math.max(m, r.pushedMs || 0), 0);
  return {
    repos: list.length,
    publicRepos: profile && profile.repos ? profile.repos : list.length,
    stars,
    forks,
    languages: langs,
    topLanguage: langs[0] ? langs[0].name : '',
    lastPushMs,
    active: isFresh(lastPushMs, Date.now(), 30 * 86400000),
    followers: (profile && profile.followers) || 0,
  };
}

// Which repositories to feature (the owner's list first, then the most recent).
export function pickFeatured(repos, pinned = [], limit = 6) {
  const list = Array.isArray(repos) ? repos : [];
  const byName = new Map(list.map((r) => [String(r.name).toLowerCase(), r]));
  const out = [];
  for (const name of Array.isArray(pinned) ? pinned : []) {
    const r = byName.get(String(name).toLowerCase());
    if (r && !out.includes(r)) out.push(r);
    if (out.length >= limit) return out;
  }
  for (const r of list) {
    if (out.includes(r)) continue;
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

// Small badges on a repository card: NEW / ACTIVE / MIT / DEMO.
export function githubBadges(repo, now = Date.now()) {
  const r = repo || {};
  const out = [];
  // Order matters: the first four are the ones the card has room for.
  if (isFresh(r.pushedMs, now, 14 * 86400000)) out.push({ state: 'live', label: 'ACTIVE' });
  if (isFresh(r.createdMs, now, 30 * 86400000)) out.push({ state: 'fresh', label: 'NEW' });
  if (r.archived) out.push({ state: 'idle', label: 'ARCHIVED' });
  if (r.homepage) out.push({ state: 'soon', label: 'LIVE DEMO' });
  if (/^MIT$/i.test(r.licence || '')) out.push({ state: 'idle', label: 'MIT' });
  return out.slice(0, 4);
}

// The whole page model, so the component stays dumb and the tests can check it.
// -> { ok, profile, repos, featured, summary, at, stale, error }
export function githubModel({ profile, repos, pinned = [], featured = 6, at = Date.now(), error = '' } = {}) {
  const p = normaliseProfile(profile);
  const list = cleanRepos((repos || []).map(shapeRepo).filter(Boolean));
  const use = list.length ? list : cleanRepos(FALLBACK_REPOS.map(shapeRepo).filter(Boolean), { includeForks: true });
  return {
    ok: !error && !p.fallback,
    fallback: Boolean(error) || p.fallback,
    error: txt(error, 200),
    profile: p,
    repos: use,
    featured: pickFeatured(use, pinned, featured),
    summary: repoSummary(p, use),
    at: Number(at) || Date.now(),
  };
}
