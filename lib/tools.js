// TOOLS HUB (v25). One registry for every free tool: the hub page, each tool page, the sitemap, the site search and the tests read it.
// Every tool runs inside the visitor's browser (no server, no Firestore, nothing is sent anywhere), so it costs the shop nothing and is private.
// Row: [slug, group, title, short description, keywords (comma separated), [[question, answer], ...]]
export const TOOL_GROUPS = [
  ['islamic', 'Islamic tools', 'Zakat, Hijri date, Qibla, Tasbih'],
  ['calc', 'Calculators', 'Percentage, discount, loan, BMI, age'],
  ['convert', 'Converters', 'Marla, kanal, tola, length, weight'],
  ['dev', 'Linux & developer tools', 'Linux commands, chmod, cron, JSON, Base64'],
  ['text', 'Text tools', 'Word counter, case, slug'],
  ['seo', 'SEO & business tools', 'Keywords, meta tags, WhatsApp link'],
];

const R = [
  ['zakat-calculator', 'islamic', 'Zakat Calculator (Pakistan, PKR)', 'Work out your zakat on cash, gold, silver and business goods in rupees.', 'zakat calculator, zakat calculator pakistan, zakat kaise nikalen, zakat nisab, zakat on gold, zakat on silver, zakat 2.5 percent, zakat calculator urdu',
    [['Zakat kitni dena farz hai?', 'Zakat is 2.5% (1/40) of your zakatable wealth that has stayed with you for one lunar year and is above the nisab, after subtracting debts you must pay now.'], ['Nisab kya hai?', 'Nisab is the minimum wealth. Many scholars in Pakistan use the silver nisab (52.5 tola, about 612.36 g) because it is lower and helps the poor more; the gold nisab is 7.5 tola (about 87.48 g). Ask your scholar which one you follow.']]],
  ['hijri-gregorian-converter', 'islamic', 'Hijri to Gregorian Date Converter', 'Change an Islamic date into an English date and back, with a moon-sighting day adjustment.', 'hijri date converter, islamic date today, hijri to gregorian, gregorian to hijri, islamic calendar converter, aaj ki islami tareekh',
    [['Pakistan aur Saudi ki Hijri date mein farq kyun?', 'Pakistan usually sights the moon about a day after Saudi Arabia, so the Pakistan date is often one day behind. Use the day adjustment box to match your local moon sighting.'], ['Kya ye date pakki hai?', 'No. A calendar calculation is approximate. The real start of a month is decided by moon sighting.']]],
  ['islamic-calendar', 'islamic', 'Islamic (Hijri) Calendar of Any Month', 'A month calendar that shows the Hijri day under every English date.', 'islamic calendar, hijri calendar 2026, islamic calendar pakistan, islami calendar, muharram ramadan eid date, hijri month calendar',
    [['Is calendar mein Hijri tareekh kaise aati hai?', 'It uses the Umm al-Qura calendar built into your browser, with an adjustment box for the Pakistan moon sighting.'], ['Ramazan aur Eid ki tareekh yahan pakki hai?', 'They are only estimates. Wait for the official moon sighting announcement.']]],
  ['qibla-direction', 'islamic', 'Qibla Direction Finder', 'Find the direction of the Kaaba from where you are, with distance in kilometres.', 'qibla direction, qibla finder, qibla compass online, qibla direction from pakistan, qibla kis taraf hai, kaaba direction',
    [['Pakistan mein qibla kis taraf hota hai?', 'In most of Pakistan the Qibla is to the west and a little north (roughly 255 to 265 degrees from north). Use the tool for your exact place.'], ['Location kyun mangta hai?', 'Only to calculate the angle inside your phone. Nothing is sent to any server. You can also type your latitude and longitude by hand.']]],
  ['tasbih-counter', 'islamic', 'Digital Tasbih Counter', 'Count your dhikr with one tap, set a target, and keep your count saved on this device.', 'tasbih counter, digital tasbih, online tasbih, dhikr counter, zikr counter, tasbeeh online',
    [['Count band hone par yaad rehta hai?', 'Yes. The count is kept on this device only, so you can come back and continue.'], ['Target kya hota hai?', 'You can set 33, 99 or 100. The phone vibrates a little when you reach it, if your phone allows it.']]],
  ['scientific-calculator', 'calc', 'Scientific Calculator Online', 'Type a full sum with brackets, powers, sin, cos, tan, log, sqrt, pi and get the answer.', 'scientific calculator online, calculator, online calculator free, sin cos tan calculator, square root calculator, calculator for mobile',
    [['Kaun se functions chalte hain?', 'Plus, minus, multiply, divide, power (^), percent of a number with %, brackets, sqrt, sin, cos, tan (in degrees), log (base 10), ln, abs, pi and e.'], ['Kya ye safe hai?', 'Yes. It uses its own small maths parser and never runs your text as code.']]],
  ['percentage-calculator', 'calc', 'Percentage Calculator', 'Percent of a number, what percent one number is of another, and percent change.', 'percentage calculator, percent calculator, how to calculate percentage, percentage nikalne ka tarika, percent increase calculator, marks percentage calculator',
    [['Marks ka percentage kaise nikalte hain?', 'Marks obtained divided by total marks, multiplied by 100. Use the second box: "X is what % of Y".'], ['Percent change kya hota hai?', 'New minus old, divided by old, times 100. A positive answer is an increase.']]],
  ['discount-calculator', 'calc', 'Discount and Sale Price Calculator', 'Find the sale price, the money you save and the final price after a second discount.', 'discount calculator, sale price calculator, discount percentage calculator, sale discount kaise nikalen, price after discount, off calculator',
    [['Discount kaise nikalte hain?', 'Price times discount percent divided by 100 is the saving. Price minus saving is what you pay.'], ['Do discount saath lagen to?', 'They do not add up. The second one applies to the already reduced price. The tool does this for you.']]],
  ['profit-margin-calculator', 'calc', 'Profit, Margin and Markup Calculator', 'Enter cost and selling price to see profit, margin percent and markup percent. Useful for online sellers.', 'profit margin calculator, markup calculator, profit calculator, selling price calculator, online business profit pakistan, reselling profit calculator',
    [['Margin aur markup mein kya farq hai?', 'Margin is profit divided by selling price. Markup is profit divided by cost. Same profit, different percentages.'], ['Delivery aur ad ka kharcha kahan likhun?', 'Add them to the cost box so the profit shown is your real profit.']]],
  ['loan-emi-calculator', 'calc', 'Loan and EMI Calculator', 'Monthly instalment, total payment and total interest for any loan.', 'emi calculator, loan calculator, loan emi calculator pakistan, monthly installment calculator, car loan calculator, bank loan installment',
    [['EMI kaise nikalti hai?', 'EMI = P x r x (1+r)^n / ((1+r)^n - 1), where r is the monthly rate and n the months.'], ['Islamic financing ke liye?', 'Islamic banks use profit rates and different contracts, so treat this as an estimate and ask the bank for the exact schedule.']]],
  ['bmi-calculator', 'calc', 'BMI Calculator', 'Body mass index from weight and height with the standard adult range.', 'bmi calculator, body mass index calculator, bmi kaise nikale, ideal weight calculator, bmi calculator in kg and cm, healthy weight',
    [['BMI ka normal range kya hai?', 'For adults 18.5 to 24.9 is the usual normal range.'], ['Kya BMI doctor ki jagah le sakta hai?', 'No. It is a rough guide only and does not know your muscle, age or health. See a doctor for advice.']]],
  ['age-calculator', 'calc', 'Age Calculator', 'Exact age in years, months and days, and the days left to your next birthday.', 'age calculator, calculate age from date of birth, umar calculator, my age in days, age calculator online, birthday countdown',
    [['Umar din mein kaise nikalen?', 'Pick your date of birth. The tool shows years, months, days and the total number of days lived.'], ['Date of birth kahin save hoti hai?', 'No. It stays in your browser.']]],
  ['date-difference-calculator', 'calc', 'Days Between Two Dates', 'Count the days, weeks and months between two dates.', 'days between dates, date difference calculator, date calculator, kitne din baaki hain, countdown days, add days to date',
    [['Dono dates shamil hoti hain?', 'The count is the number of days from the first date to the second. Add 1 if you want to include both ends.'], ['Weeks aur months?', 'The tool also gives weeks and an approximate month count.']]],
  ['sales-tax-calculator', 'calc', 'Sales Tax / GST Calculator', 'Add tax to a price or take it out of a price that already includes tax.', 'sales tax calculator, gst calculator pakistan, tax calculator, 18 percent tax calculator, vat calculator, inclusive exclusive tax',
    [['Tax shamil price mein se tax kaise nikalen?', 'Divide the price by (1 + rate/100) to get the price without tax. The difference is the tax.'], ['Rate kitna daalun?', 'Type the rate that applies to you. The box starts at 18 only as an example. Check the official rate for your goods.']]],
  ['amount-in-words', 'calc', 'Amount in Words (Rupees, Lakh, Crore)', 'Write any amount in words for cheques and invoices, using lakh and crore.', 'amount in words, number to words, rupees in words, cheque amount in words, lakh crore in words, raqam alfaz mein',
    [['Cheque par kaise likhte hain?', 'Write the words and finish with "only". The tool gives you the text ready to copy.'], ['Lakh aur crore?', 'The tool follows the South Asian system: thousand, lakh, crore, arab.']]],
  ['unit-converter', 'convert', 'Unit Converter: Marla, Kanal, Tola, Length, Weight', 'Convert land (marla, kanal, acre), gold (tola, masha), length, weight, temperature and more.', 'unit converter, marla to square feet, kanal to marla, tola to gram, acre to kanal, feet to meter, kg to pound, celsius to fahrenheit',
    [['1 marla kitne square feet ka hota hai?', 'This tool uses the common standard of 272.25 square feet per marla (and 20 marla = 1 kanal). Some places use a different local marla, so check your local record.'], ['1 tola kitne gram ka hota hai?', 'About 11.664 grams. 1 tola = 12 masha = 96 ratti.']]],
  ['linux-commands-cheat-sheet', 'dev', 'Linux Commands Cheat Sheet (Searchable)', 'Search over 120 Linux commands with what they do and examples. Copy with one tap.', 'linux commands, linux cheat sheet, linux commands list, linux commands for beginners, ubuntu commands, bash commands, linux terminal commands, linux commands in urdu',
    [['Beginner pehle kaun se commands seekhe?', 'ls, cd, pwd, mkdir, cp, mv, rm, cat, grep, chmod, sudo and man. Open the "Files" and "Basics" groups.'], ['rm -rf kyun khatarnak hai?', 'It deletes files without asking and without a recycle bin. Always check the path twice.']]],
  ['chmod-calculator', 'dev', 'Chmod Permission Calculator', 'Tick read, write and execute boxes and get the chmod number (755, 644) and the symbolic form.', 'chmod calculator, chmod 755, chmod 644, linux file permissions, chmod numeric, chmod 777 meaning, file permission calculator',
    [['chmod 755 ka matlab?', 'Owner can read, write and execute. Group and others can read and execute.'], ['chmod 777 theek hai?', 'Almost never. It lets everyone change the file. Use the smallest permission that works.']]],
  ['cron-expression-generator', 'dev', 'Cron Expression Generator', 'Build a crontab schedule (every 5 minutes, daily at 3 am) and read it in plain words.', 'cron expression generator, crontab generator, cron job example, cron every 5 minutes, crontab syntax, linux cron schedule',
    [['Cron mein 5 fields kaun se hain?', 'Minute, hour, day of month, month and day of week, in that order.'], ['Har 5 minute ke liye?', 'Use */5 * * * *.']]],
  ['base64-encoder-decoder', 'dev', 'Base64 Encoder and Decoder', 'Turn text into Base64 and back. Works with Urdu and emoji too.', 'base64 encode, base64 decode, base64 online, text to base64, base64 to text, base64 encoder decoder',
    [['Base64 encryption hai?', 'No. It only changes how data is written. Anyone can decode it, so never use it to hide passwords.'], ['Urdu text chalega?', 'Yes. The tool converts text with UTF-8 first.']]],
  ['url-encoder-decoder', 'dev', 'URL Encoder and Decoder', 'Make text safe for a web address (%20) or decode a link back to readable text.', 'url encode, url decode, percent encoding, encode uri component, url encoder online, link encoder',
    [['Space ki jagah %20 kyun aata hai?', 'A web address cannot contain raw spaces, so they are written as %20.'], ['Poora link encode karun?', 'Usually encode only the parts after ? such as search words, not the whole link.']]],
  ['json-formatter-validator', 'dev', 'JSON Formatter and Validator', 'Paste JSON, find errors, pretty print or minify it.', 'json formatter, json validator, json beautifier, json pretty print, json minify, json online',
    [['JSON error kahan hai kaise dekhun?', 'Press Format. If the text is wrong the tool shows the error message from your browser.'], ['Kya data upload hota hai?', 'No. Everything stays in your browser.']]],
  ['sha256-hash-generator', 'dev', 'SHA-256 / SHA-1 / SHA-512 Hash Generator', 'Get the hash of any text, made inside your browser.', 'sha256 generator, sha256 hash online, sha1 hash, sha512 generator, hash generator, checksum text',
    [['Hash se original text wapas mil sakta hai?', 'No, a hash is one-way.'], ['Password ke liye SHA-256 theek hai?', 'Plain SHA-256 is too fast for storing passwords. Use bcrypt, scrypt or Argon2 on the server.']]],
  ['password-generator', 'dev', 'Strong Password Generator', 'Make a random password of any length. It is created in your browser and never sent.', 'password generator, strong password generator, random password, secure password, password banane ka tarika, passphrase generator',
    [['Kitna lamba password theek hai?', 'At least 14 characters with letters, numbers and symbols, and different for every account.'], ['Kya generated password save hota hai?', 'No. Copy it into a password manager.']]],
  ['uuid-generator', 'dev', 'UUID Generator (v4)', 'Create random UUIDs for databases and apps, one or many at once.', 'uuid generator, uuid v4, guid generator, random uuid online, generate uuid',
    [['UUID v4 kya hai?', 'A 128-bit random identifier. The chance of two being equal is practically zero.'], ['Kitne ek saath ban sakte hain?', 'Up to 100 at once.']]],
  ['regex-tester', 'dev', 'Regex Tester', 'Test a regular expression on your text and see every match.', 'regex tester, regular expression tester, regex online, javascript regex, regex matcher, regex checker',
    [['Flags kya hote hain?', 'g finds all matches, i ignores case, m treats each line separately.'], ['Kaun sa regex engine?', 'The JavaScript engine of your browser.']]],
  ['timestamp-converter', 'dev', 'Unix Timestamp Converter', 'Change a Unix timestamp to a readable date and a date to a timestamp.', 'unix timestamp converter, epoch converter, timestamp to date, date to timestamp, unix time now, epoch time',
    [['Unix timestamp kya hai?', 'The number of seconds since 1 January 1970 UTC.'], ['Seconds ya milliseconds?', 'The tool detects 13 digit numbers as milliseconds.']]],
  ['color-converter', 'dev', 'Color Converter (HEX, RGB, HSL)', 'Convert colours between HEX, RGB and HSL and see a live preview.', 'color converter, hex to rgb, rgb to hex, hsl converter, color picker online, hex color code',
    [['HEX kya hota hai?', 'A colour written as # and six digits, two each for red, green and blue.'], ['Short hex?', '#0af is the short form of #00aaff.']]],
  ['word-counter', 'text', 'Word and Character Counter', 'Count words, characters, sentences and reading time. Works with Urdu.', 'word counter, character counter, word count online, letter counter, reading time calculator, urdu word counter',
    [['Words kaise gine jate hain?', 'Groups of text separated by spaces. Urdu and English both work.'], ['Reading time?', 'Estimated at about 200 words a minute.']]],
  ['text-case-converter', 'text', 'Text Case Converter', 'UPPERCASE, lowercase, Title Case, Sentence case and more in one tap.', 'case converter, uppercase to lowercase, title case converter, capitalize text, text case changer, lowercase converter',
    [['Title Case kya hai?', 'Every word starts with a capital letter.'], ['Urdu par asar?', 'Urdu has no case, so only English letters change.']]],
  ['slug-generator', 'text', 'URL Slug Generator', 'Turn a title into a clean web address slug for your blog or product.', 'slug generator, url slug generator, seo friendly url, permalink generator, blog slug, product url slug',
    [['SEO friendly slug kaisa hota hai?', 'Short, lowercase, words joined with hyphens and no strange symbols.'], ['Urdu title?', 'Write the title in English or Roman Urdu for the slug.']]],
  ['keyword-generator', 'seo', 'Keyword Idea Generator (English + Roman Urdu)', 'Turn one word into hundreds of search phrases people type in Pakistan.', 'keyword generator, seo keywords, keyword ideas, long tail keywords, keyword research free, roman urdu keywords, keywords for blog',
    [['Ye tool Google ki asli search volume dikhata hai?', 'No. It builds phrase ideas from patterns people use. Check the real volume in Google Search Console or Google Keyword Planner.'], ['Kaun se keywords chunun?', 'Pick long, specific phrases that match what your page truly gives.']]],
  ['meta-tag-generator', 'seo', 'Meta Title and Description Generator', 'Write a title and description with live length checks and a Google result preview.', 'meta tag generator, seo title description, meta description length, meta title checker, google snippet preview, seo meta tags',
    [['Title kitna lamba hona chahiye?', 'About 50 to 60 characters so Google does not cut it.'], ['Description kitni lambi?', 'About 120 to 160 characters.']]],
  ['whatsapp-link-generator', 'seo', 'WhatsApp Link Generator', 'Make a wa.me link with a ready message so customers can chat with one tap.', 'whatsapp link generator, wa.me link, whatsapp chat link, click to chat whatsapp, whatsapp business link, whatsapp message link',
    [['Number kaise likhun?', 'Use the country code without + or zeros. For Pakistan: 923001234567.'], ['Message likh sakte hain?', 'Yes. It is added to the link so the chat opens with your text ready.']]],
];

