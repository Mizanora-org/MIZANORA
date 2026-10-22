'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { dbClient } from '@/lib/firebase-client';

export default function AdminSearches() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    getDocs(collection(dbClient(), 'searchLogs')).then((s) => setRows(s.docs.map((d) => d.data()))).catch((e) => { setRows([]); setErr(e.code === 'permission-denied' ? 'Publish the updated firestore.rules first (it adds the searchLogs section).' : e.message); });
  }, []);
  if (!rows) return <p className="text-dim">Loading...</p>;
  const missed = rows.filter((r) => (r.missed || 0) > 0).sort((a, b) => (b.missed || 0) - (a.missed || 0)).slice(0, 30);
  const top = [...rows].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 30);
  const List = ({ data, key2, tone }) => (
    <ul className="space-y-1.5">{data.map((r) => <li key={r.q} className="flex items-center justify-between rounded-xl bg-raised px-3 py-2 text-sm"><span className="min-w-0 truncate font-semibold">{r.q}</span><span className={`ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${tone}`}>{r[key2] || 0}</span></li>)}</ul>
  );
  return (
    <div className="min-w-0">
      <h1 className="mb-1 text-3xl font-extrabold">What shoppers search</h1>
      <p className="mb-5 text-sm text-dim">Words people typed or spoke. Searches with no result show what to add to your shop next.</p>
      {err && <p className="mb-3 text-sm text-red-700">{err}</p>}
      {rows.length === 0 && !err && <p className="card text-center text-dim">No searches recorded yet.</p>}
      <div className="grid gap-6 md:grid-cols-2">
        <section><h2 className="mb-2 text-xl font-bold text-red-700">Not found (add these products)</h2>{missed.length ? <List data={missed} key2="missed" tone="bg-red-100 text-red-700" /> : <p className="text-sm text-dim">Nothing missed.</p>}</section>
        <section><h2 className="mb-2 text-xl font-bold text-gold">Most searched</h2><List data={top} key2="count" tone="bg-gold/10 text-gold" /></section>
      </div>
    </div>
  );
}
