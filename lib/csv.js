import { formatDate } from './format';

const itemsText = (o) => (o.items || []).map((i) => `${i.name}${i.size ? ` (${i.size})` : ''} x${i.qty}`).join(' | ');
const qtyTotal = (o) => (o.items || []).reduce((s, i) => s + i.qty, 0);

// EDIT HERE to match the column names of your HHC / Trax / Leopard bulk-upload sheet.
// Format: [column title, function that returns the cell value, optional {text:true} to keep leading zeros]
export const CSV_COLUMNS = [
  ['Order ID', (o) => o.orderId],
  ['Order Date', (o) => formatDate(o.createdAtMs)],
  ['Customer Name', (o) => o.customer?.name],
  ['Phone', (o) => o.customer?.phone, { text: true }],
  ['Address', (o) => o.customer?.address],
  ['Landmark', (o) => o.customer?.landmark],
  ['City', (o) => o.customer?.city],
  ['Province', (o) => o.customer?.province],
  ['Product Details', itemsText],
  ['Quantity', qtyTotal],
  ['COD Amount (PKR)', (o) => o.total],
  ['Remarks', (o) => o.customer?.notes],
  ['Status', (o) => o.status],
  ['Tracking ID', (o) => o.trackingId],
  ['Promo Code', (o) => o.couponCode || ''],
  ['Promo Owner', (o) => o.couponOwner || ''],
  ['Discount (PKR)', (o) => o.discount || 0],
];

function cell(value, opts) {
  let s = String(value ?? '');
  if (opts && opts.text) return `="${s.replace(/"/g, '""')}"`; // keeps 0300... as text in Excel
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // blocks spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
}

export function ordersToCsv(orders) {
  const head = CSV_COLUMNS.map(([t]) => `"${t}"`).join(',');
  const rows = orders.map((o) => CSV_COLUMNS.map(([, fn, opts]) => cell(fn(o), opts)).join(','));
  return `\uFEFF${[head, ...rows].join('\r\n')}`; // BOM so Excel reads Urdu/UTF-8 correctly
}

export function downloadCsv(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
