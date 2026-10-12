// Short, well-known verses shown as a "daily reminder" (one per day). Arabic text, Roman Urdu meaning, and the reference.
export const REMINDERS = [
  { ar: 'فَاذْكُرُونِي أَذْكُرْكُمْ', ur: 'Pas tum mujhe yaad karo, main tumhein yaad karunga.', ref: 'Surah Al-Baqarah 2:152' },
  { ar: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', ur: 'Beshak mushkil ke saath aasani hai.', ref: 'Surah Ash-Sharh 94:6' },
  { ar: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', ur: 'Humein Allah kaafi hai, aur woh behtareen kaarsaaz hai.', ref: 'Surah Aal-e-Imran 3:173' },
  { ar: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', ur: 'Aur jo Allah par bharosa kare, to woh usay kaafi hai.', ref: 'Surah At-Talaq 65:3' },
  { ar: 'رَّبِّ زِدْنِي عِلْمًا', ur: 'Aye mere Rab! mere ilm mein izafa farma.', ref: 'Surah Ta-Ha 20:114' },
  { ar: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ', ur: 'Agar tum shukr karoge to main tumhein zaroor aur ziyada dunga.', ref: 'Surah Ibrahim 14:7' },
  { ar: 'وَأَحَلَّ اللَّهُ الْبَيْعَ', ur: 'Aur Allah ne tijarat (kharid-farokht) ko halal kiya hai.', ref: 'Surah Al-Baqarah 2:275' },
  { ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', ur: 'Aye hamare Rab! hamein dunya mein bhi bhalai de, aakhirat mein bhi bhalai de, aur hamein aag ke azab se bacha.', ref: 'Surah Al-Baqarah 2:201' },
];

export function reminderOfTheDay(now = new Date()) {
  const day = Math.floor((now.getTime() + 5 * 3600000) / 86400000); // day number in Pakistan time
  return REMINDERS[day % REMINDERS.length];
}
