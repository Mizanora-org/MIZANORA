import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { snapshotGet } from '@/lib/snapshot';
import {
  MAX_CUSTOM_MOVIES,
  MOVIES_DEFAULT,
  STARTER_MOVIES,
  cleanLegalStream,
  cleanMovie,
  cleanMoviesConfig,
  extractImdbIds,
  findMovie,
  isForbiddenStreamUrl,
  isValidImdbId,
  sortMoviesNewestToOldest,
} from '@/lib/movies';
import { getEffectiveTmdbKey, lookupOfficialByImdbId } from '@/lib/moviesServer';
import {
  readMoviesAll,
  readMoviesSecrets,
  writeMoviesAll,
  writeMoviesSecrets,
} from '@/lib/moviesStore';
import { bulkResolveImdbIds, runAutoFeedDiscovery } from '@/lib/moviesAutoFeed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // large archived movie lists may need several atomic GitHub blob uploads

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

function maskKey(k = '') {
  const s = String(k || '').trim();
  if (!s) return '';
  if (s.length <= 6) return '••••••';
  return `••••••••${s.slice(-4)}`;
}

function revalidateMoviesEverywhere() {
  try {
    revalidateTag('movies');
    revalidateTag('movies-auto');
    revalidatePath('/');
    revalidatePath('/movies');
    revalidatePath('/movies/calendar');
    revalidatePath('/movies/actors');
    revalidatePath('/sitemap.xml');
  } catch {
    /* ignore outside request revalidation context */
  }
}

function mergeUniqueMovies(existing = [], incoming = []) {
  const bySlug = new Map();
  const byImdb = new Map();
  for (const raw of existing) {
    const m = cleanMovie(raw);
    if (!m) continue;
    bySlug.set(m.slug, m);
    if (m.imdbId) byImdb.set(m.imdbId, m.slug);
  }
  let added = 0;
  for (const raw of incoming) {
    const m = cleanMovie(raw);
    if (!m) continue;
    if ((m.imdbId && byImdb.has(m.imdbId)) || bySlug.has(m.slug)) continue;
    bySlug.set(m.slug, m);
    if (m.imdbId) byImdb.set(m.imdbId, m.slug);
    added += 1;
  }
  return {
    list: sortMoviesNewestToOldest([...bySlug.values()]).slice(0, MAX_CUSTOM_MOVIES),
    added,
  };
}

