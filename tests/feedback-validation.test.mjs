import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  FEEDBACK_HOURLY_LIMIT,
  factFeedbackTablesReady,
  feedbackErrorMessage,
  feedbackIsLimited,
  feedbackSubjectKey,
  feedbackWindowStart,
  isMissingFeedbackTable,
  validateFactFeedback,
} from '../lib/fact-feedback.ts';
import { provenanceSentence } from '../lib/fact-provenance.ts';

const base = { field: 'rooms', reportedValue: '1', suggestedValue: '2', comment: 'The listing says two.', locale: 'en' };

test('feedback accepts a known field and caps every text field', () => {
  const ok = validateFactFeedback(base);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.field, 'rooms');
  assert.equal(ok.value.suggestedValue, '2');
  const empty = validateFactFeedback({ field: 'price', locale: 'de' });
  assert.equal(empty.ok, true);
  assert.equal(empty.value.suggestedValue, null);
  assert.equal(empty.value.comment, null);
  assert.equal(empty.value.locale, 'de');

  const field = validateFactFeedback({ ...base, field: 'portalName' });
  assert.equal(field.ok, false);
  assert.equal(field.error, 'field');
  const suggested = validateFactFeedback({ ...base, suggestedValue: 'x'.repeat(81) });
  assert.equal(suggested.ok, false);
  assert.equal(suggested.error, 'suggested');
  const comment = validateFactFeedback({ ...base, comment: 'x'.repeat(301), locale: 'de' });
  assert.equal(comment.ok, false);
  assert.equal(comment.error, 'comment');
  assert.equal(comment.locale, 'de');
  const reported = validateFactFeedback({ ...base, reportedValue: 'x'.repeat(121) });
  assert.equal(reported.ok, false);
  assert.equal(reported.error, 'reported');
  assert.equal(validateFactFeedback(null).ok, false);
  assert.equal(validateFactFeedback({ field: 'perSqm' }).ok, true);
  assert.equal(validateFactFeedback({ field: 'transferTax' }).ok, true);
});

test('the eleventh feedback in an hour is rejected in both languages', () => {
  assert.equal(FEEDBACK_HOURLY_LIMIT, 10);
  assert.equal(feedbackIsLimited(10), false);
  assert.equal(feedbackIsLimited(11), true);
  assert.equal(feedbackErrorMessage('tooMany', 'en'), 'Too many reports, please try again later.');
  assert.equal(feedbackErrorMessage('tooMany', 'de'), 'Zu viele Meldungen, bitte später erneut versuchen.');
  assert.equal(feedbackErrorMessage('field', 'en'), 'Choose a fact from this report.');
  assert.equal(feedbackErrorMessage('notFound', 'de'), 'Dieser Bericht wurde nicht gefunden.');
  const start = feedbackWindowStart(new Date('2026-10-08T16:40:00.000Z'));
  assert.equal(start, '2026-10-08T16:00:00.000Z');
  assert.equal(feedbackWindowStart(new Date('2026-10-08T16:00:00.000Z')), start);
});

test('the rate-limit key is a salted hash and never the IP', async () => {
  const ip = '203.0.113.44';
  const key = await feedbackSubjectKey(ip, 'd3027860f829d3aa');
  assert.equal(key.includes(ip), false);
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.notEqual(key, await feedbackSubjectKey(ip, '340db75fabe49533'));
  assert.notEqual(key, await feedbackSubjectKey('198.51.100.8', 'd3027860f829d3aa'));
  assert.equal(key, await feedbackSubjectKey(ip, 'd3027860f829d3aa'));
});

test('a missing feedback table hides wrong-value reports and keeps the source quote', () => {
  assert.equal(factFeedbackTablesReady([]), false);
  assert.equal(factFeedbackTablesReady(['reports', 'report_sources']), false);
  assert.equal(factFeedbackTablesReady(['fact_feedback_limits']), false);
  assert.equal(factFeedbackTablesReady(['reports', 'fact_feedback']), true);
  assert.equal(isMissingFeedbackTable(new Error('D1_ERROR: no such table: fact_feedback: SQLITE_ERROR')), true);
  assert.equal(isMissingFeedbackTable(new Error('no such table: fact_feedback_limits')), true);
  assert.equal(isMissingFeedbackTable(new Error('D1 binding is not configured.')), false);
  assert.equal(feedbackErrorMessage('unavailable', 'en'), 'Reporting a wrong value is not available yet. Please try again later.');
  assert.equal(feedbackErrorMessage('unavailable', 'de'), 'Eine Meldung zu einem falschen Wert ist noch nicht möglich. Bitte versuche es später erneut.');

  const quote = provenanceSentence({
    field: 'price',
    kind: 'stated',
    quotes: ['Kaufpreis 172.000 €'],
    reportedValue: '€172,000',
  }, 'en');
  assert.match(quote, /From the listing: Kaufpreis 172\.000 €/);

  const route = readFileSync(new URL('../app/api/reports/[id]/feedback/route.ts', import.meta.url), 'utf8');
  assert.match(route, /if \(!await factFeedbackReady\(\)\) return json\(\{ error: feedbackErrorMessage\('unavailable'/);
  assert.match(route, /status: 503|}, 503\)/);
  assert.match(route, /isMissingFeedbackTable\(error\)/);
  const readyCheck = route.indexOf('factFeedbackReady()');
  const insert = route.indexOf('insertFactFeedback(');
  assert.ok(readyCheck > 0 && readyCheck < insert);

  const button = readFileSync(new URL('../components/FactSource.tsx', import.meta.url), 'utf8');
  assert.match(button, /fromListing/);
  assert.match(button, /reportingEnabled \? thanks/);
  assert.match(button, /className="fact-wrong"/);
  const report = readFileSync(new URL('../components/ReportView.tsx', import.meta.url), 'utf8');
  assert.match(report, /reportingEnabled=\{reportingEnabled\}/);
  const page = readFileSync(new URL('../app/r/[id]/page.tsx', import.meta.url), 'utf8');
  const german = readFileSync(new URL('../app/de/r/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /factFeedbackReady\(\)\.catch\(\(\) => false\)/);
  assert.match(german, /factFeedbackReady\(\)\.catch\(\(\) => false\)/);
  assert.equal(existsMigration('0004_fact_feedback.sql'), false);
  assert.match(readFileSync(new URL('../migrations/0005_fact_feedback.sql', import.meta.url), 'utf8'), /CREATE TABLE IF NOT EXISTS fact_feedback/);
});

function existsMigration(name) {
  try {
    readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
    return true;
  } catch {
    return false;
  }
}

test('the feedback route does not touch the report HTML cache', () => {
  const route = readFileSync(new URL('../app/api/reports/[id]/feedback/route.ts', import.meta.url), 'utf8');
  assert.match(route, /requireSameOrigin\(request\)/);
  assert.match(route, /Cache-Control': 'no-store'/);
  assert.match(route, /status: 204/);
  assert.doesNotMatch(route, /invalidateReportHtml|report-html-cache|caches\.default/);
  assert.match(route, /cf-connecting-ip/);
  assert.doesNotMatch(route, /INSERT INTO fact_feedback[\s\S]*ip/i);
  const store = readFileSync(new URL('../lib/fact-feedback-store.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(store, /invalidateReportHtml|cf-connecting-ip/);
  assert.match(store, /fact_feedback_limits/);
});
