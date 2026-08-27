import { defaultEquity } from './finance.ts';

type Query = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function bounded(value: string | string[] | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(first(value));
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export function printFinanceSettings(query: Query, total: number) {
  return {
    equity: bounded(query.equity, defaultEquity(total), 0, total),
    interest: bounded(query.interest, 3.5, 2, 7),
    repayment: bounded(query.repayment, 2, 1, 5),
    includeHousegeld: first(query.hausgeld) !== '0',
  };
}
