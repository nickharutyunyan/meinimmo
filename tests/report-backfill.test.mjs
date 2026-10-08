import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { backfillRejection } from '../cloudflare/backfill-gate.mjs';
import { BACKFILL_BATCH_SIZE, backfillAuthorized, runBackfillBatch } from '../lib/report-backfill.ts';

const token = 'a'.repeat(32);

test('an unauthorized backfill is rejected before Next loads the parser', async () => {
  const secret = 'b'.repeat(32);
  const request = (method, pathname, authorization) => ({
    method,
    url: `https://reviewahouse.com${pathname}`,
    headers: { get: (name) => (name.toLowerCase() === 'authorization' ? authorization : null) },
  });
  const rejected = backfillRejection(request('POST', '/api/reports/backfill', null), secret);
  assert.equal(rejected.status, 401);
  assert.equal(rejected.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await rejected.json(), { error: 'Unauthorized.' });
  assert.equal(backfillRejection(request('POST', '/api/reports/backfill/', `Bearer ${secret}`), secret), null);
  assert.equal(backfillRejection(request('GET', '/api/reports/backfill', null), secret), null);
  assert.equal(backfillRejection(request('POST', '/api/assess', `Bearer ${secret}`), secret), null);
  const mismatch = backfillRejection(request('POST', '/api/reports/backfill', `Bearer ${'c'.repeat(32)}`), secret);
  assert.equal(mismatch.status, 401);
});

test('the backfill token is required and compared in full', () => {
  assert.equal(backfillAuthorized(null, token), false);
  assert.equal(backfillAuthorized(`Bearer ${token}`, undefined), false);
  assert.equal(backfillAuthorized(`Bearer ${token}`, 'short'), false);
  assert.equal(backfillAuthorized(`Bearer ${token.slice(0, -1)}b`, token), false);
  assert.equal(backfillAuthorized(`Bearer ${token}`, token), true);
  assert.equal(backfillAuthorized(`Basic ${token}`, token), false);
});

test('a backfill call stays within five reports and the time budget', async () => {
  const candidates = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id }));
  let clock = 0;
  const seen = [];
  const open = await runBackfillBatch({
    candidates,
    budgetMs: 10_000,
    now: () => clock,
    refresh: async (item) => {
      seen.push(item.id);
      return 'refreshed';
    },
  });
  assert.equal(BACKFILL_BATCH_SIZE, 5);
  assert.deepEqual(seen, ['a', 'b', 'c', 'd', 'e']);
  assert.equal(open.stoppedEarly, false);
  assert.equal(open.processed.length, 5);

  clock = 0;
  const paced = [];
  const limited = await runBackfillBatch({
    candidates,
    budgetMs: 100,
    now: () => clock,
    refresh: async (item) => {
      paced.push(item.id);
      clock += 60;
      return 'unavailable';
    },
  });
  assert.deepEqual(paced, ['a', 'b']);
  assert.equal(limited.stoppedEarly, true);
  assert.deepEqual(limited.processed.map(item => item.status), ['unavailable', 'unavailable']);
});

test('a thrown refresh is recorded and does not continue as a queue', async () => {
  const result = await runBackfillBatch({
    candidates: [{ id: 'one' }, { id: 'two' }],
    refresh: async (item) => {
      if (item.id === 'one') throw new Error('d1 down');
      return 'refreshed';
    },
  });
  assert.deepEqual(result.processed, [
    { id: 'one', status: 'error' },
    { id: 'two', status: 'refreshed' },
  ]);
});

test('page, print, sitemap and metadata routes do not read archived HTML', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const viewPaths = [
    'app/sitemap.ts',
    'app/layout.tsx',
    'app/r/[id]/page.tsx',
    'app/r/[id]/print/page.tsx',
    'app/de/r/[id]/page.tsx',
    'app/de/r/[id]/print/page.tsx',
    'app/c/[id]/page.tsx',
    'app/de/c/[id]/page.tsx',
  ];
  for (const path of viewPaths) {
    const text = await read(path);
    assert.doesNotMatch(text, /parseListing|report_sources|source_text|listing-parser|listing-content|fetchListing/, path);
  }
  const sitemap = await read('app/sitemap.ts');
  assert.doesNotMatch(sitemap, /\/r\//);
  const robots = await read('app/robots.ts');
  assert.match(robots, /disallow:\s*\['\/api\/'\]/);
  const store = await read('lib/store.ts');
  const reportFn = store.slice(store.indexOf('export async function report('), store.indexOf('export async function staleReportsForBackfill'));
  assert.doesNotMatch(reportFn, /parseListing|report_sources|source_text|fetchListing/);
  const candidateQuery = store.slice(store.indexOf('export async function staleReportsForBackfill'), store.indexOf('export async function archivedListingSource'));
  assert.match(candidateQuery, /LIMIT/);
  assert.match(candidateQuery, /COALESCE\(json_extract\(data, '\$\.extractionVersion'\), -1\)/);
  assert.doesNotMatch(candidateQuery, /source_text/);
  const backfill = await read('app/api/reports/backfill/route.ts');
  assert.match(backfill, /backfillAuthorized/);
  assert.match(backfill, /parseListing/);
  assert.doesNotMatch(backfill, /fetchListing/);
  const prelude = backfill.slice(0, backfill.indexOf('export async function POST'));
  assert.doesNotMatch(prelude, /listing-parser|assessment|report-refresh|from '@\/lib\/store'/);
  assert.match(backfill, /await Promise\.all/);
  const worker = await read('cloudflare/worker.mjs');
  const fetchBody = worker.slice(worker.indexOf('async fetch'));
  assert.ok(fetchBody.indexOf('backfillRejection(request') >= 0);
  assert.ok(fetchBody.indexOf('backfillRejection(request') < fetchBody.indexOf('fetchNext'));
  const gate = await read('cloudflare/backfill-gate.mjs');
  assert.match(gate, /backfillAuthorized/);
  assert.doesNotMatch(gate, /listing-parser|assessment|\/lib\/store/);
  const assess = await read('app/api/assess/route.ts');
  assert.match(assess, /deterministicAssessment/);
});
