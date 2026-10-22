import { SITE } from '@/lib/config';

// Shown to visitors while the website is shut down. No Firebase, no images, nothing that can fail.
export default function Maintenance({ reason, backAt }) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#0B6B45] px-5 py-10 text-center text-white">
      <meta name="robots" content="noindex" />
      <div className="mx-auto max-w-md">
        <p className="text-5xl" aria-hidden="true">🛠️</p>
        <h1 className="mt-3 text-3xl font-extrabold">{SITE.name} is closed for a short time</h1>
        {reason ? <p className="mt-4 rounded-2xl bg-white/10 p-4 text-base leading-relaxed">{reason}</p> : <p className="mt-4 text-white/85">We are doing some important work on the shop.</p>}
        {backAt && <p className="mt-4 text-sm font-semibold text-[#F5B83D]">We expect to be back: {backAt}</p>}
        <p className="mt-6 text-sm text-white/80">Your orders already placed are safe. Questions? Message us on WhatsApp.</p>
        <a className="mt-3 inline-block rounded-full bg-white px-6 py-3 font-bold text-[#0B6B45]" href={`https://wa.me/${SITE.whatsapp}`} rel="noopener noreferrer">WhatsApp support</a>
      </div>
    </main>
  );
}
