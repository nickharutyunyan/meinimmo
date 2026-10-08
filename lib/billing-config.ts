import { featureFlagEnabled } from './feature-flags.ts';

type BillingEnvironment = {
  PAYMENTS_ENABLED?: string;
  PAID_PLANS_ENABLED?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_DAY_PASS?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ULTRA?: string;
};

export function paidPlansEnabled(env: { PAID_PLANS_ENABLED?: string }) {
  return featureFlagEnabled(env.PAID_PLANS_ENABLED, false);
}

export function billingAvailability(env: BillingEnvironment) {
  const enabled = featureFlagEnabled(env.PAYMENTS_ENABLED, false);
  const plansEnabled = paidPlansEnabled(env);
  const stripeConfigured = Boolean(env.STRIPE_SECRET_KEY);
  const purchasesOpen = enabled && plansEnabled;
  return {
    enabled,
    plansEnabled,
    subscriptions: purchasesOpen && stripeConfigured && Boolean(env.STRIPE_PRICE_PRO && env.STRIPE_PRICE_ULTRA),
    dayPass: purchasesOpen && stripeConfigured && Boolean(env.STRIPE_PRICE_DAY_PASS),
  };
}
