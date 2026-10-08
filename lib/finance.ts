import type { CostSource } from './buyer-costs.ts';
import { buyerCostBreakdown } from './buyer-costs.ts';

const finiteNonNegative = (value: number | undefined) => Number.isFinite(value) && Number(value) >= 0 ? Number(value) : 0;

/**
 * Buyer costs come from the listing when it states them. Otherwise they are
 * the itemised estimate in `buyer-costs.ts` (state transfer tax, notary, and
 * any commission the listing states). There is no flat percentage fallback.
 */
export function acquisitionCosts(input: CostSource) {
  const breakdown = buyerCostBreakdown(input);
  const ranged = breakdown.financingIsRange;
  return {
    price: breakdown.price,
    buyerCosts: breakdown.financingLow,
    total: breakdown.totalLow,
    buyerCostsAreEstimated: breakdown.financingIsEstimated,
    ...(ranged ? {
      buyerCostsHigh: breakdown.financingHigh,
      totalHigh: breakdown.totalHigh,
      buyerCostsAreRange: true as const,
    } : {}),
  };
}

export function defaultEquity(total: number) {
  return Math.min(total, Math.round(total * 0.25 / 1000) * 1000);
}

export function financingScenario(input: {
  total: number;
  equity: number;
  interest: number;
  repayment: number;
  housegeld?: number;
  includeHousegeld?: boolean;
}) {
  const total = finiteNonNegative(input.total);
  const equity = Math.min(total, finiteNonNegative(input.equity));
  const interest = finiteNonNegative(input.interest);
  const repayment = finiteNonNegative(input.repayment);
  const housegeld = input.includeHousegeld === false ? 0 : finiteNonNegative(input.housegeld);
  const loan = Math.max(0, total - equity);
  const loanPayment = loan * (interest + repayment) / 100 / 12;
  return { loan, loanPayment, knownOutlay: loanPayment + housegeld };
}
