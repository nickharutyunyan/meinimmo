import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { factEvidence, numberPresent, propertyTextLines } from '../lib/fact-evidence.ts';
import { parseListing } from '../lib/listing-parser.ts';
import { perSqmFormula, provenanceForField, provenanceSentence, registerBuyerCostProvenance } from '../lib/fact-provenance.ts';
import { factSourceCopy } from '../lib/fact-source-copy.ts';

const PRIVATE_CONTACT = /@|\+49|\b0\d{3,4}[ /]?\d{5,}/;
const visible = (value) => value.replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
const fixtureDir = path.resolve(import.meta.dirname, 'fixtures/listings');
const fixture = (name) => readFileSync(path.join(fixtureDir, name), 'utf8');
const parse = (name) => parseListing(fixture(name), `https://example.test/${name}`);

const bochum = `<html><head><title>NEUWERTIGES MEHRFAMILIENHAUS IN BOCHUM-LINDEN</title></head><body><main>
  <div>44879 Bochum (Linden)</div>
  <div>Kaufpreis: 1.180.000 €</div>
  <div>17</div><div>Zimmer</div>
  <div>439,12 m²</div><div>Wohnfläche</div>
  <p>Dieses im Jahr 2022 errichtete Mehrfamilienhaus in Bochum-Linden bietet sechs Wohnungen.</p>
  <div>Objektart</div><div>Haus</div>
  <p>Ansprechpartner Max Muster, Telefon 0172 1234567, max@example.test</p>
</main></html>`;

test('471956 quotes the room count, price, Hausgeld and living area', () => {
  const report = parse('ohne-makler-471956.html');
  assert.match(report.factEvidence.rooms.excerpt, /1-Zimmer|Zimmer 1/);
  assert.match(report.factEvidence.price.excerpt, /172\.000/);
  assert.match(report.factEvidence.housegeld.excerpt, /197/);
  assert.match(report.factEvidence.area.excerpt, /30/);
  assert.equal(visible(provenanceSentence(provenanceForField(report, 'perSqm', '', 'en'), 'en')), 'Calculated: €172,000 ÷ 30 m²');
  assert.equal(visible(provenanceSentence(provenanceForField(report, 'perSqm', '', 'de'), 'de')), 'Berechnet: 172.000 € ÷ 30 m²');
  assert.equal(visible(perSqmFormula(report, 'en')), '€172,000 ÷ 30 m²');
});

test('Berlin, Erfde and Bochum quotes contain the room count and the price', () => {
  const berlin = parse('ohne-makler-471956.html');
  const erfde = parse('ohne-makler-502750.html');
  const multi = parseListing(bochum, 'https://example.test/bochum');
  for (const report of [berlin, erfde, multi]) {
    assert.match(report.factEvidence.rooms.excerpt, new RegExp(String(report.facts.rooms).replace(',', '[,.]')));
    assert.ok(numberPresent(report.factEvidence.price.excerpt, report.facts.price), report.facts.city);
  }
  assert.equal(erfde.facts.city, 'Erfde');
  assert.equal(multi.facts.city, 'Bochum');
  assert.match(multi.factEvidence.rooms.excerpt, /17/);
  assert.match(multi.factEvidence.price.excerpt, /1\.180\.000|1180000/);
});

