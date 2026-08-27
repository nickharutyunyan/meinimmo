import { featureFlagEnabled } from './feature-flags.ts';

type BillingEnvironment = {
  PAYMENTS_ENABLED?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_DAY_PASS?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ULTRA?: string;
};

export function billingAvailability(env: BillingEnvironment) {
  const enabled = featureFlagEnabled(env.PAYMENTS_ENABLED, false);
  const stripeConfigured = Boolean(env.STRIPE_SECRET_KEY);
  return {
    enabled,
    subscriptions: enabled && stripeConfigured && Boolean(env.STRIPE_PRICE_PRO && env.STRIPE_PRICE_ULTRA),
    dayPass: enabled && stripeConfigured && Boolean(env.STRIPE_PRICE_DAY_PASS),
  };
}
