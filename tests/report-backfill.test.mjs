import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { backfillRejection } from '../cloudflare/backfill-gate.mjs';
import { DatabaseSync } from 'node:sqlite';
import { BACKFILL_BATCH_SIZE, STALE_REPORT_BACKFILL_SQL, STALE_REPORT_COUNT_SQL, backfillAuthorized, configuredBackfillBatchSize, mergedBackfillReport, runBackfillBatch } from '../lib/report-backfill.ts';
import { parseListing } from '../lib/listing-parser.ts';
import { EXTRACTION_VERSION } from '../lib/report-integrity.ts';
import { refreshFailureMarker } from '../lib/report-refresh.ts';

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

test('the batch size is the only backfill guard and the response has no clock', async () => {
  const candidates = ['a', 'b', 'c'].map(id => ({ id }));
  assert.equal(BACKFILL_BATCH_SIZE, 1);
  assert.equal(configuredBackfillBatchSize(undefined), 1);
  assert.equal(configuredBackfillBatchSize(''), 1);
  assert.equal(configuredBackfillBatchSize('0'), 1);
  assert.equal(configuredBackfillBatchSize('2.5'), 1);
  assert.equal(configuredBackfillBatchSize('6'), 1);
  assert.equal(configuredBackfillBatchSize('1'), 1);
  assert.equal(configuredBackfillBatchSize('5'), 5);

  const seen = [];
  const open = await runBackfillBatch({
    candidates,
    refresh: async (item) => {
      seen.push(item.id);
      return 'refreshed';
    },
  });
  assert.deepEqual(seen, ['a']);
  assert.deepEqual(Object.keys(open).sort(), ['processed']);

  const paced = [];
  const sized = await runBackfillBatch({
    candidates,
    batchSize: 2,
    refresh: async (item, account) => {
      paced.push(item.id);
      if (typeof account === 'function') account(10_000);
      return 'refreshed';
    },
  });
  assert.deepEqual(paced, ['a', 'b']);
  assert.deepEqual(Object.keys(sized).sort(), ['processed']);
});