test('a label line that does not contain the value is not stored', () => {
  const lines = ['Zimmer 30 m²', 'Wohnfläche 80 m²', 'Kaufpreis 90.000 €', '1-Zimmer-Wohnung, Kaufpreis 172.000 €, Wohnfläche ca. 30 m²'];
  const evidence = factEvidence(lines, {
    price: 172000, area: 30, rooms: '1', year: 'not stated', floor: 'not stated', energy: 'not stated', heating: 'not stated', totalCost: 0,
  });
  assert.match(evidence.rooms.excerpt, /1-Zimmer/);
  assert.doesNotMatch(evidence.rooms.excerpt, /^Zimmer 30/);
  assert.match(evidence.price.excerpt, /172\.000/);
  assert.doesNotMatch(evidence.price.excerpt, /90\.000/);
  const missing = factEvidence(['Zimmer 30 m²', 'Kaufpreis auf Anfrage'], {
    price: 172000, area: 30, rooms: '1', year: 'not stated', floor: 'not stated', energy: 'not stated', heating: 'not stated', totalCost: 0,
  });
  assert.equal(missing.rooms, undefined);
  assert.equal(missing.price, undefined);
  const report = { facts: { price: 172000, area: 30, rooms: '1', totalCost: 0 }, factEvidence: {} };
  assert.equal(provenanceSentence(provenanceForField(report, 'rooms', '1', 'en'), 'en'), factSourceCopy.en.noQuote);
  assert.equal(provenanceSentence(provenanceForField(report, 'rooms', '1', 'de'), 'de'), factSourceCopy.de.noQuote);
});

test('fixture quotes contain their value and no phone number or e-mail', () => {
  const files = readdirSync(fixtureDir).filter(name => name.endsWith('.html'));
  assert.ok(files.length >= 9);
  for (const name of files) {
    const report = parse(name);
    const evidence = report.factEvidence || {};
    for (const [field, item] of Object.entries(evidence)) {
      assert.equal(item.kind, 'stated', `${name} ${field}`);
      assert.doesNotMatch(item.excerpt, PRIVATE_CONTACT, `${name} ${field} ${item.excerpt}`);
      if (field === 'price') assert.equal(numberPresent(item.excerpt, report.facts.price), true, name);
      if (field === 'area') assert.equal(numberPresent(item.excerpt, report.facts.area), true, name);
      if (field === 'usableArea') assert.equal(numberPresent(item.excerpt, report.facts.usableArea), true, `${name} ${item.excerpt}`);
      if (field === 'housegeld') assert.equal(numberPresent(item.excerpt, report.facts.housegeld), true, `${name} ${item.excerpt}`);
      if (field === 'rooms') assert.match(item.excerpt, /Zimmer|Zi\.|rooms/i, name);
      if (field === 'year') assert.match(item.excerpt, new RegExp(report.facts.year), name);
    }
  }
});

test('property text drops contact lines before a quote is chosen', () => {
  const lines = propertyTextLines([
    'Kaufpreis 172.000 €',
    'Ansprechpartner Erika Muster',
    'Telefon 030 12345678',
    'mail@example.test',
    'Kontakt',
    'Weitere Telefonnummer 0171 1234567',
  ]);
  assert.deepEqual(lines, ['Kaufpreis 172.000 €']);
  const evidence = factEvidence([
    'Kaufpreis 172.000 €',
    'Telefon 030 12345678 und Kaufpreis 172.000 €',
  ], { price: 172000, area: 0, rooms: 'not stated', year: 'not stated', floor: 'not stated', energy: 'not stated', heating: 'not stated', totalCost: 0 });
  assert.match(evidence.price.excerpt, /172\.000/);
  assert.doesNotMatch(evidence.price.excerpt, PRIVATE_CONTACT);
});

test('buyer-cost provenance is a plug-in and does not invent a tax figure', () => {
  const report = parse('ohne-makler-471956.html');
  registerBuyerCostProvenance(() => [{
    key: 'notary',
    kind: 'estimated',
    detail: { en: 'typically 1.5–2.5%', de: 'typisch 1,5–2,5 %' },
  }]);
  const estimated = provenanceForField(report, 'notary', '', 'en');
  assert.equal(estimated.kind, 'estimated');
  assert.equal(provenanceSentence(estimated, 'en'), 'Estimate: typically 1.5–2.5%');
  assert.equal(provenanceSentence(provenanceForField(report, 'notary', '', 'de'), 'de'), 'Schätzung: typisch 1,5–2,5 %');
  registerBuyerCostProvenance();
  assert.equal(provenanceForField(report, 'notary', '', 'en').kind, 'notStated');
});
