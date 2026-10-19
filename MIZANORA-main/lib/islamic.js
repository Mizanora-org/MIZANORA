// ISLAMIC FEED CONTENT (home page). Short, well-known texts with their reference: Arabic, Roman Urdu meaning, source.
// Only add a text when you are sure of its wording and source, and ask a scholar (aalim) to check anything new.
// kind: 'ayat' (Quran) | 'hadith' | 'qaul' (a saying of a Sahabi / scholar) | 'dua'.  winter: true = shown first in the cold months.
export const ISLAMIC_ITEMS = [
  // ---- Quran
  { id: 'q1', kind: 'ayat', ar: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', ur: 'Khabardar! Allah ke zikr se hi dilon ko itminan milta hai.', ref: "Surah Ar-Ra'd 13:28" },
  { id: 'q2', kind: 'ayat', ar: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا', ur: 'Allah kisi jaan par uski taqat se zyada bojh nahi dalta.', ref: 'Surah Al-Baqarah 2:286' },
  { id: 'q3', kind: 'ayat', ar: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا', ur: 'Aur jo Allah se darta hai, Allah uske liye (mushkil se) nikalne ka raasta bana deta hai.', ref: 'Surah At-Talaq 65:2' },
  { id: 'q4', kind: 'ayat', ar: 'إِنَّ اللَّهَ يُحِبُّ الْمُحْسِنِينَ', ur: 'Beshak Allah ehsaan karne walon se mohabbat karta hai.', ref: 'Surah Al-Baqarah 2:195' },
  { id: 'q5', kind: 'ayat', ar: 'وَيْلٌ لِّلْمُطَفِّفِينَ', ur: 'Naap tol mein kami karne walon ke liye barbadi hai. (Dukaan aur tijarat mein imandari ka hukm.)', ref: 'Surah Al-Mutaffifin 83:1' },
  { id: 'q6', kind: 'ayat', ar: 'وَأَوْفُوا الْكَيْلَ إِذَا كِلْتُمْ وَزِنُوا بِالْقِسْطَاسِ الْمُسْتَقِيمِ', ur: 'Aur jab naapo to pura naapo, aur sahi taraazu se toolo.', ref: 'Surah Al-Isra 17:35' },
  { id: 'q7', kind: 'ayat', ar: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ', ur: 'Pas tum (jinn o insan) apne Rab ki kaun kaun si nematon ko jhutlaoge?', ref: 'Surah Ar-Rahman 55:13' },
  { id: 'q8', kind: 'ayat', ar: 'وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ', ur: 'Himmat na haro aur gham na karo, agar tum momin ho to tum hi ghalib rahoge.', ref: "Surah Aal-e-Imran 3:139" },
  { id: 'q9', kind: 'ayat', ar: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي', ur: 'Aye mere Rab! mera seena khol de aur mera kaam aasan kar de.', ref: 'Surah Ta-Ha 20:25-26' },
  { id: 'q10', kind: 'ayat', ar: 'إِنَّمَا يُوَفَّى الصَّابِرُونَ أَجْرَهُم بِغَيْرِ حِسَابٍ', ur: 'Sabr karne walon ko unka ajar bepanah diya jayega.', ref: 'Surah Az-Zumar 39:10' },
  { id: 'q11', kind: 'ayat', ar: 'ادْفَعْ بِالَّتِي هِيَ أَحْسَنُ', ur: '(Burai ko) us tareeqe se door karo jo sab se behtar ho.', ref: 'Surah Fussilat 41:34' },
  // ---- Hadith
  { id: 'h1', kind: 'hadith', ar: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ', ur: 'Aamaal ka daromadar niyyaton par hai.', ref: 'Sahih Bukhari 1, Sahih Muslim 1907' },
  { id: 'h2', kind: 'hadith', ar: 'التَّاجِرُ الصَّدُوقُ الْأَمِينُ مَعَ النَّبِيِّينَ وَالصِّدِّيقِينَ وَالشُّهَدَاءِ', ur: 'Sacha aur amanatdar tajir (qayamat ke din) nabiyon, siddiqeen aur shuhada ke saath hoga.', ref: "Jami' at-Tirmidhi 1209" },
  { id: 'h3', kind: 'hadith', ar: 'مَنْ غَشَّنَا فَلَيْسَ مِنَّا', ur: 'Jis ne humein dhoka diya, wo hum mein se nahi.', ref: 'Sahih Muslim 101' },
  { id: 'h4', kind: 'hadith', ar: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ', ur: 'Apne bhai ke samne tumhara muskurana tumhare liye sadaqa hai.', ref: "Jami' at-Tirmidhi 1956" },
  { id: 'h5', kind: 'hadith', ar: 'الطُّهُورُ شَطْرُ الْإِيمَانِ', ur: 'Paaki aur safai imaan ka hissa (aadha) hai.', ref: 'Sahih Muslim 223' },
  { id: 'h6', kind: 'hadith', ar: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ', ur: 'Tum mein behtareen wo hai jo Quran seekhe aur doosron ko sikhaye.', ref: 'Sahih Bukhari 5027' },
  { id: 'h7', kind: 'hadith', ar: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ', ur: 'Tum mein se koi (kaamil) momin nahi hota jab tak apne bhai ke liye wahi pasand na kare jo apne liye pasand karta hai.', ref: 'Sahih Bukhari 13, Sahih Muslim 45' },
  { id: 'h8', kind: 'hadith', ar: 'رَحِمَ اللَّهُ رَجُلًا سَمْحًا إِذَا بَاعَ وَإِذَا اشْتَرَى وَإِذَا اقْتَضَى', ur: 'Allah us shakhs par reham farmaye jo bechte, kharidte aur apna haq maangte waqt narm raho.', ref: 'Sahih Bukhari 2076' },
  { id: 'h9', kind: 'hadith', ar: 'الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ', ur: 'Muslim wo hai jis ki zabaan aur haath se doosre musalman mehfooz rahein.', ref: 'Sahih Bukhari 10, Sahih Muslim 40' },
  { id: 'h10', kind: 'hadith', ar: 'الدِّينُ النَّصِيحَةُ', ur: 'Deen khair-khwahi (naseehat) ka naam hai.', ref: 'Sahih Muslim 55' },
  { id: 'h11', kind: 'hadith', ar: 'فَإِنْ صَدَقَا وَبَيَّنَا بُورِكَ لَهُمَا فِي بَيْعِهِمَا', ur: 'Agar bechne aur kharidne wala dono sach bolen aur (cheez ka aib) wazeh kar den to unki khareed-o-farokht mein barkat di jati hai.', ref: 'Sahih Bukhari 2079, Sahih Muslim 1532' },
  { id: 'h12', kind: 'hadith', winter: true, ar: 'إِسْبَاغُ الْوُضُوءِ عَلَى الْمَكَارِهِ', ur: 'Na-gawari (jaise sakht sardi) mein bhi achi tarah wudu karna, gunahon ke mitne aur darajaat ki buland-i ka sabab hai.', ref: 'Sahih Muslim 251' },
  // ---- Duas and sayings
  { id: 'd1', kind: 'dua', ar: 'بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', ur: 'Allah ke naam se, maine Allah par bharosa kiya; gunah se bachne aur neki ki taqat sirf Allah hi ki taraf se hai. (Ghar se nikalte waqt ki dua.)', ref: 'Sunan Abi Dawud 5095' },
  { id: 'd2', kind: 'dua', ar: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ', ur: 'Aye Allah! mujhe halal rizq de kar haram se bacha le, aur apne fazl se apne siwa sab se beniyaz kar de.', ref: "Jami' at-Tirmidhi 3563" },
  { id: 's1', kind: 'qaul', ar: 'حَاسِبُوا أَنْفُسَكُمْ قَبْلَ أَنْ تُحَاسَبُوا', ur: 'Apna hisab khud kar lo, us se pehle ke tumhara hisab liya jaye.', ref: "Qaul-e-Hazrat Umar (RA), Jami' at-Tirmidhi mein naqal" },
];

export const KIND_LABEL = { ayat: 'Ayat', hadith: 'Hadees', qaul: 'Qaul', dua: 'Dua' };
export const KIND_COLOR = { ayat: 'bg-emerald-600', hadith: 'bg-amber-600', qaul: 'bg-sky-700', dua: 'bg-violet-700' };

// A clean, safe item from anything (used for posts the admin adds): drops empty / oversized / markup-like text.
export function cleanFeedItem(x = {}) {
  const s = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  const kind = ['ayat', 'hadith', 'qaul', 'dua'].includes(x.kind) ? x.kind : 'qaul';
  const out = { id: s(x.id, 40) || `x${Date.now().toString(36)}`, kind, ar: s(x.ar, 400), ur: s(x.ur, 500), ref: s(x.ref, 160) };
  if (!out.ur || !out.ref) return null; // a text without its meaning or without its reference is not published
  return out;
}
