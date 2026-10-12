import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { priceBar } from '../lib/price-check-copy.ts';

const base = { area: 'Prenzlauer Berg', year: 2025, mean: 6300, low: 3911, high: 8656, n: 663, askingPerSqm: 9083, deltaPct: 44, position: 'above', confidence: 'normal', newBuildCaveat: false, city: 'Berlin', rangeKind: 'typical' };
const inBounds = value => value >= 0 && value <= 100;

test('the bar places range, average and asking price in order and inside the track', () => {
  const bar = priceBar(base, 'en');
  assert.ok(bar.range);
  for (const value of [bar.range.low, bar.mean, bar.range.high, bar.asking]) assert.ok(inBounds(value), String(value));
  assert.ok(bar.range.low < bar.mean && bar.mean < bar.range.high && bar.range.high < bar.asking);
  assert.equal(bar.askingLabel, '€9,083/m²');
  assert.equal(bar.homeKey, 'This home €9,083/m²');
  assert.equal(bar.meanKey, 'Area average €6,300/m²');
  assert.equal(bar.rangeKey, 'Typical range €3,911–€8,656/m²');
  assert.equal(bar.onMean, false);
});

test('a price far outside the range stays on the bar with its pin turned inward', () => {
  const high = priceBar({ ...base, askingPerSqm: 17500, deltaPct: 178 }, 'en');
  assert.ok(inBounds(high.asking));
  assert.equal(high.pinAlign, 'end');
  const low = priceBar({ ...base, askingPerSqm: 1200, deltaPct: -81, position: 'below' }, 'en');
  assert.ok(inBounds(low.asking) && low.asking < low.range.low);
  assert.equal(low.pinAlign, 'start');
});

test('edge labels are left to the legend when the band is too narrow for them', () => {
  assert.equal(priceBar({ ...base, askingPerSqm: 17500, deltaPct: 178 }, 'en').range.showEnds, false);
  assert.equal(priceBar(base, 'en').range.showEnds, true);
});

test('a price on the average is flagged so the tick clears the pin', () => {
  assert.equal(priceBar({ ...base, askingPerSqm: 6350, deltaPct: 1, position: 'within' }, 'en').onMean, true);
});

test('Cologne names its range as lowest–highest, Munich shows only a city-wide average', () => {
  const cologne = priceBar({ ...base, city: 'Köln', rangeKind: 'minmax', mean: 3266, low: 1500, high: 5200, askingPerSqm: 3782 }, 'de');
  assert.match(cologne.rangeKey, /^Niedrigster–höchster Verkauf /);
  assert.equal(cologne.homeKey, 'Dieses Objekt 3.782 €/m²');
  const munich = priceBar({ ...base, city: 'München', tier: 'city', rangeKind: 'none', mean: 9500, low: 0, high: 0, askingPerSqm: 9750 }, 'en');
  assert.equal(munich.range, undefined);
  assert.equal(munich.rangeKey, undefined);
  assert.equal(munich.meanKey, 'City-wide average €9,500/m²');
  assert.ok(inBounds(munich.asking) && inBounds(munich.mean));
});

test('the report card and the print report both draw the bar', async () => {
  const card = await readFile(new URL('../components/PriceCheckCard.tsx', import.meta.url), 'utf8');
  const print = await readFile(new URL('../components/PrintReport.tsx', import.meta.url), 'utf8');
  assert.match(card, /<PriceRangeBar bar=\{view\.bar\} \/>/);
  assert.match(print, /<PriceRangeBar bar=\{priceView\.bar\} className="is-print" \/>/);
});
