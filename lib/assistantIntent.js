// Conservative routing for Noor: an ordinary question must never turn into a product search just
// because it contains words found in the catalogue. Unknown requests go to the model, not the shop.
const SITE = /\b(quran|qur'an|surah|surat|ayat|ayah|tilawat|hadith|hadees|bukhari|muslim|namaz|salah|prayer|zakat|ramadan|ramzan|roza|iftar|sehri|dua|live\s*tv|live\s*channel|channel|calculator|converter|linux|delivery|shipping|returns?|refund|tracking|track|order|checkout|contact|support|asaan\s*lang|asaanlang|muaaz|مُعاذ|معاذ|آسان\s*لینگ|قرآن|حدیث|نماز|روزہ|زکوٰ?ۃ|ٹی\s*وی|founder)\b|قرآن|حدیث|نماز|روزہ|زکو|معاذ|آسان/i;
const SHOP_NOUN = /\b(shoes?|boots?|sneakers?|sandal|chappal|joot\w*|jut\w*|watch(?:es)?|ghari|ghadi|kapr\w*|clothes?|shirt|kurti|kurta|dress|suit|abaya|dupatta|perfume|mobile|phone|charger|earbuds?|cover|case|toy|khilona|bag|handbag|wallet|purse|skincare|serum|cream|makeup|laptop|headphones?|speaker|product|products|item|cheez\w*|چیز|جوت|کپڑ|گھڑی|بیگ|موبائل|سوٹ)\b|جوت|کپڑ|گھڑی|موبائل|سوٹ/i;
const SHOP_VERB = /\b(buy|purchase|shop|shopping|order|kharid\w*|khareed\w*|lena\s+hai|len[ai]|mangwana|dikha(?:o|ye|iye|na)|show\s+me|find\s+me|search\s+for|looking\s+for|chahiye|chaiye|چاہیے|خرید|منگوان|دکھا)\b|خرید|چاہیے|دکھا/i;
const PRICE = /\b(price|prices|pkr|rupees?|budget|under|below|sast\w*|mehng\w*|qeemat|qimat|keemat|rate|kitne\s+(?:ka|ke)|کتنے|قیمت|ریٹ)\b|قیمت|کتنے/i;
const QUESTION = /\?|？|\b(what|who|why|how|when|where|which|explain|tell\s+me|define|meaning|compare|difference|farq|kya|kyun|kyon|kaise|kaisay|kab|kaun|kon|kis|matlab|mausam|weather|news|joke|lateefa|story|kahani|translate|tarjuma|شکریہ|کیوں|کیا|کیسے|کب|کون)\b|کیا|کیوں|کیسے|کون|کب/i;
const GREETING = /^(?:ass?ala?m(?:\s*o\s*alaikum|u\s*alaikum)?|salam|hello|hi|hey|salaam|اسلام\s*علیکم|السلام\s*علیکم|شکریہ|thanks|thank\s+you|shukriya)[!.,\s]*$/i;
const REFERENCE = /\b(is\s+(?:ki|ka|ko|mein)|iss|isko|isse|yeh|ye|this|it|that|these|those|iska|iski|uska)\b|اس\s*(?:کی|کا|کو)/i;

export function assistantIntent(text, { hasCurrent = false, hasHistory = false } = {}) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  if (!t) return 'general';
  if (GREETING.test(t)) return 'greeting';
  const noun = SHOP_NOUN.test(t), verb = SHOP_VERB.test(t), price = PRICE.test(t);
  // Tracking and after-sales questions must go to the site, not to unrelated product cards.
  if (/\b(track|tracking|delivery|shipping|returns?|refund|order\s+status)\b/i.test(t) && !/\b(buy|purchase|kharid\w*|khareed\w*|dikha\w*)\b/i.test(t)) return 'site';
  // An explicit purchase of e.g. a Quran cover or a television is shopping, not site navigation.
  if ((noun && (verb || price)) || (verb && price && !SITE.test(t))) return 'shopping';
  if (SITE.test(t)) return 'site';
  if ((hasCurrent || hasHistory) && (REFERENCE.test(t) || /^(aur|or|and|more|what about|اور)\b/i.test(t) || /\b(rate\s*kam|price\s*kam|discount|bargain|final\s+price)\b/i.test(t))) return 'followup';
  if (verb && /\b(buy|purchase|find\s+me|show\s+me|kharid\w*|khareed\w*|dikha\w*)\b/i.test(t)) return 'shopping';
  if (QUESTION.test(t)) return 'general';
  if (noun || (verb && !QUESTION.test(t))) return 'shopping';
  return 'general';
}

