export const BLOCKING_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'] as const;

export type BlockingSubscriptionStatus = (typeof BLOCKING_SUBSCRIPTION_STATUSES)[number];

export function isBlockingSubscriptionStatus(status: string | null | undefined): status is BlockingSubscriptionStatus {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

/**
 * Refuse a new subscription when AUTH_DB or Stripe already has one that is
 * active, trialing, or past_due. A clear local row does not override Stripe:
 * the subscriptions table keeps a single row per user, so a later webhook can
 * hide an older subscription that Stripe is still billing.
 */
export function subscriptionCheckoutConflict(input: {
  localStatus: string | null | undefined;
  stripeStatuses: readonly (string | null | undefined)[];
}): { blocked: boolean; status: string | null; source: 'auth_db' | 'stripe' | null } {
  if (isBlockingSubscriptionStatus(input.localStatus)) {
    return { blocked: true, status: input.localStatus, source: 'auth_db' };
  }
  const stripeStatus = input.stripeStatuses.find(isBlockingSubscriptionStatus);
  if (stripeStatus) return { blocked: true, status: stripeStatus, source: 'stripe' };
  return { blocked: false, status: null, source: null };
}
