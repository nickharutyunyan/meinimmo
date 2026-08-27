import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('the location heading links its factual map query to Google Maps', async () => {
  const component = await readFile(new URL('../components/LocationCard.tsx', import.meta.url), 'utf8');
  assert.match(component, /https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  assert.match(component, /encodeURIComponent\(location\.mapQuery\)/);
  assert.match(component, /aria-label=\{`\$\{location\.mapLabel\} — Google Maps`\}/);
  assert.match(component, /target="_blank" rel="noreferrer"/);
});
