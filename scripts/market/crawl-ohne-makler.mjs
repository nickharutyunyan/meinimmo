// Picks the most recent ohne-makler.net sale listings per market city and writes
// their URLs to data/market-seed.json. Listing ids rise over time, so the highest
// ids are the newest. One request per second; nothing is copied except the URL,
// the price shown on the card and the district name.
//
//   node scripts/market/crawl-ohne-makler.mjs [--per-city 24] [--pages 30]
// A few more than the 20 shown per city: the importer skips listings without a price.
import { writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? Number(args[index + 1]) : fallback;
};
const PER_CITY = option('per-city', 24);
const MAX_PAGES = option('pages', 30);
const BASE = 'https://www.ohne-makler.net/immobilien';

const CITIES = [
  {
    market: 'berlin',
    paths: ['wohnung-kaufen/berlin', 'haus-kaufen/berlin'],
    // The three districts asked for. Charlottenburg-Nord and Westend are separate localities.
    keep: card => card.city === 'Berlin' && /^(Prenzlauer Berg|Schöneberg|Charlottenburg)$/.test(card.district),
  },
  {
    market: 'munich',
    paths: ['wohnung-kaufen/bayern/munchen', 'haus-kaufen/bayern/munchen'],
    keep: card => card.postcode >= 80331 && card.postcode <= 81929,
  },
  {
    market: 'cologne',
    paths: ['wohnung-kaufen/nordrhein-westfalen/koln', 'haus-kaufen/nordrhein-westfalen/koln'],
    keep: card => card.postcode >= 50667 && card.postcode <= 51149,
  },
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const decode = value => value.replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');

function cards(html) {
  const found = new Map();
  for (const match of html.matchAll(/href="\/immobilie\/(\d+)\/"[^>]*data-om-type="SELL"/g)) {
    const id = Number(match[1]);
    if (found.has(id)) continue;
    const text = decode(html.slice(match.index, match.index + 5000).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
    const place = text.match(/\b(\d{5}) ([A-ZÄÖÜ][^()|]*?) \(([^)]+)\)/);
    const price = text.match(/([\d.]+) €/);
    if (!place) continue;
    found.set(id, {
      id,
      url: `https://www.ohne-makler.net/immobilie/${id}/`,
      postcode: Number(place[1]),
      city: place[2].trim(),
      district: place[3].trim(),
      price: price ? Number(price[1].replace(/\./g, '')) : 0,
    });
  }
  return [...found.values()];
}

async function page(path, number) {
  const url = `${BASE}/${path}/${number > 1 ? `?page=${number}` : ''}`;
  const response = await fetch(url, { headers: { 'user-agent': 'ReviewAHouse/1.0 (+https://reviewahouse.com)', 'accept-language': 'de-DE' } });
  // Past the last page the portal answers 404, which simply ends the walk.
  if (response.status === 404) return '';
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.text();
}

const seed = [];
for (const city of CITIES) {
  const pool = new Map();
  for (const path of city.paths) {
    for (let number = 1; number <= MAX_PAGES; number += 1) {
      const found = cards(await page(path, number));
      await sleep(1000);
      if (!found.length) break;
      for (const card of found) if (card.price > 0 && city.keep(card)) pool.set(card.id, card);
    }
  }
  const newest = [...pool.values()].sort((a, b) => b.id - a.id).slice(0, PER_CITY);
  console.log(`${city.market}: ${pool.size} candidates, keeping ${newest.length}`);
  for (const card of newest) seed.push({ market: city.market, url: card.url, district: card.district, price: card.price });
}

await writeFile(new URL('../../data/market-seed.json', import.meta.url), `${JSON.stringify(seed, null, 2)}\n`);
console.log(`Wrote ${seed.length} listings to data/market-seed.json`);
