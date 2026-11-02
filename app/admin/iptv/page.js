import { pageMeta } from '@/lib/seo';
import AdminIptv from '@/components/AdminIptv';

export const metadata = pageMeta({
  title: 'Admin — IPTV',
  description: 'IPTV lines, trial requests and the monthly collection cycle.',
  path: '/admin/iptv',
  noindex: true,
});

export default function AdminIptvPage() {
  return (
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
      <header className="mb-4">
        <h1 className="font-display text-2xl font-extrabold">IPTV</h1>
        <p className="mt-1 text-sm text-dim">
          Trials, lines aur 1–10 ki wasooli. Prices aur cap <code className="rounded bg-raised px-1">lib/iptv.js</code> se aati hain.
        </p>
      </header>
      <AdminIptv />
    </div>
  );
}
