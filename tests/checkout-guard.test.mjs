import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('hidden paid plans refuse checkout before a Stripe session is created', async () => {
  const route = await source('app/api/billing/checkout/route.ts');
  const hidden = route.indexOf('plansEnabled');
  const create = route.indexOf('createCheckout(');
  assert.ok(hidden > 0 && create > hidden);
  assert.match(route, /status: 403/);
  assert.match(route, /plans_hidden/);
  assert.match(route, /Paid plans are not available right now/);
});

test('subscription checkout checks AUTH_DB and Stripe before creating a session', async () => {
  const route = await source('app/api/billing/checkout/route.ts');
  const stripe = await source('lib/stripe.ts');
  assert.match(route, /SELECT status FROM subscriptions WHERE user_id = \?1/);
  assert.match(route, /stripeCustomerId/);
  assert.match(route, /customerSubscriptionStatuses/);
  assert.match(route, /subscriptionCheckoutConflict/);
  assert.match(route, /subscription_exists/);
  assert.doesNotMatch(route, /access\.kind === 'pro'/);
  const conflict = route.indexOf('subscriptionCheckoutConflict');
  const create = route.indexOf('createCheckout(');
  assert.ok(conflict > 0 && create > conflict);
  assert.match(stripe, /status: 'all'/);
  assert.match(stripe, /customer: customerId/);
});

test('the billing portal and webhooks stay available while new purchases are hidden', async () => {
  const portal = await source('app/api/billing/portal/route.ts');
  const webhook = await source('app/api/billing/webhook/route.ts');
  assert.doesNotMatch(portal, /PAID_PLANS_ENABLED|plansEnabled/);
  assert.match(portal, /createBillingPortal/);
  assert.match(webhook, /processStripeEvent/);
  assert.doesNotMatch(webhook, /PAID_PLANS_ENABLED|plansEnabled/);
});
