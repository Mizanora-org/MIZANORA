import { ExternalLink, GitFork, Github, GitCommitHorizontal, Star, ArrowRight, Code2, Users } from 'lucide-react';
import LiveBadge from './LiveBadge';
import { SyncedAgo } from './LiveStrip';
import { githubBadges, langColor } from '@/lib/githubRepos';
import { formatCount, timeAgo } from '@/lib/liveBadges';

// ============================================================================
// GITHUB, LIVE ON THE WEBSITE (v33)
// ----------------------------------------------------------------------------
// The owner's real GitHub account, read on the server (cached 30 minutes) and
// drawn here: avatar, followers, repository count, total stars, the language
// mix and the repositories themselves - newest push first, with NEW / ACTIVE /
// MIT / LIVE DEMO badges and "pushed 2 ghante pehle" notes.
//
// If GitHub cannot be reached the same layout renders from the projects in the
// code (lib/githubRepos.js FALLBACK_REPOS), so this section is never empty.
// ============================================================================
export default function GitHubLive({ data, limit = 6, compact = false, title = 'Open source on GitHub', intro }) {
  if (!data || !data.profile) return null;
  const p = data.profile;
  const s = data.summary || {};
  const repos = (data.featured && data.featured.length ? data.featured : data.repos || []).slice(0, limit);
  const now = Date.now();
  const langs = (s.languages || []).slice(0, 5);
  const lastPush = timeAgo(s.lastPushMs, now);

  return (
    <section className="mz-gh" aria-label="GitHub projects">
      <header className="mz-gh-head">
        <div className="mz-gh-id">
          {p.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatar} alt="" width={56} height={56} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="mz-gh-avatar" />
          ) : (
            <span className="mz-gh-avatar mz-gh-avatar-fallback" aria-hidden="true"><Github size={26} /></span>
          )}
          <div className="min-w-0">
            <h2 className="mz-gh-title">{title}</h2>
            <p className="mz-gh-user">
              <a href={p.url} target="_blank" rel="noopener noreferrer me" className="mz-gh-link">@{p.login}</a>
              {p.fallback ? <LiveBadge state="soon" label="CACHED" size="xs" pulse={false} /> : <LiveBadge state={s.active ? 'live' : 'fresh'} label={s.active ? 'LIVE FEED' : 'SYNCED'} size="xs" />}
              <SyncedAgo at={data.at} label="updated" />
            </p>
          </div>
        </div>
        <a href={p.url} target="_blank" rel="noopener noreferrer me" className="mz-gh-follow">
          Follow on GitHub <ArrowRight size={14} aria-hidden="true" />
        </a>
      </header>

      {intro && <p className="mz-gh-intro">{intro}</p>}

      {/* the numbers: repos, stars, followers, last push */}
      <ul className="mz-gh-stats">
        <li><Github size={16} aria-hidden="true" /><b>{formatCount(s.repos || p.repos)}</b><span>repositories</span></li>
        <li><Star size={16} aria-hidden="true" /><b>{formatCount(s.stars)}</b><span>stars</span></li>
        <li><GitFork size={16} aria-hidden="true" /><b>{formatCount(s.forks)}</b><span>forks</span></li>
        <li><Users size={16} aria-hidden="true" /><b>{formatCount(s.followers)}</b><span>followers</span></li>
        <li className="mz-gh-stats-wide">
          <GitCommitHorizontal size={16} aria-hidden="true" />
          <b>{lastPush.text}</b>
          <span>last push{s.topLanguage ? ` · ${s.topLanguage}` : ''}</span>
        </li>
      </ul>

      {/* the language mix */}
      {langs.length > 0 && (
        <div className="mz-gh-langs" aria-label="Languages">
          <span className="mz-gh-langs-bar" aria-hidden="true">
            {langs.map((l) => <i key={l.name} style={{ width: `${Math.max(2, l.pct)}%`, background: l.color || langColor(l.name) }} title={`${l.name} ${l.pct}%`} />)}
          </span>
          <ul className="mz-gh-langs-list">
            {langs.map((l) => (
              <li key={l.name}><i style={{ background: l.color || langColor(l.name) }} aria-hidden="true" />{l.name} <b>{l.pct}%</b></li>
            ))}
          </ul>
        </div>
      )}

      {/* the repositories */}
      <ul className={`mz-gh-repos${compact ? ' is-compact' : ''}`}>
        {repos.map((r) => {
          const badges = githubBadges(r, now);
          const ago = timeAgo(r.pushedMs, now);
          return (
            <li key={r.name} className="mz-gh-repo">
              <div className="mz-gh-repo-top">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="mz-gh-repo-name">
                  <Code2 size={12} aria-hidden="true" /> {r.name}
                </a>
                <span className="mz-gh-repo-badges">
                  {badges.map((b) => <LiveBadge key={b.label} state={b.state} label={b.label} size="xs" pulse={b.state === 'live'} />)}
                </span>
              </div>
              {r.description && <p className="mz-gh-repo-desc">{r.description}</p>}
              <p className="mz-gh-repo-meta">
                {r.language && <span className="mz-gh-lang"><i style={{ background: langColor(r.language) }} aria-hidden="true" />{r.language}</span>}
                <span><Star size={11} aria-hidden="true" /> {formatCount(r.stars)}</span>
                <span><GitFork size={11} aria-hidden="true" /> {formatCount(r.forks)}</span>
                <span className={`mz-gh-ago is-${ago.tone}`}>{ago.text}</span>
                {r.homepage && <a href={r.homepage} target="_blank" rel="noopener noreferrer" className="mz-gh-demo">Demo <ExternalLink size={10} aria-hidden="true" /></a>}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mz-gh-foot">
        <a href={p.url} target="_blank" rel="noopener noreferrer me">github.com/{p.login}</a>
        <span aria-hidden="true"> · </span>
        <a href="/api/github" rel="nofollow">JSON</a>
        {data.fallback ? <span className="mz-gh-offline"> GitHub se abhi jawab nahi mila; ye list code se hai.</span> : null}
      </p>
    </section>
  );
}
