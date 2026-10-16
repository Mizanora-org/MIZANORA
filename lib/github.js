// Minimal GitHub client for the product archive (server only). Commits files into YOUR repository through GitHub's API, many files in ONE commit,
// so Vercel deploys only once. Needs three Vercel variables:
//   GITHUB_TOKEN   a fine-grained token with "Contents: Read and write" on this one repository
//   GITHUB_REPO    owner/name, for example  muaaz/mizanora
//   GITHUB_BRANCH  optional, default "main" (the branch Vercel deploys)
const API = 'https://api.github.com';
const repo = () => String(process.env.GITHUB_REPO || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/$/, '');
const branch = () => String(process.env.GITHUB_BRANCH || 'main').trim();
export const ghReady = () => Boolean(process.env.GITHUB_TOKEN && /^[\w.-]+\/[\w.-]+$/.test(repo()));
export const ghInfo = () => ({ repo: repo(), branch: branch() });

async function gh(method, url, body, timeoutMs = 25000) {
  const r = await fetch(`${API}/repos/${repo()}${url}`, {
    method, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store',
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'mizanora-archive', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch { /* not json */ }
  if (!r.ok) { const e = new Error(`GitHub ${r.status}: ${(j && j.message) || text.slice(0, 120)}`); e.status = r.status; throw e; }
  return j;
}

// NON-DESTRUCTIVE CONNECTION TEST for Admin > Connections. Does not write or commit anything:
//   1) GET /repos/{owner}/{name}   -> does the repo exist, is the token valid, what permissions does the token have
//   2) GET /git/ref/heads/{branch} -> does the deploy branch exist (the one Vercel builds)
// Returns { ok:true, repo, branch, defaultBranch, private, canPush, head } or { ok:false, error } with a plain reason.
export async function ghTest() {
  if (!ghReady()) return { ok: false, error: 'GITHUB_TOKEN and GITHUB_REPO are not set in Vercel (Settings > Environment Variables), or GITHUB_REPO is not in the form owner/name.' };
  try {
    const info = await gh('GET', '');
    const ref = await gh('GET', `/git/ref/heads/${encodeURIComponent(branch())}`);
    return {
      ok: true,
      repo: info.full_name || repo(),
      branch: branch(),
      defaultBranch: info.default_branch || '',
      private: Boolean(info.private),
      canPush: !info.permissions || info.permissions.push !== false,
      head: String((ref && ref.object && ref.object.sha) || '').slice(0, 7),
    };
  } catch (e) {
    const msg = e.status === 401 || e.status === 403
      ? 'GitHub rejected the token (401/403). Create a new fine-grained token for THIS repository with Contents: Read and write, paste it in Vercel (GITHUB_TOKEN) and redeploy.'
      : e.status === 404
        ? 'Repository or branch not found (404). Check GITHUB_REPO (owner/name) and GITHUB_BRANCH (the branch Vercel deploys).'
        : `GitHub error: ${String(e.message || e).slice(0, 140)}`;
    return { ok: false, error: msg };
  }
}

// The file as it is in the repository right now (null when it does not exist).
export async function ghReadFile(path) {
  try {
    const j = await gh('GET', `/contents/${path}?ref=${encodeURIComponent(branch())}`);
    return Buffer.from(j.content || '', 'base64').toString('utf8');
  } catch (e) { if (e.status === 404) return null; throw e; }
}
// The file NAMES inside a repository folder ([] when it does not exist). Used to rebuild the parts list when
// data/catalog/manifest.json is missing or was overwritten by an upgrade - the products must never disappear.
export async function ghListDir(path) {
  try {
    const j = await gh('GET', `/contents/${path}?ref=${encodeURIComponent(branch())}`);
    return Array.isArray(j) ? j.map((x) => String(x.name || '')).filter(Boolean) : [];
  } catch (e) { if (e.status === 404) return []; throw e; }
}

export async function ghBlob(text) {
  const j = await gh('POST', '/git/blobs', { content: text, encoding: 'utf-8' }, 60000);
  return j.sha;
}
// files: [{ path, sha }] (blobs made with ghBlob). One commit on the branch.
export async function ghCommit(files, message) {
  const ref = await gh('GET', `/git/ref/heads/${encodeURIComponent(branch())}`);
  const head = ref.object.sha;
  const commit = await gh('GET', `/git/commits/${head}`);
  const tree = await gh('POST', '/git/trees', { base_tree: commit.tree.sha, tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', sha: f.sha })) }, 60000);
  const made = await gh('POST', '/git/commits', { message, tree: tree.sha, parents: [head] });
  await gh('PATCH', `/git/refs/heads/${encodeURIComponent(branch())}`, { sha: made.sha });
  return made.sha;
}
