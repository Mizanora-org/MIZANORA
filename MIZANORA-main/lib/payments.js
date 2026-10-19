// Payment methods. Cash on delivery is always on. Easypaisa / JazzCash / Bank (Raast) switch on by themselves
// when you set their account in the environment variables (see .env.example). Nothing else to change.
//   NEXT_PUBLIC_PAY_EASYPAISA = 03XX-XXXXXXX|Account title
//   NEXT_PUBLIC_PAY_JAZZCASH  = 03XX-XXXXXXX|Account title
//   NEXT_PUBLIC_PAY_BANK      = PK00XXXX0000000000000000|Account title|Bank name   (works for Raast ID / IBAN transfers)
//   NEXT_PUBLIC_PREPAID_PERCENT = 0..15  (optional discount for paying before delivery; cuts return-to-origin losses)
const account = (v) => {
  const [num = '', title = '', bank = ''] = String(v || '').split('|').map((s) => s.trim());
  return num ? { num, title, bank } : null;
};

export const PREPAID_PERCENT = Math.max(0, Math.min(15, Number(process.env.NEXT_PUBLIC_PREPAID_PERCENT) || 0));

const WALLETS = [
  { id: 'EASYPAISA', label: 'Easypaisa', acc: account(process.env.NEXT_PUBLIC_PAY_EASYPAISA) },
  { id: 'JAZZCASH', label: 'JazzCash', acc: account(process.env.NEXT_PUBLIC_PAY_JAZZCASH) },
  { id: 'BANK', label: 'Bank / Raast', acc: account(process.env.NEXT_PUBLIC_PAY_BANK) },
];

export const PAY_METHODS = [
  { id: 'COD', label: 'Cash on delivery', note: 'Pay when the parcel reaches you', prepaid: false, acc: null },
  ...WALLETS.filter((w) => w.acc).map((w) => ({ id: w.id, label: w.label, note: 'Pay now, ship faster', prepaid: true, acc: w.acc })),
];

export const payMethod = (id) => PAY_METHODS.find((m) => m.id === String(id || 'COD').toUpperCase()) || null;
export const payLabel = (id) => { const m = payMethod(id); return m ? m.label : 'Cash on delivery'; };

// Discount for paying before delivery (0 for cash on delivery). Used by checkout AND the server.
export const prepaidOff = (base, id) => {
  const m = payMethod(id);
  return m && m.prepaid && PREPAID_PERCENT > 0 ? Math.round((Math.max(0, base) * PREPAID_PERCENT) / 100) : 0;
};

// Transaction ID typed by the customer: letters, numbers, dash; 6 to 30 characters.
export const cleanPayRef = (s) => {
  const t = String(s || '').replace(/[^A-Za-z0-9\- ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
  return t.length >= 6 ? t : '';
};
