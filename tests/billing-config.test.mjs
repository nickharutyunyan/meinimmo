import assert from 'node:assert/strict';
import test from 'node:test';
import { billingAvailability } from '../lib/billing-config.ts';

const configured = {
  STRIPE_SECRET_KEY: 'secret-present',
  STRIPE_PRICE_DAY_PASS: 'price_day',
  STRIPE_PRICE_PRO: 'price_pro',
  STRIPE_PRICE_ULTRA: 'price_ultra',
};

test('billing stays disabled unless the payment feature is explicitly enabled', () => {
  assert.deepEqual(billingAvailability(configured), { enabled: false, subscriptions: false, dayPass: false });
});

test('subscription checkout is independent from day-pass and report-limit configuration', () => {
  assert.deepEqual(billingAvailability({ ...configured, PAYMENTS_ENABLED: 'true', STRIPE_PRICE_DAY_PASS: undefined }), {
    enabled: true,
    subscriptions: true,
    dayPass: false,
  });
});

test('all payment paths are available when their Stripe resources are configured', () => {
  assert.deepEqual(billingAvailability({ ...configured, PAYMENTS_ENABLED: 'enabled' }), {
    enabled: true,
    subscriptions: true,
    dayPass: true,
  });
});
