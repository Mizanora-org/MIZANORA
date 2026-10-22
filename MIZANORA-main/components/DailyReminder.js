import { reminderOfTheDay } from '@/lib/reminders';
import Ornament from './Ornament';

// One short verse per day, shown on the home page.
export default function DailyReminder() {
  const r = reminderOfTheDay();
  return (
    <section className="mx-auto max-w-3xl px-4 pt-14" aria-labelledby="daily">
      <div className="relative overflow-hidden rounded-t-[7rem] rounded-b-3xl border border-gold/25 bg-gradient-to-b from-[#F4F8F1] to-white px-6 pb-8 pt-10 text-center shadow-[0_10px_40px_-18px_rgba(11,107,69,.5)]">
        <h2 id="daily" className="text-xs font-bold uppercase tracking-[0.25em] text-gold">Aaj ki yaad-dehani</h2>
        <Ornament className="mt-3" />
        <p lang="ar" dir="rtl" className="font-arabic mt-4 text-3xl leading-[2.1] text-cream sm:text-4xl">{r.ar}</p>
        <p className="mx-auto mt-2 max-w-xl text-base text-dim">{r.ur}</p>
        <p className="mt-2 text-xs font-semibold text-faint">{r.ref}</p>
      </div>
    </section>
  );
}
