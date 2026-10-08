import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { reportSubtitle, reportTitle, resolveLocation } from '../lib/display.ts';
import { parseListing, refreshDerivedReport } from '../lib/listing-parser.ts';
import { berlinPriceAvailability, berlinPriceCheck } from '../lib/price-check.ts';
import { reportConflicts, reportVerdict, scoreAvailable } from '../lib/report-integrity.ts';
import {
  REFRESH_ATTEMPTED_MAX,
  refreshAttemptedCount,
  refreshInFlight,
  resetReportRefreshState,
  runBoundedRefresh,
} from '../lib/report-refresh.ts';

const REQUESTS = 3_000;
const HEAP_BUDGET_BYTES = 8 * 1024 * 1024;

function storedReports() {
  const directory = new URL('./fixtures/listings/', import.meta.url);
  return readdirSync(directory).filter(name => name.endsWith('.html')).map(name => {
    const html = readFileSync(new URL(name, directory), 'utf8');
    return parseListing(html, `fixture:${name}`);
  });
}

test('thousands of page and report views keep a flat heap and an idle refresh limiter', async () => {
  assert.equal(typeof global.gc, 'function');
  resetReportRefreshState();
  const reports = storedReports();
  assert.ok(reports.length >= 8, `expected the listing fixtures, found ${reports.length}`);
  const malformed = [
    '',
    '<',
    '<script ',
    'not a listing',
    `<div>${'x'.repeat(8_000)}</div>`,
    '{',
    '<html><body><p>Kaufpreis</p>',
  ];
  for (let warm = 0; warm < 20; warm += 1) {
    const report = reports[warm % reports.length];
    reportTitle(report, warm % 2 ? 'de' : 'en');
    resolveLocation(report);
    parseListing(malformed[warm % malformed.length], 'warm-malformed');
  }
  global.gc();
  const before = process.memoryUsage().heapUsed;
  for (let index = 0; index < REQUESTS; index += 1) {
    const report = reports[index % reports.length];
    const locale = index % 2 ? 'de' : 'en';
    if (index % 5 === 0) {
      reportVerdict(report, locale);
      berlinPriceAvailability(report);
      reportConflicts(report);
    } else {
      resolveLocation(report);
      reportTitle(report, 'en');
      reportTitle(report, 'de');
      reportSubtitle(report);
      scoreAvailable(report);
      refreshDerivedReport(report);
      berlinPriceCheck(report);
    }
    if (index % 11 === 0) {
      const parsed = parseListing(malformed[index % malformed.length], `malformed:${index % malformed.length}`);
      assert.equal(typeof parsed.address, 'string');
    }
    const outcome = await runBoundedRefresh(`view-${index}`, async () => report.id, 50);
    assert.ok(outcome.status === 'started' || outcome.status === 'dropped' || outcome.status === 'already');
  }
  global.gc();
  const growth = process.memoryUsage().heapUsed - before;
  assert.equal(refreshInFlight(), 0);
  assert.ok(refreshAttemptedCount() <= REFRESH_ATTEMPTED_MAX);
  assert.ok(refreshAttemptedCount() > 0);
  assert.ok(growth < HEAP_BUDGET_BYTES, `heap grew by ${growth} bytes across ${REQUESTS} views`);
  resetReportRefreshState();
  assert.equal(refreshInFlight(), 0);
});
