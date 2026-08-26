import assert from 'node:assert/strict';
import test from 'node:test';
import { pdfTextFromItems } from '../lib/pdf-text.ts';

const item = (str, x, y, width, hasEOL = false, height = 9) => ({ str, transform: [1, 0, 0, 1, x, y], width, height, hasEOL });

test('rebuilds PDF visual lines without splitting glyph fragments inside words', () => {
  const text = pdfTextFromItems([
    item('Pren', 44, 731, 19), item('z', 63, 731, 4), item('lauer Berg', 67, 731, 44),
    item(',', 111, 731, 2), item(' ', 113, 731, 2), item('10439', 115, 731, 25), item(' ', 140, 731, 2), item('Berlin', 142, 731, 25, true),
    item('Wohn', 44, 700, 24), item('fl', 68, 700, 6), item('äche', 74, 700, 22), item(':', 96, 700, 2), item(' ', 98, 700, 30), item('91,68', 143, 700, 21), item(' ', 164, 700, 2), item('m', 166, 700, 8), item('²', 174, 700, 3, true),
  ]);

  assert.equal(text, 'Prenzlauer Berg, 10439 Berlin\nWohnfläche: 91,68 m²');
});

test('keeps vertically separate price and price-per-square-metre rows separate', () => {
  const text = pdfTextFromItems([
    item('575.000', 44, 421, 62), item(' ', 106, 421, 3), item('€', 109, 421, 11, true, 17),
    item('Kaufpreis', 44, 406, 40), item(' ', 84, 406, 2), item('6.272', 85, 406, 21), item(' ', 107, 406, 2), item('€/', 108, 406, 10), item('m', 118, 406, 8), item('²', 126, 406, 3, true),
  ]);

  assert.equal(text, '575.000 €\nKaufpreis 6.272 €/m²');
});

