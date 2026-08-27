import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('print reports link the brand, identify PDF sources and keep the concise footer', async () => {
  const component = await readFile(new URL('../components/PrintReport.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app/print-report.css', import.meta.url), 'utf8');
  assert.match(component, /<a className="print-brand" href="https:\/\/reviewahouse\.com">/);
  assert.match(component, /pdfSource: 'Exposé PDF'/);
  assert.doesNotMatch(component, /Grobe Orientierung|An indicative review/);
  assert.match(component, /disclaimer: 'Kein Wertgutachten oder Finanzierungsangebot\.'/);
  assert.match(component, /https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  assert.match(component, /<a href=\{mapsUrl\}>\{location\.mapLabel \|\| subtitle\}<span aria-hidden="true">↗<\/span><\/a>/);
  assert.match(css, /\.print-footer p\s*\{[^}]*white-space:\s*nowrap;/);
});
