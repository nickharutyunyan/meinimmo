import nextWorker, { BucketCachePurge, DOQueueHandler, DOShardedTagCache } from '../.open-next/worker.js';
import { REPORT_CACHE_BUILD_ID } from './build-id.mjs';
import { reportCacheRequest } from '../lib/report-cache-key.ts';
import { REPORT_HTML_CACHE_TTL_SECONDS } from '../lib/report-html-cache.ts';
import { applySecurityHeaders } from '../lib/security-headers.ts';
import { backfillRejection } from './backfill-gate.mjs';
import { applyDocumentLanguage, assetPathForPathname, documentLanguage, isCacheableDocument, isPersonalDocument, reportDocumentId, reportHtmlIsShared } from './routes.mjs';

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache };

const NEXT_TIMEOUT_MS = 20_000;

function tagged(response, workerPath) {
  const headers = new Headers(response.headers);
  headers.set('x-worker-path', workerPath);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function fetchAsset(request, env, pathname) {
  if (!env.ASSETS) return null;
  const assetUrl = new URL(request.url);
  assetUrl.pathname = assetPathForPathname(pathname);
  assetUrl.search = '';
  assetUrl.hash = '';
  const asset = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET' }));
  if (!asset.ok) return null;
  const headers = new Headers();
  const contentType = asset.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const etag = asset.headers.get('etag');
  if (etag) headers.set('etag', etag);
  const length = asset.headers.get('content-length');
  if (length) headers.set('content-length', length);
  headers.set('cache-control', 'public, max-age=0, must-revalidate');
  headers.set('vary', 'RSC, Next-Router-Prefetch, Next-Router-State-Tree, Next-Router-Segment-Prefetch');
  headers.set('x-worker-path', 'asset');
  applySecurityHeaders(headers);
  if (request.method === 'HEAD') return new Response(null, { status: asset.status, headers });
  return new Response(asset.body, { status: asset.status, headers });
}

function cacheableReport(response) {
  if (response.status !== 200) return false;
  if (response.headers.has('set-cookie')) return false;
  return (response.headers.get('content-type') || '').includes('text/html');
}

async function serveReport(request, env, ctx) {
  const cache = globalThis.caches?.default;
  const key = reportCacheRequest(request.url, REPORT_CACHE_BUILD_ID);
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const headers = new Headers(hit.headers);
        headers.set('cache-control', 'private, no-store');
        headers.delete('set-cookie');
        headers.set('x-report-cache', 'hit');
        headers.set('x-worker-path', 'report-cache');
        applySecurityHeaders(headers);
        return new Response(hit.body, { status: hit.status, headers });
      }
    } catch {
      // A cache read failure still renders the report.
    }
  }
  const response = await fetchNext(request, env, ctx);
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-report-cache', 'miss');
  if (!headers.has('x-worker-path')) headers.set('x-worker-path', 'next');
  applySecurityHeaders(headers);
  const html = cache && cacheableReport(response) ? await response.clone().text() : '';
  if (cache && html && reportHtmlIsShared(html)) {
    const storedHeaders = new Headers(headers);
    storedHeaders.set('cache-control', `public, max-age=${REPORT_HTML_CACHE_TTL_SECONDS}`);
    storedHeaders.delete('set-cookie');
    storedHeaders.delete('vary');
    const stored = new Response(html, { status: response.status, headers: storedHeaders });
    ctx.waitUntil(cache.put(key, stored).catch(() => undefined));
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function fetchNext(request, env, ctx) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      resolve(new Response('The server took too long to respond.', {
        status: 504,
        headers: {
          'cache-control': 'no-store',
          'content-type': 'text/plain; charset=utf-8',
          'x-worker-path': 'timeout',
        },
      }));
    }, NEXT_TIMEOUT_MS);
  });
  try {
    const response = await Promise.race([Promise.resolve(nextWorker.fetch(request, env, ctx)), timeout]);
    if (response.headers.get('x-worker-path') === 'timeout') return response;
    return tagged(response, 'next');
  } finally {
    clearTimeout(timer);
  }
}

async function withDocumentLanguage(response, pathname, method) {
  if (method === 'HEAD' || documentLanguage(pathname) === 'en') return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const html = applyDocumentLanguage(await response.text(), pathname);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const rejected = backfillRejection(request, env.BACKFILL_TOKEN);
    if (rejected) return rejected;
    const url = new URL(request.url);
    let response;
    if (isPersonalDocument(url.pathname)) response = await fetchNext(request, env, ctx);
    else if (isCacheableDocument(request.method, url.pathname, request.headers, url.searchParams)) {
      if (request.method === 'GET' && reportDocumentId(url.pathname)) response = await serveReport(request, env, ctx);
      else if (!reportDocumentId(url.pathname)) {
        const asset = await fetchAsset(request, env, url.pathname);
        response = asset || await fetchNext(request, env, ctx);
      } else response = await fetchNext(request, env, ctx);
    } else response = await fetchNext(request, env, ctx);
    if (isPersonalDocument(url.pathname)) {
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'private, no-store, max-age=0');
      headers.set('x-worker-path', headers.get('x-worker-path') || 'personal');
      response = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    return withDocumentLanguage(response, url.pathname, request.method);
  },
};
