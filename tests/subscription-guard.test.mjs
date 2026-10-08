import assert from 'node:assert/strict';
import test from 'node:test';
import { subscriptionCheckoutConflict } from '../lib/subscription-guard.ts';

const open = { localStatus: null, stripeStatuses: [] };

test('a new subscription is allowed when neither AUTH_DB nor Stripe has one', () => {
  assert.deepEqual(subscriptionCheckoutConflict(open), { blocked: false, status: null, source: null });
  assert.deepEqual(subscriptionCheckoutConflict({ localStatus: undefined, stripeStatuses: [] }), { blocked: false, status: null, source: null });
});

test('AUTH_DB blocks active, trialing, and past_due subscriptions', () => {
  for (const status of ['active', 'trialing', 'past_due']) {
    assert.deepEqual(subscriptionCheckoutConflict({ localStatus: status, stripeStatuses: [] }), {
      blocked: true,
      status,
      source: 'auth_db',
    });
  }
});

test('Stripe blocks the same statuses even when the local row was overwritten or cancelled', () => {
  for (const localStatus of [null, 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused']) {
    assert.deepEqual(subscriptionCheckoutConflict({
      localStatus,
      stripeStatuses: ['canceled', 'active'],
    }), {
      blocked: true,
      status: 'active',
      source: 'stripe',
    });
  }
  assert.equal(subscriptionCheckoutConflict({ localStatus: 'canceled', stripeStatuses: ['trialing'] }).blocked, true);
  assert.equal(subscriptionCheckoutConflict({ localStatus: null, stripeStatuses: ['past_due'] }).source, 'stripe');
});

test('ended or unfinished statuses do not block a new subscription', () => {
  for (const status of ['canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused', 'Active', '']) {
    assert.equal(subscriptionCheckoutConflict({ localStatus: status, stripeStatuses: [status] }).blocked, false, status);
  }
});

test('the guard uses both sources and does not depend on a feature flag', () => {
  const decision = subscriptionCheckoutConflict({ localStatus: 'canceled', stripeStatuses: ['past_due'] });
  assert.equal(decision.blocked, true);
  assert.equal(decision.source, 'stripe');
  assert.equal(subscriptionCheckoutConflict({ localStatus: 'active', stripeStatuses: ['canceled'] }).source, 'auth_db');
});
