import assert from 'node:assert/strict';
import test from 'node:test';
import { stableReportId } from '../lib/report-id.ts';

test('URL report ids remain stable across tracking variants', async () => {
  const clean = await stableReportId('https://www.ohne-makler.net/immobilie/487839/');
  const tracked = await stableReportId('https://www.ohne-makler.net/immobilie/487839/?utm_source=email#photos');
  assert.equal(tracked, clean);
  assert.notEqual(await stableReportId('https://www.ohne-makler.net/immobilie/487840/'), clean);
});

test('PDF report ids include their extracted text', async () => {
  assert.notEqual(await stableReportId('Expose.pdf', 'First property'), await stableReportId('Expose.pdf', 'Second property'));
});
