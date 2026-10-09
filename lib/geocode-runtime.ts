import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { refreshDerivedReport } from './listing-parser.ts';
import { report as findReport, replaceReport } from './store.ts';
import { resolveLocation } from './display.ts';
import { hasStoredGeocode } from './osm-map.ts';
import {
  acquireGeocodeSlot,
  createD1GeocodeCache,
  createMemoryGeocodeCache,
  createMemoryRateStore,
  geocodeD1TablesMissing,
  geocodeCacheKey,
  geocodeForView,
  geocodeGermanLocation,
  lookupCachedGeocode,
  reportGeocodeQuery,
  withParsedGeocode,
  type GeocodeAllowance,
  type SqlDatabase,
} from './geocode.ts';
import type { Report } from './types.ts';

const isolateCache = createMemoryGeocodeCache();
const isolateRate = createMemoryRateStore();

async function database() {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB as SqlDatabase | undefined;
}

export async function runtimeGeocodeCache() {
  if (geocodeD1TablesMissing()) return isolateCache;
  try {
    const db = await database();
    if (db) return createD1GeocodeCache(db);
  } catch { /* Binding failures use the isolate cache. A missing table is handled on the first query. */ }
  return isolateCache;
}

export async function acquireRuntimeNominatimSlot(now: number) {
  try {
    return await acquireGeocodeSlot(await database(), now, isolateRate);
  } catch {
    return isolateRate.tryAcquire(now);
  }
}

/** One Nominatim lookup per new report. The neighbourhood, when missing, comes from that same response. */
export async function attachReportGeocode(report: Report): Promise<Report> {
  if (hasStoredGeocode(report.geocode)) return report;
  const query = reportGeocodeQuery(report);
  if (!query) return report;
  const country = report.country === 'AM' ? 'am' : 'de';
  const city = report.country === 'AM' ? '' : resolveLocation(report).city;
  try {
    const result = await lookupCachedGeocode({
      query,
      country,
      city,
      cache: await runtimeGeocodeCache(),
      fetchPlace: (value, placeCity, code) => geocodeGermanLocation(value, placeCity, code),
      acquireSlot: acquireRuntimeNominatimSlot,
    });
    if (!result.place) return report;
    const next = withParsedGeocode(report, result.place);
    return next.facts.district !== report.facts.district ? refreshDerivedReport(next) : next;
  } catch (error) {
    console.warn('Geocoding during import failed', { message: error instanceof Error ? error.message : 'unknown error' });
    return report;
  }
}

export async function viewGeocode(allowed: GeocodeAllowance) {
  return geocodeForView(allowed, {
    cache: await runtimeGeocodeCache(),
    fetchPlace: (query, city, country) => geocodeGermanLocation(query, city, country),
    acquireSlot: acquireRuntimeNominatimSlot,
    loadReport: findReport,
    saveReport: (item) => replaceReport(item),
  });
}

/**
 * The neighbourhood Nominatim gave for a report's address. Reads the cached
 * response attachReportGeocode just stored, so it costs no second request.
 */
export async function cachedNeighborhood(report: Report): Promise<string> {
  const query = reportGeocodeQuery(report);
  if (!query || report.country === 'AM') return '';
  try {
    const cache = await runtimeGeocodeCache();
    const cached = await cache.get(geocodeCacheKey(query, 'de'));
    return cached?.place.neighborhood || '';
  } catch {
    return '';
  }
}
