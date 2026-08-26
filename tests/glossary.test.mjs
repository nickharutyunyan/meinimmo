import assert from 'node:assert/strict';
import test from 'node:test';
import { glossaryPieces } from '../lib/glossary.ts';

test('English glossary terms receive the expected explanations', () => {
  const pieces = glossaryPieces('Check the Hausgeld and Energieausweis.', 'en');
  assert.match(pieces.find(piece => piece.text === 'Hausgeld')?.explanation || '', /monthly condominium fee/i);
  assert.match(pieces.find(piece => piece.text === 'Energieausweis')?.explanation || '', /energy performance certificate/i);
});

test('German pages return completely plain glossary text', () => {
  assert.deepEqual(glossaryPieces('Hausgeld und Energieausweis', 'de'), [{ text: 'Hausgeld und Energieausweis' }]);
});
