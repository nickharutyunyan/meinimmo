import assert from 'node:assert/strict';
import test from 'node:test';
import { extractAvailabilityDate, formatAvailabilityDate } from '../lib/availability.ts';
import { localizedTenancy } from '../lib/i18n.ts';

test('extracts an explicit future move-in date from a PDF-style availability row', () => {
  assert.equal(extractAvailabilityDate(['Nutzfläche ca.: 5 m²', 'Bezugsfrei ab: 27.8.2026', 'Zimmer: 3']), '2026-08-27');
  assert.equal(extractAvailabilityDate(['Bezugsfrei ab:', '27. August 2026']), '2026-08-27');
});

test('does not invent a date for immediate or generic vacant-possession wording', () => {
  assert.equal(extractAvailabilityDate(['Bezugsfrei ab: sofort']), undefined);
  assert.equal(extractAvailabilityDate(['Die Wohnung ist nicht vermietet.']), undefined);
  assert.equal(extractAvailabilityDate(['Nur für kurze Zeit provisionsfrei.']), undefined);
});

test('dated availability replaces the generic not-rented display copy', () => {
  assert.equal(formatAvailabilityDate('2026-08-27', 'en'), '27 August 2026');
  assert.equal(localizedTenancy('Not rented', '2026-08-27', 'en'), 'Available from 27 August 2026');
  assert.equal(localizedTenancy('Not rented', '2026-08-27', 'de'), 'Bezugsfrei ab 27. August 2026');
});
