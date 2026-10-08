import { reportCacheBuildId, reportCacheRequest } from './report-cache-key.ts';
import { validReportId } from './report-note-validation.ts';

/**
 * How long a report document stays in `caches.default`.
 * That cache is colo-local, so a save can only delete the location that
 * handled it. Five minutes is what makes every other location serve the
 * saved page without a cache-purge token. A hit still returns the stored
 * HTML and does not read D1.
 */
export const REPORT_HTML_CACHE_TTL_SECONDS = 5 * 60;

/** Origins whose document cache is cleared when a report is saved. The Cache API is colo-local. */
export const REPORT_HTML_ORIGINS = [
  'https://reviewahouse.com',
  'https://www.reviewahouse.com',
  'http://127.0.0.1:8787',
  'http://localhost:8787',
  'http://localhost:3000',
];

export function reportHtmlUrls(id: string, buildId = reportCacheBuildId()) {
  if (!validReportId(id)) return [];
  return REPORT_HTML_ORIGINS.flatMap(origin => [
    reportCacheRequest(`${origin}/r/${id}`, buildId).url,
    reportCacheRequest(`${origin}/de/r/${id}`, buildId).url,
  ]);
}

export async function invalidateReportHtml(id: string) {
  const cache = (globalThis.caches as { default?: Cache } | undefined)?.default;
  if (!cache) return;
  const buildId = reportCacheBuildId();
  await Promise.all(reportHtmlUrls(id, buildId).map(async (url) => {
    try {
      await cache.delete(reportCacheRequest(url, buildId));
    } catch {
      // Purging a colo cache must not fail the D1 write.
    }
  }));
}
