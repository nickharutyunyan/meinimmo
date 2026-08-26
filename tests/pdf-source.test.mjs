import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPdfDisplayName, hasPdfSignature, pdfContentDisposition, pdfDownloadName } from '../lib/pdf-source.ts';

test('uploaded PDF names are cleaned for report display', () => {
  assert.equal(cleanPdfDisplayName('  Berlin_Flat_Expose.PDF  '), 'Berlin Flat Expose');
  assert.equal(cleanPdfDisplayName('/private/uploads/Danziger Str. 89.pdf'), 'Danziger Str. 89');
  assert.equal(cleanPdfDisplayName('__.pdf'), 'Property Exposé');
  assert.equal(pdfDownloadName('Danziger Str. 89.pdf'), 'Danziger Str. 89.pdf');
});

test('PDF validation checks the real file signature', () => {
  assert.equal(hasPdfSignature(new TextEncoder().encode('%PDF-1.7')), true);
  assert.equal(hasPdfSignature(new TextEncoder().encode('<html>')), false);
});

test('PDF downloads use a safe filename and preserve unicode', () => {
  const header = pdfContentDisposition('Schönes Exposé.pdf');
  assert.match(header, /^attachment; filename="/);
  assert.match(header, /filename\*=UTF-8''Sch%C3%B6nes%20Expos%C3%A9\.pdf$/);
  assert.doesNotMatch(header, /\.pdf\.pdf/);
});
