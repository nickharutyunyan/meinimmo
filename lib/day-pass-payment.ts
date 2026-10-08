/**
 * Euro cents charged for the one-off day pass.
 * Checkout events do not include the price id unless line items are expanded.
 * When that id is missing, fulfillment still requires this amount. Prefer the
 * configured Stripe price id (`STRIPE_PRICE_DAY_PASS`) once it is present.
 */
export const DAY_PASS_AMOUNT_CENTS = 500;

export function dayPassCheckoutFulfilled(input: {
  plan?: string | null;
  paymentStatus?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  linePriceId?: string | null;
  configuredPriceId?: string | null;
}) {
  if (input.plan !== 'day_pass' || input.paymentStatus !== 'paid' || input.currency !== 'eur') return false;
  if (input.linePriceId) return Boolean(input.configuredPriceId) && input.linePriceId === input.configuredPriceId;
  return input.amountTotal === DAY_PASS_AMOUNT_CENTS;
}
