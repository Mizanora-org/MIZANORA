// Real Next production-cache regression test, with a tiny temporary app and mocked admin auth.
// It copies the actual revalidation route, but never alters the shop or needs Firebase credentials.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const nextBin = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const fixture = await mkdtemp(join(tmpdir(), 'mizanora-next-cache-'));
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NO_COLOR: '1' };
let server;

async function write(path, data) {
  const full = join(fixture, path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, data);
}

async function availablePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(child) {
  await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => finish(new Error(`Next server startup timed out: ${log}`)), 45000);
    const onData = (chunk) => {
      log += chunk.toString();
      if (log.includes('Ready in')) finish();
    };
    const onExit = (code) => finish(new Error(`Next server exited (${code}): ${log}`));
    const onError = (error) => finish(error);
    function finish(error) {
      clearTimeout(timer);
      child.stdout.off('data', onData); child.stderr.off('data', onData);
      child.off('exit', onExit); child.off('error', onError);
      if (error) reject(error); else resolve();
    }
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    child.once('exit', onExit); child.once('error', onError);
  });
}

try {
  await symlink(join(root, 'node_modules'), join(fixture, 'node_modules'), 'junction');
  await write('package.json', JSON.stringify({ name: 'mizanora-cache-fixture', version: '1.0.0', private: true }));
  await write('jsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./*'] } } }));
  await write('next.config.js', 'module.exports = { experimental: { cpus: 2 } };\n');
  await write('app/api/revalidate/route.js', await readFile(join(root, 'app/api/revalidate/route.js'), 'utf8'));
  await write('lib/adminAuth.js', `
    export async function verifyAdmin(req) {
      return req.headers.get('authorization') === 'Bearer fixture-admin' ? { ok: true } : { ok: false, status: 401 };
    }
  `);
  await write('lib/readValues.js', `
    import { unstable_cache } from 'next/cache';
    import { readFile } from 'node:fs/promises';
    const value = (file) => readFile(process.cwd() + '/data/' + file + '.txt', 'utf8');
    export const theme = unstable_cache(() => value('theme'), ['fixture-theme'], { tags: ['theme'], revalidate: 86400 });
    export const feed = unstable_cache(() => value('feed'), ['fixture-feed'], { tags: ['feed-posts'], revalidate: 86400 });
    export const github = unstable_cache(() => value('github'), ['fixture-github'], { tags: ['github'], revalidate: 86400 });
    export const images = unstable_cache(() => value('images'), ['fixture-images'], { tags: ['images'], revalidate: 86400 });
  `);
  await write('app/layout.js', `
    import { theme } from '@/lib/readValues';
    export default async function Layout({ children }) { return <html><body><div id="theme">{await theme()}</div>{children}</body></html>; }
  `);
  await write('app/page.js', `
    import { feed } from '@/lib/readValues';
    export const revalidate = 86400;
    export default async function Home() { return <div id="feed">{await feed()}</div>; }
  `);
  await write('app/about/page.js', `
    import { github } from '@/lib/readValues';
    export const revalidate = 86400;
    export default async function About() { return <div id="github">{await github()}</div>; }
  `);
  await write('app/gallery/page.js', `
    import { images } from '@/lib/readValues';
    export const revalidate = 86400;
    export default async function Gallery() { return <div id="images">{await images()}</div>; }
  `);
  const names = ['theme', 'feed', 'github', 'images'];
  await Promise.all(names.map((name) => write(`data/${name}.txt`, `before-${name}`)));

  await promisify(execFile)(process.execPath, [nextBin, 'build'], { cwd: fixture, env, timeout: 180000, maxBuffer: 5 * 1024 * 1024 });
  const port = await availablePort();
  server = spawn(process.execPath, [nextBin, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: fixture, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer(server);
  const base = `http://127.0.0.1:${port}`;
  async function get(path) {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, `${path} is available`);
    const html = await response.text();
    const fields = Object.fromEntries([...html.matchAll(/<div id="(theme|feed|github|images)">([^<]+)/g)].map((m) => [m[1], m[2]]));
    return { cache: response.headers.get('x-nextjs-cache'), ...fields };
  }
  async function refresh(tag, authorized = true) {
    return fetch(`${base}/api/revalidate`, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'content-type': 'application/json', ...(authorized ? { authorization: 'Bearer fixture-admin' } : {}) },
      body: JSON.stringify({ tags: [tag] }),
    });
  }

  assert.equal((await refresh('theme', false)).status, 401, 'auth is enforced');
  assert.equal((await get('/')).feed, 'before-feed');
  assert.equal((await get('/about')).github, 'before-github');
  assert.equal((await get('/gallery')).images, 'before-images');
  await Promise.all(names.map((name) => write(`data/${name}.txt`, `after-${name}`)));

  assert.equal((await refresh('feed-posts')).status, 200);
  const home = await get('/');
  const untouched = await get('/about');
  assert.equal(home.feed, 'after-feed', 'the dependent home page sees the updated feed');
  assert.equal(home.theme, 'before-theme');
  assert.equal(untouched.github, 'before-github');
  assert.equal(untouched.cache, 'HIT', 'an unrelated route remains cached');

  assert.equal((await refresh('images')).status, 200);
  assert.equal((await get('/gallery')).images, 'after-images', 'image settings refresh their dependent page');
  assert.equal((await refresh('theme')).status, 200);
  for (const path of ['/', '/about', '/gallery']) {
    assert.equal((await get(path)).theme, 'after-theme', `shared-layout tag refreshes ${path}`);
  }
  assert.equal((await get('/about')).github, 'before-github', 'other tagged data remains cached');
  console.log('Real Next production cache: targeted page and shared-layout tag refreshes work; unrelated routes stay cached.');
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    const stopped = new Promise((resolve) => server.once('exit', resolve));
    server.kill('SIGTERM');
    await Promise.race([stopped, delay(3000, undefined, { ref: false })]);
    if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
  }
  await rm(fixture, { recursive: true, force: true });
}
