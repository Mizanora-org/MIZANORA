// HADITH (v24). Pure code, shared by the server route, the page and the tests.
// NOTHING of any hadith is typed in this project: the text comes from the open "hadith-api" data set (fawazahmed0/hadith-api on the
// jsDelivr CDN), which carries the big collections in Arabic, English and Urdu where a translation exists. The server keeps a section for 30 days.
// If a book has no translation in the language chosen, the page says so and shows another language instead of showing nothing.
const CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';

// [key, name, arabic name, edition stem]. Edition ids look like "eng-bukhari", "urd-bukhari", "ara-bukhari".
export const BOOKS = [
  ['bukhari', 'Sahih al-Bukhari', 'صحيح البخاري'],
  ['muslim', 'Sahih Muslim', 'صحيح مسلم'],
  ['abudawud', 'Sunan Abi Dawud', 'سنن أبي داود'],
  ['tirmidhi', 'Jami at-Tirmidhi', 'جامع الترمذي'],
  ['nasai', "Sunan an-Nasa'i", 'سنن النسائي'],
  ['ibnmajah', 'Sunan Ibn Majah', 'سنن ابن ماجه'],
  ['malik', 'Muwatta Malik', 'موطأ مالك'],
  ['nawawi', 'Forty Hadith of an-Nawawi', 'الأربعون النووية'],
  ['qudsi', 'Forty Hadith Qudsi', 'الأحاديث القدسية'],
].map(([key, name, ar]) => ({ key, name, ar }));
export const LANGS = [['urd', 'Urdu'], ['eng', 'English'], ['ara', 'Arabic']];

const BOOK_KEYS = new Set(BOOKS.map((b) => b.key));
export const okBook = (k) => BOOK_KEYS.has(k);
export const okLang = (l) => LANGS.some((x) => x[0] === l);
export const edition = (lang, book) => `${lang}-${book}`;
// Section = a chapter group of the book (Book of Faith, Book of Prayer ...). 0 = the whole book's section list.
export const sectionUrl = (lang, book, n) => `${CDN}/${edition(lang, book)}/sections/${Number(n)}.json`;
export const hadithUrl = (lang, book, n) => `${CDN}/${edition(lang, book)}/${Number(n)}.json`;
export const bookUrl = (lang, book) => `${CDN}/${edition(lang, book)}.json`;

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
// The data set's grades: [{ name, grade }]. Shown as given, never made up.
export function parseGrades(g) {
  return (Array.isArray(g) ? g : []).map((x) => ({ by: clean(x && x.name).slice(0, 60), grade: clean(x && x.grade).slice(0, 40) })).filter((x) => x.grade);
}
// One section answer -> { title, hadiths:[{ n, text, grades, book, hadith }] }. Returns null when the answer is not what we expect.
export function parseSection(json, n) {
  if (!json || !Array.isArray(json.hadiths)) return null;
  const meta = (json.metadata && json.metadata.section && (json.metadata.section[String(n)] || json.metadata.section[n])) || '';
  const hs = json.hadiths.map((h) => ({
    n: h.hadithnumber, ar: h.arabicnumber || h.hadithnumber, text: clean(h.text).slice(0, 4000), grades: parseGrades(h.grades),
    book: h.reference && h.reference.book, hadith: h.reference && h.reference.hadith,
  })).filter((h) => h.text);
  return { title: clean(meta).slice(0, 120), hadiths: hs.slice(0, 300) };
}
// Section list of a book: { 1: 'Revelation', 2: 'Belief', ... } from the metadata of any edition's section file.
export function parseSectionNames(json) {
  const m = json && json.metadata && json.metadata.section;
  if (!m || typeof m !== 'object') return [];
  return Object.entries(m).map(([k, v]) => ({ n: Number(k), name: clean(v).slice(0, 100) })).filter((x) => x.n > 0 && x.name).sort((a, b) => a.n - b.n);
}
// Search inside text already loaded (a section): every word must appear.
export function filterHadiths(list, q) {
  const words = clean(q).toLowerCase().split(' ').filter((w) => w.length > 1);
  if (!words.length) return list;
  return list.filter((h) => { const t = h.text.toLowerCase(); return words.every((w) => t.includes(w)); });
}
