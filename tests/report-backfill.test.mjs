import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BACKFILL_BATCH_SIZE, backfillAuthorized, runBackfillBatch } from '../lib/report-backfill.ts';

const token = 'a'.repeat(32);

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
  assert.doesNotMatch(candidateQuery, /source_text/);
  const backfill = await read('app/api/reports/backfill/route.ts');
  assert.match(backfill, /backfillAuthorized/);
  assert.match(backfill, /parseListing/);
  assert.doesNotMatch(backfill, /fetchListing/);
  const assess = await read('app/api/assess/route.ts');
  assert.match(assess, /deterministicAssessment/);
});
