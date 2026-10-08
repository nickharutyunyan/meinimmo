import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolveLocation } from '../lib/display.ts';
import { copy } from '../lib/i18n.ts';
import { EXTRACTION_VERSION } from '../lib/report-integrity.ts';
import { OSM_ATTRIBUTION } from '../lib/osm-map.ts';
import {
  GEOCODE_CACHE_TTL_MS,
  GEOCODE_QUERY_LIMIT,
  NOMINATIM_CONTACT,
  NOMINATIM_MIN_INTERVAL_MS,
  acquireD1NominatimSlot,
  applyStoredGeocode,
  cacheEntryFresh,
  canPersistGeocode,
  createD1GeocodeCache,
  createMemoryGeocodeCache,
  createMemoryRateStore,
  geocodeCacheKey,
  geocodeForView,
  geocodePrecision,
  lookupCachedGeocode,
  neighborhoodFromAddress,
  nominatimRequestHeaders,
  normalizeGeocodeQuery,
  rejectGeocodeRequest,
  reportGeocodeQuery,
  withParsedGeocode,
} from '../lib/geocode.ts';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('selects the most precise factual OpenStreetMap neighborhood', () => {
  assert.equal(neighborhoodFromAddress({ suburb: 'Prenzlauer Berg', borough: 'Pankow', city: 'Berlin' }, 'Berlin'), 'Prenzlauer Berg');
  assert.equal(neighborhoodFromAddress({ quarter: 'Südvorstadt', city: 'Leipzig' }, 'Leipzig'), 'Südvorstadt');
});

test('does not mistake a city or postcode for a neighborhood', () => {
  assert.equal(neighborhoodFromAddress({ suburb: 'Berlin', borough: 'Berlin' }, 'Berlin'), '');
  assert.equal(neighborhoodFromAddress({ neighbourhood: '10437' }, 'Berlin'), '');
});

function sampleReport(overrides = {}) {
  return {
    extractionVersion: EXTRACTION_VERSION,
    id: 'abc12345',
    title: 'Flat',
    address: 'Dörpfeldstraße 5, 12489 Berlin',
    location: 'Berlin',
    propertyType: 'flat',
    source: 'test',
    createdAt: '2026-10-01T00:00:00.000Z',
    facts: {
      price: 172000, area: 30, rooms: '1', year: '1987', floor: '1', energy: 'C', heating: 'gas', totalCost: 180000,
      postalCode: '12489', city: 'Berlin', street: 'Dörpfeldstraße 5',
    },
    score: null, summary: '', considerations: [], sunOrientation: 'not stated', aiEnriched: false,
    ...overrides,
    facts: { ...{
      price: 172000, area: 30, rooms: '1', year: '1987', floor: '1', energy: 'C', heating: 'gas', totalCost: 180000,
      postalCode: '12489', city: 'Berlin', street: 'Dörpfeldstraße 5',
    }, ...(overrides.facts || {}) },
  };
}

test('the map query keeps a stated house number and does not invent one', () => {
  const exact = sampleReport();
  assert.match(reportGeocodeQuery(exact), /Dörpfeldstraße 5/);
  assert.equal(geocodePrecision(resolveLocation(exact).basis), 'street');

  const streetOnly = sampleReport({
    address: 'Dörpfeldstraße, 12489 Berlin',
    facts: { street: 'Dörpfeldstraße', district: undefined },
  });
  const query = reportGeocodeQuery(streetOnly);
  assert.match(query, /Dörpfeldstraße, 12489 Berlin, Germany/);
  assert.doesNotMatch(query, /Dörpfeldstraße\s+\d/);
  assert.equal(geocodePrecision(resolveLocation(streetOnly).basis), 'street');

  const postal = sampleReport({
    address: '12489 Berlin',
    location: 'Berlin',
    facts: { street: undefined, district: undefined },
  });
  assert.match(reportGeocodeQuery(postal), /12489 Berlin, Germany/);
  assert.equal(geocodePrecision(resolveLocation(postal).basis), 'postcode');
});

