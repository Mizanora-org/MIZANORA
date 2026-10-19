// Islamic (Hijri) date from the browser/Node calendar (Umm al-Qura). Pakistan usually sights the moon a day after Saudi Arabia,
// so the default is -1 day. Change it with NEXT_PUBLIC_HIJRI_OFFSET in Vercel (for example 0 or -2) if the date shown is off.
const OFFSET = Number(process.env.NEXT_PUBLIC_HIJRI_OFFSET ?? -1) || 0;

export const HIJRI_MONTHS = [
  ['Muharram', 'مُحَرَّم'], ['Safar', 'صَفَر'], ["Rabi' ul Awwal", 'رَبِيع الأَوَّل'], ["Rabi' ul Thani", 'رَبِيع الثَّانِي'],
  ['Jumada ul Awwal', 'جُمَادَىٰ الأُولَىٰ'], ['Jumada ul Thani', 'جُمَادَىٰ الآخِرَة'], ['Rajab', 'رَجَب'], ["Sha'ban", 'شَعْبَان'],
  ['Ramadan', 'رَمَضَان'], ['Shawwal', 'شَوَّال'], ["Dhul Qa'dah", 'ذُو القَعْدَة'], ['Dhul Hijjah', 'ذُو الحِجَّة'],
];

export function hijriNow(now = new Date()) {
  try {
    const d = new Date(now.getTime() + OFFSET * 86400000);
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
    const get = (t) => Number((parts.find((p) => p.type === t) || {}).value);
    const day = get('day'), month = get('month'), year = get('year');
    if (!day || !month || !year) return null;
    const [en, ar] = HIJRI_MONTHS[month - 1];
    return { day, month, year, en, ar, text: `${day} ${en} ${year} AH` };
  } catch { return null; }
}

export function isFridayKarachi(now = new Date()) {
  try { return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'short' }).format(now) === 'Fri'; } catch { return false; }
}

// Islamic occasions by Hijri date. The date follows the Umm al-Qura calendar with the Pakistan offset above, so it can be a day off
// from the moon sighting in Pakistan: the shop always says "approximately".
const EVENTS = [
  { m: 1, d: 1, en: 'Islamic New Year', ur: 'Naya Islami saal (1 Muharram)' },
  { m: 1, d: 10, en: 'Ashura', ur: 'Youm-e-Ashura (10 Muharram)' },
  { m: 3, d: 12, en: 'Eid Milad-un-Nabi', ur: 'Eid Milad-un-Nabi (12 Rabi ul Awwal)' },
  { m: 7, d: 27, en: "Shab-e-Mi'raj", ur: "Shab-e-Mi'raj (27 Rajab)" },
  { m: 8, d: 15, en: 'Shab-e-Barat', ur: "Shab-e-Barat (15 Sha'ban)" },
  { m: 9, d: 1, en: 'Ramadan begins', ur: 'Ramzan shuru (1 Ramzan)' },
  { m: 10, d: 1, en: 'Eid ul Fitr', ur: 'Eid ul Fitr (1 Shawwal)' },
  { m: 12, d: 9, en: 'Day of Arafah', ur: 'Youm-e-Arafah (9 Dhul Hijjah)' },
  { m: 12, d: 10, en: 'Eid ul Adha', ur: 'Eid ul Adha (10 Dhul Hijjah)' },
];
export function nextIslamicEvent(now = new Date(), maxDays = 400) {
  try {
    const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'numeric' });
    for (let i = 0; i <= maxDays; i++) {
      const parts = f.formatToParts(new Date(now.getTime() + (OFFSET + i) * 86400000));
      const day = Number((parts.find((p) => p.type === 'day') || {}).value), month = Number((parts.find((p) => p.type === 'month') || {}).value);
      const ev = EVENTS.find((e) => e.m === month && e.d === day);
      if (ev) return { ...ev, inDays: i };
    }
  } catch { /* old browser: no countdown */ }
  return null;
}
