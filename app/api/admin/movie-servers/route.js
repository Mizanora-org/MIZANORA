import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import {
  MAX_MOVIE_SERVERS,
  MOVIE_SERVERS_DEFAULT,
  buildServerUrl,
  cleanMoviesServersConfig,
  cleanServer,
  describeServers,
  sampleTemplateUrl,
  validateServerTemplate,
} from '@/lib/movieServers';
import { readMovieServers, saveMovieServers } from '@/lib/movieServersServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

const refresh = () => {
  try {
    revalidateTag('movie-servers');
    revalidateTag('movies');
    revalidateTag('movies-auto');
  } catch {
    /* outside a request context (tests) - the 300s cache will pick it up */
  }
};

// Admin only. The "play servers" list is the bridge between the catalogue and the Cinema Player:
// every entry is a URL template such as https://my-cdn.com/play/{imdbid} that the player fills in.
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

  if (!adminReady()) {
    if (action === 'load') {
      return json({ ok: true, cfg: MOVIE_SERVERS_DEFAULT, dbReady: false, stats: describeServers([]) });
    }
    return json({ ok: false, error: 'Firestore Admin is not configured yet - play servers need the database.' }, 503);
  }

  try {
    const current = await readMovieServers();
    const cfg = cleanMoviesServersConfig(current);

    if (action === 'load') {
      return json({
        ok: true,
        cfg,
        dbReady: true,
        max: MAX_MOVIE_SERVERS,
        stats: describeServers(cfg.servers),
        preview: cfg.servers.map((s) => ({ id: s.id, url: buildServerUrl(s.template, { imdbId: 'tt22084616', title: 'Sample Title', year: 2026, type: 'movie', season: 1, episode: 1 }) })),
      });
    }

    if (action === 'save' || action === 'add' || action === 'update') {
      let servers = cfg.servers;

      if (action === 'add') {
        const draft = body.server && typeof body.server === 'object' ? body.server : null;
        if (!draft) return json({ ok: false, error: 'Server ki tafseel nahi mili.' }, 400);
        const check = validateServerTemplate(draft.template);
        if (!check.ok) return json({ ok: false, error: check.error }, 400);
        if (draft.rightsConfirmed !== true) {
          return json({ ok: false, error: 'Pehle tasdeeq karein ke yeh server aap ka hai ya aap ke paas is se stream karne ka licence hai (checkbox tick karein).' }, 400);
        }
        if (servers.length >= MAX_MOVIE_SERVERS) {
          return json({ ok: false, error: `Maximum ${MAX_MOVIE_SERVERS} play servers allowed. Kuch puranay delete karein.` }, 400);
        }
        const s = cleanServer({ ...draft, priority: Number(draft.priority) || servers.length + 1, createdAt: Date.now() }, servers.length);
        if (!s) return json({ ok: false, error: 'Server validate nahi hua. Name aur https link dobara check karein.' }, 400);
        servers = [...servers, s];
      } else if (action === 'update') {
        const id = String(body.id || '');
        const patch = body.server && typeof body.server === 'object' ? body.server : {};
        if (!id) return json({ ok: false, error: 'Server id missing.' }, 400);
        const at = servers.findIndex((s) => s.id === id);
        if (at < 0) return json({ ok: false, error: 'That server no longer exists.' }, 404);
        if (patch.template != null) {
          const check = validateServerTemplate(patch.template);
          if (!check.ok) return json({ ok: false, error: check.error }, 400);
        }
        if (patch.rightsConfirmed === false) {
          return json({ ok: false, error: 'Rights confirmation ke baghair server save nahi ho sakta.' }, 400);
        }
        const merged = cleanServer({ ...servers[at], ...patch, createdAt: servers[at].createdAt }, at);
        if (!merged) return json({ ok: false, error: 'Updated server validate nahi hua.' }, 400);
        merged.id = servers[at].id; // the id never changes, so links & stats stay stable
        servers = servers.map((s, i) => (i === at ? merged : s));
      } else if (Array.isArray(body.servers)) {
        servers = body.servers;
        for (const s of servers) {
          const check = validateServerTemplate(s && s.template);
          if (!check.ok) return json({ ok: false, error: `${(s && s.name) || 'Server'}: ${check.error}` }, 400);
          if (s && s.rightsConfirmed === false) {
            return json({ ok: false, error: `${s.name || 'Server'}: rights confirmation zaroori hai.` }, 400);
          }
        }
      }

      const next = cleanMoviesServersConfig({
        ...cfg,
        ...(body.cfg && typeof body.cfg === 'object' ? { enabled: body.cfg.enabled, ads: body.cfg.ads } : {}),
        servers,
      });
      if (next.servers.length > MAX_MOVIE_SERVERS) {
        return json({ ok: false, error: `Maximum ${MAX_MOVIE_SERVERS} play servers allowed.` }, 400);
      }
      const saved = await saveMovieServers(next);
      if (!saved.ok) return json({ ok: false, error: saved.error }, 500);
      refresh();
      return json({
        ok: true,
        cfg: saved.cfg,
        stats: describeServers(saved.cfg.servers),
        message:
          action === 'add'
            ? `Server add ho gaya: ${saved.cfg.servers[saved.cfg.servers.length - 1]?.name || ''}. Ab har movie page par nazar aayega.`
            : action === 'update'
              ? 'Server update ho gaya.'
              : `Save ho gaya — ${saved.cfg.servers.length} server(s).`,
      });
    }

    // v51: paste a whole list at once - one link per line, optionally "Name | link".
    if (action === 'bulkAdd') {
      const rows = Array.isArray(body.servers) ? body.servers.slice(0, MAX_MOVIE_SERVERS) : [];
      if (!rows.length) return json({ ok: false, error: 'Koi link nahi mila. Har line par ek link likhein.' }, 400);
      if (body.rightsConfirmed !== true) {
        return json({ ok: false, error: 'Bulk add se pehle rights confirmation tick karein.' }, 400);
      }
      const room = MAX_MOVIE_SERVERS - cfg.servers.length;
      if (room <= 0) return json({ ok: false, error: `Maximum ${MAX_MOVIE_SERVERS} servers already reached.` }, 400);

      const seen = new Set(cfg.servers.map((s) => String(s.template || '').trim().toLowerCase()));
      const added = [];
      const errors = [];
      for (const row of rows.slice(0, room)) {
        const template = String((row && (row.template || row.url)) || '').trim().slice(0, 400);
        if (!template) continue;
        const check = validateServerTemplate(template);
        if (!check.ok) {
          errors.push(`${template.slice(0, 50)} — ${check.error}`);
          continue;
        }
        if (seen.has(template.toLowerCase())) {
          errors.push(`${template.slice(0, 50)} — pehle se list mein hai.`);
          continue;
        }
        let host = '';
        try { host = new URL(sampleTemplateUrl(template)).hostname.replace(/^www\./i, ''); } catch { host = ''; }
        const server = cleanServer(
          {
            name: String((row && row.name) || '').trim() || host || `Server ${cfg.servers.length + added.length + 1}`,
            template,
            kind: 'auto',
            quality: (row && row.quality) || 'Auto',
            scope: (row && row.scope) || 'all',
            rightsConfirmed: true,
          },
          cfg.servers.length + added.length,
        );
        if (!server) {
          errors.push(`${template.slice(0, 50)} — server validate nahi hua.`);
          continue;
        }
        seen.add(template.toLowerCase());
        added.push(server);
      }

      if (!added.length) {
        return json({ ok: false, error: errors.length ? errors.slice(0, 4).join(' · ') : 'Koi valid link nahi mila.' }, 400);
      }
      const saved = await saveMovieServers({ ...cfg, servers: [...cfg.servers, ...added] });
      if (!saved.ok) return json({ ok: false, error: saved.error }, 500);
      refresh();
      return json({
        ok: true,
        cfg: saved.cfg,
        added: added.length,
        errors,
        stats: describeServers(saved.cfg.servers),
        message: `${added.length} server add ho gaye${errors.length ? `, ${errors.length} skip hue` : ''}.`,
      });
    }

    if (action === 'delete') {
      const id = String(body.id || '');
      if (!id) return json({ ok: false, error: 'Server id missing.' }, 400);
      const servers = cfg.servers.filter((s) => s.id !== id);
      if (servers.length === cfg.servers.length) return json({ ok: false, error: 'That server no longer exists.' }, 404);
      const saved = await saveMovieServers({ ...cfg, servers });
      if (!saved.ok) return json({ ok: false, error: saved.error }, 500);
      refresh();
      return json({ ok: true, cfg: saved.cfg, stats: describeServers(saved.cfg.servers), message: 'Server delete ho gaya.' });
    }

    if (action === 'toggle') {
      const id = String(body.id || '');
      const at = cfg.servers.findIndex((s) => s.id === id);
      if (at < 0) return json({ ok: false, error: 'That server no longer exists.' }, 404);
      const servers = cfg.servers.map((s, i) => (i === at ? { ...s, enabled: s.enabled === false } : s));
      const saved = await saveMovieServers({ ...cfg, servers });
      if (!saved.ok) return json({ ok: false, error: saved.error }, 500);
      refresh();
      return json({ ok: true, cfg: saved.cfg, stats: describeServers(saved.cfg.servers) });
    }

    if (action === 'move') {
      const id = String(body.id || '');
      const dir = body.dir === 'up' ? -1 : 1;
      const list = [...cfg.servers].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
      const at = list.findIndex((s) => s.id === id);
      if (at < 0) return json({ ok: false, error: 'That server no longer exists.' }, 404);
      const to = Math.max(0, Math.min(list.length - 1, at + dir));
      if (to !== at) {
        const [row] = list.splice(at, 1);
        list.splice(to, 0, row);
      }
      const servers = list.map((s, i) => ({ ...s, priority: i + 1 }));
      const saved = await saveMovieServers({ ...cfg, servers });
      if (!saved.ok) return json({ ok: false, error: saved.error }, 500);
      refresh();
      return json({ ok: true, cfg: saved.cfg, stats: describeServers(saved.cfg.servers) });
    }

    if (action === 'duplicate') {
      const id = String(body.id || '');
      const src = cfg.servers.find((s) => s.id === id);
      if (!src) return json({ ok: false, error: 'That server no longer exists.' }, 404);
      if (cfg.servers.length >= MAX_MOVIE_SERVERS) return json({ ok: false, error: `Maximum ${MAX_MOVIE_SERVERS} servers.` }, 400);
      const copy = cleanServer({ ...src, id: `${src.id}-copy`, name: `${src.name} copy`.slice(0, 40), priority: cfg.servers.length + 1 }, cfg.servers.length);
      const saved = await saveMovieServers({ ...cfg, servers: [...cfg.servers, copy] });
      if (!saved.ok) return json({ ok: false, error: saved.error }, 500);
      refresh();
      return json({ ok: true, cfg: saved.cfg, stats: describeServers(saved.cfg.servers), message: 'Server ki copy bana di.' });
    }

    if (action === 'reset') {
      const saved = await saveMovieServers({ ...MOVIE_SERVERS_DEFAULT });
      if (!saved.ok) return json({ ok: false, error: saved.error }, 500);
      refresh();
      return json({ ok: true, cfg: saved.cfg, stats: describeServers([]), message: 'Poori list reset ho gayi.' });
    }

    return json({ ok: false, error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error('admin movie-servers route failed:', e.message);
    return json({ ok: false, error: 'Could not reach Firestore. Try again.' }, 500);
  }
}
