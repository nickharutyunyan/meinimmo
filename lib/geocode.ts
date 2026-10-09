import type { Report } from './types';
import { stateFromGeocodeLabel, type StateCode } from './buyer-costs.ts';
import { resolveLocation } from './display.ts';
import { validReportId } from './report-note-validation.ts';
import { hasStoredGeocode } from './osm-map.ts';

export type GermanPlace = {
  lat: number;
  lon: number;
  label: string;
  neighborhood?: string;
  /** Parsed from a Nominatim label or address.state already in hand. */
  state?: StateCode;
};

export type GeocodePrecision = 'street' | 'postcode';

/** Nominatim's usage policy asks for a contact on the User-Agent. This is the site's existing address. */
export const NOMINATIM_CONTACT = 'account@updates.reviewahouse.com';
export const NOMINATIM_USER_AGENT = `ReviewAHouse/1.0 (https://reviewahouse.com; ${NOMINATIM_CONTACT})`;
export const NOMINATIM_REFERER = 'https://reviewahouse.com/';
export const GEOCODE_QUERY_LIMIT = 160;
export const GEOCODE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const NOMINATIM_MIN_INTERVAL_MS = 1000;

type NominatimPlace = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string | undefined>;
};

export type SqlDatabase = {
  prepare(query: string): {
    bind(...values: Array<string | number | null>): {
      first<T>(): Promise<T | null>;
      run(): Promise<{ meta?: { changes?: number } }>;
    };
  };
};

export type GeocodeCacheStore = {
  get(key: string): Promise<{ place: GermanPlace; cachedAt: number } | undefined>;
  set(key: string, place: GermanPlace, cachedAt: number): Promise<void>;
};

export function nominatimRequestHeaders() {
  return {
    'User-Agent': NOMINATIM_USER_AGENT,
    Referer: NOMINATIM_REFERER,
    Accept: 'application/json',
  };
}

function cleanArea(value?: string) {
  return (value || '').replace(/^kreisfreie\s+stadt\s+/i, '').replace(/\s+/g, ' ').trim();
}

export function neighborhoodFromAddress(address: Record<string, string | undefined> | undefined, city = '') {
  if (!address) return '';
  const normalizedCity = cleanArea(city).toLocaleLowerCase('de-DE');
  const candidates = [address.neighbourhood, address.suburb, address.quarter, address.city_district, address.borough];
  return candidates
    .map(cleanArea)
    .find(candidate => candidate && !/^\d{5}$/.test(candidate) && candidate.toLocaleLowerCase('de-DE') !== normalizedCity) || '';
}

export function normalizeGeocodeQuery(query: string) {
  return query.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('de-DE');
}

export function geocodeCacheKey(query: string, country: 'de' | 'am') {
  return `${country}:${normalizeGeocodeQuery(query)}`;
}

/** A stated street keeps a street pin. Anything coarser is a postcode-area pin. Never invent a house number. */
export function geocodePrecision(basis: string): GeocodePrecision {
  return basis === 'address' || basis === 'street' ? 'street' : 'postcode';
}

export function cacheEntryFresh(cachedAt: number, now: number, ttl = GEOCODE_CACHE_TTL_MS) {
  return Number.isFinite(cachedAt) && now >= cachedAt && now - cachedAt < ttl;
}

export function nominatimSlotAllowed(lastRequestAt: number | undefined, now: number) {
  return lastRequestAt == null || now - lastRequestAt >= NOMINATIM_MIN_INTERVAL_MS;
}

export function reportGeocodeQuery(report: Pick<Report, 'country' | 'address' | 'location' | 'source' | 'facts'>) {
  if (report.country === 'AM') {
    const address = (report.address || '').trim();
    return address ? `${address}, Armenia` : '';
  }
  return resolveLocation(report).mapQuery;
}

export function canPersistGeocode(report: Report, query: string) {
  if (hasStoredGeocode(report.geocode)) return false;
  const expected = normalizeGeocodeQuery(reportGeocodeQuery(report));
  return Boolean(expected) && expected === normalizeGeocodeQuery(query);
}

