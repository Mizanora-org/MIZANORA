'use client';
import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { dbClient } from '@/lib/firebase-client';
import { formatDate } from '@/lib/format';
import { revalidateSite } from '@/lib/admin-cache';
import Stars from '@/components/Stars';

export default function AdminReviews() {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const snap = await getDocs(collection(dbClient(), 'reviews'));
    setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)));
  }, []);
  useEffect(() => { load().catch((e) => { setList([]); setErr(e.message); }); }, [load]);
  // Update the list in memory (no full re-read) and refresh that product's public page.
  const setApproved = (r, approved) => updateDoc(doc(dbClient(), 'reviews', r.id), { approved })
    .then(() => { setList((cur) => cur.map((x) => (x.id === r.id ? { ...x, approved } : x))); return revalidateSite(r.productId); })
    .catch((e) => setErr(e.message));
  const removeReview = (r) => deleteDoc(doc(dbClient(), 'reviews', r.id))
    .then(() => { setList((cur) => cur.filter((x) => x.id !== r.id)); return revalidateSite(r.productId); })
    .catch((e) => setErr(e.message));
  if (!list) return <p className="text-dim">Loading...</p>;
  return (
    <div>
      <h1 className="mb-4 text-3xl font-extrabold">Reviews <span className="text-lg text-faint">({list.filter((r) => !r.approved).length} waiting)</span></h1>
      {err && <p className="mb-3 text-sm text-red-700">{err}</p>}
      {list.length === 0 && <p className="card text-center text-dim">No reviews yet.</p>}
      <ul className="space-y-3">
        {list.map((r) => (
          <li key={r.id} className="card !p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">{r.productName || r.productId}</span><Stars value={r.rating} /></div>
            <p className="mt-1 text-sm text-dim">{r.name} · {formatDate(r.createdAtMs)} · {r.approved ? <b className="text-gold">Published</b> : <b className="text-saffron">Waiting</b>}</p>
            <p className="mt-2 text-sm">{r.text}</p>
            <div className="mt-3 flex gap-3 text-sm font-semibold">
              {!r.approved && <button className="text-gold" onClick={() => setApproved(r, true)}>Approve</button>}
              {r.approved && <button className="text-dim" onClick={() => setApproved(r, false)}>Unpublish</button>}
              <button className="text-red-700" onClick={() => { if (confirm('Delete this review?')) removeReview(r); }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
