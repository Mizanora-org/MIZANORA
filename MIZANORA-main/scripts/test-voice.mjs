// Tests for the assistant's speech splitting (Chrome stops long speech, so answers are spoken in short pieces).
// Usage: node scripts/test-voice.mjs
import assert from 'node:assert/strict';
import { speechChunks, isEcho } from '../lib/assistantVoice.js';

let fails = 0;
const test = (name, fn) => { try { fn(); console.log('ok   ', name); } catch (e) { fails++; console.log('FAIL ', name, '\n     ', e.message); } };

test('short answer is one piece', () => {
  assert.deepEqual(speechChunks('Ji, mujhe 3 cheezein mili hain.'), ['Ji, mujhe 3 cheezein mili hain.']);
});
test('long answer is split at sentence ends, nothing lost', () => {
  const long = Array.from({ length: 12 }, (_, i) => `Ye jumla number ${i + 1} hai aur ye kaafi lamba hai.`).join(' ');
  const parts = speechChunks(long);
  assert.ok(parts.length > 1, 'should split');
  assert.ok(parts.every((p) => p.length <= 200), 'each piece is short');
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), long.replace(/\s+/g, ' '));
});
test('Urdu full stop and question mark split too', () => {
  const parts = speechChunks('آپ کیسی ہیں؟ میں ٹھیک ہوں۔ دیکھیں گے۔');
  assert.equal(parts.length, 1); // short enough: one piece
  const long = 'یہ ایک لمبا جملہ ہے جو بہت سارے الفاظ رکھتا ہے۔ '.repeat(8);
  assert.ok(speechChunks(long).length > 1);
});
test('empty / spaces give no pieces', () => {
  assert.deepEqual(speechChunks('   '), []);
  assert.deepEqual(speechChunks(''), []);
});

test('echo: her own sentence heard by the mic is recognised', () => {
  assert.equal(isEcho('ji aap ke liye yeh cheezein mili hain', 'Ji, aap ke liye yeh cheezein mili hain.'), true);
});
test('echo: a real question from the shopper is NOT dropped', () => {
  assert.equal(isEcho('kya is ki delivery kal tak hogi', 'Ji, mujhe 3 cheezein mili hain.'), false);
});
test('echo: single word or empty heard text is never an echo', () => {
  assert.equal(isEcho('ji', 'Ji, aap ke liye'), false);
  assert.equal(isEcho('', 'anything'), false);
});

console.log(fails ? `\n${fails} voice test(s) FAILED` : '\nAll voice tests passed.');
process.exit(fails ? 1 : 0);