function placeState(place: GermanPlace): StateCode | undefined {
  return place.state || stateFromGeocodeLabel(place.label);
}

export function applyStoredGeocode(report: Report, place: GermanPlace, precision: GeocodePrecision): Report {
  if (hasStoredGeocode(report.geocode)) return report;
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return report;
  const state = placeState(place);
  return { ...report, geocode: { lat: place.lat, lon: place.lon, precision, ...(state ? { state } : {}) } };
}

/**
 * Attach the pin from a single Nominatim response. A postal-only German report
 * also keeps the neighbourhood from that same response, and does not call again.
 */
export function withParsedGeocode(report: Report, place: GermanPlace): Report {
  const precision = report.country === 'AM'
    ? (report.armenia?.approximate ? 'postcode' : 'street')
    : geocodePrecision(resolveLocation(report).basis);
  const located = applyStoredGeocode(report, place, precision);
  if (located === report || report.country === 'AM') return located;
  if (report.facts.street || report.facts.district || !report.facts.postalCode || !place.neighborhood) return located;
  return {
    ...located,
    location: place.neighborhood,
    facts: { ...located.facts, district: place.neighborhood, locationPrecision: 'neighborhood' },
  };
}

export async function geocodeGermanLocation(query: string, city = '', country: 'de' | 'am' = 'de'): Promise<GermanPlace | undefined> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', country);
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('q', query);
  const response = await fetch(url, {
    headers: nominatimRequestHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Geocoding service unavailable');
  const [place] = await response.json() as NominatimPlace[];
  if (!place) return undefined;
  const neighborhood = neighborhoodFromAddress(place.address, city);
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  const label = place.display_name;
  const state = stateFromGeocodeLabel(place.address?.state || label) || stateFromGeocodeLabel(label);
  return { lat, lon, label, neighborhood: neighborhood || undefined, ...(state ? { state } : {}) };
}

export function createMemoryGeocodeCache(): GeocodeCacheStore {
  const rows = new Map<string, { place: GermanPlace; cachedAt: number }>();
  return {
    async get(key) { return rows.get(key); },
    async set(key, place, cachedAt) { rows.set(key, { place, cachedAt }); },
  };
}

export function createMemoryRateStore() {
  let last: number | undefined;
  return {
    async tryAcquire(now: number) {
      if (!nominatimSlotAllowed(last, now)) return false;
      last = now;
      return true;
    },
  };
}

type CacheRow = { lat: number; lon: number; label: string; neighborhood: string | null; cached_at: string };

/** One warning per isolate. A deploy can run before migration 0004; later requests stay quiet. */
let missingGeocodeTableLogged = false;

export function missingGeocodeTable(error: unknown) {
  const cause = error instanceof Error && error.cause != null ? String(error.cause) : '';
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /no such table/i.test(`${message} ${cause}`);
}

export function geocodeD1TablesMissing() {
  return missingGeocodeTableLogged;
}

export function resetMissingGeocodeTableNoticeForTests() {
  missingGeocodeTableLogged = false;
}

function noteMissingGeocodeTable(error: unknown) {
  if (!missingGeocodeTable(error)) return false;
  if (!missingGeocodeTableLogged) {
    missingGeocodeTableLogged = true;
    console.warn('D1 geocode tables are missing (no such table). Lookups continue without geocode_cache and geocode_rate_limit; pins stay on the report.');
  }
  return true;
}

export function createD1GeocodeCache(db: SqlDatabase): GeocodeCacheStore {
  return {
    async get(key) {
      try {
        const row = await db.prepare('SELECT lat, lon, label, neighborhood, cached_at FROM geocode_cache WHERE query_key = ?1').bind(key).first<CacheRow>();
        if (!row || !Number.isFinite(Number(row.lat)) || !Number.isFinite(Number(row.lon))) return undefined;
        const cachedAt = Date.parse(row.cached_at);
        if (!Number.isFinite(cachedAt)) return undefined;
        const state = stateFromGeocodeLabel(row.label);
        return {
          cachedAt,
          place: {
            lat: Number(row.lat),
            lon: Number(row.lon),
            label: row.label,
            neighborhood: row.neighborhood || undefined,
            ...(state ? { state } : {}),
          },
        };
      } catch (error) {
        if (noteMissingGeocodeTable(error)) return undefined;
        return undefined;
      }
    },
    async set(key, place, cachedAt) {
      try {
        await db.prepare(`INSERT INTO geocode_cache (query_key, lat, lon, label, neighborhood, cached_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
          ON CONFLICT(query_key) DO UPDATE SET
            lat = excluded.lat, lon = excluded.lon, label = excluded.label,
            neighborhood = excluded.neighborhood, cached_at = excluded.cached_at`)
          .bind(key, place.lat, place.lon, place.label, place.neighborhood || null, new Date(cachedAt).toISOString())
          .run();
      } catch (error) {
        // A missing cache table must not block the lookup that fills the report JSON.
        noteMissingGeocodeTable(error);
      }
    },
  };
}

/** Best-effort global slot. A lost race returns no change and the caller waits. */
export async function acquireD1NominatimSlot(db: SqlDatabase, now: number) {
  try {
    const result = await db.prepare(`INSERT INTO geocode_rate_limit (id, last_request_at) VALUES ('nominatim', ?1)
      ON CONFLICT(id) DO UPDATE SET last_request_at = excluded.last_request_at
      WHERE ?1 - geocode_rate_limit.last_request_at >= ?2`)
      .bind(now, NOMINATIM_MIN_INTERVAL_MS)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  } catch (error) {
    if (noteMissingGeocodeTable(error)) return true;
    throw error;
  }
}

/**
 * Uses the D1 slot when the rate-limit table exists. A missing table is "no row":
 * the request is allowed, and this isolate spaces further calls itself.
 */
export async function acquireGeocodeSlot(db: SqlDatabase | undefined, now: number, isolate: { tryAcquire(now: number): Promise<boolean> }) {
  if (geocodeD1TablesMissing() || !db) return isolate.tryAcquire(now);
  try {
    const allowed = await acquireD1NominatimSlot(db, now);
    if (geocodeD1TablesMissing()) return isolate.tryAcquire(now);
    return allowed;
  } catch (error) {
    if (noteMissingGeocodeTable(error)) return isolate.tryAcquire(now);
    throw error;
  }
}

export async function lookupCachedGeocode(options: {
  query: string;
  country: 'de' | 'am';
  cache: GeocodeCacheStore;
  fetchPlace: (query: string, city: string, country: 'de' | 'am') => Promise<GermanPlace | undefined>;
  acquireSlot: (now: number) => Promise<boolean>;
  city?: string;
  wait?: (ms: number) => Promise<void>;
  clock?: () => number;
}): Promise<{ place?: GermanPlace; cache: 'hit' | 'miss' }> {
  const clock = options.clock ?? Date.now;
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const key = geocodeCacheKey(options.query, options.country);
  const cached = await options.cache.get(key);
  if (cached && cacheEntryFresh(cached.cachedAt, clock())) return { place: cached.place, cache: 'hit' };
  if (!await options.acquireSlot(clock())) {
    await wait(NOMINATIM_MIN_INTERVAL_MS);
    if (!await options.acquireSlot(clock())) throw new Error('Geocoding service unavailable');
  }
  const place = await options.fetchPlace(options.query, options.city || '', options.country);
  if (!place) return { cache: 'miss' };
  await options.cache.set(key, place, clock());
  return { place, cache: 'miss' };
}

export type GeocodeAllowance = { ok: true; query: string; country: 'de' | 'am'; reportId?: string };
export type GeocodeRejection = { ok: false; status: 400 | 403; error: string };

/**
 * Browsers omit Origin on a same-origin GET. Sec-Fetch-Site is set by the
 * browser, so a page cannot forge it. Older browsers that send neither
 * header are accepted only when Referer is this request's own origin.
 */
function geocodeCallerAllowed(requestUrl: URL, headers: { get(name: string): string | null }) {
  const origin = headers.get('origin')?.trim() || '';
  if (origin) return origin === requestUrl.origin;
  const site = headers.get('sec-fetch-site')?.trim().toLowerCase() || '';
  if (site) return site === 'same-origin';
  const referer = headers.get('referer')?.trim() || '';
  if (!referer) return false;
  try {
    return new URL(referer).origin === requestUrl.origin;
  } catch {
    return false;
  }
}

/** Same-origin only, with a hard query length, so this route cannot proxy arbitrary Nominatim searches. */
export function rejectGeocodeRequest(url: string, headers: { get(name: string): string | null }): GeocodeAllowance | GeocodeRejection {
  let requestUrl: URL;
  try { requestUrl = new URL(url); } catch { return { ok: false, status: 400, error: 'No usable location supplied.' }; }
  if (!geocodeCallerAllowed(requestUrl, headers)) return { ok: false, status: 403, error: 'Invalid request origin.' };
  const query = requestUrl.searchParams.get('q')?.trim() || '';
  if (!query || query.length > GEOCODE_QUERY_LIMIT || /not stated/i.test(query)) {
    return { ok: false, status: 400, error: 'No usable location supplied.' };
  }
  const country = requestUrl.searchParams.get('country') === 'AM' ? 'am' : 'de';
  const reportParam = requestUrl.searchParams.get('report')?.trim() || '';
  const reportId = reportParam && validReportId(reportParam) ? reportParam : undefined;
  return { ok: true, query, country, reportId };
}

export async function geocodeForView(allowed: GeocodeAllowance, deps: {
  cache: GeocodeCacheStore;
  fetchPlace: (query: string, city: string, country: 'de' | 'am') => Promise<GermanPlace | undefined>;
  acquireSlot: (now: number) => Promise<boolean>;
  loadReport?: (id: string) => Promise<Report | undefined>;
  saveReport?: (report: Report) => Promise<void>;
  wait?: (ms: number) => Promise<void>;
  clock?: () => number;
}): Promise<{ place?: GermanPlace; persisted: boolean; cache: 'hit' | 'miss' }> {
  const current = allowed.reportId && deps.loadReport ? await deps.loadReport(allowed.reportId) : undefined;
  if (current && hasStoredGeocode(current.geocode) && normalizeGeocodeQuery(reportGeocodeQuery(current)) === normalizeGeocodeQuery(allowed.query)) {
    if (!current.geocode.state) {
      const cached = await deps.cache.get(geocodeCacheKey(allowed.query, allowed.country));
      const state = cached?.place.state;
      if (state && deps.saveReport) {
        await deps.saveReport({ ...current, geocode: { ...current.geocode, state } });
        return { place: { ...cached.place, state }, persisted: true, cache: 'hit' };
      }
    }
    return {
      place: {
        lat: current.geocode.lat,
        lon: current.geocode.lon,
        label: allowed.query,
        ...(current.geocode.state ? { state: current.geocode.state } : {}),
      },
      persisted: false,
      cache: 'hit',
    };
  }
  const city = current && current.country !== 'AM' ? resolveLocation(current).city : '';
  const looked = await lookupCachedGeocode({
    query: allowed.query,
    country: allowed.country,
    city,
    cache: deps.cache,
    fetchPlace: deps.fetchPlace,
    acquireSlot: deps.acquireSlot,
    wait: deps.wait,
    clock: deps.clock,
  });
  if (!looked.place || !current || !deps.saveReport || !canPersistGeocode(current, allowed.query)) {
    return { place: looked.place, persisted: false, cache: looked.cache };
  }
  const precision = current.country === 'AM'
    ? (current.armenia?.approximate ? 'postcode' : 'street')
    : geocodePrecision(resolveLocation(current).basis);
  await deps.saveReport(applyStoredGeocode(current, looked.place, precision));
  return { place: looked.place, persisted: true, cache: looked.cache };
}
