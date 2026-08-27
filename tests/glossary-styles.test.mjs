import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('glossary terms and tooltips are isolated from surrounding component styles', async () => {
  const css = await readFile(new URL('../app/editorial.css', import.meta.url), 'utf8');
  assert.match(css, /span\.glossary-term\[role='button'\]\s*\{\s*all:\s*unset;/);
  assert.match(css, /span\.glossary-term\[role='button'\]\s*>\s*span\.glossary-tooltip\s*\{\s*all:\s*initial;/);
  assert.doesNotMatch(css, /\.offer-questions li span\s*\{/);
  assert.doesNotMatch(css, /\.signal span\s*\{/);
  assert.doesNotMatch(css, /\.feature-list span\s*\{/);
});

test('financing labels wrap glossary text inside a single flex item', async () => {
  const component = await readFile(new URL('../components/FinanceCalculator.tsx', import.meta.url), 'utf8');
  assert.match(component, /className="finance-field-label"><GlossaryText[^>]*>\{text\.repayment\}/);
  assert.doesNotMatch(component, /<span><GlossaryText[^>]*>\{text\.repayment\}/);
});

test('mobile comparisons render both properties as complete cards', async () => {
  const component = await readFile(new URL('../components/ComparisonView.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app/editorial.css', import.meta.url), 'utf8');
  assert.match(component, /comparison-mobile/);
  assert.match(css, /\.comparison-mobile\s*\{[\s\S]*?display:\s*grid;/);
});

test('comparison label tooltips open inward instead of being cropped by the table edge', async () => {
  const css = await readFile(new URL('../app/editorial.css', import.meta.url), 'utf8');
  assert.match(css, /\.comparison-grid \.metric span\.glossary-term\[role='button'\] > span\.glossary-tooltip\s*\{[\s\S]*?left:\s*0;[\s\S]*?transform:\s*translateY\(4px\);/);
});

test('comparison navigation keeps its descriptor centered between equal side columns', async () => {
  const css = await readFile(new URL('../app/editorial.css', import.meta.url), 'utf8');
  assert.match(css, /\.comparison-page \.site-nav\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\);/);
  assert.match(css, /\.comparison-page \.site-nav \.nav-note\s*\{[\s\S]*?justify-self:\s*center;[\s\S]*?text-align:\s*center;/);
});
