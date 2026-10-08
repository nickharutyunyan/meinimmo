/**
 * Cache key for a report document. The build id is part of the key so a deploy
 * stops serving HTML that points at the previous `/_next/static` chunks.
 * The visitor's URL is unchanged; only the Request stored in the Cache API
 * carries `b`.
 */
export function reportCacheRequest(requestUrl: string, buildId: string) {
  const url = new URL(requestUrl);
  url.search = '';
  url.hash = '';
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
  url.searchParams.set('b', buildId);
  return new Request(url.toString(), { method: 'GET' });
}

/** Build id OpenNext stamps on the server isolate from `.next/BUILD_ID`. */
export function reportCacheBuildId() {
  return (process.env.OPEN_NEXT_BUILD_ID || process.env.NEXT_BUILD_ID || '').trim();
}
