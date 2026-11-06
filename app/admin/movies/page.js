'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  KeyRound,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { authClient } from '@/lib/firebase-client';
import { MOVIE_REGIONS, MOVIES_DEFAULT, extractImdbIds, slugifyMovie } from '@/lib/movies';
import MovieServersAdmin from '@/components/MovieServersAdmin';

const EMPTY_FORM = {
  title: '',
  imdbId: '',
  type: 'movie',
  year: 2026,
  releaseDate: '2026-12-01',
  status: 'released',
  region: 'Pakistan',
  country: 'Pakistan',
  language: 'Urdu',
  genres: 'Drama, Action',
  rating: 8.0,
  runtime: 135,
  tagline: '',
  story: '',
  director: '',
  castText: '',
  trailerYoutubeId: '',
  providerName: '',
  providerUrl: '',
  streamUrl: '',
  streamLicenseType: 'public-domain',
  streamLicenseText: '',
  rightsConfirmed: false,
};

async function adminToken() {
  try {
    const a = authClient();
    const u = a && a.currentUser;
    return u ? await u.getIdToken() : '';
  } catch {
    return '';
  }
}

export default function AdminMoviesPage() {
  const [cfg, setCfg] = useState(MOVIES_DEFAULT);
  const [starterCount, setStarterCount] = useState(0);
  const [tmdbOn, setTmdbOn] = useState(false);
  const [tmdbMasked, setTmdbMasked] = useState('');
  const [tmdbInput, setTmdbInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [imdbLookup, setImdbLookup] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adSlugsText, setAdSlugsText] = useState('');
  const [listFilter, setListFilter] = useState('');
  const [pageIdx, setPageIdx] = useState(0);

  const callApi = useCallback(async (payload) => {
    const t = await adminToken();
    const res = await fetch('/api/admin/movies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    return res.json().catch(() => ({ ok: false, error: 'Bad server response' }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await callApi({ action: 'load' });
      if (r && r.ok && r.cfg) {
        setCfg(r.cfg);
        setStarterCount(r.starterCount || 0);
        setTmdbOn(Boolean(r.tmdbConfigured));
        setTmdbMasked(r.tmdbKeyMasked || '');
        setAdSlugsText(((r.cfg.ads && r.cfg.ads.slugs) || []).join(', '));
      } else {
        setErr((r && r.error) || 'Could not load Movies settings.');
      }
    } catch {
      setErr('Network error while loading Movies settings.');
    } finally {
      setLoading(false);
    }
  }, [callApi]);

  useEffect(() => { load(); }, [load]);

  const runOneClickAutoSync = async () => {
    setSyncing(true);
    setErr('');
    setMsg('');
    try {
      const r = await callApi({
        action: 'autoSync',
        autoSync: cfg.autoSync || MOVIES_DEFAULT.autoSync,
      });
      if (r && r.ok && r.cfg) {
        setCfg(r.cfg);
        setMsg(r.message || 'Auto-Sync complete!');
      } else {
        setErr((r && r.error) || 'Auto-Sync could not complete.');
      }
    } finally {
      setSyncing(false);
    }
  };

  const runBulkImdbImport = async () => {
    const detected = extractImdbIds(bulkText, 250);
    if (!detected.length) {
      setErr('Paste at least one IMDb ID (like tt1375666) or IMDb URLs/CSV text first.');
      return;
    }
    setBulkImporting(true);
    setErr('');
    setMsg('');
    try {
      const r = await callApi({ action: 'bulkImdb', rawText: bulkText });
      if (r && r.ok && r.cfg) {
        setCfg(r.cfg);
        setBulkText('');
        setMsg(r.message || `Imported ${r.added || 0} titles.`);
      } else {
        setErr((r && r.error) || 'Bulk IMDb import failed.');
      }
    } finally {
      setBulkImporting(false);
    }
  };

  const saveSecretTmdbKey = async () => {
    setSavingKey(true);
    setErr('');
    setMsg('');
    try {
      const r = await callApi({ action: 'saveTmdbKey', tmdbApiKey: tmdbInput.trim() });
      if (r && r.ok) {
        setTmdbOn(Boolean(r.tmdbConfigured));
        setTmdbMasked(r.tmdbKeyMasked || '');
        setTmdbInput('');
        setMsg(r.message || 'TMDB key updated.');
      } else {
        setErr((r && r.error) || 'Could not save TMDB key.');
      }
    } finally {
      setSavingKey(false);
    }
  };

  const fetchByImdb = async () => {
    setErr('');
    setMsg('');
    if (!imdbLookup.trim()) {
      setErr('Enter an IMDb ID like tt1375666 first.');
      return;
    }
    setLookingUp(true);
    try {
      const r = await callApi({ action: 'lookupImdb', imdbId: imdbLookup.trim() });
      if (r && r.ok && r.item) {
        const m = r.item;
        setForm({
          ...EMPTY_FORM,
          title: m.title || '',
          imdbId: m.imdbId || '',
          type: m.type || 'movie',
          year: m.year || 2026,
          releaseDate: m.releaseDate || '',
          status: m.status || 'released',
          region: m.region || 'International',
          country: m.country || '',
          language: m.language || 'English',
          genres: (m.genres || []).join(', '),
          rating: m.rating || 0,
          runtime: m.runtime || 0,
          tagline: m.tagline || '',
          story: m.story || '',
          director: m.director || '',
          castText: (m.cast || []).map((c) => (c.character ? `${c.name} as ${c.character}` : c.name)).join(', '),
          trailerYoutubeId: m.trailerYoutubeId || '',
          providerName: (m.legalProviders && m.legalProviders[0] && m.legalProviders[0].name) || '',
          providerUrl: (m.legalProviders && m.legalProviders[0] && m.legalProviders[0].url) || '',
        });
        setMsg(`Loaded official metadata for "${m.title}" (${m.imdbId}). Review and press "Add to Custom List", then Save.`);
      } else {
        setErr((r && r.error) || 'Lookup failed.');
      }
    } finally {
      setLookingUp(false);
    }
  };

  const addCustomFromForm = () => {
    setErr('');
    setMsg('');
    if (!form.title.trim()) {
      setErr('Title is required.');
      return;
    }
    if (form.streamUrl.trim() && !form.rightsConfirmed) {
      setErr('Please tick the legal rights confirmation box before attaching a direct video file.');
      return;
    }

    const cast = form.castText
      .split(',')
      .map((part) => {
        const [namePart, charPart] = part.split(/\s+as\s+/i);
        const name = String(namePart || '').trim();
        if (!name) return null;
        return { slug: slugifyMovie(name), name, character: String(charPart || '').trim() };
      })
      .filter(Boolean);

    const legalProviders = [];
    if (form.providerName.trim() && form.providerUrl.trim()) {
      legalProviders.push({
        name: form.providerName.trim(),
        kind: 'Official',
        url: form.providerUrl.trim(),
        region: form.region,
      });
    }

    const item = {
      slug: slugifyMovie(`${form.title}-${form.year || ''}`),
      imdbId: form.imdbId.trim().toLowerCase(),
      title: form.title.trim(),
      type: form.type,
      year: Number(form.year) || 2026,
      releaseDate: form.releaseDate.trim(),
      status: form.status,
      region: form.region,
      country: form.country.trim() || form.region,
      language: form.language.trim() || 'Urdu',
      genres: form.genres.split(',').map((g) => g.trim()).filter(Boolean),
      rating: Number(form.rating) || 0,
      runtime: Number(form.runtime) || 0,
      tagline: form.tagline.trim(),
      story: form.story.trim() || `${form.title.trim()} official details, cast and preview on Mizanora.`,
      director: form.director.trim(),
      cast,
      trailerYoutubeId: form.trailerYoutubeId.trim(),
      legalProviders,
      publicDomainStream: form.streamUrl.trim()
        ? {
            url: form.streamUrl.trim(),
            licenseType: form.streamLicenseType,
            license:
              form.streamLicenseText.trim() ||
              (form.streamLicenseType === 'public-domain'
                ? 'Public Domain Film'
                : form.streamLicenseType === 'creative-commons'
                  ? 'Creative Commons Licensed'
                  : 'Mizanora Owned / Licensed Broadcast'),
            rightsConfirmed: Boolean(form.rightsConfirmed),
          }
        : null,
    };

    setCfg((prev) => ({
      ...prev,
      customMovies: [item, ...(prev.customMovies || []).filter((x) => x.slug !== item.slug)],
    }));
    setForm(EMPTY_FORM);
    setMsg(`Added "${item.title}" to synced/custom list. Click "Save All Changes" at the top to publish.`);
  };

  const removeCustom = (slug) => {
    setCfg((prev) => ({
      ...prev,
      customMovies: (prev.customMovies || []).filter((m) => m.slug !== slug),
    }));
  };

  const saveAll = async () => {
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const nextCfg = {
        ...cfg,
        ads: {
          enabled: !(cfg.ads && cfg.ads.enabled === false),
          slugs: adSlugsText.split(',').map((s) => s.trim()).filter(Boolean),
        },
      };
      const r = await callApi({ action: 'save', cfg: nextCfg });
      if (r && r.ok) {
        setCfg(r.cfg);
        setMsg(r.message || 'Saved successfully!');
      } else {
        setErr((r && r.error) || 'Could not save.');
      }
    } finally {
      setSaving(false);
    }
  };

  const autoSync = cfg.autoSync || MOVIES_DEFAULT.autoSync;
  const setAutoFlag = (key, val) => {
    setCfg((p) => ({
      ...p,
      autoSync: { ...(p.autoSync || MOVIES_DEFAULT.autoSync), [key]: val },
    }));
  };

  const filteredCustom = useMemo(() => {
    const list = cfg.customMovies || [];
    const q = listFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.imdbId || '').toLowerCase().includes(q) ||
        (m.region || '').toLowerCase().includes(q) ||
        String(m.year || '').includes(q),
    );
  }, [cfg.customMovies, listFilter]);

  const PAGE_SIZE = 25;
  const pagedCustom = filteredCustom.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE);
  const detectedBulkCount = useMemo(() => extractImdbIds(bulkText, 250).length, [bulkText]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-surface p-5">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-gold">
            <Clapperboard size={14} /> Auto-Pilot Entertainment &amp; SEO Hub
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-cream">Movies &amp; Series Auto-Sync Console</h1>
          <p className="mt-0.5 text-sm text-dim">
            Zero manual typing needed — Upcoming (ane wali), Latest Newest-to-Oldest (nayi se porani) &amp; Classics load automatically into pages &amp; sitemap.xml.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/movies" target="_blank" className="btn-ghost inline-flex items-center gap-1.5 text-xs font-bold">
            Open /movies <ExternalLink size={13} />
          </Link>
          <a href="#play-servers" className="btn-ghost inline-flex items-center gap-1.5 text-xs font-bold">
            Play Servers ↓
          </a>
          <button
            type="button"
            onClick={saveAll}
            disabled={saving || loading}
            className="btn-gold inline-flex items-center gap-1.5 text-xs font-extrabold"
          >
            <Save size={15} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-sm font-semibold text-rose-700">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-sm font-semibold text-emerald-800">
          {msg}
        </div>
      )}

      {/* 1. AUTO-PILOT ENGINE CARD (No manual 1-by-1 work needed!) */}
      <div className="rounded-3xl border-2 border-gold/40 bg-gradient-to-br from-[#052e1d] via-[#0B6B45] to-[#13293d] p-5 text-white shadow-xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-wider">
              <span className="inline-flex items-center gap-1 rounded-full bg-saffron px-3 py-1 text-[#2B1B00]">
                <Zap size={13} /> 100% Automatic Feed
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-200">
                <CheckCircle2 size={12} /> {autoSync.enabled !== false ? 'Auto-Load ON (Hourly ISR + Sitemap)' : 'Auto-Load Paused'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1">
                <Layers size={12} /> {(cfg.customMovies || []).length} Synced + {starterCount} Built-in Titles
              </span>
            </div>
            <h2 className="mt-3 font-display text-xl font-extrabold sm:text-2xl">
              One-Click &amp; Hourly Auto-Load: Upcoming + Newest to Oldest
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-white/85">
              Mizanora automatically pulls official IMDb/TVmaze/Archive/TMDB metadata for upcoming 2026–2027 releases, brand-new movies &amp; dramas, regional cinema (PK, IN, BD, IR, IQ, AF, TR), and classics—and indexes every slug into <code className="rounded bg-black/30 px-1.5 py-0.5 text-[#F5B83D]">/sitemap.xml</code>.
            </p>
          </div>

          <button
            type="button"
            onClick={runOneClickAutoSync}
            disabled={syncing}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-saffron px-5 py-3.5 text-sm font-extrabold text-[#2B1B00] shadow-lg transition hover:brightness-95 disabled:opacity-60"
          >
            <RefreshCw size={17} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing Upcoming + Latest + Classics...' : 'Auto-Sync All Now (1-Click)'}
          </button>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['enabled', 'Hourly Server Auto-Load (Zero Admin Work)'],
            ['includeUpcoming', 'Upcoming Releases (Ane Wali 2026–2027)'],
            ['includeLatest', 'Latest & Now Playing (Nayi se Porani)'],
            ['includeRegional', 'Pakistan, India, BD, Iran, Iraq, Afghan & TR'],
            ['includeClassics', 'Top-Rated All-Time Classics (Porani Hits)'],
            ['includePublicDomain', 'Free Legal Public-Domain Full Movies'],
          ].map(([key, label]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/15 bg-black/20 px-3.5 py-2.5 text-xs font-bold text-white"
            >
              <input
                type="checkbox"
                checked={autoSync[key] !== false}
                onChange={(e) => setAutoFlag(key, e.target.checked)}
                className="h-4 w-4 accent-[#F5B83D]"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* 2. BULK IMDb PASTE + OPTIONAL TMDB KEY */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Bulk IMDb List Importer */}
        <div className="space-y-3 rounded-3xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold text-cream">
              <Sparkles size={16} className="mr-1.5 inline text-gold" />
              Bulk IMDb Auto-Import (Paste 10–250 IDs / CSV / URLs)
            </h2>
            {detectedBulkCount > 0 && (
              <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-extrabold text-gold">
                {detectedBulkCount} IMDb IDs detected
              </span>
            )}
          </div>
          <p className="text-xs text-dim">
            Paste any IMDb list page URLs, exported CSV text, or raw <code className="font-mono">tt1234567</code> IDs—Mizanora extracts every ID and fetches official metadata in bulk automatically.
          </p>
          <textarea
            rows={4}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Example: tt1375666, tt15398776, https://www.imdb.com/title/tt0816692/ ... paste as many as you want!"
            className="input font-mono text-xs"
          />
          <button
            type="button"
            onClick={runBulkImdbImport}
            disabled={bulkImporting || detectedBulkCount === 0}
            className="btn-gold inline-flex items-center gap-1.5 text-xs font-extrabold disabled:opacity-50"
          >
            <Zap size={14} />
            {bulkImporting ? 'Auto-Importing Batch...' : `Import ${detectedBulkCount || ''} IMDb Titles Automatically`}
          </button>
        </div>

        {/* Optional TMDB API Key + Hub Settings */}
        <div className="space-y-3 rounded-3xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold text-cream">
              <KeyRound size={16} className="mr-1.5 inline text-gold" />
              Optional TMDB API Key (Turbo 10,000+ Sync)
            </h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tmdbOn ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-500/15 text-amber-800'}`}>
              {tmdbOn ? `Active (${tmdbMasked || 'Configured'})` : 'Zero-Key Mode Active'}
            </span>
          </div>
          <p className="text-xs text-dim">
            Even without a key, Mizanora auto-loads via TVmaze + IMDb Public JSON + Internet Archive! Paste a free TMDB v3 key or v4 Read Token here anytime to unlock 10x deeper regional &amp; trailer sync (stored in server-only <code className="font-mono">adminSecrets</code>).
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={tmdbInput}
              onChange={(e) => setTmdbInput(e.target.value)}
              placeholder={tmdbOn ? 'Paste new TMDB key/token to replace...' : 'Paste optional TMDB API Key or Read Token...'}
              className="input text-xs"
            />
            <button
              type="button"
              onClick={saveSecretTmdbKey}
              disabled={savingKey}
              className="btn-ghost shrink-0 text-xs font-bold"
            >
              {savingKey ? 'Saving...' : 'Save Key'}
            </button>
          </div>

          <div className="border-t border-line pt-3">
            <label className="mb-1 block text-xs font-bold text-dim">
              Companion Product Ad Slugs (blank = automatic in-stock Mizanora deals)
            </label>
            <input
              type="text"
              value={adSlugsText}
              onChange={(e) => setAdSlugsText(e.target.value)}
              placeholder="wireless-earbuds, smart-watch, winter-hoodie"
              className="input text-xs"
            />
          </div>
        </div>
      </div>

      {/* 3. SYNCED & CUSTOM CATALOGUE TABLE (Paged for 10,000+ titles) */}
      <div className="rounded-3xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold text-cream">
              Synced &amp; Custom Titles ({(cfg.customMovies || []).length} synced + {starterCount} built-in)
            </h2>
            <p className="text-xs text-dim">
              Stored in sharded Firestore parts so thousands of auto-synced titles never hit the 1 MB document limit.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={listFilter}
              onChange={(e) => { setListFilter(e.target.value); setPageIdx(0); }}
              placeholder="Filter synced titles..."
              className="input !py-2 !pl-8 text-xs"
            />
          </div>
        </div>

        {pagedCustom.length > 0 ? (
          <div className="mt-4 space-y-2">
            {pagedCustom.map((m) => (
              <div
                key={m.slug}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-raised px-3.5 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-cream">
                    {m.title} <span className="text-xs font-normal text-faint">({m.year} · {m.type} · {m.region})</span>
                    {m.status === 'upcoming' && (
                      <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[0.65rem] font-extrabold text-amber-700">
                        UPCOMING
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-dim">
                    /movies/{m.slug}
                    {m.imdbId ? ` · IMDb ${m.imdbId}` : ''}
                    {m.releaseDate ? ` · ${m.releaseDate}` : ''}
                    {m.publicDomainStream ? ' · Direct Legal Stream' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/movies/${m.slug}`} target="_blank" className="text-xs font-bold text-gold hover:underline">
                    View
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeCustom(m.slug)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-500/10"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>
            ))}

            {filteredCustom.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-3 text-xs text-dim">
                <span>
                  Page {pageIdx + 1} of {Math.ceil(filteredCustom.length / PAGE_SIZE)} ({filteredCustom.length} matching)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pageIdx === 0}
                    onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
                    className="btn-ghost !px-3 !py-1 text-xs disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={(pageIdx + 1) * PAGE_SIZE >= filteredCustom.length}
                    onClick={() => setPageIdx((p) => p + 1)}
                    className="btn-ghost !px-3 !py-1 text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-line p-4 text-xs text-dim">
            {starterCount} built-in regional &amp; global titles are already live on <Link href="/movies" className="font-bold text-gold underline">/movies</Link>, and hourly Auto-Load is active! Press <b>Auto-Sync All Now (1-Click)</b> above anytime to snapshot live external feeds into Firestore shards.
          </p>
        )}
      </div>

      {/* 4. OPTIONAL SINGLE TITLE / OWNED LEGAL STREAM OVERRIDE (Collapsed so screen stays clean) */}
      <details className="rounded-3xl border border-line bg-surface p-5">
        <summary className="cursor-pointer font-display text-base font-extrabold text-cream">
          Optional: Add or Customize a Single Title / Owned Legal Stream (.mp4 / .m3u8)
        </summary>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={imdbLookup}
              onChange={(e) => setImdbLookup(e.target.value)}
              placeholder="Auto-fill single form from IMDb ID (e.g. tt1375666)"
              className="input max-w-xs text-sm"
            />
            <button
              type="button"
              onClick={fetchByImdb}
              disabled={lookingUp}
              className="btn-ghost inline-flex items-center gap-1.5 text-xs font-bold"
            >
              <Search size={14} /> {lookingUp ? 'Fetching...' : 'Auto-Fill from IMDb'}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-dim">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Movie or Series Title"
                className="input text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-dim">IMDb ID</label>
              <input
                type="text"
                value={form.imdbId}
                onChange={(e) => setForm((p) => ({ ...p, imdbId: e.target.value }))}
                placeholder="tt1234567"
                className="input text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-dim">Format</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                className="input text-sm"
              >
                <option value="movie">Movie</option>
                <option value="series">TV / Web Series</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-dim">Region</label>
              <select
                value={form.region}
                onChange={(e) => setForm((p) => ({ ...p, region: e.target.value, country: e.target.value }))}
                className="input text-sm"
              >
                {MOVIE_REGIONS.filter((r) => r.id !== 'all').map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-dim">Release Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                className="input text-sm"
              >
                <option value="released">Released</option>
                <option value="upcoming">Upcoming (Calendar)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-dim">Release Date</label>
              <input
                type="date"
                value={form.releaseDate}
                onChange={(e) => setForm((p) => ({
                  ...p,
                  releaseDate: e.target.value,
                  year: e.target.value ? Number(e.target.value.slice(0, 4)) : p.year,
                }))}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-dim">YouTube Trailer ID</label>
              <input
                type="text"
                value={form.trailerYoutubeId}
                onChange={(e) => setForm((p) => ({ ...p, trailerYoutubeId: e.target.value }))}
                placeholder="YoHD9XEInc0"
                className="input text-sm"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-700">
              <ShieldCheck size={14} /> Optional Direct Legal Cinema Stream (Public-Domain or Owned Rights Only)
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <input
                type="url"
                value={form.streamUrl}
                onChange={(e) => setForm((p) => ({ ...p, streamUrl: e.target.value }))}
                placeholder="https://archive.org/download/.../film.mp4"
                className="input text-xs sm:col-span-2"
              />
              <select
                value={form.streamLicenseType}
                onChange={(e) => setForm((p) => ({ ...p, streamLicenseType: e.target.value }))}
                className="input text-xs"
              >
                <option value="public-domain">Public Domain</option>
                <option value="creative-commons">Creative Commons (CC-BY)</option>
                <option value="owned-licensed">Mizanora Owned / Licensed</option>
              </select>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-cream">
              <input
                type="checkbox"
                checked={form.rightsConfirmed}
                onChange={(e) => setForm((p) => ({ ...p, rightsConfirmed: e.target.checked }))}
                className="h-4 w-4 accent-emerald-600"
              />
              I confirm this file is Public Domain, Creative Commons, or legally licensed to Mizanora.
            </label>
          </div>

          <button type="button" onClick={addCustomFromForm} className="btn-gold inline-flex items-center gap-1.5 text-xs font-extrabold">
            <Plus size={15} /> Add Single Title
          </button>
        </div>
      </details>

      {/* v51 — PLAY SERVERS: the sources the Cinema Player builds every movie link from. */}
      <div id="play-servers" className="scroll-mt-24">
        <MovieServersAdmin />
      </div>
    </div>
  );
}