test('a thrown refresh is recorded and does not continue as a queue', async () => {
  const result = await runBackfillBatch({
    candidates: [{ id: 'one' }, { id: 'two' }],
    batchSize: 2,
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

/** node:sqlite binds `?`, while D1 binds the numbered `?1` placeholders in the production statement. */
function sqliteBackfillSql(sql = STALE_REPORT_BACKFILL_SQL) {
  return sql.replaceAll('?1', '?').replaceAll('?2', '?');
}

function backfillRows(records) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE reports (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL)');
  const insert = db.prepare('INSERT INTO reports (id, data, created_at) VALUES (?, ?, ?)');
  for (const record of records) insert.run(record.id, JSON.stringify({ ...record.data, id: record.id }), record.createdAt);
  return db.prepare(sqliteBackfillSql()).all(EXTRACTION_VERSION, 50).map(row => JSON.parse(row.data).id);
}

test('backfill selects recent reports that only have an attempt timestamp', () => {
  assert.equal(EXTRACTION_VERSION, 2026100807);
  const attempted = '2026-10-08T12:00:00.000Z';
  const recent = {
    extractionVersion: 2026100802,
    sourceReviewAttemptedAt: attempted,
    country: 'DE',
  };
  const selected = backfillRows([
    { id: 'bf62c0f3bed8b491', createdAt: '2026-09-01T00:00:00.000Z', data: recent },
    { id: 'e6a15c401e77ba11', createdAt: '2026-09-02T00:00:00.000Z', data: { ...recent } },
    { id: 'fefc0acce8c09d7e', createdAt: '2026-09-03T00:00:00.000Z', data: { ...recent } },
    { id: 'db99dbe605cbd1c1', createdAt: '2026-09-04T00:00:00.000Z', data: { ...recent } },
    { id: 'b7c9512d8475e887', createdAt: '2026-09-05T00:00:00.000Z', data: { ...recent } },
    { id: 'legacy-missing-version', createdAt: '2026-08-01T00:00:00.000Z', data: { country: 'DE', sourceReviewAttemptedAt: attempted } },
    { id: 'current', createdAt: '2026-10-01T00:00:00.000Z', data: { extractionVersion: EXTRACTION_VERSION, country: 'DE' } },
    { id: 'armenia', createdAt: '2026-08-02T00:00:00.000Z', data: { country: 'AM', extractionVersion: 1 } },
    { id: 'marked-unavailable', createdAt: '2026-08-03T00:00:00.000Z', data: { extractionVersion: 2026100101, country: 'DE', sourceUnavailable: true, sourceReviewAttemptedAt: attempted } },
    { id: 'unavailable-without-attempt', createdAt: '2026-08-04T00:00:00.000Z', data: { extractionVersion: 2026100101, country: 'DE', sourceUnavailable: true } },
  ]);
  assert.deepEqual(selected, [
    'legacy-missing-version',
    'unavailable-without-attempt',
    'bf62c0f3bed8b491',
    'e6a15c401e77ba11',
    'fefc0acce8c09d7e',
    'db99dbe605cbd1c1',
    'b7c9512d8475e887',
  ]);
  assert.equal(selected.includes('current'), false);
  assert.equal(selected.includes('armenia'), false);
  assert.equal(selected.includes('marked-unavailable'), false);
});

test('the stale count uses the same filter as the batch select', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE reports (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL)');
  const insert = db.prepare('INSERT INTO reports (id, data, created_at) VALUES (?, ?, ?)');
  insert.run('old', JSON.stringify({ id: 'old', country: 'DE', extractionVersion: 2026100802 }), '2026-08-01T00:00:00.000Z');
  insert.run('current', JSON.stringify({ id: 'current', country: 'DE', extractionVersion: EXTRACTION_VERSION }), '2026-10-01T00:00:00.000Z');
  insert.run('armenia', JSON.stringify({ id: 'armenia', country: 'AM', extractionVersion: 1 }), '2026-08-02T00:00:00.000Z');
  const selected = db.prepare(sqliteBackfillSql()).all(EXTRACTION_VERSION, 50).map(row => JSON.parse(row.data).id);
  const count = db.prepare(sqliteBackfillSql(STALE_REPORT_COUNT_SQL)).get(EXTRACTION_VERSION);
  assert.deepEqual(selected, ['old']);
  assert.equal(count.remaining, 1);
});

test('backfill selects an older version and leaves the current and newer versions stored', () => {
  assert.match(STALE_REPORT_BACKFILL_SQL, /extractionVersion'\), -1\) < \?1/);
  assert.doesNotMatch(STALE_REPORT_BACKFILL_SQL, /extractionVersion'\), -1\) != \?1/);
  const selected = backfillRows([
    { id: 'older', createdAt: '2026-08-01T00:00:00.000Z', data: { extractionVersion: EXTRACTION_VERSION - 1, country: 'DE', futureField: { ok: true } } },
    { id: 'equal', createdAt: '2026-08-02T00:00:00.000Z', data: { extractionVersion: EXTRACTION_VERSION, country: 'DE', futureField: { ok: true } } },
    { id: 'newer', createdAt: '2026-08-03T00:00:00.000Z', data: { extractionVersion: EXTRACTION_VERSION + 1, country: 'DE', futureField: { ok: true }, score: 8.2 } },
    { id: 'missing', createdAt: '2026-08-04T00:00:00.000Z', data: { country: 'DE' } },
  ]);
  assert.deepEqual(selected, ['older', 'missing']);
});

test('marking the selected rows unavailable drains the backfill', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE reports (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL)');
  const insert = db.prepare('INSERT INTO reports (id, data, created_at) VALUES (?, ?, ?)');
  const rows = [
    { id: 'one', createdAt: '2026-08-01', data: { extractionVersion: 2026100802, country: 'DE', sourceReviewAttemptedAt: '2026-09-01T00:00:00.000Z' } },
    { id: 'two', createdAt: '2026-08-02', data: { extractionVersion: 1, country: 'DE' } },
  ];
  for (const row of rows) insert.run(row.id, JSON.stringify({ ...row.data, id: row.id }), row.createdAt);
  const query = db.prepare(sqliteBackfillSql());
  assert.deepEqual(query.all(EXTRACTION_VERSION, 5).map(row => JSON.parse(row.data).id), ['one', 'two']);
  const update = db.prepare('UPDATE reports SET data = ? WHERE id = ?');
  for (const row of rows) {
    const marked = refreshFailureMarker({ ...row.data, id: row.id, facts: {} }, '2026-10-08T15:00:00.000Z');
    update.run(JSON.stringify(marked), row.id);
  }
  assert.deepEqual(query.all(EXTRACTION_VERSION, 5), []);
});

test('backfill keeps enrichment, categories, notes ownership and photo expiry', () => {
  const previous = {
    id: 'kept',
    createdAt: '2026-08-01T00:00:00.000Z',
    source: 'https://example.test/listing/1',
    sourceFile: { displayName: 'expose.pdf', size: 10 },
    aiEnriched: true,
    aiFactChecked: true,
    aiLocationChecked: true,
    verificationAttempted: true,
    jevCategorized: true,
    categories: { schemaVersion: 1, model: 'jev', buildingProfile: { value: 'family', confidence: 0.8 }, buyerFit: { value: 'owner', confidence: 0.7 }, locationStyle: { value: 'urban', confidence: 0.6 }, purchaseSituation: { value: 'vacant', confidence: 0.5 } },
    taxonomy: { building: 'walk-up' },
    locationEvidence: 'The listing names the street.',
    offerQuestions: ['Kept English question about the roof?'],
    offerQuestionsDe: ['Behaltene Frage zum Dach?'],
    title: 'old',
    address: 'Old street',
    propertyType: 'flat',
    facts: { price: 1, area: 1, rooms: '2', year: '1900', floor: '1', energy: 'D', heating: 'Gas', totalCost: 1, photoUrls: ['https://media.example/old.jpg?exp=10'], photosExpireAt: '1970-01-01T00:00:10.000Z' },
    score: 1,
    summary: 'old summary',
    considerations: [],
    sunOrientation: 'South',
  };
  const parsed = {
    ...previous,
    id: 'new-id',
    createdAt: '2026-10-08T00:00:00.000Z',
    aiEnriched: false,
    aiFactChecked: false,
    aiLocationChecked: false,
    verificationAttempted: false,
    jevCategorized: false,
    categories: undefined,
    taxonomy: undefined,
    locationEvidence: undefined,
    offerQuestions: ['Fresh question one?'],
    offerQuestionsDe: ['Neue Frage eins?'],
    title: '3-room flat · Berlin',
    extractionVersion: EXTRACTION_VERSION,
    sourceUnavailable: true,
    facts: { ...previous.facts, rooms: '3', photoUrls: ['https://media.example/new.jpg?exp=20'], photosExpireAt: '1970-01-01T00:00:20.000Z' },
  };
  const merged = mergedBackfillReport(previous, parsed, '2026-10-08T16:00:00.000Z');
  assert.equal(merged.id, 'kept');
  assert.equal(merged.createdAt, '2026-08-01T00:00:00.000Z');
  assert.equal(merged.aiEnriched, true);
  assert.equal(merged.aiFactChecked, true);
  assert.equal(merged.aiLocationChecked, true);
  assert.equal(merged.verificationAttempted, true);
  assert.equal(merged.jevCategorized, true);
  assert.equal(merged.categories.buildingProfile.value, 'family');
  assert.equal(merged.taxonomy.building, 'walk-up');
  assert.equal(merged.locationEvidence, 'The listing names the street.');
  assert.deepEqual(merged.offerQuestions, previous.offerQuestions);
  assert.deepEqual(merged.offerQuestionsDe, previous.offerQuestionsDe);
  assert.equal(merged.facts.rooms, '3');
  assert.deepEqual(merged.facts.photoUrls, parsed.facts.photoUrls);
  assert.equal(merged.facts.photosExpireAt, parsed.facts.photosExpireAt);
  assert.equal(merged.sourceUnavailable, undefined);
  assert.equal(merged.sourceReviewAttemptedAt, '2026-10-08T16:00:00.000Z');
  assert.equal(merged.extractionVersion, EXTRACTION_VERSION);

  const pinned = {
    ...previous,
    country: 'DE',
    geocode: { lat: 52.593, lon: 13.283, precision: 'street' },
    evidence: { price: ['Kaufpreis 1 €'] },
  };
  const keptPin = mergedBackfillReport(pinned, { ...parsed, geocode: undefined, country: undefined, evidence: undefined }, '2026-10-08T16:00:00.000Z');
  assert.deepEqual(keptPin.geocode, pinned.geocode);
  assert.equal(keptPin.country, 'DE');
  assert.deepEqual(keptPin.evidence, pinned.evidence);
  assert.equal(keptPin.title, parsed.title);
  assert.equal(keptPin.facts.rooms, '3');

  const withoutPhotos = mergedBackfillReport(previous, { ...parsed, aiEnriched: false, facts: { ...parsed.facts, photoUrls: undefined, photosExpireAt: undefined } }, '2026-10-08T16:00:00.000Z');
  assert.deepEqual(withoutPhotos.facts.photoUrls, previous.facts.photoUrls);
  assert.equal(withoutPhotos.facts.photosExpireAt, previous.facts.photosExpireAt);
  const plain = { ...previous, aiEnriched: false };
  const replacedQuestions = mergedBackfillReport(plain, parsed, '2026-10-08T16:00:00.000Z');
  assert.deepEqual(replacedQuestions.offerQuestions, parsed.offerQuestions);
  assert.equal(replacedQuestions.aiEnriched, false);
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
  assert.match(candidateQuery, /STALE_REPORT_BACKFILL_SQL/);
  assert.doesNotMatch(candidateQuery, /source_text/);
  const backfillLib = await read('lib/report-backfill.ts');
  assert.match(backfillLib, /COALESCE\(json_extract\(data, '\$\.extractionVersion'\), -1\)/);
  assert.match(backfillLib, /COALESCE\(json_extract\(data, '\$\.sourceUnavailable'\), 0\) = 1/);
  assert.match(backfillLib, /geocode: previous\.geocode/);
  assert.match(backfillLib, /STALE_REPORT_COUNT_SQL/);
  assert.doesNotMatch(backfillLib, /(?:DELETE|INSERT|UPDATE|FROM)\s+report_notes|report-notes/);
  const backfill = await read('app/api/reports/backfill/route.ts');
  assert.match(backfill, /mergedBackfillReport/);
  assert.match(backfill, /backfillAuthorized/);
  assert.match(backfill, /parseListing\(source, item\.source \|\| item\.id, lines\)/);
  assert.match(backfill, /archivedListingAccepted\(source, lines\)/);
  assert.match(backfill, /htmlToLines\(source\)/);
  assert.match(backfill, /configuredBackfillBatchSize\(env\.BACKFILL_BATCH_SIZE\)/);
  assert.match(backfill, /remaining/);
  assert.doesNotMatch(backfill, /usedMs|performance\.now|BACKFILL_WORK_BUDGET/);
  assert.doesNotMatch(backfill, /looksLikePropertyListing/);
  assert.doesNotMatch(backfill, /fetchListing|report_notes|report-notes/);
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

test('a backfilled report gets factEvidence from the archived source', async () => {
  const html = await readFile(new URL('./fixtures/listings/ohne-makler-471956.html', import.meta.url), 'utf8');
  const parsed = parseListing(html, 'https://example.test/471956');
  const previous = {
    ...parsed,
    id: 'kept-report',
    createdAt: '2026-08-01T00:00:00.000Z',
    extractionVersion: 2026100803,
    factEvidence: undefined,
    aiEnriched: true,
    aiFactChecked: true,
    categories: parsed.categories,
    offerQuestions: ['Kept question about the roof?'],
    offerQuestionsDe: ['Behaltene Frage zum Dach?'],
    source: 'https://example.test/listing',
  };
  const merged = mergedBackfillReport(previous, parsed, '2026-10-08T16:00:00.000Z');
  assert.equal(merged.id, 'kept-report');
  assert.equal(merged.createdAt, previous.createdAt);
  assert.equal(merged.aiEnriched, true);
  assert.equal(merged.aiFactChecked, true);
  assert.deepEqual(merged.offerQuestions, previous.offerQuestions);
  assert.equal(merged.extractionVersion, EXTRACTION_VERSION);
  assert.deepEqual(merged.factEvidence, parsed.factEvidence);
  assert.match(merged.factEvidence.price.excerpt, /172\.000/);
  assert.match(merged.factEvidence.rooms.excerpt, /1-Zimmer|Zimmer 1/);
  assert.match(merged.factEvidence.area.excerpt, /30/);
  assert.match(merged.factEvidence.housegeld.excerpt, /197/);
  assert.match(merged.factEvidence.heating.excerpt, /Heizung|Zentralheizung/);
  assert.equal(merged.factEvidence.price.kind, 'stated');
  for (const [field, evidence] of Object.entries(parsed.factEvidence)) {
    assert.equal(evidence.kind, 'stated', field);
    assert.equal(merged.factEvidence[field].excerpt, evidence.excerpt, field);
  }
});
