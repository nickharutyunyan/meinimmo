import assert from 'node:assert/strict';
import test from 'node:test';
import { glossListingQuote } from '../lib/listing-gloss.ts';
import { area, money } from '../lib/format.ts';

const visible = (value) => String(value).replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');

test('English pages gloss a German listing quote and leave the quote intact', () => {
  const price = glossListingQuote('Kaufpreis 329.000 €', 'en');
  assert.equal(visible(price), `Kaufpreis 329.000 € (purchase price ${visible(money(329_000, 'en'))})`);
  const space = glossListingQuote('42,42 m² Wohnfläche', 'en');
  assert.equal(visible(space), `42,42 m² Wohnfläche (${area(42.42, 'en')} living area)`);
  assert.equal(glossListingQuote('Aktuelle Nutzung Vermietet', 'en'), 'Aktuelle Nutzung Vermietet (current use: rented)');
  assert.equal(
    glossListingQuote('Vollständig vermietet – sofortige Einnahmen', 'en'),
    'Vollständig vermietet – sofortige Einnahmen (fully rented; immediate income)',
  );
  assert.equal(glossListingQuote('Kaufpreis 329.000 €', 'de'), 'Kaufpreis 329.000 €');
  assert.equal(glossListingQuote('Aktuelle Nutzung Vermietet', 'de'), 'Aktuelle Nutzung Vermietet');
});

test('sun orientation and glossary terms stay as written', () => {
  assert.equal(glossListingQuote('Südwest', 'en'), 'Südwest');
  assert.equal(glossListingQuote('Süd- und West-Ausrichtung', 'en'), 'Süd- und West-Ausrichtung');
  assert.equal(glossListingQuote('Hausgeld', 'en'), 'Hausgeld');
  assert.equal(glossListingQuote('Bedarfsausweis', 'en'), 'Bedarfsausweis');
  assert.equal(glossListingQuote('Energieausweis', 'en'), 'Energieausweis');
});
