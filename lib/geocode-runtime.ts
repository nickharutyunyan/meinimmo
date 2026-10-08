import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { refreshDerivedReport } from './listing-parser.ts';
import { report as findReport, replaceReport } from './store.ts';
import { resolveLocation } from './display.ts';
import { hasStoredGeocode } from './osm-map.ts';
import {
  acquireD1NominatimSlot,
  createD1GeocodeCache,
  createMemoryGeocodeCache,
  createMemoryRateStore,
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
  try {
    const db = await database();
    if (db) return createD1GeocodeCache(db);
  } catch { /* The report row is the durable pin. The cache table may not be migrated yet. */ }
  return isolateCache;
}

export async function acquireRuntimeNominatimSlot(now: number) {
  try {
    const db = await database();
    if (db) return await acquireD1NominatimSlot(db, now);
  } catch { /* One isolate-local slot is the fallback when D1 cannot record the global one. */ }
  return isolateRate.tryAcquire(now);
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
