import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assetPathForPathname, cacheFileToAssetPath, isCacheableDocument, isRouterDataRequest, reportCacheRequest, reportDocumentId, reportHtmlIsShared } from '../cloudflare/routes.mjs';
import { withTimeout } from '../lib/io-timeout.ts';
import { invalidateReportHtml, reportHtmlUrls } from '../lib/report-html-cache.ts';
import { publishedBody, publishStaticPages } from '../scripts/publish-static-pages.mjs';

const headers = (pairs) => new Headers(pairs);
const params = (query) => new URLSearchParams(query);

test('document GETs of public pages are cacheable and router data is not', () => {
  assert.equal(isCacheableDocument('GET', '/', headers([]), params('')), true);
  assert.equal(isCacheableDocument('HEAD', '/de/guide/berlin-with-children/', headers([]), params('')), true);
  assert.equal(isCacheableDocument('POST', '/', headers([]), params('')), false);
  assert.equal(isCacheableDocument('GET', '/api/auth/me', headers([]), params('')), false);
  assert.equal(isCacheableDocument('GET', '/downloads/reviewahouse-helper.zip', headers([]), params('')), false);
  assert.equal(isCacheableDocument('GET', '/', headers([['RSC', '1']]), params('')), false);
  assert.equal(isCacheableDocument('GET', '/', headers([['Next-Router-Prefetch', '1']]), params('')), false);
  assert.equal(isCacheableDocument('GET', '/', headers([['Next-Router-Segment-Prefetch', '1']]), params('')), false);
  assert.equal(isCacheableDocument('GET', '/', headers([['Next-Router-State-Tree', '1']]), params('')), false);
  assert.equal(isCacheableDocument('GET', '/guide', headers([['Accept', 'text/x-component']]), params('')), false);
  assert.equal(isCacheableDocument('GET', '/', headers([]), params('_rsc=abc')), false);
  assert.equal(isRouterDataRequest(headers([['rsc', '1']]), params('')), true);
});

test('report documents are keyed without print or a query string', () => {
  assert.equal(reportDocumentId('/r/59531030123f2eba'), '59531030123f2eba');
  assert.equal(reportDocumentId('/de/r/59531030123f2eba/'), '59531030123f2eba');
  assert.equal(reportDocumentId('/r/59531030123f2eba/print'), '');
  assert.equal(reportDocumentId('/r/short'), '');
  assert.equal(reportDocumentId('/c/59531030123f2eba'), '');
  const key = reportCacheRequest('https://reviewahouse.com/de/r/59531030123f2eba?fresh=1#map');
  assert.equal(key.url, 'https://reviewahouse.com/de/r/59531030123f2eba');
  assert.equal(key.method, 'GET');
});

test('prerender cache files become asset paths', () => {
  assert.equal(cacheFileToAssetPath('index.cache'), 'index.html');
  assert.equal(cacheFileToAssetPath('de.cache'), 'de/index.html');
  assert.equal(cacheFileToAssetPath('guide/berlin-with-children.cache'), 'guide/berlin-with-children/index.html');
  assert.equal(cacheFileToAssetPath('sitemap.xml.cache'), 'sitemap.xml');
  assert.equal(cacheFileToAssetPath('robots.txt.cache'), 'robots.txt');
  assert.equal(cacheFileToAssetPath('icon.svg.cache'), 'icon.svg');
  assert.equal(cacheFileToAssetPath('_global-error.cache'), null);
  assert.equal(cacheFileToAssetPath('_not-found.cache'), null);
  assert.equal(assetPathForPathname('/'), '/index.html');
  assert.equal(assetPathForPathname('/de/terms/'), '/de/terms/index.html');
  assert.equal(assetPathForPathname('/sitemap.xml'), '/sitemap.xml');
  assert.equal(publishedBody({ html: '<p>Home</p>' }).body, '<p>Home</p>');
  assert.equal(publishedBody({ type: 'route', meta: { headers: { 'content-type': 'text/plain' } }, body: 'Allow: /\n' }).contentType, 'text/plain');
  assert.equal(publishedBody({ type: 'route' }), null);
});

