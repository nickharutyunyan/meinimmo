import test from 'node:test';
import assert from 'node:assert/strict';
import { marketFor } from '../lib/market/cities.ts';
import { extractFreeText } from '../lib/market/extract.ts';
import { floorLabel, parseRooms, priceShort } from '../lib/market/format.ts';
import { featureKeys } from '../lib/market/features.ts';
import { generatedDescription, generatedTitle } from '../lib/market/describe.ts';
import { cleanDistrict, listingFromReport } from '../lib/market/from-report.ts';
import { applyPatch, blankListing, blurredGeo, displayTitle, listingSummary, missingForPublish, publicListing, reorderPhotos, streetOnly } from '../lib/market/validate.ts';
import { applySearch, DEFAULT_SEARCH, searchFromParams, searchToParams } from '../lib/market/search.ts';
import { listingAsSourceText } from '../lib/market/review-source.ts';
import { shareTargets } from '../lib/market/share.ts';
import { parseListing } from '../lib/listing-parser.ts';

const NOW = '2026-10-09T12:00:00.000Z';

function ready(overrides = {}) {
  const base = blankListing({ id: 'abcdef123456', locale: 'en', propertyType: 'flat', now: NOW });
  const complete = applyPatch({ ...base, photos: [{ kind: 'stored', id: '0123456789abcdef', width: 1600, height: 1100 }] }, {
    facts: { price: 545000, area: 82, rooms: 3, floor: '4. OG' },
    address: { street: 'Akazienstraße 14', postalCode: '10823', city: 'Berlin' },
    contact: { name: 'Ada', email: 'ada@example.com' },
    consent: true,
  }, NOW);
  return applyPatch(complete, overrides, NOW);
}

test('a postcode decides the market city before the city name', () => {
  assert.equal(marketFor({ postalCode: '10823', city: 'Berlin' }), 'berlin');
  assert.equal(marketFor({ postalCode: '80331' }), 'munich');
  assert.equal(marketFor({ postalCode: '50667', city: 'Köln' }), 'cologne');
  assert.equal(marketFor({ postalCode: '84513', city: 'München' }), null);
  assert.equal(marketFor({ city: 'München-Schwabing' }), 'munich');
  assert.equal(marketFor({ city: 'Potsdam' }), null);
});

test('plain English and German sentences give the core facts', () => {
  const english = extractFreeText('Bright 3-room flat, 4th floor. 82 m² living space, price 545.000 €. Built 1908, renovated. Energy class D, gas central heating. Hausgeld 310 € per month. Akazienstraße 14, 10823 Berlin.');
  assert.deepEqual([english.price, english.area, english.rooms, english.floor, english.year, english.energyClass, english.housegeld, english.condition], [545000, 82, 3, '4. OG', '1908', 'D', 310, 'renovated']);
  assert.deepEqual(english.address, { street: 'Akazienstraße 14', postalCode: '10823', city: 'Berlin' });
  const german = extractFreeText('Einfamilienhaus, 5 Zimmer, 140 m² Wohnfläche auf 620 m² Grundstück. Kaufpreis 1,2 Mio. €. Ölheizung. Lindenweg 3, 50999 Köln');
  assert.equal(german.price, 1_200_000);
  assert.equal(german.plotArea, 620);
  assert.equal(german.heating, 'Ölheizung');
  assert.equal(german.address?.street, 'Lindenweg 3');
  assert.equal(german.propertyType, 'house');
  assert.equal(extractFreeText('2 Zi., EG, 58qm, €389k').price, 389000);
  assert.equal(extractFreeText('Karl-Marx-Allee 12, 10243 Berlin').address?.street, 'Karl-Marx-Allee 12');
});

test('floors, rooms and short prices read the way buyers expect', () => {
  assert.equal(floorLabel('3. OG', 'en'), '3rd floor');
  assert.equal(floorLabel('11. OG', 'en'), '11th floor');
  assert.equal(floorLabel('EG', 'de'), 'Erdgeschoss');
  assert.equal(floorLabel('not stated', 'en'), '');
  assert.equal(parseRooms('2,5'), 2.5);
  assert.equal(parseRooms('not stated'), null);
  assert.equal(priceShort(749000, 'en'), '€749k');
  assert.equal(priceShort(1_250_000, 'de'), '1,25 Mio. €');
});

test('parsed German feature words map onto canonical keys once', () => {
  assert.deepEqual(featureKeys(['Balkon', 'Einbauküche', 'Keller', 'Balkon', 'Aufzug']), ['balcony', 'lift', 'cellar', 'kitchen']);
});

