import test from 'node:test';
import assert from 'node:assert/strict';
import { distinctUsableArea, glanceFacts } from '../lib/report-copy.ts';

test('usable area that repeats the living area is hidden', () => {
  assert.equal(distinctUsableArea({ area: 42.42, usableArea: 42.4 }), undefined);
  assert.equal(distinctUsableArea({ area: 100, usableArea: 100.9 }), undefined);
});

test('usable area that differs from the living area is kept', () => {
  assert.equal(distinctUsableArea({ area: 60, usableArea: 66 }), 66);
  assert.equal(distinctUsableArea({ usableArea: 40 }), 40);
  assert.equal(distinctUsableArea({ area: 60 }), undefined);
});

test('the glance grid shows no duplicate usable-space row', () => {
  const report = { id: 'x', title: 't', propertyType: 'flat', facts: { price: 329000, area: 42.42, usableArea: 42.4 } };
  const labels = glanceFacts(report, 'en').map(([label]) => label);
  assert.ok(!labels.some(label => /usable/i.test(label)));
});
