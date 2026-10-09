import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buyerCostBreakdown, buyerCostView } from '../lib/buyer-costs.ts';
import { acquisitionCosts, defaultEquity, financingScenario } from '../lib/finance.ts';

const rows = JSON.parse(readFileSync(new URL('./fixtures/baseline-reports.json', import.meta.url), 'utf8'))[0].results;

function parseMoney(raw, locale) {
  const text = String(raw).replace(/\u00a0/g, '').replace(/\u202f/g, '').replace(/€/g, '').trim();
  if (!text) return null;
  const numeric = locale === 'de' ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  const value = Number(numeric);
  if (!Number.isFinite(value)) throw new Error(`unparsed money ${raw}`);
  return value;
}

function ends(amount, locale) {
  if (!amount) return null;
  const parsed = String(amount).split('–').map((piece) => parseMoney(piece, locale)).filter((value) => value != null);
  if (!parsed.length) return null;
  return { low: parsed[0], high: parsed.at(-1) };
}

const cents = (value) => Math.round(Number(value) * 100);

test('every baseline cost panel derives total, loan, equity and monthly cost from the displayed lines', () => {
  assert.ok(rows.length >= 80);
  const seen = new Set();
  for (const row of rows) {
    const report = JSON.parse(row.data);
    const price = Number(report?.facts?.price);
    if (!(price > 0)) continue;
    seen.add(row.id);
    const breakdown = buyerCostBreakdown(report);
    const costs = acquisitionCosts(report);
    assert.equal(cents(costs.buyerCosts), cents(breakdown.financingLow), row.id);
    assert.equal(cents(costs.total), cents(breakdown.totalLow), row.id);
    assert.equal(cents(costs.total), cents(price) + cents(costs.buyerCosts), row.id);

    for (const locale of ['en', 'de']) {
      const view = buyerCostView(report, locale);
      const lines = view.rows.map((line) => ends(line.amount, locale)).filter(Boolean);
      const low = lines.reduce((sum, line) => sum + cents(line.low), 0);
      const high = lines.reduce((sum, line) => sum + cents(line.high), 0);
      const summary = ends(view.summaryAmount, locale);
      const total = ends(view.totalAmount, locale);
      assert.equal(cents(summary.low), low, `${row.id} ${locale} summary`);
      assert.equal(cents(summary.high), high, `${row.id} ${locale} summary high`);
      assert.equal(cents(total.low), cents(price) + low, `${row.id} ${locale} total`);
      assert.equal(cents(total.high), cents(price) + high, `${row.id} ${locale} total high`);
      assert.equal(cents(costs.total), cents(total.low), `${row.id} ${locale} financed total`);
    }

    const equity = defaultEquity(costs.total);
    const monthly = financingScenario({
      total: costs.total,
      equity,
      interest: 3.5,
      repayment: 2,
      housegeld: report.facts.housegeld,
      includeHousegeld: true,
    });
    const without = financingScenario({
      total: costs.total,
      equity,
      interest: 3.5,
      repayment: 2,
      housegeld: report.facts.housegeld,
      includeHousegeld: false,
    });
    assert.equal(cents(monthly.loan + equity), cents(costs.total), row.id);
    assert.equal(cents(monthly.loanPayment), cents(monthly.loan * 5.5 / 100 / 12), row.id);
    const housegeld = Number(report.facts.housegeld) > 0 ? Number(report.facts.housegeld) : 0;
    assert.equal(cents(monthly.knownOutlay), cents(monthly.loanPayment + housegeld), row.id);
    assert.equal(cents(without.knownOutlay), cents(without.loanPayment), row.id);
    assert.equal(cents(monthly.knownOutlay - without.knownOutlay), cents(housegeld), row.id);
  }

  for (const id of ['6fe05eec1c186287', '6c2cb1fb2e3d4934', '9aedc83ac364b455', 'b7c9512d8475e887', 'fefc0acce8c09d7e']) {
    assert.ok(seen.has(id), id);
  }

  const storedGap = (id) => {
    const report = JSON.parse(rows.find((row) => row.id === id).data);
    return cents(report.facts.price + report.facts.buyerCosts) - cents(report.facts.totalCost);
  };
  assert.equal(storedGap('6c2cb1fb2e3d4934'), 100);
  assert.equal(storedGap('fefc0acce8c09d7e'), 100);
  assert.equal(storedGap('9aedc83ac364b455'), 100);
  const panel = (id) => buyerCostBreakdown(JSON.parse(rows.find((row) => row.id === id).data));
  assert.notEqual(cents(panel('6c2cb1fb2e3d4934').totalLow), cents(JSON.parse(rows.find((row) => row.id === '6c2cb1fb2e3d4934').data).facts.totalCost));
  assert.equal(panel('6fe05eec1c186287').estimateLow, 26_320);
  assert.equal(panel('6c2cb1fb2e3d4934').estimateLow, 44_965);
  assert.equal(panel('9aedc83ac364b455').estimateLow, 71_500);
  assert.equal(panel('b7c9512d8475e887').estimateLow, 100_300);
  assert.equal(panel('fefc0acce8c09d7e').estimateLow, 59_920);
});
