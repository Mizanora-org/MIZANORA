import { NextResponse } from 'next/server';
import { getGitHub } from '@/lib/githubLive';
import { GH_USER, GH_URL } from '@/lib/githubRepos';

export const runtime = 'nodejs';
export const revalidate = 1800;

// PUBLIC, cacheable: the owner's GitHub profile, repositories, stars and languages.
//   GET /api/github                 -> everything (profile, featured, summary, repos)
//   GET /api/github?limit=12        -> more repositories in the list
//   GET /api/github?bare=1          -> only the numbers (a tiny "live" badge request)
// No secrets are exposed: this is public GitHub data, read server side.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(req) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.max(1, Math.min(100, Math.floor(Number(sp.get('limit'))) || 100));
  const d = await getGitHub();
  const headers = {
    ...CORS,
    'Cache-Control': `public, s-maxage=1800, stale-while-revalidate=86400`,
    'X-GitHub-User': d.profile.login || GH_USER,
    'X-GitHub-Repos': String(d.summary.repos || 0),
    'X-GitHub-Stars': String(d.summary.stars || 0),
    'X-GitHub-Live': d.fallback ? '0' : '1',
  };
  if (sp.get('bare')) {
    return NextResponse.json({
      ok: true, user: d.profile.login, url: GH_URL, name: d.profile.name,
      repos: d.summary.repos, stars: d.summary.stars, forks: d.summary.forks,
      followers: d.summary.followers, topLanguage: d.summary.topLanguage,
      lastPushMs: d.summary.lastPushMs, live: !d.fallback, at: d.at,
    }, { headers });
  }
  return NextResponse.json({
    ok: true,
    live: !d.fallback,
    at: d.at,
    error: d.error || '',
    profile: d.profile,
    summary: d.summary,
    featured: d.featured,
    repos: d.repos.slice(0, limit),
  }, { headers });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
