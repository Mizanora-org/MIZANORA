import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { IPTV_CATALOGUE, cleanCatalogue } from '@/lib/iptvCatalogue';
import { VOD_DOC, cleanVod } from '@/lib/iptvVod';
import { readShardedDoc } from '@/lib/gateway/shards';
import { buildArchiveFiles, cleanRepo } from '@/lib/iptvArchive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const META = { collection: 'siteMeta', id: 'iptvArchive' };
const gh = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'Mizanora-IPTV-Archive',
});

const baseOf = (req) => {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'mizanora.vercel.app';
  return `${proto}://${host}`;
};

// GITHUB ARCHIVE — poora IPTV panel (catalogue, VOD, M3U, lines CSV) aik commit mein.
// Token sirf env se (GITHUB_ARCHIVE_TOKEN) ya request body se — Firestore mein KABHI save nahi hota.
//   GET                                  -> { repo, branch, tokenSet, last }
//   POST { action:'preview' }            -> files ki list (kuch push nahi)
//   POST { action:'push', repo?, branch?, token? }
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  const env = {
    repo: cleanRepo(process.env.GITHUB_ARCHIVE_REPO || '') || '',
    tokenSet: Boolean(process.env.GITHUB_ARCHIVE_TOKEN || process.env.GITHUB_TOKEN),
  };
  let last = null;
  if (adminReady()) {
    const snap = await adminDb().collection(META.collection).doc(META.id).get().catch(() => null);
    if (snap && snap.exists) last = snap.data();
  }
  return json({ ok: true, ...env, last });
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firestore connect karein (FIREBASE_SERVICE_ACCOUNT).' }, 503);

  let b;
  try { b = await req.json(); } catch { b = {}; }
  const action = String(b.action || 'push');

  const [live, vod, linesSnap] = await Promise.all([
    readShardedDoc(IPTV_CATALOGUE.collection, IPTV_CATALOGUE.id, ['channels']).catch(() => ({})),
    readShardedDoc(VOD_DOC.collection, VOD_DOC.id, ['movies', 'series']).catch(() => ({})),
    adminDb().collection('iptvLines').limit(2000).get().catch(() => null),
  ]);
  const cat = cleanCatalogue(live || {});
  const v = cleanVod(vod || {});
  const lines = (linesSnap?.docs || []).map((d) => ({ id: d.id, ...d.data() }));

  const built = buildArchiveFiles({
    channels: cat.channels, movies: v.movies, series: v.series, lines, base: baseOf(req),
  });

  const summary = built.files.map((f) => ({ path: f.path, kb: Math.round(Buffer.byteLength(f.content) / 1024) }));

  if (action === 'preview') return json({ ok: true, preview: true, tag: built.tag, stats: built.stats, files: summary });

  const token = String(b.token || process.env.GITHUB_ARCHIVE_TOKEN || process.env.GITHUB_TOKEN || '').trim();
  const repo = cleanRepo(b.repo || process.env.GITHUB_ARCHIVE_REPO || '');
  const branch = String(b.branch || process.env.GITHUB_ARCHIVE_BRANCH || 'main').trim().replace(/[^A-Za-z0-9._/-]/g, '');

  if (!token) return json({ ok: false, error: 'GitHub token chahiye — Vercel par GITHUB_ARCHIVE_TOKEN set karein (repo scope), ya ek dafa token paste karein (save nahi hoga).' }, 400);
  if (!repo) return json({ ok: false, error: 'Repo "owner/repo" format mein dein (ya GITHUB_ARCHIVE_REPO env set karein).' }, 400);

  const H = gh(token);
  const api = `https://api.github.com/repos/${repo}`;

  try {
    // 1) branch ka latest commit
    const refRes = await fetch(`${api}/git/ref/heads/${encodeURIComponent(branch)}`, { headers: H });
    if (!refRes.ok) {
      return json({ ok: false, error: `GitHub branch "${branch}" nahi mili (${refRes.status}). Repo/branch check karein.` }, 400);
    }
    const refData = await refRes.json();
    const headSha = refData.object.sha;

    const commitRes = await fetch(`${api}/git/commits/${headSha}`, { headers: H });
    if (!commitRes.ok) return json({ ok: false, error: `GitHub commit read fail (${commitRes.status}).` }, 400);
    const baseTree = (await commitRes.json()).tree.sha;

    // 2) ek atomic tree (saari files aik sath)
    const treeRes = await fetch(`${api}/git/trees`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ base_tree: baseTree, tree: built.files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })) }),
    });
    if (!treeRes.ok) return json({ ok: false, error: `GitHub tree fail (${treeRes.status}): ${(await treeRes.text()).slice(0, 200)}` }, 400);
    const tree = await treeRes.json();

    // 3) commit
    const newCommitRes = await fetch(`${api}/git/commits`, {
      method: 'POST', headers: H,
      body: JSON.stringify({
        message: `IPTV archive ${built.tag} — ${built.stats.channels} channels, ${built.stats.movies} movies, ${built.stats.series} series, ${lines.length} lines`,
        tree: tree.sha, parents: [headSha],
      }),
    });
    if (!newCommitRes.ok) return json({ ok: false, error: `GitHub commit fail (${newCommitRes.status}).` }, 400);
    const newCommit = await newCommitRes.json();

    // 4) branch ko naye commit par le jao
    const updRes = await fetch(`${api}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });
    if (!updRes.ok) return json({ ok: false, error: `GitHub ref update fail (${updRes.status}).` }, 400);

    const meta = {
      repo, branch, tag: built.tag, commit: newCommit.sha, url: `https://github.com/${repo}/commit/${newCommit.sha}`,
      stats: built.stats, lines: lines.length, files: summary.length, at: Date.now(),
    };
    await adminDb().collection(META.collection).doc(META.id).set(meta, { merge: true });

    return json({ ok: true, pushed: true, ...meta });
  } catch (e) {
    console.error('archive push:', e.message);
    return json({ ok: false, error: `GitHub push nahi hua: ${e.message}` }, 500);
  }
}
