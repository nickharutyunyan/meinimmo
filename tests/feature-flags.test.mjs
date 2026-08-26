import assert from 'node:assert/strict';
import test from 'node:test';
import { featureFlagEnabled } from '../lib/feature-flags.ts';

test('report-limit feature flags default to off', () => {
  assert.equal(featureFlagEnabled(undefined), false);
  assert.equal(featureFlagEnabled('false'), false);
  assert.equal(featureFlagEnabled('off'), false);
});

test('report limits can be restored with one explicit flag value', () => {
  assert.equal(featureFlagEnabled('true'), true);
  assert.equal(featureFlagEnabled('1'), true);
  assert.equal(featureFlagEnabled('enabled'), true);
});