test('generated text uses only the facts and follows the reader language', () => {
  const listing = ready();
  assert.equal(generatedTitle(listing, 'en'), '3-room flat in Berlin');
  assert.equal(generatedTitle(listing, 'de'), '3-Zimmer-Wohnung in Berlin');
  assert.match(generatedDescription(listing, 'en'), /82 m² of living space, on the 4th floor in Berlin/);
  assert.equal(displayTitle(applyPatch(listing, { title: 'Sunny flat by the park' }, NOW), 'de'), 'Sunny flat by the park');
  // Clearing the text hands it back to the generator.
  const cleared = applyPatch(applyPatch(listing, { title: 'Mine' }, NOW), { title: '' }, NOW);
  assert.equal(cleared.autoTitle, true);
});

test('a listing is publishable only with title, price, size, place, photo, contact and consent', () => {
  assert.deepEqual(missingForPublish(ready()), []);
  const blank = blankListing({ id: 'abcdef123456', locale: 'en', propertyType: 'flat', now: NOW });
  // "Flat" alone is too short to stand as a headline.
  assert.deepEqual(missingForPublish(blank), ['title', 'price', 'size', 'location', 'photos', 'contact', 'consent']);
  assert.ok(missingForPublish(ready({ contact: { email: 'not-an-email' } })).includes('contact'));
  assert.ok(missingForPublish(ready({ contact: { showEmail: false } })).includes('contact'));
  assert.deepEqual(missingForPublish(ready({ contact: { phone: '+49 30 1234567', showEmail: false, showPhone: true } })), []);
  const land = applyPatch(ready(), { propertyType: 'land', facts: { plotArea: 640 } }, NOW);
  assert.deepEqual(missingForPublish(land), []);
  assert.equal(land.facts.area, 0);
  assert.equal(land.facts.rooms, null);
});

test('patches ignore unknown keys and keep values that do not parse', () => {
  const listing = ready();
  const next = applyPatch(listing, { facts: { price: 'lots', year: '19', energyClass: 'Z', rooms: '2,5' }, status: 'published', id: 'x' }, NOW);
  assert.equal(next.facts.price, 545000);
  assert.equal(next.facts.year, '');
  assert.equal(next.facts.energyClass, '');
  assert.equal(next.facts.rooms, 2.5);
  assert.equal(next.status, 'draft');
  assert.equal(next.id, 'abcdef123456');
  assert.equal(applyPatch(listing, { facts: { price: '1.250.000' } }, NOW).facts.price, 1250000);
});

test('a changed address drops the stored pin so it is geocoded again', () => {
  const pinned = { ...ready(), geo: { lat: 52.49, lon: 13.35, precision: 'street' } };
  assert.ok(applyPatch(pinned, { title: 'New title' }, NOW).geo);
  assert.equal(applyPatch(pinned, { address: { street: 'Goltzstraße 3' } }, NOW).geo, null);
});

test('the public copy hides what the seller did not share', () => {
  const listing = { ...ready({ contact: { phone: '+49 30 1234567' } }), geo: { lat: 52.488969, lon: 13.353631, precision: 'street' } };
  const shown = publicListing(listing);
  assert.equal(shown.address.street, 'Akazienstraße');
  assert.equal(shown.contact.phone, '');
  assert.equal(shown.contact.email, 'ada@example.com');
  assert.notEqual(shown.geo.lat, listing.geo.lat);
  assert.equal(shown.geo.precision, 'postcode');
  assert.equal(streetOnly('Karl-Marx-Allee 12a'), 'Karl-Marx-Allee');
  assert.equal(streetOnly('Am Hang 3-5'), 'Am Hang');
  assert.equal(blurredGeo(null), null);
  const exact = publicListing(applyPatch(listing, { address: { showExactAddress: true } }, NOW));
  assert.equal(exact.address.street, 'Akazienstraße 14');
});

test('reordering keeps every photo exactly once', () => {
  const photos = [{ kind: 'stored', id: 'a', width: 1, height: 1 }, { kind: 'remote', url: 'https://x/b.jpg' }, { kind: 'stored', id: 'c', width: 1, height: 1 }];
  assert.deepEqual(reorderPhotos(photos, ['c', 'unknown', 'c', 7]).map(photo => photo.id || photo.url), ['c', 'a', 'https://x/b.jpg']);
});

