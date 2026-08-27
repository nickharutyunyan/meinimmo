import assert from 'node:assert/strict';
import test from 'node:test';
import { visibleComparisonRows } from '../lib/comparison.ts';

test('comparison rows disappear only when both properties have no value', () => {
  assert.deepEqual(visibleComparisonRows([
    ['Advertised return', '—', '—'],
    ['Hausgeld', '—', '€320 / month'],
    ['Energy', 'C', '—'],
    ['Score', '7.20 / 10', '6.80 / 10'],
  ]), [
    ['Hausgeld', '—', '€320 / month'],
    ['Energy', 'C', '—'],
    ['Score', '7.20 / 10', '6.80 / 10'],
  ]);
});
