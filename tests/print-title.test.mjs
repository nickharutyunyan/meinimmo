import assert from 'node:assert/strict';
import test from 'node:test';
import { printDocumentTitle } from '../lib/print-title.ts';

const report = {
  address: 'Möckernstraße, 10963 Berlin',
  location: 'Kreuzberg',
  source: 'test',
  facts: { city: 'Berlin', district: 'Kreuzberg', street: 'Möckernstraße', locationPrecision: 'street' },
};

test('print document titles include the clean property street or best location', () => {
  assert.equal(printDocumentTitle(report, 'de'), 'Immobilien-Bericht · Möckernstraße · ReviewAHouse');
  assert.equal(printDocumentTitle(report, 'en'), 'Property report · Möckernstraße · ReviewAHouse');
  assert.equal(printDocumentTitle({ ...report, address: 'Address not stated', facts: { ...report.facts, street: undefined, district: 'Kreuzberg', locationPrecision: 'neighborhood' } }, 'de'), 'Immobilien-Bericht · Kreuzberg · ReviewAHouse');
});
