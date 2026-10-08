import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  FEEDBACK_HOURLY_LIMIT,
  feedbackErrorMessage,
  feedbackIsLimited,
  feedbackSubjectKey,
  feedbackWindowStart,
  validateFactFeedback,
} from '../lib/fact-feedback.ts';

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
