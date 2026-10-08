import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { applyDocumentLanguage, assetPathForPathname, cacheFileToAssetPath, documentLanguage, isCacheableDocument, isRouterDataRequest, pathnameForPublishedAsset, reportDocumentId, reportHtmlIsShared } from '../cloudflare/routes.mjs';
import { withTimeout } from '../lib/io-timeout.ts';
import { reportCacheRequest } from '../lib/report-cache-key.ts';
import { invalidateReportHtml, reportHtmlUrls } from '../lib/report-html-cache.ts';
import { publishedBody, publishStaticPages, writeReportCacheBuildId } from '../scripts/publish-static-pages.mjs';

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

test('report documents are keyed by build id, without print or a visitor query string', () => {
  assert.equal(reportDocumentId('/r/59531030123f2eba'), '59531030123f2eba');
  assert.equal(reportDocumentId('/de/r/59531030123f2eba/'), '59531030123f2eba');
  assert.equal(reportDocumentId('/r/59531030123f2eba/print'), '');
  assert.equal(reportDocumentId('/r/short'), '');
  assert.equal(reportDocumentId('/c/59531030123f2eba'), '');
  const first = reportCacheRequest('https://reviewahouse.com/de/r/59531030123f2eba?fresh=1#map', 'build-one');
  const second = reportCacheRequest('https://reviewahouse.com/de/r/59531030123f2eba/', 'build-two');
  assert.equal(first.url, 'https://reviewahouse.com/de/r/59531030123f2eba?b=build-one');
  assert.equal(second.url, 'https://reviewahouse.com/de/r/59531030123f2eba?b=build-two');
  assert.notEqual(first.url, second.url);
  assert.equal(first.method, 'GET');
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

test('saving a report deletes both locales for the current build id', async () => {
  const deleted = [];
  const previousCache = globalThis.caches;
  const previousBuild = process.env.OPEN_NEXT_BUILD_ID;
  process.env.OPEN_NEXT_BUILD_ID = 'build-one';
  globalThis.caches = { default: { async delete(request) { deleted.push(request.url); return true; } } };
  try {
    await invalidateReportHtml('59531030123f2eba');
    await invalidateReportHtml('../etc');
  } finally {
    globalThis.caches = previousCache;
    if (previousBuild === undefined) delete process.env.OPEN_NEXT_BUILD_ID;
    else process.env.OPEN_NEXT_BUILD_ID = previousBuild;
  }
  assert.deepEqual(deleted, reportHtmlUrls('59531030123f2eba', 'build-one'));
  assert.ok(deleted.includes('https://reviewahouse.com/r/59531030123f2eba?b=build-one'));
  assert.ok(deleted.includes('https://www.reviewahouse.com/de/r/59531030123f2eba?b=build-one'));
  assert.equal(reportHtmlUrls('short', 'build-one').length, 0);
  assert.notEqual(reportHtmlUrls('59531030123f2eba', 'build-one')[0], reportHtmlUrls('59531030123f2eba', 'build-two')[0]);
});

test('the published build id is the report cache build id', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'build-id-'));
  await writeFile(path.join(root, 'BUILD_ID'), 'build-one\n');
  const destination = path.join(root, 'build-id.mjs');
  assert.equal(await writeReportCacheBuildId(path.join(root, 'BUILD_ID'), destination), 'build-one');
  assert.equal(await readFile(destination, 'utf8'), 'export const REPORT_CACHE_BUILD_ID = "build-one";\n');
  await writeFile(path.join(root, 'BUILD_ID'), 'bad id\n');
  await assert.rejects(writeReportCacheBuildId(path.join(root, 'BUILD_ID'), destination), /build id/);
  await writeFile(path.join(root, 'BUILD_ID'), '\n');
  await assert.rejects(writeReportCacheBuildId(path.join(root, 'BUILD_ID'), destination), /build id/);
  await rm(root, { recursive: true, force: true });
});

test('a stalled promise rejects instead of hanging', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 30), /timed_out/);
  assert.equal(await withTimeout(Promise.resolve('ok'), 30), 'ok');
});

test('a German report-cache hit is labelled once and the stored HTML is not rewritten', async () => {
  const cached = '<html lang="en"><head></head><body>172.000 €</body></html>';
  const served = applyDocumentLanguage(cached, '/de/r/59531030123f2eba');
  assert.equal(served, '<html lang="de"><head></head><body>172.000 €</body></html>');
  assert.equal(applyDocumentLanguage(served, '/de/r/59531030123f2eba'), served);
  assert.equal(applyDocumentLanguage(cached, '/r/59531030123f2eba'), cached);

  const worker = await readFile(new URL('../cloudflare/worker.mjs', import.meta.url), 'utf8');
  const serve = worker.slice(worker.indexOf('async function serveReport'), worker.indexOf('async function fetchNext'));
  const fetchFn = worker.slice(worker.indexOf('export default'));
  assert.doesNotMatch(serve, /applyDocumentLanguage|withDocumentLanguage/);
  assert.match(serve, /await response\.clone\(\)\.text\(\)/);
  assert.ok(fetchFn.indexOf('backfillRejection(request, env.BACKFILL_TOKEN)') < fetchFn.indexOf('serveReport'));
  assert.ok(fetchFn.indexOf('serveReport') < fetchFn.indexOf('return withDocumentLanguage'));
  assert.equal(fetchFn.match(/withDocumentLanguage\(/g).length, 1);
});

test('German document HTML carries lang=de and English stays lang=en', () => {
  assert.equal(documentLanguage('/de'), 'de');
  assert.equal(documentLanguage('/de/r/abc'), 'de');
  assert.equal(documentLanguage('/'), 'en');
  assert.equal(documentLanguage('/r/abc'), 'en');
  assert.equal(documentLanguage('/am'), 'en');
  const english = '<html lang="en"><head><title>Bericht</title></head></html>';
  assert.equal(applyDocumentLanguage(english, '/de/r/abc'), '<html lang="de"><head><title>Bericht</title></head></html>');
  assert.equal(applyDocumentLanguage(english, '/r/abc'), english);
  assert.equal(applyDocumentLanguage('<html><body></body></html>', '/de'), '<html lang="de"><body></body></html>');
  assert.equal(pathnameForPublishedAsset('de/index.html'), '/de');
  assert.equal(pathnameForPublishedAsset('index.html'), '/');
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
  assert.match(worker, /applyDocumentLanguage/);
  assert.match(worker, /reportCacheRequest\(request\.url, REPORT_CACHE_BUILD_ID\)/);
  assert.match(worker, /from '\.\/build-id\.mjs'/);
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
