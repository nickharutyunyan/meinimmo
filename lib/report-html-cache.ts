import { validReportId } from './report-note-validation.ts';

/** Origins whose document cache is cleared when a report is saved. The Cache API is colo-local. */
export const REPORT_HTML_ORIGINS = [
  'https://reviewahouse.com',
  'https://www.reviewahouse.com',
  'http://127.0.0.1:8787',
  'http://localhost:8787',
  'http://localhost:3000',
];

export function reportHtmlUrls(id: string) {
  if (!validReportId(id)) return [];
  return REPORT_HTML_ORIGINS.flatMap(origin => [`${origin}/r/${id}`, `${origin}/de/r/${id}`]);
}

export async function invalidateReportHtml(id: string) {
  const cache = globalThis.caches?.default;
  if (!cache) return;
  await Promise.all(reportHtmlUrls(id).map(async (url) => {
    try {
      await cache.delete(new Request(url, { method: 'GET' }));
    } catch {
      // Purging a colo cache must not fail the D1 write.
    }
  }));
}
