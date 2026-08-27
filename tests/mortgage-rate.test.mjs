import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFmhMortgageRate } from '../lib/fmh-mortgage-rate.ts';

const sample = `
  <table>
    <tr id="ucDailyDetailBG10_trHeader"><th>Baugeld Eff.zins 10 J.</th><th class="datum">27.08.</th><th>13.08.</th></tr>
    <tr><td>Niedrigster Zins</td><td>3,76</td></tr>
    <tr class="fmhindex"><td>FMH-IndeX</td><td class="zins"><div>4,15</div></td><td>4,10</td></tr>
  </table>`;

test('parses the current 10-year FMH average and observation date', () => {
  assert.deepEqual(parseFmhMortgageRate(sample, new Date('2026-08-27T12:00:00Z')), {
    rate: 4.15,
    observedAt: '2026-08-27',
  });
});

test('assigns a late-December observation to the previous year when run in January', () => {
  const december = sample.replace('27.08.', '31.12.');
  assert.equal(parseFmhMortgageRate(december, new Date('2027-01-02T12:00:00Z')).observedAt, '2026-12-31');
});

test('rejects malformed or implausible rate data', () => {
  assert.throws(() => parseFmhMortgageRate(sample.replace('4,15', '99,00')));
  assert.throws(() => parseFmhMortgageRate('<html>no index</html>'));
});