export const TOOLS = R.map(([slug, group, title, short, kw, faq]) => ({ slug, group, title, short, keywords: kw.split(',').map((s) => s.trim()).filter(Boolean), faq }));
export const getTool = (slug) => TOOLS.find((t) => t.slug === slug) || null;
export const toolsIn = (group) => TOOLS.filter((t) => t.group === group);
// Blog guides that belong to a group (the tool page links to one of them).
export const GROUP_BLOG = {
  islamic: 'zakat-kaise-nikalen-guide-nisab-pakistan',
  calc: 'free-online-calculators-pakistan-percentage-discount-emi',
  convert: 'marla-kanal-tola-converter-guide-pakistan',
  dev: 'linux-commands-for-beginners-cheat-sheet-urdu',
  text: 'free-text-tools-word-counter-case-converter-slug',
  seo: 'free-seo-keyword-tools-for-pakistani-websites',
};
export function relatedTools(slug, n = 6) {
  const t = getTool(slug); if (!t) return [];
  return [...toolsIn(t.group).filter((x) => x.slug !== slug), ...TOOLS.filter((x) => x.group !== t.group && x.slug !== slug)].slice(0, n);
}
// Plain text search over the tools (used by /search and the tools hub).
export function searchTools(q, limit = 20) {
  const w = String(q || '').toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/).filter((x) => x.length >= 2);
  if (!w.length) return [];
  return TOOLS.map((t) => { const hay = `${t.title} ${t.short} ${t.keywords.join(' ')}`.toLowerCase(); let s = 0; for (const x of w) { if (t.title.toLowerCase().includes(x)) s += 3; else if (hay.includes(x)) s += 1; else s -= 2; } return { t, s }; }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.t);
}
