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
  // ---- v23: more ayat
  { id: 'q12', kind: 'ayat', ar: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا إِنَّ مَعَ الْعُسْرِ يُسْرًا', ur: 'Yaqeenan har mushkil ke saath aasani hai, beshak mushkil ke saath aasani hai.', ref: 'Surah Ash-Sharh 94:5-6' },
  { id: 'q13', kind: 'ayat', ar: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ', ur: 'Aur qareeb hai ke tumhara Rab tumhein itna dega ke tum raazi ho jaoge.', ref: 'Surah Ad-Duha 93:5' },
  { id: 'q14', kind: 'ayat', ar: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', ur: 'Beshak Allah sabr karne walon ke saath hai.', ref: 'Surah Al-Baqarah 2:153' },
  { id: 'q15', kind: 'ayat', ar: 'فَاذْكُرُونِي أَذْكُرْكُمْ', ur: 'Pas tum mujhe yaad karo, main tumhein yaad rakhunga.', ref: 'Surah Al-Baqarah 2:152' },
  { id: 'q16', kind: 'ayat', ar: 'وَقُل رَّبِّ زِدْنِي عِلْمًا', ur: 'Aur kaho: aye mere Rab! mere ilm mein izafa farma.', ref: 'Surah Ta-Ha 20:114' },
  { id: 'q17', kind: 'ayat', ar: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', ur: 'Humein Allah kaafi hai aur wohi behtareen kaarsaz hai.', ref: "Surah Aal-e-Imran 3:173" },
  { id: 'q18', kind: 'ayat', ar: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', ur: 'Aur jo Allah par bharosa karta hai to Allah usay kaafi hai.', ref: 'Surah At-Talaq 65:3' },
  { id: 'q19', kind: 'ayat', ar: 'لَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا', ur: 'Gham na karo, beshak Allah hamare saath hai.', ref: 'Surah At-Tawbah 9:40' },
  { id: 'q20', kind: 'ayat', ar: 'إِنَّ الصَّلَاةَ تَنْهَىٰ عَنِ الْفَحْشَاءِ وَالْمُنكَرِ', ur: 'Beshak namaz be-hayai aur burai se rokti hai.', ref: "Surah Al-Ankabut 29:45" },
  { id: 'q21', kind: 'ayat', ar: 'وَأَحَلَّ اللَّهُ الْبَيْعَ وَحَرَّمَ الرِّبَا', ur: 'Aur Allah ne tijarat ko halal kiya aur sood ko haram kiya.', ref: 'Surah Al-Baqarah 2:275' },
  { id: 'q22', kind: 'ayat', ar: 'وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ', ur: 'Ho sakta hai tum kisi cheez ko napasand karo aur wohi tumhare liye behtar ho.', ref: 'Surah Al-Baqarah 2:216' },
  { id: 'q23', kind: 'ayat', ar: 'قُلْ هُوَ اللَّهُ أَحَدٌ', ur: 'Kaho: wohi Allah ek hai.', ref: 'Surah Al-Ikhlas 112:1' },
  // ---- v23: more hadith
  { id: 'h13', kind: 'hadith', ar: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ', ur: 'Jo ilm ki talash mein kisi raaste par chale, Allah uske liye jannat ka raasta aasan kar deta hai.', ref: 'Sahih Muslim 2699' },
  { id: 'h14', kind: 'hadith', ar: 'الْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ', ur: 'Achi baat sadaqa hai.', ref: 'Sahih Bukhari 2989, Sahih Muslim 1009' },
  { id: 'h15', kind: 'hadith', ar: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ', ur: 'Jo Allah aur aakhirat ke din par imaan rakhta hai wo achi baat kahe ya khamosh rahe.', ref: 'Sahih Bukhari 6018, Sahih Muslim 47' },
  { id: 'h16', kind: 'hadith', ar: 'لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ', ur: 'Pehalwan wo nahi jo kushti mein pachhaade, asli bahadur wo hai jo gusse ke waqt apne aap par qaabu rakhe.', ref: 'Sahih Bukhari 6114, Sahih Muslim 2609' },
  { id: 'h17', kind: 'hadith', ar: 'أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ', ur: 'Allah ko sab se pasandeeda amal wo hai jo hamesha kiya jaye, chahe thora ho.', ref: 'Sahih Bukhari 6464, Sahih Muslim 783' },
  { id: 'h18', kind: 'hadith', ar: 'إِنَّ اللَّهَ جَمِيلٌ يُحِبُّ الْجَمَالَ', ur: 'Beshak Allah khoobsurat hai aur khoobsurti ko pasand karta hai.', ref: 'Sahih Muslim 91' },
  { id: 'h19', kind: 'hadith', ar: 'مَنْ لَا يَرْحَمْ لَا يُرْحَمْ', ur: 'Jo reham nahi karta us par reham nahi kiya jata.', ref: 'Sahih Bukhari 5997, Sahih Muslim 2318' },
  { id: 'h20', kind: 'hadith', ar: 'اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا', ur: 'Jahan bhi ho Allah se daro, aur burai ke baad nekii karo wo usay mita degi.', ref: "Jami' at-Tirmidhi 1987" },
  { id: 'h21', kind: 'hadith', ar: 'مَنْ صَلَّى عَلَيَّ وَاحِدَةً صَلَّى اللَّهُ عَلَيْهِ بِهَا عَشْرًا', ur: 'Jo mujh par ek baar durood bheje Allah us par das rahmatein bhejta hai.', ref: 'Sahih Muslim 408' },
  { id: 'h22', kind: 'hadith', ar: 'إِنَّ اللَّهَ لَا يَنْظُرُ إِلَى صُوَرِكُمْ وَأَمْوَالِكُمْ وَلَكِنْ يَنْظُرُ إِلَى قُلُوبِكُمْ وَأَعْمَالِكُمْ', ur: 'Allah tumhari soorton aur maalon ko nahi dekhta, wo tumhare dilon aur amaal ko dekhta hai.', ref: 'Sahih Muslim 2564' },
  { id: 'h23', kind: 'hadith', ar: 'الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ', ur: 'Taqatwar momin Allah ke nazdeek kamzor momin se behtar aur zyada pasandeeda hai.', ref: 'Sahih Muslim 2664' },
  // ---- v23: more duas
  { id: 'd3', kind: 'dua', ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', ur: 'Aye hamare Rab! humein duniya mein bhi bhalai de aur aakhirat mein bhi bhalai de aur humein aag ke azaab se bacha.', ref: 'Surah Al-Baqarah 2:201' },
  { id: 'd4', kind: 'dua', ar: 'رَبِّ إِنِّي لِمَا أَنزَلْتَ إِلَيَّ مِنْ خَيْرٍ فَقِيرٌ', ur: 'Aye mere Rab! jo bhalai tu mere liye utare main uska muhtaaj hoon. (Rizq ki dua.)', ref: 'Surah Al-Qasas 28:24' },
  { id: 'd5', kind: 'dua', ar: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ', ur: 'Aye hamare Rab! humein hamari biviyon aur aulad se aankhon ki thandak ata farma.', ref: 'Surah Al-Furqan 25:74' },
  { id: 'd6', kind: 'dua', ar: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ', ur: 'Sab tareef Allah ke liye jis ne humein maut (neend) ke baad zinda kiya aur usi ki taraf lautna hai. (Subah uthte waqt.)', ref: 'Sahih Bukhari 6312' },
  { id: 'd7', kind: 'dua', ar: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', ur: 'Aye Allah! tere hi naam se marta (sota) hoon aur jeeta (jagta) hoon. (Sone se pehle.)', ref: 'Sahih Bukhari 6324' },
  { id: 'd8', kind: 'dua', ar: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ', ur: 'Sab tareef Allah ke liye jis ne humein khilaya, pilaya aur musalman banaya. (Khane ke baad.)', ref: 'Sunan Abi Dawud 3850' },
  { id: 'd9', kind: 'dua', ar: 'اللَّهُمَّ لَكَ الْحَمْدُ أَنْتَ كَسَوْتَنِيهِ أَسْأَلُكَ مِنْ خَيْرِهِ وَخَيْرِ مَا صُنِعَ لَهُ وَأَعُوذُ بِكَ مِنْ شَرِّهِ وَشَرِّ مَا صُنِعَ لَهُ', ur: 'Aye Allah! tere liye hi tareef hai, tu ne mujhe ye pehnaya. Main is ki bhalai aur jis maqsad ke liye bana uski bhalai maangta hoon aur is ki burai se teri panah maangta hoon. (Naya libas pehente waqt.)', ref: 'Sunan Abi Dawud 4020, Jami\' at-Tirmidhi 1767' },
  { id: 'd10', kind: 'dua', ar: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ', ur: 'Aye Allah! main fikr aur gham se teri panah maangta hoon.', ref: 'Sahih Bukhari 6369' },
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