test('publish writes the newest build and skips internal cache files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'static-pages-'));
  const older = path.join(root, 'cache', 'older');
  const newer = path.join(root, 'cache', 'newer');
  await mkdir(path.join(older), { recursive: true });
  await mkdir(path.join(newer, 'guide'), { recursive: true });
  await writeFile(path.join(older, 'index.cache'), JSON.stringify({ html: 'old' }));
  await writeFile(path.join(newer, 'index.cache'), JSON.stringify({ html: '<!DOCTYPE html><title>Home</title>' }));
  await writeFile(path.join(newer, 'robots.txt.cache'), JSON.stringify({ body: 'Allow: /\n', meta: { headers: { 'content-type': 'text/plain' } } }));
  await writeFile(path.join(newer, '_not-found.cache'), JSON.stringify({ html: 'missing' }));
  await writeFile(path.join(newer, 'guide', 'berlin-with-children.cache'), JSON.stringify({ html: '<h1>Berlin</h1>' }));
  await utimes(older, new Date(1_000), new Date(1_000));
  await utimes(newer, new Date(2_000), new Date(2_000));
  const written = await publishStaticPages(path.join(root, 'cache'), path.join(root, 'assets'));
  assert.deepEqual(written.sort(), ['guide/berlin-with-children/index.html', 'index.html', 'robots.txt'].sort());
  assert.match(await readFile(path.join(root, 'assets', 'index.html'), 'utf8'), /Home/);
  assert.equal(await readFile(path.join(root, 'assets', 'robots.txt'), 'utf8'), 'Allow: /\n');
  await rm(root, { recursive: true, force: true });
});

test('saving a report deletes both locales on every configured origin', async () => {
  const deleted = [];
  const previous = globalThis.caches;
  globalThis.caches = { default: { async delete(request) { deleted.push(request.url); return true; } } };
  try {
    await invalidateReportHtml('59531030123f2eba');
    await invalidateReportHtml('../etc');
  } finally {
    globalThis.caches = previous;
  }
  assert.deepEqual(deleted, reportHtmlUrls('59531030123f2eba'));
  assert.ok(deleted.includes('https://reviewahouse.com/r/59531030123f2eba'));
  assert.ok(deleted.includes('https://www.reviewahouse.com/de/r/59531030123f2eba'));
  assert.equal(reportHtmlUrls('short').length, 0);
});

test('a stalled promise rejects instead of hanging', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 30), /timed_out/);
  assert.equal(await withTimeout(Promise.resolve('ok'), 30), 'ok');
});

test('cached report HTML is the anonymous document', () => {
  const shared = '<a class="account-nav" href="/account">Sign in</a><section class="card private-note"><p>YOUR NOTE</p><textarea></textarea>';
  assert.equal(reportHtmlIsShared(shared), true);
  assert.equal(reportHtmlIsShared(shared.replace('Sign in', 'Sign out') + ' class="account-menu"'), false);
  assert.equal(reportHtmlIsShared('<html>rah_session=abc</html>'), false);
  assert.equal(reportHtmlIsShared('<input name="csrf" value="t">'), false);
  assert.equal(reportHtmlIsShared(''), false);
});

test('the worker serves prerendered documents before the Next handler', async () => {
  const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const worker = await read('cloudflare/worker.mjs');
  const wrangler = await read('wrangler.jsonc');
  const store = await read('lib/store.ts');
  const google = await read('app/api/auth/google/callback/route.ts');
  const email = await read('lib/transactional-email.ts');
  const stripe = await read('lib/stripe.ts');
  assert.match(wrangler, /"main": "cloudflare\/worker.mjs"/);
  assert.match(wrangler, /"!\/_next\/static\/\*"/);
  assert.match(worker, /env\.ASSETS\.fetch/);
  assert.match(worker, /applySecurityHeaders/);
  assert.match(worker, /reportHtmlIsShared/);
  const reportPage = await read('app/r/[id]/page.tsx');
  const germanReport = await read('app/de/r/[id]/page.tsx');
  const printPage = await read('app/r/[id]/print/page.tsx');
  const sitemap = await read('app/sitemap.ts');
  assert.doesNotMatch(reportPage, /cookies\(|headers\(|rah_session|robots/);
  assert.doesNotMatch(germanReport, /cookies\(|headers\(|rah_session|robots/);
  assert.match(printPage, /index:\s*false/);
  assert.doesNotMatch(sitemap, /\/r\//);
  assert.match(worker, /caches\?\.default/);
  assert.match(worker, /NEXT_TIMEOUT_MS = 20_000/);
  assert.match(worker, /isCacheableDocument/);
  assert.match(store, /invalidateReportHtml\(item\.id\)/);
  assert.match(google, /AbortSignal\.timeout\(8_000\)/);
  assert.match(email, /AbortSignal\.timeout\(8_000\)/);
  assert.match(stripe, /timeout: 10_000/);
  const reportFn = store.slice(store.indexOf('export async function report('), store.indexOf('export async function staleReportsForBackfill'));
  assert.doesNotMatch(reportFn, /parseListing|report_sources|source_text|fetchListing/);
});
