// Imports data/market-seed.json through POST /api/listings/import, one listing at a time.
// Each call fetches the portal page, reviews it and geocodes it, so calls are spaced
// to respect the portal and Nominatim's one-request-per-second rule.
//
//   MARKET_IMPORT_TOKEN=... node scripts/market/import-listings.mjs --base http://localhost:3000 [--per-city 20] [--refresh]
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const base = (args[args.indexOf('--base') + 1] || 'http://localhost:3000').replace(/\/$/, '');
const refresh = args.includes('--refresh');
const perCity = Number(args[args.indexOf('--per-city') + 1]) || 20;
const token = process.env.MARKET_IMPORT_TOKEN;
if (!token) throw new Error('Set MARKET_IMPORT_TOKEN to the BACKFILL_TOKEN of the target environment.');

// The seed lists the newest first and holds a few spares per city. Pick the newest
// that import cleanly, then import those oldest first so the newest gets the latest
// publish time and "Newest" on the site keeps the portal's order.
const all = JSON.parse(await readFile(new URL('../../data/market-seed.json', import.meta.url), 'utf8'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const tally = { created: 0, existing: 0, failed: 0 };
const kept = {};
const seed = all;
const started = Date.now();
// One minute apart in seed order, newest first, so "Newest" on the site follows the portal.
const listedAt = index => new Date(started - index * 60_000).toISOString();

for (const [index, item] of seed.entries()) {
  if ((kept[item.market] || 0) >= perCity) continue;
  const response = await fetch(`${base}/api/listings/import`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ url: item.url, district: item.district, refresh, listedAt: listedAt(index) }),
  });
  const body = await response.json().catch(() => ({}));
  const label = `${String(index + 1).padStart(2)}/${seed.length} ${item.market.padEnd(7)} ${item.url}`;
  if (response.ok) {
    tally[body.created ? 'created' : 'existing'] += 1;
    kept[item.market] = (kept[item.market] || 0) + 1;
    console.log(`${label} → ${body.id} ${body.created ? 'new' : 'kept'} · ${body.photos} photos · pin ${body.geo ? 'yes' : 'no'} · market ${body.market}`);
  } else {
    tally.failed += 1;
    console.log(`${label} → ${response.status} ${body.error || ''}`);
  }
  await sleep(1500);
}
console.log(tally);
