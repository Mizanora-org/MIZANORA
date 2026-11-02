'use client';
import { useMemo, useState } from 'react';
import { Clock, Search, Tv } from 'lucide-react';

// Public TV guide — channel rows + aage ke programmes. Server se sirf text aata hai (koi URL nahi).
const hhmm = (ms) => new Date(Number(ms) || 0).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function IptvGuideGrid({ rows = [], groups = [] }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => (group === 'all' || (r.group || 'Other') === group)
      && (!term || String(r.name).toLowerCase().includes(term)));
  }, [rows, q, group]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Channel search…" />
        </div>
        <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="all">All groups ({rows.length})</option>
          {groups.map((g) => <option key={g.name} value={g.name}>{g.name} ({g.count})</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-raised text-[10px] uppercase tracking-wider text-faint">
            <tr><th className="px-3 py-2">Channel</th><th className="px-3 py-2">Abhi</th><th className="px-3 py-2">Aage</th></tr>
          </thead>
          <tbody>
            {list.slice(0, 200).map((r) => (
              <tr key={r.id} className="border-t border-line/60">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-raised">
                      {r.logo ? <img src={r.logo} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Tv size={12} className="text-faint" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-cream">{r.name}</p>
                      <p className="truncate text-[10px] text-faint">{r.group}{r.archive ? <span className="ml-1 rounded bg-gold/15 px-1 font-bold text-gold">{r.archive}d</span> : null}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <p className="max-w-[16rem] truncate text-xs text-cream">{r.now || '—'}</p>
                  {r.nowStop ? <p className="text-[10px] text-faint">till {hhmm(r.nowStop)}</p> : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(r.items || []).slice(0, 4).map((p, i) => (
                      <span key={`${p.start}-${i}`} className="flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-dim">
                        <Clock size={9} className="text-faint" /> {hhmm(p.start)} {String(p.title || '').slice(0, 26)}
                      </span>
                    ))}
                    {!(r.items || []).length && <span className="text-[11px] text-faint">—</span>}
                  </div>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-faint">Kuch nahi mila.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-faint">Guide har 10 minute refresh hoti hai. Apps ke liye: <code>/xmltv.php?username=…&amp;password=…</code></p>
    </div>
  );
}
