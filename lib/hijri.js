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
