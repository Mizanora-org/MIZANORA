// Worker own price + market rate + price bands. Run: node scripts/test-worker-prices.mjs
import { bandPct, maxMarkupFor, sellView, lineEarning, TIERS } from '../lib/workers.js';
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? 'ok   ' : 'FAIL '} ${name}${ok ? '' : ` got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`); };
eq('band 1000 -> 10%', bandPct(1000), 10);
eq('band 1220 -> 15%', bandPct(1220), 15);
eq('band 2500 -> 20%', bandPct(2500), 20);
eq('max profit on Rs 1220 = Rs 183', maxMarkupFor(1220), 183);
eq('market higher than sell -> discount shown', sellView(1220, 100, 2000), { sell: 1320, market: 2000, off: 34 });
eq('market equal to sell -> no discount', sellView(1220, 100, 1320), { sell: 1320, market: 0, off: 0 });
eq('market lower than sell -> no discount', sellView(1220, 100, 1000), { sell: 1320, market: 0, off: 0 });
eq('no worker data -> shop price', sellView(1220, 0, 0), { sell: 1220, market: 0, off: 0 });
eq('own profit never above the band', lineEarning(TIERS[0], 1220, 1, 900).markupProfit, 183);
eq('every level may set own price', TIERS.every((t) => t.custom), true);
console.log(bad ? `\n${bad} FAILED` : '\nAll worker price tests passed.');
process.exit(bad ? 1 : 0);
