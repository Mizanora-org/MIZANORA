'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Clock, Globe2 } from 'lucide-react';

// v37: the news desk. Same guides as the blog, shown the way a newsroom would: newest first,
// one tab per beat, and the date on every line - because news without a date is not news.

const TABS = [['all', 'Everything'], ['world-news', 'World'], ['science', 'Science'], ['technology', 'Technology']];

export default function NewsDesk({ posts = [], labels = {} }) {
  const [tab, setTab] = useState('all');
  const list = tab === 'all' ? posts : posts.filter((p) => p.category === tab);
  const [lead, ...rest] = list;

  if (!posts.length) return <p className="rounded-2xl border border-line bg-surface p-6 text-dim">No dispatches yet.</p>;

  return (
    <>
      <nav aria-label="News sections" className="mb-5 flex flex-wrap gap-2">
        {TABS.map(([id, label]) => {
          const count = id === 'all' ? posts.length : posts.filter((p) => p.category === id).length;
          if (!count && id !== 'all') return null;
          return (
            <button key={id} type="button" onClick={() => setTab(id)} className={`mz-chip${tab === id ? ' is-on' : ''}`}>
              {label} <i>{count}</i>
            </button>
          );
        })}
      </nav>

      {lead && (
        <article className="mb-6 overflow-hidden rounded-3xl border border-line bg-surface">
          {lead.image ? (
            <Link href={`/blog/${lead.slug}`} className="block" tabIndex={-1} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lead.image} alt="" className="h-52 w-full object-cover sm:h-72" />
            </Link>
          ) : null}
          <div className="p-5 sm:p-7">
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <span className="mz-tag">{labels[lead.category] || lead.category}</span>
              <span className="flex items-center gap-1 text-faint"><Clock size={11} /> {lead.date}</span>
              <span className="text-faint">· {lead.mins} min read</span>
            </p>
            <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
              <Link href={`/blog/${lead.slug}`}>{lead.title}</Link>
            </h2>
            <p className="mt-2 max-w-2xl text-dim">{lead.description}</p>
            <Link href={`/blog/${lead.slug}`} className="mt-3 inline-block font-semibold text-gold underline underline-offset-4">Read the dispatch</Link>
          </div>
        </article>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((p) => (
          <li key={p.slug} className="card flex flex-col">
            <p className="flex items-center gap-2 text-xs">
              <span className="mz-tag">{labels[p.category] || p.category}</span>
              <span className="text-faint">{p.date}</span>
            </p>
            <h3 className="mt-2 text-lg font-bold leading-snug"><Link href={`/blog/${p.slug}`}>{p.title}</Link></h3>
            <p className="mt-1 flex-1 text-sm text-dim">{p.description}</p>
            <Link href={`/blog/${p.slug}`} className="mt-2 text-sm font-semibold text-gold">Read →</Link>
          </li>
        ))}
      </ul>

      {list.length === 0 && (
        <p className="rounded-2xl border border-line bg-surface p-6 text-dim">Nothing in this section yet.</p>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-faint">
        <Globe2 size={13} /> Every dispatch is written for Pakistani readers: what happened, and what it changes here.
      </p>
    </>
  );
}
