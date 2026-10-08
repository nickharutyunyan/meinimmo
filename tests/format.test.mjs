import assert from 'node:assert/strict';
import test from 'node:test';
import { area, money, moneyPerSqm, percent, photoCount, plainNumber, score } from '../lib/format.ts';

const visible = (value) => value.replace(/\u00a0/g, ' ');

test('money uses English and German currency formats', () => {
  assert.equal(money(172000, 'en'), '€172,000');
  assert.equal(visible(money(172000, 'de')), '172.000 €');
  assert.equal(money(1000000, 'en'), '€1,000,000');
  assert.equal(visible(money(1000000, 'de')), '1.000.000 €');
  assert.equal(money(100, 'en'), '€100');
  assert.equal(visible(money(100, 'de')), '100 €');
  assert.equal(money(142.59, 'en'), '€142.59');
  assert.equal(visible(money(142.59, 'de')), '142,59 €');
  assert.equal(money(99.5, 'en'), '€99.50');
  assert.equal(visible(money(99.5, 'de')), '99,50 €');
  assert.equal(money(83, 'en'), '€83');
  assert.equal(visible(money(83, 'de')), '83 €');
  assert.equal(money(9, 'en'), '€9.00');
  assert.equal(visible(money(9, 'de')), '9,00 €');
  assert.equal(money(83.4, 'en'), '€83.40');
  assert.equal(money(0, 'en'), '€0.00');
  assert.equal(visible(money(0, 'de')), '0,00 €');
  assert.equal(money(-1000, 'en'), '−€1,000');
  assert.equal(visible(money(-1000, 'de')), '−1.000 €');
});

test('money per square metre, area, percent, score and plain numbers follow the locale', () => {
  assert.equal(moneyPerSqm(5733, 'en'), '€5,733/m²');
  assert.equal(visible(moneyPerSqm(5733, 'de')), '5.733 €/m²');
  assert.equal(area(32.2, 'en'), '32.2 m²');
  assert.equal(area(32.2, 'de'), '32,2 m²');
  assert.equal(area(30, 'en'), '30 m²');
  assert.equal(area(87.71, 'de'), '87,71 m²');
  assert.equal(percent(4.52, 'en'), '4.52%');
  assert.equal(percent(4.52, 'de'), '4,52\u00a0%');
  assert.equal(percent(3.5, 'en', 1), '3.5%');
  assert.equal(score(7, 'en'), '7.0');
  assert.equal(score(7, 'de'), '7,0');
  assert.equal(score(7.5, 'en'), '7.5');
  assert.equal(plainNumber(124.8, 'de', 1), '124,8');
  assert.equal(plainNumber(2.5, 'en', 1), '2.5');
  assert.equal(photoCount(3, 8, 'en'), '3 / 8');
  assert.equal(photoCount(3, 8, 'de'), '3 / 8');
  assert.equal(photoCount(3, 8, 'de', '{n} / {total}'), '3 / 8');
  assert.equal(photoCount(1000, 2000, 'en'), '1,000 / 2,000');
  assert.equal(visible(photoCount(1000, 2000, 'de')), '1.000 / 2.000');
});

test('unknown numbers do not become zero, NaN or null', () => {
  for (const value of [undefined, null, Number.NaN, 'nope']) {
    for (const locale of ['en', 'de']) {
      for (const formatted of [money(value, locale), moneyPerSqm(value, locale), area(value, locale), percent(value, locale), score(value, locale), plainNumber(value, locale, 2), photoCount(value, 8, locale), photoCount(1, value, locale)]) {
        assert.equal(formatted, '');
        assert.doesNotMatch(formatted, /undefined|NaN|null|0 €|€0/);
      }
    }
  }
});