test('normalised geocode keys fold German case, umlauts and spacing', () => {
  assert.equal(normalizeGeocodeQuery('  Müllerstraße   12,  10437 Berlin '), 'müllerstraße 12, 10437 berlin');
  assert.equal(geocodeCacheKey('Straße 12', 'de'), geocodeCacheKey('straße 12', 'de'));
  assert.match(geocodeCacheKey('Müllerstraße', 'de'), /^de:müllerstraße$/);
});

test('Nominatim requests identify the site and its contact address', () => {
  const headers = nominatimRequestHeaders();
  assert.match(headers['User-Agent'], new RegExp(NOMINATIM_CONTACT.replace(/[.]/g, '\\.')));
  assert.equal(headers.Referer, 'https://reviewahouse.com/');
  assert.match(headers['User-Agent'], /reviewahouse\.com/);
});

test('a cache hit does not call Nominatim', async () => {
  const cache = createMemoryGeocodeCache();
  const key = geocodeCacheKey('  Berlin Mitte ', 'de');
  await cache.set(key, { lat: 52.5, lon: 13.4, label: 'Berlin' }, 1_000);
  let fetches = 0;
  const result = await lookupCachedGeocode({
    query: 'berlin mitte',
    country: 'de',
    cache,
    clock: () => 1_000 + 60_000,
    fetchPlace: async () => { fetches += 1; throw new Error('nominatim'); },
    acquireSlot: async () => { throw new Error('slot'); },
    wait: async () => { throw new Error('wait'); },
  });
  assert.equal(fetches, 0);
  assert.equal(result.cache, 'hit');
  assert.equal(result.place.lat, 52.5);
});

test('a cache entry older than 30 days is fetched once and replaced', async () => {
  const cache = createMemoryGeocodeCache();
  const now = GEOCODE_CACHE_TTL_MS + 5_000;
  await cache.set(geocodeCacheKey('Leipzig', 'de'), { lat: 1, lon: 2, label: 'old' }, 0);
  assert.equal(cacheEntryFresh(0, now), false);
  assert.equal(cacheEntryFresh(now - GEOCODE_CACHE_TTL_MS + 1, now), true);
  let fetches = 0;
  const result = await lookupCachedGeocode({
    query: 'Leipzig',
    country: 'de',
    cache,
    clock: () => now,
    acquireSlot: async () => true,
    fetchPlace: async () => { fetches += 1; return { lat: 51.3, lon: 12.4, label: 'Leipzig', neighborhood: 'Zentrum' }; },
  });
  assert.equal(fetches, 1);
  assert.equal(result.cache, 'miss');
  const again = await lookupCachedGeocode({
    query: 'Leipzig',
    country: 'de',
    cache,
    clock: () => now + 1,
    acquireSlot: async () => { throw new Error('slot'); },
    fetchPlace: async () => { fetches += 1; throw new Error('nominatim'); },
  });
  assert.equal(fetches, 1);
  assert.equal(again.cache, 'hit');
  assert.equal(again.place.neighborhood, 'Zentrum');
});

test('the global Nominatim slot refuses a second request inside one second, then allows the next', async () => {
  const rate = createMemoryRateStore();
  assert.equal(await rate.tryAcquire(10_000), true);
  assert.equal(await rate.tryAcquire(10_000 + NOMINATIM_MIN_INTERVAL_MS - 1), false);
  assert.equal(await rate.tryAcquire(10_000 + NOMINATIM_MIN_INTERVAL_MS), true);

  let now = 20_000;
  const limited = createMemoryRateStore();
  assert.equal(await limited.tryAcquire(now), true);
  let fetches = 0;
  const result = await lookupCachedGeocode({
    query: 'Erfurt',
    country: 'de',
    cache: createMemoryGeocodeCache(),
    clock: () => now,
    wait: async (ms) => { now += ms; },
    acquireSlot: (at) => limited.tryAcquire(at),
    fetchPlace: async () => { fetches += 1; return { lat: 50.9, lon: 11.0, label: 'Erfurt' }; },
  });
  assert.equal(fetches, 1);
  assert.ok(now >= 20_000 + NOMINATIM_MIN_INTERVAL_MS);
  assert.equal(result.place.label, 'Erfurt');
});

