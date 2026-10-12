import { SITE } from '@/lib/config';
import Marquee from './Marquee';
import { seasonFor } from '@/lib/season';

// Moving offer ticker above the header (like a market's loudspeaker).
export default function AnnouncementBar() {
  const season = seasonFor();
  const items = [...new Set([season && season.ticker, SITE.announcement, 'Free delivery offers on selected items', 'New products added every week', 'Shop smart. Shop halal.', 'WhatsApp support when you need help'].filter(Boolean))];
  return (
    <div className="bg-[#073D28] text-xs font-semibold text-white sm:text-sm">
      <Marquee seconds={45} label="Offers">
        {items.map((t) => <span key={t} className="whitespace-nowrap px-8 py-1.5">{t}<span className="ml-8 text-saffron" aria-hidden="true">●</span></span>)}
      </Marquee>
    </div>
  );
}
