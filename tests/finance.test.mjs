import assert from 'node:assert/strict';
import test from 'node:test';
import { acquisitionCosts, defaultEquity, financingScenario } from '../lib/finance.ts';

test('rejects a monthly financing quote masquerading as total acquisition cost', () => {
  const costs = acquisitionCosts({ price: 480_000, buyerCosts: 38_400, totalCost: 1_531 });
  assert.deepEqual(costs, {
    price: 480_000,
    buyerCosts: 38_400,
    total: 518_400,
    buyerCostsAreEstimated: false,
  });
});

test('calculates a bounded annuity scenario from acquisition cost, equity and rates', () => {
  const total = 518_400;
  const equity = defaultEquity(total);
  assert.equal(equity, 130_000);
  const scenario = financingScenario({ total, equity, interest: 3.5, repayment: 2, housegeld: 145 });
  assert.equal(scenario.loan, 388_400);
  assert.equal(Math.round(scenario.loanPayment), 1_780);
  assert.equal(Math.round(scenario.knownOutlay), 1_925);
});

test('includes Hausgeld by default and can remove it from the monthly total', () => {
  const input = { total: 300_000, equity: 60_000, interest: 3.5, repayment: 2, housegeld: 280 };
  const included = financingScenario(input);
  const excluded = financingScenario({ ...input, includeHousegeld: false });
  assert.equal(included.knownOutlay - excluded.knownOutlay, 280);
  assert.equal(excluded.knownOutlay, excluded.loanPayment);
});

test('never allows equity or malformed negative inputs to create a negative loan', () => {
  const scenario = financingScenario({ total: 300_000, equity: 500_000, interest: -1, repayment: -2, housegeld: -10 });
  assert.deepEqual(scenario, { loan: 0, loanPayment: 0, knownOutlay: 0 });
});

test('conflicting costs never produce a contradictory acquisition breakdown', () => {
  const costs = acquisitionCosts({ price: 192700, buyerCosts: 192700, totalCost: 207242 });
  assert.equal(costs.buyerCosts, 14542);
  assert.equal(costs.price + costs.buyerCosts, costs.total);
  assert.equal(acquisitionCosts({price: 172000, buyerCosts: 13105, totalCost:185104}).buyerCosts, 13105);
  assert.equal(acquisitionCosts({price: 172000, buyerCosts: 0, totalCost:0}).buyerCostsAreEstimated, false);
});
