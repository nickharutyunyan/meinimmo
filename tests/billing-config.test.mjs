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
  assert.deepEqual(billingAvailability(configured), {
    enabled: false,
    plansEnabled: false,
    subscriptions: false,
    dayPass: false,
  });
});

test('paid plans stay hidden while payments infrastructure remains on', () => {
  assert.deepEqual(billingAvailability({ ...configured, PAYMENTS_ENABLED: 'true' }), {
    enabled: true,
    plansEnabled: false,
    subscriptions: false,
    dayPass: false,
  });
  assert.equal(billingAvailability({ ...configured, PAYMENTS_ENABLED: 'true', PAID_PLANS_ENABLED: 'false' }).plansEnabled, false);
});

test('subscription checkout is independent from day-pass configuration once plans are offered', () => {
  assert.deepEqual(billingAvailability({
    ...configured,
    PAYMENTS_ENABLED: 'true',
    PAID_PLANS_ENABLED: 'on',
    STRIPE_PRICE_DAY_PASS: undefined,
  }), {
    enabled: true,
    plansEnabled: true,
    subscriptions: true,
    dayPass: false,
  });
});

test('all payment paths are available when plans are offered and their Stripe resources are configured', () => {
  assert.deepEqual(billingAvailability({ ...configured, PAYMENTS_ENABLED: 'enabled', PAID_PLANS_ENABLED: 'true' }), {
    enabled: true,
    plansEnabled: true,
    subscriptions: true,
    dayPass: true,
  });
});