test('a view geocode persists once and a repeat does not call Nominatim', async () => {
  const report = sampleReport();
  const saved = [];
  let fetches = 0;
  const cache = createMemoryGeocodeCache();
  const rate = createMemoryRateStore();
  let now = 50_000;
  const deps = {
    cache,
    clock: () => now,
    wait: async (ms) => { now += ms; },
    acquireSlot: (at) => rate.tryAcquire(at),
    fetchPlace: async () => { fetches += 1; return { lat: 52.43, lon: 13.54, label: 'Adlershof' }; },
    loadReport: async () => saved[0] || report,
    saveReport: async (next) => { saved.push(next); },
  };
  const query = reportGeocodeQuery(report);
  const first = await geocodeForView({ ok: true, query, country: 'de', reportId: report.id }, deps);
  assert.equal(first.persisted, true);
  assert.equal(first.cache, 'miss');
  assert.equal(fetches, 1);
  assert.equal(saved[0].geocode.lat, 52.43);
  assert.equal(saved[0].geocode.precision, 'street');
  assert.equal(saved[0].extractionVersion, EXTRACTION_VERSION);
  assert.equal(saved[0].extractionVersion, report.extractionVersion);

  const second = await geocodeForView({ ok: true, query, country: 'de', reportId: report.id }, deps);
  assert.equal(fetches, 1);
  assert.equal(second.cache, 'hit');
  assert.equal(second.persisted, false);
  assert.equal(saved.length, 1);
  assert.equal(canPersistGeocode(saved[0], query), false);
});

test('a mismatched query is not written onto the report', async () => {
  const report = sampleReport();
  let saved = 0;
  const result = await geocodeForView({ ok: true, query: 'Somewhere else', country: 'de', reportId: report.id }, {
    cache: createMemoryGeocodeCache(),
    acquireSlot: async () => true,
    fetchPlace: async () => ({ lat: 1, lon: 2, label: 'Elsewhere' }),
    loadReport: async () => report,
    saveReport: async () => { saved += 1; },
  });
  assert.equal(result.place.lat, 1);
  assert.equal(result.persisted, false);
  assert.equal(saved, 0);
});

test('one Nominatim response stores the pin and the neighbourhood for a postal-only report', () => {
  const postal = sampleReport({
    address: '12489 Berlin',
    location: 'Berlin',
    facts: { street: undefined, district: undefined },
  });
  const next = withParsedGeocode(postal, { lat: 52.43, lon: 13.54, label: '12489 Berlin', neighborhood: 'Adlershof' });
  assert.equal(next.geocode.precision, 'postcode');
  assert.equal(next.facts.district, 'Adlershof');
  assert.equal(next.location, 'Adlershof');
  assert.equal(next.extractionVersion, postal.extractionVersion);

  const addressed = withParsedGeocode(sampleReport(), { lat: 1, lon: 2, label: 'x', neighborhood: 'Should stay off the report' });
  assert.equal(addressed.facts.district, undefined);
  assert.equal(addressed.geocode.precision, 'street');
  assert.equal(applyStoredGeocode(addressed, { lat: 9, lon: 9, label: 'other' }, 'postcode'), addressed);
});

