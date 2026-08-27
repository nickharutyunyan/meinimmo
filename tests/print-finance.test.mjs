import assert from 'node:assert/strict';
import test from 'node:test';
import { printFinanceSettings } from '../lib/print-finance.ts';

test('print reports preserve valid calculator settings', () => {
  assert.deepEqual(printFinanceSettings({ equity: '90000', interest: '4.2', repayment: '2.4', hausgeld: '0' }, 400_000), {
    equity: 90_000,
    interest: 4.2,
    repayment: 2.4,
    includeHousegeld: false,
  });
});

test('print calculator parameters are bounded and retain safe defaults', () => {
  assert.deepEqual(printFinanceSettings({ equity: '999999', interest: '99', repayment: '-2' }, 400_000), {
    equity: 400_000,
    interest: 7,
    repayment: 1,
    includeHousegeld: true,
  });
});
