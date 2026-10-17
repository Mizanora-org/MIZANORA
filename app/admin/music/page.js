'use client';
import Link from 'next/link';
import { Info, Music4, Video } from 'lucide-react';
import { AppMusicCard, ReelsMusicCard } from '@/components/MusicCards';

// Admin > Music: one place for every sound the shop plays.
//
//  * "App background music"  -> plays across the whole app (home, products, cart, blog, ...)
//  * "Reels background music" -> plays behind the reels that have no sound of their own
//
// The admin only has to paste a DIRECT audio link. Cloudinary (free), any CDN or the shop's own
// hosting all work. A Google Drive or Dropbox share link is converted automatically when possible.
export default function AdminMusic() {
  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Music4 className="text-gold" /> Music</h1>
        <Link href="/admin/reels" className="btn-ghost !px-4 !py-2 text-sm"><Video size={16} /> Reels</Link>
      </div>

      <div className="mb-6 rounded-2xl border border-line bg-raised p-4 text-sm text-dim">
        <p className="flex items-start gap-2"><Info size={16} className="mt-0.5 shrink-0 text-gold" />
          <span>
            <b className="text-cream">How to get a link:</b> upload the audio to Cloudinary (free, no card needed), or to any
            hosting that gives a direct file link. The link must end with <b className="text-cream">.mp3</b>, <b className="text-cream">.m4a</b>,
            {' '}<b className="text-cream">.ogg</b> or <b className="text-cream">.wav</b>. Use <b className="text-cream">Test play</b> before saving.
          </span>
        </p>
        <p className="mt-2 flex items-start gap-2"><Info size={16} className="mt-0.5 shrink-0 text-gold" />
          <span>Browsers never play sound before the first tap, so the music starts as soon as the shopper touches the screen.
            Every shopper can switch it off with the music button in the header (their choice is remembered on their phone).</span>
        </p>
      </div>

      <AppMusicCard />
      <ReelsMusicCard />
    </div>
  );
}
