import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('comparison addresses link to their factual Google Maps queries on desktop and mobile', async () => {
  const component = await readFile(new URL('../components/ComparisonView.tsx', import.meta.url), 'utf8');
  assert.match(component, /https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  assert.match(component, /label === text\.address && value !== '—'/);
  assert.match(component, /comparisonValue\(label, a, 1\)/);
  assert.match(component, /comparisonValue\(label, valueIndex === 1 \? a : b, valueIndex as 1 \| 2\)/);
});

test('the removed comparison tagline is absent in both languages', async () => {
  const translations = await readFile(new URL('../lib/i18n.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(translations, /A calm view of the facts that change a decision\./);
  assert.doesNotMatch(translations, /Eine ruhige Ansicht der Fakten/);
});
