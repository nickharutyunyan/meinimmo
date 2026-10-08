import assert from 'node:assert/strict';
import test from 'node:test';
import { EXTRACTION_VERSION } from '../lib/report-integrity.ts';
import {
  REFRESH_ATTEMPTED_MAX,
  REFRESH_IN_FLIGHT_MAX,
  beginReportRefresh,
  finishReportRefresh,
  needsArchivedRefresh,
  refreshAttemptedCount,
  refreshFailureMarker,
  refreshInFlight,
  resetReportRefreshState,
  runBoundedRefresh,
} from '../lib/report-refresh.ts';

test('a failed refresh is saved as a marker and is not parsed again', () => {
  const stale = { id: 'erfde', extractionVersion: 0, facts: { city: 'Erfde', price: 1, area: 1 } };
  assert.equal(needsArchivedRefresh(stale), true);
  const marked = refreshFailureMarker(stale, '2026-10-08T12:00:00.000Z');
  assert.equal(marked.extractionVersion, 0);
  assert.equal(marked.sourceUnavailable, true);
  assert.equal(marked.sourceReviewAttemptedAt, '2026-10-08T12:00:00.000Z');
  assert.equal(needsArchivedRefresh(marked), false);
  assert.equal(needsArchivedRefresh({ country: 'AM', extractionVersion: 0 }), false);
  assert.equal(needsArchivedRefresh({ extractionVersion: EXTRACTION_VERSION }), false);
  assert.equal(needsArchivedRefresh({}), true);
  assert.equal(needsArchivedRefresh({ extractionVersion: undefined }), true);
});

test('the refresh limiter drops extra work, releases on failure, and remembers an attempt', async () => {
  resetReportRefreshState();
  assert.equal(beginReportRefresh('a'), 'started');
  assert.equal(beginReportRefresh('b'), 'started');
  assert.equal(REFRESH_IN_FLIGHT_MAX, 2);
  assert.equal(beginReportRefresh('c'), 'dropped');
  assert.equal(refreshInFlight(), 2);
  finishReportRefresh('a');
  finishReportRefresh('b');
  assert.equal(refreshInFlight(), 0);
  assert.equal(beginReportRefresh('a'), 'already');
  assert.equal(beginReportRefresh('c'), 'started');
  finishReportRefresh('c');

  const failed = await runBoundedRefresh('d1', async () => { throw new Error('replace failed'); });
  assert.equal(failed.status, 'started');
  assert.equal(failed.ok, false);
  assert.equal(refreshInFlight(), 0);
  assert.equal((await runBoundedRefresh('d1', async () => 'again')).status, 'already');

  const started = performance.now();
  let releaseHung = () => undefined;
  const timedOut = await runBoundedRefresh('hung', () => new Promise(resolve => { releaseHung = () => resolve('done'); }), 30);
  assert.equal(timedOut.status, 'started');
  assert.equal(timedOut.ok, false);
  assert.ok(performance.now() - started < 500, 'the budget must return without waiting for the parse');
  assert.equal(refreshInFlight(), 1);
  assert.equal((await runBoundedRefresh('hung', async () => 'again')).status, 'already');
  assert.equal((await runBoundedRefresh('while-hung', async () => 'ok')).status, 'started');
  const stillHung = runBoundedRefresh('hung-2', () => new Promise(() => {}), 20);
  await stillHung;
  assert.equal(refreshInFlight(), 2);
  assert.equal((await runBoundedRefresh('hung-3', async () => 'no')).status, 'dropped');
  releaseHung();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(refreshInFlight(), 1);

  resetReportRefreshState();
  for (let index = 0; index < REFRESH_ATTEMPTED_MAX + 10; index += 1) {
    const status = beginReportRefresh(`id-${index}`);
    if (status === 'started') finishReportRefresh(`id-${index}`);
    else assert.equal(status, 'dropped');
  }
  assert.equal(refreshAttemptedCount(), REFRESH_ATTEMPTED_MAX);
  assert.equal(refreshInFlight(), 0);
  assert.equal(beginReportRefresh('beyond'), 'dropped');
  resetReportRefreshState();
});
