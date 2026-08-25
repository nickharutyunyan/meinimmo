import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_REPORT_NOTE_LENGTH, normalizeReportNote, validReportId } from '../lib/report-note-validation.ts';

test('report notes preserve text while normalizing line endings', () => {
  assert.equal(normalizeReportNote('Call agent\r\nAsk about Hausgeld'), 'Call agent\nAsk about Hausgeld');
  assert.equal(normalizeReportNote('  keep spacing  '), '  keep spacing  ');
});

test('report notes reject invalid values and oversized drafts', () => {
  assert.throws(() => normalizeReportNote(null), /invalid_note/);
  assert.throws(() => normalizeReportNote('x'.repeat(MAX_REPORT_NOTE_LENGTH + 1)), /note_too_long/);
  assert.equal(normalizeReportNote('x'.repeat(MAX_REPORT_NOTE_LENGTH)).length, MAX_REPORT_NOTE_LENGTH);
});

test('report note routes only accept bounded report identifiers', () => {
  assert.equal(validReportId('6f3484d59eb090fa'), true);
  assert.equal(validReportId('../private'), false);
  assert.equal(validReportId('short'), false);
});
