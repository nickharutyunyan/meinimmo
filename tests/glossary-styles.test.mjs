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
