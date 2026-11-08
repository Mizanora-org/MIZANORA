import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import Stars from '@/components/Stars';
import { getRecentReviews } from '@/lib/reviews';
import { summarize } from '@/lib/reviewStats';

export const revalidate = 3600;
export const metadata = pageMeta({ title: 'Customer reviews of Mizanora', description: 'Real reviews written by Mizanora customers, checked by us before they are shown. How we keep reviews honest and how to spot fake ones.', path: '/reviews' });

export default async function ReviewsPage() {
  const list = await getRecentReviews();
  const s = summarize(list);
  return (
    <>
      <PageHead title="Customer reviews" intro="Sirf asli customers ke reviews. Har review hum parhte hain, tab dikhta hai." crumbs={[['/', 'Home'], [null, 'Reviews']]} />
      <section className="mx-auto max-w-3xl px-4 py-6">
        {s.count > 0 ? (
          <div className="mb-6 flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3"><span className="text-4xl font-extrabold">{s.avg.toFixed(1)}</span><div><Stars value={s.avg} size={20} /><p className="text-sm text-dim">{s.count} approved review{s.count > 1 ? 's' : ''}</p></div></div>
            <div className="min-w-[10rem] flex-1 space-y-1">{[5, 4, 3, 2, 1].map((n) => <div key={n} className="flex items-center gap-2 text-xs text-dim"><span className="w-3">{n}</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-saffron" style={{ width: `${s.pct[n - 1]}%` }} /></span><span className="w-8 text-right">{s.pct[n - 1]}%</span></div>)}</div>
          </div>
        ) : <p className="mb-6 rounded-2xl bg-raised p-4 text-dim">Abhi koi review nahi hai. Koi product kharidein aur uske page par apna asli tajurba likhein.</p>}
        <ul className="space-y-3">
          {list.slice(0, 60).map((r) => (
            <li key={r.id} className="card !p-4">
              <div className="flex items-center justify-between gap-2"><b>{r.name}</b><Stars value={r.rating} /></div>
              <p className="mt-1 text-sm text-dim">{r.text}</p>
              {r.productName && <p className="mt-1 text-xs text-dim/80">Product: <span className="font-semibold">{r.productName}</span></p>}
            </li>
          ))}
        </ul>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="card"><h2 className="font-display text-lg font-extrabold">Hum reviews ko sacha kaise rakhte hain</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-dim"><li>Sirf login kiya hua customer review likh sakta hai.</li><li>Ek product par ek account se ek hi review.</li><li>Har review pehle &quot;pending&quot; hota hai; hum parh kar approve karte hain.</li><li>Link, phone number, copy-paste aur spam wale reviews nahi chhapte.</li><li>Hum khud apne reviews nahi banate aur na khareedte hain.</li></ul></div>
          <div className="card"><h2 className="font-display text-lg font-extrabold">Kisi bhi shop par fake review kaise pehchanein</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-dim"><li>Sab reviews ek jaise alfaaz mein aur 5 star hon.</li><li>Product ki tafseel nahi, sirf &quot;best, super&quot; likha ho.</li><li>Ek hi din mein bohat saare reviews.</li><li>Photo ya asli tajurba ka zikr na ho (size, rang, delivery).</li><li>Kam rating wale reviews bilkul na hon: asli shop par kuch na kuch shikayat hoti hai.</li></ul></div>
        </div>
      </section>
    </>
  );
}
