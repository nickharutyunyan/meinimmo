import type { Facts } from './types';

const finiteNonNegative = (value: number | undefined) => Number.isFinite(value) && Number(value) >= 0 ? Number(value) : 0;

export function acquisitionCosts(facts: Pick<Facts, 'price' | 'buyerCosts' | 'totalCost'>) {
  const price = finiteNonNegative(facts.price);
  const statedBuyerCosts = finiteNonNegative(facts.buyerCosts);
  const statedTotal = finiteNonNegative(facts.totalCost);
  const plausibleTotal = statedTotal >= price ? statedTotal : 0;
  const buyerCostsAreEstimated = !statedBuyerCosts && !plausibleTotal;
  const buyerCosts = statedBuyerCosts
    || (plausibleTotal ? Math.max(0, plausibleTotal - price) : Math.round(price * 0.08));
  const total = plausibleTotal || price + buyerCosts;

  return { price, buyerCosts, total, buyerCostsAreEstimated };
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
}) {
  const total = finiteNonNegative(input.total);
  const equity = Math.min(total, finiteNonNegative(input.equity));
  const interest = finiteNonNegative(input.interest);
  const repayment = finiteNonNegative(input.repayment);
  const housegeld = finiteNonNegative(input.housegeld);
  const loan = Math.max(0, total - equity);
  const loanPayment = loan * (interest + repayment) / 100 / 12;
  return { loan, loanPayment, knownOutlay: loanPayment + housegeld };
}
