import test from 'node:test';
import assert from 'node:assert/strict';
import { canOfferDayPass } from '../lib/day-pass.ts';

test('new visitors never see the one-off day pass', () => {
  assert.equal(canOfferDayPass({ kind: 'free', limit: 2, used: 0, remaining: 2 }), false);
  assert.equal(canOfferDayPass({ kind: 'free', limit: 2, used: 1, remaining: 1 }), false);
  assert.equal(canOfferDayPass(undefined), false);
});

test('the day pass appears only after both free reports are used', () => {
  assert.equal(canOfferDayPass({ kind: 'free', limit: 2, used: 2, remaining: 0 }), true);
  assert.equal(canOfferDayPass({ kind: 'day_pass', limit: 50, used: 50, remaining: 0 }), false);
  assert.equal(canOfferDayPass({ kind: 'pro', limit: 10, used: 10, remaining: 0 }), false);
  assert.equal(canOfferDayPass({ kind: 'ultra', limit: 100, used: 100, remaining: 0 }), false);
});

test('the day pass remains hidden while report limits are feature-flagged off', () => {
  assert.equal(canOfferDayPass({ limitsEnabled: false, kind: 'free', limit: 2, used: 2, remaining: 0 }), false);
});
