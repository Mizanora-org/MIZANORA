import { DEFAULT_SETTINGS } from './workers';

let cache = { at: 0, v: DEFAULT_SETTINGS };

// Program switches the admin controls in /admin/workers > Settings. Cached 60 seconds so orders do not cost an extra read each time.
export async function getWorkerSettings(db) {
  if (Date.now() - cache.at < 60000) return cache.v;
  try {
    const s = await db.collection('workerSettings').doc('main').get();
    const d = s.exists ? s.data() : {};
    cache = { at: Date.now(), v: {
      programOn: d.programOn !== false,
      repeatCredit: Boolean(d.repeatCredit),
      repeatDays: Math.max(1, Number(d.repeatDays) || DEFAULT_SETTINGS.repeatDays),
      holdDays: Number(d.holdDays) >= 0 ? Number(d.holdDays) : DEFAULT_SETTINGS.holdDays,
    } };
  } catch { cache = { at: Date.now() - 50000, v: DEFAULT_SETTINGS }; }
  return cache.v;
}
