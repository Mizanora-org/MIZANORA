'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

// Search box of the tools hub: filters the full list in the browser (no server call).
export default function ToolSearch({ tools }) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => {
    const w = q.toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/).filter((x) => x.length >= 2);
    if (!w.length) return [];
    return tools.filter((t) => w.every((x) => `${t.title} ${t.short} ${t.kw}`.toLowerCase().includes(x))).slice(0, 12);
  }, [q, tools]);
  return (
    <div className="relative">
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
      <input className="input !pl-11" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools: zakat, marla, linux, json, discount..." aria-label="Search tools" />
      {q.trim().length >= 2 && (
        <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
          {hits.map((t) => <li key={t.slug}><Link href={`/tools/${t.slug}`} className="block p-3 hover:bg-raised"><b>{t.title}</b><span className="block text-xs text-dim">{t.short}</span></Link></li>)}
          {!hits.length && <li className="p-3 text-sm text-dim">No tool found for this word.</li>}
        </ul>
      )}
    </div>
  );
}
