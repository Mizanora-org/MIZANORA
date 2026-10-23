'use client';
import * as C from './ToolsCalc';
import * as D from './ToolsDev';
import * as T from './ToolsText';

const MAP = {
  'zakat-calculator': C.Zakat, 'hijri-gregorian-converter': C.HijriConverter, 'islamic-calendar': C.IslamicCalendar, 'qibla-direction': C.Qibla, 'tasbih-counter': C.Tasbih,
  'scientific-calculator': C.SciCalc, 'percentage-calculator': C.Percentage, 'discount-calculator': C.Discount, 'profit-margin-calculator': C.Margin, 'loan-emi-calculator': C.Emi,
  'bmi-calculator': C.Bmi, 'age-calculator': C.Age, 'date-difference-calculator': C.DateDiff, 'sales-tax-calculator': C.SalesTax, 'amount-in-words': C.Words, 'unit-converter': C.Units,
  'linux-commands-cheat-sheet': D.LinuxSheet, 'chmod-calculator': D.Chmod, 'cron-expression-generator': D.Cron, 'base64-encoder-decoder': D.Base64, 'url-encoder-decoder': D.UrlCoder,
  'json-formatter-validator': D.Json, 'sha256-hash-generator': D.Sha, 'password-generator': D.Password, 'uuid-generator': D.Uuid, 'regex-tester': D.Regex, 'timestamp-converter': D.Timestamp, 'color-converter': D.Color,
  'word-counter': T.WordCount, 'text-case-converter': T.CaseConv, 'slug-generator': T.Slug, 'keyword-generator': T.Keywords, 'meta-tag-generator': T.Meta, 'whatsapp-link-generator': T.WhatsApp,
};
export const TOOL_SLUGS = Object.keys(MAP);
export default function ToolRunner({ slug }) {
  const Tool = MAP[slug];
  return Tool ? <Tool /> : <p className="text-dim">This tool is not available.</p>;
}