test('cross-origin and oversized geocode queries are rejected before any lookup', () => {
  const cross = rejectGeocodeRequest('https://reviewahouse.com/api/geocode?q=Berlin', 'https://evil.example');
  assert.equal(cross.ok, false);
  assert.equal(cross.status, 403);

  const missing = rejectGeocodeRequest('https://reviewahouse.com/api/geocode?q=Berlin', null);
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 403);

  const oversized = rejectGeocodeRequest(`https://reviewahouse.com/api/geocode?q=${'a'.repeat(GEOCODE_QUERY_LIMIT + 1)}`, 'https://reviewahouse.com');
  assert.equal(oversized.ok, false);
  assert.equal(oversized.status, 400);

  const allowed = rejectGeocodeRequest('https://reviewahouse.com/api/geocode?q=M%C3%BCllerstra%C3%9Fe%2012&report=abc12345&country=AM', 'https://reviewahouse.com');
  assert.equal(allowed.ok, true);
  assert.equal(allowed.query, 'Müllerstraße 12');
  assert.equal(allowed.country, 'am');
  assert.equal(allowed.reportId, 'abc12345');
});

test('D1 cache round-trips a result and the rate-limit row spaces live calls', async () => {
  const rows = new Map();
  let last = null;
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              return rows.get(values[0]) || null;
            },
            async run() {
              if (sql.includes('geocode_cache')) {
                rows.set(values[0], { lat: values[1], lon: values[2], label: values[3], neighborhood: values[4], cached_at: values[5] });
                return { meta: { changes: 1 } };
              }
              const now = values[0];
              const interval = values[1];
              if (last == null || now - last >= interval) {
                last = now;
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
  const cache = createD1GeocodeCache(db);
  await cache.set('de:berlin', { lat: 52.5, lon: 13.4, label: 'Berlin', neighborhood: 'Mitte' }, 1_700_000_000_000);
  const stored = await cache.get('de:berlin');
  assert.equal(stored.place.neighborhood, 'Mitte');
  assert.equal(stored.place.lat, 52.5);
  assert.equal(await acquireD1NominatimSlot(db, 5_000), true);
  assert.equal(await acquireD1NominatimSlot(db, 5_500), false);
  assert.equal(await acquireD1NominatimSlot(db, 6_000), true);

  const broken = createD1GeocodeCache({
    prepare() {
      return { bind() { return { async first() { throw new Error('no such table'); }, async run() { throw new Error('no such table'); } }; } };
    },
  });
  assert.equal(await broken.get('de:berlin'), undefined);
  await broken.set('de:berlin', { lat: 1, lon: 2, label: 'Berlin' }, 0);
});

test('views use a stored pin, comparisons do not call Nominatim, and every map shows the credit', async () => {
  const location = await read('components/LocationCard.tsx');
  const comparison = await read('components/ComparisonView.tsx');
  const armenia = await read('components/ArmeniaReport.tsx');
  const guide = await read('components/GuideArticleView.tsx');
  const assess = await read('app/api/assess/route.ts');
  const route = await read('app/api/geocode/route.ts');
  const migration = await read('migrations/0004_geocode_cache.sql');

  assert.match(location, /if \(hasStoredGeocode\(geocode\)\)/);
  assert.ok(location.indexOf('hasStoredGeocode(geocode)') < location.indexOf('fetch(`/api/geocode'));
  assert.match(location, /© OpenStreetMap contributors|text\.credit/);
  assert.equal(copy.en.map.credit, OSM_ATTRIBUTION);
  assert.equal(copy.de.map.credit, OSM_ATTRIBUTION);
  assert.match(armenia, /OSM_ATTRIBUTION/);
  assert.match(guide, /OSM_ATTRIBUTION/);
  assert.match(armenia, /hasStoredGeocode\(report\.geocode\)/);
  assert.ok(armenia.indexOf('hasStoredGeocode(report.geocode)') < armenia.indexOf('fetch(`/api/geocode'));

  assert.doesNotMatch(comparison, /neighborhoodForReport|nominatim|geocodeGermanLocation/);
  assert.match(comparison, /reportNeighborhood\(first\)/);
  assert.match(assess, /attachReportGeocode/);
  assert.doesNotMatch(assess, /neighborhoodForPostalCode/);
  assert.match(route, /requireSameOrigin\(request\)/);
  assert.match(route, /rejectGeocodeRequest/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS geocode_cache/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS geocode_rate_limit/);
  assert.ok(GEOCODE_CACHE_TTL_MS >= 30 * 24 * 60 * 60 * 1000);
});
