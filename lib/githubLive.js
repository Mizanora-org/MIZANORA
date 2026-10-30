// ============================================================================
// v33 - GITHUB LIVE (server side)
// ----------------------------------------------------------------------------
// Reads the public GitHub API for the owner's account and returns the model the
// pages show. The ANSWER is cached for 30 minutes (and can be cleared with
// /api/revalidate, tag "github"), so a busy shop never hits GitHub's rate limit
// and a visitor never waits.
//
// Only a SUCCESS is cached. A failure (no network, rate limit, 5xx) is retried
// at most once a minute per server instance and the page renders from the
// projects in the code - so a build made offline heals itself as soon as the
// site goes live, instead of showing the fallback for half an hour.
//
// No secret is needed: the profile and the public repositories are public data.
// An optional GITHUB_TOKEN (already used by the archive) raises the rate limit.
// ============================================================================
import { unstable_cache } from 'next/cache';
import { GH_USER, githubModel } from './githubRepos';

const API = 'https://api.github.com';
const TTL = Math.max(300, Number(process.env.GITHUB_CACHE_SECONDS) || 1800);
const RETRY_MS = Math.max(30, Number(process.env.GITHUB_RETRY_SECONDS) || 60) * 1000;

async function getJSON(url, token, timeoutMs = 8000) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'mizanora-site',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.json();
}

// Pinned repositories need a GraphQL token; the REST API has no "pinned" flag.
// The owner can name them in GITHUB_PINNED="MIZANORA,asaan-lang,..." (comma separated).
export const pinnedFromEnv = () => String(process.env.GITHUB_PINNED || 'MIZANORA,asaan-lang,BarakatWave-TV')
  .split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8);

export async function fetchGitHub({ user = GH_USER, token = process.env.GITHUB_TOKEN, pinned = pinnedFromEnv(), now = Date.now() } = {}) {
  let profile = null;
  let repos = [];
  let error = '';
  try {
    [profile, repos] = await Promise.all([
      getJSON(`${API}/users/${encodeURIComponent(user)}`, token),
      getJSON(`${API}/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`, token),
    ]);
    if (!Array.isArray(repos)) repos = [];
  } catch (e) {
    error = String((e && e.message) || e).slice(0, 160);
  }
  return githubModel({ profile, repos, pinned, at: now, error });
}

// The successful read is what gets cached (tags: ['github'] -> instant refresh from the admin panel).
const readLive = unstable_cache(async () => {
  const d = await fetchGitHub();
  if (d.fallback) throw new Error(d.error || 'GitHub unreachable');
  return d;
}, ['mz-github-live-v2'], { revalidate: TTL, tags: ['github'] });

// A failed attempt is remembered for a minute only (module memory, per instance).
let failedAt = 0;
let failedWith = '';

export async function getGitHub() {
  const now = Date.now();
  if (failedAt && now - failedAt < RETRY_MS) {
    return githubModel({ at: now, error: failedWith });
  }
  try {
    const d = await readLive();
    failedAt = 0;
    failedWith = '';
    return d;
  } catch (e) {
    failedAt = now;
    failedWith = String((e && e.message) || e).slice(0, 160);
    // The page must never break because GitHub is down: build the model from the code.
    return githubModel({ at: now, error: failedWith });
  }
}