test('search filters, sorts and round-trips through the URL', () => {
  const base = { photos: [], score: null, reportId: null, origin: 'imported', market: 'berlin', city: 'Berlin', floor: '', plotArea: null, title: '' };
  const listings = [
    { ...base, id: 'a', propertyType: 'flat', price: 400000, area: 80, rooms: 3, district: 'Schöneberg', lat: 52.48, lon: 13.35, score: 7.2, publishedAt: '2026-10-01' },
    { ...base, id: 'b', propertyType: 'flat', price: 300000, area: 40, rooms: 1, district: 'Charlottenburg', lat: 52.51, lon: 13.30, score: null, publishedAt: '2026-10-03' },
    { ...base, id: 'c', propertyType: 'house', price: 900000, area: 150, rooms: null, district: 'Schöneberg', lat: null, lon: null, score: 8.1, publishedAt: '2026-10-02' },
  ];
  const ids = search => applySearch(listings, { ...DEFAULT_SEARCH, ...search }).map(listing => listing.id);
  assert.deepEqual(ids({}), ['b', 'c', 'a']);
  assert.deepEqual(ids({ maxPrice: 500000 }), ['b', 'a']);
  assert.deepEqual(ids({ minRooms: 2 }), ['a']);
  assert.deepEqual(ids({ type: 'house' }), ['c']);
  assert.deepEqual(ids({ sort: 'score' }), ['c', 'a', 'b']);
  assert.deepEqual(ids({ sort: 'sqm-asc' }), ['a', 'c', 'b']);
  assert.deepEqual(ids({ bounds: { south: 52.47, west: 13.34, north: 52.49, east: 13.36 } }), ['a']);
  const state = { ...DEFAULT_SEARCH, type: 'flat', maxPrice: 500000, district: 'Schöneberg', sort: 'price-asc', bounds: { south: 52.4, west: 13.2, north: 52.6, east: 13.5 } };
  assert.deepEqual(searchFromParams(searchToParams(state)), state);
  assert.deepEqual(searchFromParams(new URLSearchParams('type=castle&max=-4&sort=evil&area=1,2,0,0')), DEFAULT_SEARCH);
});

test('an imported report becomes a listing without the portal text or contact', () => {
  const report = parseListing(`3-Zimmer-Wohnung
Wohnung kaufen
Kaufpreis: 449.000 €
Wohnfläche: 73,7 m²
Zimmer: 3
Etage: 3. OG
Baujahr: 1912
Energieeffizienzklasse: C
Hausgeld: 388 €
Ausstattung: Balkon, Keller
Adresse: Liselotte-Herrmann-Str. 12, 10407 Berlin (Prenzlauer Berg)
Beschreibung
Ruhige Altbauwohnung. Kontakt: verkaeufer@example.com`, 'https://www.ohne-makler.net/immobilie/1/');
  const listing = listingFromReport(report, { id: 'abcdef123456', origin: 'imported', locale: 'de', now: NOW, sourceUrl: 'https://www.ohne-makler.net/immobilie/1/', sourceName: 'ohne-makler.net', district: 'Prenzlauer Berg' });
  assert.equal(listing.facts.price, 449000);
  assert.equal(listing.facts.energyClass, 'C');
  assert.deepEqual(listing.facts.features, ['balcony', 'cellar']);
  assert.equal(listing.market, 'berlin');
  assert.equal(listing.contact.email, '');
  assert.equal(listing.description, '');
  assert.ok(listing.autoDescription);
  assert.equal(cleanDistrict('Mitte Mitte'), 'Mitte');
  assert.equal(listingSummary(listing, 'en').title, '3-room flat in Prenzlauer Berg');
});

test('a seller listing reads back through the parser with the same facts', () => {
  const listing = applyPatch(ready(), { facts: { year: '1908', energyClass: 'D', housegeld: 310, features: ['balcony', 'lift'] }, address: { district: 'Schöneberg' } }, NOW);
  const report = parseListing(listingAsSourceText(listing), 'Review a House listing');
  assert.equal(report.facts.price, 545000);
  assert.equal(report.facts.area, 82);
  assert.equal(report.facts.rooms, '3');
  assert.equal(report.facts.year, '1908');
  assert.equal(report.facts.energy, 'D');
  assert.equal(report.facts.housegeld, 310);
  assert.equal(report.facts.postalCode, '10823');
  assert.equal(report.propertyType, 'flat');
});

test('share links carry the URL encoded and no tracking', () => {
  const targets = shareTargets('https://reviewahouse.com/l/abcdef123456', 'Flat & garden');
  assert.equal(targets.length, 6);
  for (const target of targets) assert.doesNotMatch(target.href, /utm_/);
  assert.match(targets.find(target => target.id === 'telegram').href, /url=https%3A%2F%2Freviewahouse\.com%2Fl%2Fabcdef123456&text=Flat%20%26%20garden/);
});