export async function POST(req) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON request.' }, 400);
  }

  const action = String(body.action || 'load');

  // 1. Single IMDb lookup (works with TMDB key OR zero-key fallback + built-in catalog)
  if (action === 'lookupImdb') {
    const imdbId = String(body.imdbId || '').trim().toLowerCase();
    if (!isValidImdbId(imdbId)) {
      return json({ ok: false, error: 'Enter a valid IMDb ID starting with tt (for example tt1375666).' }, 400);
    }
    const item = (await lookupOfficialByImdbId(imdbId)) || findMovie(imdbId, STARTER_MOVIES);
    if (!item) {
      return json({ ok: false, error: `Could not resolve metadata for ${imdbId} right now.` }, 404);
    }
    return json({ ok: true, item });
  }

  const envTmdb = String(process.env.TMDB_API_KEY || '').trim();

  // A deployed archive can be read/edited without the Firestore Admin SDK.
  const archiveMode = Boolean(await snapshotGet('movies'));
  // When neither Firestore nor an archive is configured, keep load & preview actions smooth.
  if (!adminReady() && !archiveMode) {
    if (action === 'load') {
      return json({
        ok: true,
        cfg: cleanMoviesConfig(MOVIES_DEFAULT),
        starterCount: STARTER_MOVIES.length,
        tmdbConfigured: Boolean(envTmdb),
        tmdbKeyMasked: maskKey(envTmdb),
        tmdbFromEnv: Boolean(envTmdb),
        parts: 0,
        dbReady: false,
      });
    }
    if (action === 'autoSync') {
      const discovered = await runAutoFeedDiscovery({
        tmdbApiKey: envTmdb,
        autoSync: body.autoSync || MOVIES_DEFAULT.autoSync,
        pagesPerFeed: 3,
        archiveRows: 12,
        timeoutMs: 8000,
      });
      const previewCfg = cleanMoviesConfig({
        ...MOVIES_DEFAULT,
        autoSync: body.autoSync || MOVIES_DEFAULT.autoSync,
        lastAutoSyncAt: Date.now(),
        customMovies: discovered.movies,
      });
      return json({
        ok: true,
        cfg: previewCfg,
        added: discovered.movies.length,
        discoveredCount: discovered.movies.length,
        message: `Auto-loaded ${discovered.movies.length} live titles + ${STARTER_MOVIES.length} built-in titles (connect Firestore in production to persist shards permanently).`,
      });
    }
    return json({ ok: false, error: 'Firestore Admin is not configured on the server yet.' }, 503);
  }

  try {
    const db = adminReady() ? adminDb() : null;

    if (action === 'load') {
      const [cfg, secrets] = await Promise.all([readMoviesAll(db), db ? readMoviesSecrets(db) : { tmdbApiKey: '' }]);
      const activeKey = envTmdb || secrets.tmdbApiKey || '';
      return json({
        ok: true,
        cfg,
        starterCount: STARTER_MOVIES.length,
        tmdbConfigured: Boolean(activeKey),
        tmdbKeyMasked: maskKey(activeKey),
        tmdbFromEnv: Boolean(envTmdb),
        dbReady: Boolean(db || archiveMode),
        source: archiveMode ? 'archive' : 'firestore',
      });
    }

    if (action === 'saveTmdbKey') {
      if (!db) return json({ ok: false, error: 'TMDB API keys stay private. Set TMDB_API_KEY in Vercel or configure the Firebase Admin SDK; never commit keys to a public archive.' }, 503);
      const rawKey = String(body.tmdbApiKey || '').trim();
      await writeMoviesSecrets(db, { tmdbApiKey: rawKey });
      revalidateMoviesEverywhere();
      const activeKey = envTmdb || rawKey;
      return json({
        ok: true,
        tmdbConfigured: Boolean(activeKey),
        tmdbKeyMasked: maskKey(activeKey),
        message: rawKey
          ? 'Saved TMDB API Key securely in server-only secrets. Auto-Sync will now pull full TMDB + IMDb catalogs!'
          : 'Cleared stored TMDB API key (zero-key TVmaze + IMDb + Archive auto-sync remains active).',
      });
    }

    // 2. ONE-CLICK AUTO-SYNC: Upcoming ("ane wali") + Latest Newest-to-Oldest ("nayi se porani") + Classics + Regional
    if (action === 'autoSync') {
      const current = await readMoviesAll(db);
      const tmdbKey = await getEffectiveTmdbKey();
      const nextAutoSync = body.autoSync && typeof body.autoSync === 'object'
        ? { ...current.autoSync, ...body.autoSync, enabled: true }
        : { ...current.autoSync, enabled: true };

      const discovered = await runAutoFeedDiscovery({
        tmdbApiKey: tmdbKey,
        autoSync: nextAutoSync,
        pagesPerFeed: 3,
        archiveRows: 15,
        timeoutMs: 8500,
      });

      const merged = mergeUniqueMovies(current.customMovies || [], discovered.movies || []);
      const nextCfg = {
        ...current,
        autoSync: nextAutoSync,
        lastAutoSyncAt: Date.now(),
        customMovies: merged.list,
      };
      const saved = await writeMoviesAll(db, nextCfg);
      revalidateMoviesEverywhere();

      return json({
        ok: true,
        cfg: saved.cfg,
        parts: saved.parts,
        added: merged.added,
        discoveredCount: (discovered.movies || []).length,
        message: saved.source === 'archive' ? `Auto-Sync committed ${merged.added} new titles to GitHub. They appear after the new deployment (no Firebase writes).` : `Auto-Sync complete! Added ${merged.added} new titles (${saved.cfg.customMovies.length} synced + ${STARTER_MOVIES.length} built-in across ${saved.parts} database shards). Sitemap & pages updated.`,
      });
    }

    // 3. BULK IMDb PASTE IMPORT: Paste 10, 50 or 250 tt... IDs / CSV / IMDb list URLs at once
    if (action === 'bulkImdb') {
      const rawText = String(body.rawText || '');
      const ids = extractImdbIds(rawText, 250);
      if (!ids.length) {
        return json({ ok: false, error: 'No IMDb IDs (tt...) found in the pasted text. Paste any IMDb URLs, CSV export, or tt1234567 IDs.' }, 400);
      }

      const current = await readMoviesAll(db);
      const tmdbKey = await getEffectiveTmdbKey();
      const batch = await bulkResolveImdbIds(ids, {
        lookupByImdbFn: (id) => lookupOfficialByImdbId(id, tmdbKey),
        maxIds: 250,
        concurrency: 8,
      });

      const merged = mergeUniqueMovies(current.customMovies || [], batch.movies || []);
      const saved = await writeMoviesAll(db, {
        ...current,
        lastAutoSyncAt: Date.now(),
        customMovies: merged.list,
      });
      revalidateMoviesEverywhere();

      return json({
        ok: true,
        cfg: saved.cfg,
        parts: saved.parts,
        added: merged.added,
        resolvedCount: batch.movies.length,
        failedCount: batch.failed.length,
        message: saved.source === 'archive' ? `Committed ${merged.added} titles to the archive. They appear after the deployment (no Firebase writes).` : `Bulk IMDb import finished: resolved ${batch.movies.length} of ${ids.length} IMDb IDs (${merged.added} newly added). Sitemap & pages updated!`,
      });
    }

    // 4. SAVE SETTINGS & CUSTOM LIST (Sharded + Anti-Piracy Validated)
    if (action === 'save') {
      const rawCfg = body.cfg && typeof body.cfg === 'object' ? body.cfg : null;
      if (!rawCfg) return json({ ok: false, error: 'Nothing to save.' }, 400);
      const rawMovies = Array.isArray(rawCfg.customMovies) ? rawCfg.customMovies : [];
      if (rawMovies.length > MAX_CUSTOM_MOVIES) {
        return json({ ok: false, error: `Maximum ${MAX_CUSTOM_MOVIES} synced/custom titles allowed.` }, 400);
      }

      for (let i = 0; i < rawMovies.length; i += 1) {
        const m = rawMovies[i];
        if (!m || !String(m.title || '').trim()) {
          return json({ ok: false, error: `Custom title #${i + 1} is missing a title.` }, 400);
        }
        const streamRaw = m.publicDomainStream && m.publicDomainStream.url ? String(m.publicDomainStream.url).trim() : '';
        if (streamRaw) {
          if (isForbiddenStreamUrl(streamRaw)) {
            return json(
              {
                ok: false,
                error: `Stream rejected for "${m.title}": third-party unauthorized / piracy embed hosts or non-HTTPS links are not permitted on Mizanora.`,
              },
              400,
            );
          }
          if (!cleanLegalStream(m.publicDomainStream)) {
            return json(
              {
                ok: false,
                error: `Stream rejected for "${m.title}": only direct https .mp4 / .webm / .m3u8 files with confirmed Public-Domain, Creative Commons, or Owned-Licensed rights are accepted.`,
              },
              400,
            );
          }
        }
        if (!cleanMovie(m)) {
          return json({ ok: false, error: `Custom title "${m.title}" could not be validated.` }, 400);
        }
      }

      const saved = await writeMoviesAll(db, rawCfg);
      revalidateMoviesEverywhere();

      return json({
        ok: true,
        cfg: saved.cfg,
        parts: saved.parts,
        message: saved.source === 'archive' ? `Saved ${saved.cfg.customMovies.length} titles to GitHub; visible after the new deployment (no Firebase writes).` : `Saved Movies & Series Hub (${saved.cfg.customMovies.length} synced/custom + ${STARTER_MOVIES.length} built-in across ${saved.parts} shards).`,
      });
    }

    return json({ ok: false, error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error('admin movies route failed:', e.message);
    return json({ ok: false, error: e.status ? e.message : 'Could not save Movies. Try again.' }, e.status || 500);
  }
}