// Local, truthful navigation if the AI service is unavailable. This never pretends to answer a religious
// ruling, order status, or time-sensitive question; it only points to pages that actually exist.
export function localAssistantHelp(text, intent, reason = 'unavailable') {
  const t = String(text || '');
  if (intent === 'greeting') {
    if (/^(hi|hello|hey)\b/i.test(t)) return { text: 'Hello! I can help you find products, pages and guides. What would you like to ask?', links: [] };
    return { text: 'Wa alaikum assalam! Main products, website ke pages aur maloomat dhoondhne mein madad kar sakti hoon. Kya poochna chahte hain?', links: [] };
  }
  const links = [];
  let textOut = '';
  if (/asaan\s*lang|asaanlang|آسان\s*لینگ/i.test(t)) {
    textOut = 'Asaan Lang Muaaz Iqbal ka Urdu aur Roman Urdu programming project hai. Is guide mein misaal aur project ka link mil jayega.';
    links.push({ label: 'Asaan Lang guide', href: '/blog/asaan-lang-urdu-programming-language-by-muaaz-iqbal' });
  } else if (/muaaz|معاذ|founder/i.test(t)) {
    textOut = 'Muaaz Iqbal Mizanora ke founder aur developer hain. Unke projects aur official links profile par hain.';
    links.push({ label: 'Muaaz Iqbal profile', href: '/muaaz-iqbal' });
  } else if (/live\s*tv|channel|ٹی\s*وی/i.test(t)) {
    textOut = 'Live TV ka page yahan hai. Available channels aur streams admin ki settings par depend karte hain.';
    links.push({ label: 'Live TV', href: '/live' });
  } else if (/quran|qur'an|surah|surat|ayat|ayah|tilawat|قرآن/i.test(t)) {
    textOut = 'Quran parhne aur sunne ke liye yeh page kholein. Main is waqt kisi ayat ka matn verify nahi kar sakti.';
    links.push({ label: 'Quran', href: '/quran' });
  } else if (/hadith|hadees|bukhari|حدیث/i.test(t)) {
    textOut = 'Hadees reader yahan hai. Main is waqt kisi riwayat ka matn verify nahi kar sakti.';
    links.push({ label: 'Hadith reader', href: '/hadith' });
  } else if (/calculator|converter|linux|zakat|زکو/i.test(t)) {
    textOut = 'Mizanora ke calculators aur doosre tools yahan milenge.';
    links.push({ label: 'Free tools', href: '/tools' });
  } else if (/track|parcel|order\s*status/i.test(t)) {
    textOut = 'Apna order track karne ke liye tracking page kholein; main aapka status khud nahi dekh sakti.';
    links.push({ label: 'Track order', href: '/track' });
  } else if (/delivery|shipping|deliver/i.test(t)) {
    textOut = 'Delivery aur charges ki current details shipping page aur checkout par dekh lein.';
    links.push({ label: 'Delivery information', href: '/shipping' });
  } else if (/return|refund|exchange/i.test(t)) {
    textOut = 'Return ki sharaait aur tareeqa current returns page par check karein.';
    links.push({ label: 'Returns information', href: '/returns' });
  } else if (/order|checkout/i.test(t)) {
    textOut = 'Product select karke cart aur checkout par jayein. Poori guide yahan hai.';
    links.push({ label: 'How to order', href: '/how-to-order' });
  } else if (/contact|support/i.test(t)) {
    textOut = 'Support se rabta karne ke liye contact page kholein.';
    links.push({ label: 'Contact support', href: '/contact' });
  } else if (/blog|guide/i.test(t)) {
    textOut = 'Mizanora ki guides yahan hain.'; links.push({ label: 'Blog', href: '/blog' });
  }
  if (textOut) return { text: textOut, links };
  const message = reason === 'limited'
    ? 'Mera AI connection is waqt limit par hai. Main is sawal ka jawab verify nahi kar sakti; thori der baad dobara poochein.'
    : 'Mera AI connection is waqt available nahi. Main is sawal ka jawab verify nahi kar sakti; baad mein dobara poochein ya support se rabta karein.';
  return { text: message, links: [{ label: 'Contact support', href: '/contact' }] };
}
