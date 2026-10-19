import { PROVINCES } from './constants';

// Accepts 0300-1234567, 03001234567, +923001234567, 923001234567, 3001234567
export function normalizePhone(input) {
  const d = String(input || '').replace(/\D/g, '');
  const m = d.match(/^(?:92|0)?(3\d{9})$/);
  if (!m) return null;
  return { local: `0${m[1]}`, intl: `+92${m[1]}`, wa: `92${m[1]}` };
}

export function validateCustomer(c = {}) {
  const errors = {};
  const name = String(c.name || '').trim();
  const address = String(c.address || '').trim();
  const landmark = String(c.landmark || '').trim();
  const city = String(c.city || '').trim();
  const province = String(c.province || '').trim();
  const notes = String(c.notes || '').trim();
  const ph = normalizePhone(c.phone);

  if (name.length < 3 || name.length > 80) errors.name = 'Please enter your full name';
  if (!ph) errors.phone = 'Enter a valid mobile number, e.g. 0300-1234567';
  if (address.length < 10 || address.length > 250) errors.address = 'Please enter your complete address (house #, street, area)';
  if (landmark.length < 3 || landmark.length > 120) errors.landmark = 'Please enter a nearby landmark';
  if (city.length < 2 || city.length > 60) errors.city = 'Please select your city';
  if (!PROVINCES.includes(province)) errors.province = 'Please select your province';
  if (notes.length > 300) errors.notes = 'Notes are too long (max 300 characters)';

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    clean: { name, phone: ph ? ph.local : '', phoneIntl: ph ? ph.intl : '', address, landmark, city, province, notes },
  };
}
