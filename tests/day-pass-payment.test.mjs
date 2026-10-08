import assert from 'node:assert/strict';
import test from 'node:test';
import { DAY_PASS_AMOUNT_CENTS, dayPassCheckoutFulfilled } from '../lib/day-pass-payment.ts';

test('a paid day pass can be matched by the configured Stripe price id', () => {
  assert.equal(dayPassCheckoutFulfilled({
    plan: 'day_pass',
    paymentStatus: 'paid',
    amountTotal: 600,
    currency: 'eur',
    linePriceId: 'price_day',
    configuredPriceId: 'price_day',
  }), true);
  assert.equal(dayPassCheckoutFulfilled({
    plan: 'day_pass',
    paymentStatus: 'paid',
    amountTotal: DAY_PASS_AMOUNT_CENTS,
    currency: 'eur',
    linePriceId: 'price_other',
    configuredPriceId: 'price_day',
  }), false);
});

test('without a price id, day-pass fulfillment still requires the hard-coded €5 amount', () => {
  assert.equal(DAY_PASS_AMOUNT_CENTS, 500);
  assert.equal(dayPassCheckoutFulfilled({
    plan: 'day_pass',
    paymentStatus: 'paid',
    amountTotal: 500,
    currency: 'eur',
  }), true);
  assert.equal(dayPassCheckoutFulfilled({
    plan: 'day_pass',
    paymentStatus: 'paid',
    amountTotal: 499,
    currency: 'eur',
  }), false);
  assert.equal(dayPassCheckoutFulfilled({
    plan: 'pro',
    paymentStatus: 'paid',
    amountTotal: 500,
    currency: 'eur',
  }), false);
});
