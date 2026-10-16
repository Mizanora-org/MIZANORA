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

// The file as it is in the repository right now (null when it does not exist).
export async function ghReadFile(path) {
  try {
    const j = await gh('GET', `/contents/${path}?ref=${encodeURIComponent(branch())}`);
    return Buffer.from(j.content || '', 'base64').toString('utf8');
  } catch (e) { if (e.status === 404) return null; throw e; }
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
