import assert from 'node:assert/strict';
import test from 'node:test';
import { buyerCostBreakdown, stateForReport, transferTaxRate } from '../lib/buyer-costs.ts';
import { copy } from '../lib/i18n.ts';
import { parseListing } from '../lib/listing-parser.ts';
import { stagedPhotoMarks } from '../lib/listing-photos.ts';
import { methodCopy, methodPlainText } from '../lib/method-copy.ts';
import { scoreExplanation } from '../lib/report-integrity.ts';

const CDN = 'https://media.ohne-makler.net';

function listing(facts = {}, extra = {}) {
  return { address: '', location: '', propertyType: 'flat', ...extra, facts: { price: 400_000, ...facts } };
}

function page(body) {
  return `<html><head><title>Wohnung</title></head><body><main>${body}</main></body></html>`;
}

test('Töging am Inn names Bayern and the transfer tax is 3.5%', () => {
  const html = page(`
    <div>84513 Töging am Inn – Bayern</div>
    <div>Kaufpreis</div><div>400.000 €</div>
    <div>Wohnfläche</div><div>80 m²</div>
    <div>Zimmer</div><div>3</div>
  `);
  const report = parseListing(html, 'https://example.test/toeging');
  const resolution = stateForReport(report);
  assert.equal(resolution.state, 'BY');
  assert.equal(transferTaxRate(resolution.state), 3.5);
  const tax = buyerCostBreakdown(report).lines.find((line) => line.key === 'tax');
  assert.equal(tax.low, 14_000);
  assert.equal(tax.high, 14_000);
  assert.notEqual(buyerCostBreakdown(report).basis, 'unknown');
});

test('a stored geocode state is used when the listing names none, and no new lookup is required', () => {
  const unnamed = stateForReport(listing({ city: 'Töging am Inn' }, {
    geocode: { state: 'BY', label: 'Töging am Inn, Landkreis Altötting, Bayern, Deutschland' },
  }));
  assert.equal(unnamed.state, 'BY');
  const fromLabel = stateForReport(listing({ city: 'Atlantis' }, {
    geocode: { label: 'Töging am Inn, Landkreis Altötting, Bayern, Deutschland' },
  }));
  assert.equal(fromLabel.state, 'BY');
  assert.equal(stateForReport(listing({ city: 'Atlantis' })).basis, 'unknown');
});

test('Neu-Ulm, Norderstedt, Falkensee and Teltow take their own state', () => {
  assert.equal(stateForReport(listing({ city: 'Neu-Ulm' })).state, 'BY');
  assert.equal(stateForReport(listing({ city: 'Ulm' })).state, 'BW');
  assert.equal(stateForReport(listing({ city: 'Norderstedt', location: 'bei Hamburg' })).state, 'SH');
  assert.equal(stateForReport(listing({ city: 'Norderstedt bei Hamburg' })).state, 'SH');
  assert.equal(stateForReport(listing({ city: 'Falkensee', location: 'bei Berlin' })).state, 'BB');
  assert.equal(stateForReport(listing({ city: 'Falkensee bei Berlin' })).state, 'BB');
  assert.equal(stateForReport(listing({ city: 'Teltow', location: 'bei Berlin' })).state, 'BB');
  assert.equal(stateForReport(listing({ city: 'Teltow (Berlin-Stadtrand)' })).state, 'BB');
  assert.equal(transferTaxRate('BY'), 3.5);
  assert.equal(transferTaxRate('SH'), 6.5);
  assert.equal(transferTaxRate('BB'), 6.5);
  assert.equal(stateForReport(listing({ city: 'Ulm', postalCode: '80331' })).state, 'BY');
});

test('Munich wording says the check is switched off unless the flag is on', () => {
  const previous = process.env.PRICE_REF_MUENCHEN_ENABLED;
  const scored = {
    extractionVersion: 2026100807,
    country: 'DE',
    address: 'Hauptstraße 1, 10115 Berlin',
    location: 'Mitte',
    propertyType: 'flat',
    typeSource: 'structured',
    source: 'https://example.test/listing',
    facts: {
      price: 400_000, area: 70, rooms: '3', year: '1990', floor: '1', energy: 'C',
      housegeld: 200, city: 'Berlin', street: 'Hauptstraße 1', postalCode: '10115',
    },
    score: 6,
    redFlags: [],
    qualityWarnings: [],
  };
  try {
    delete process.env.PRICE_REF_MUENCHEN_ENABLED;
    const off = `${methodPlainText('en')}\n${methodPlainText('de')}\n${scoreExplanation(scored, 'en')}\n${scoreExplanation(scored, 'de')}`;
    assert.match(off, /the Munich price check is switched off/);
    assert.match(off, /die München-Preisprüfung ist aus/);
    assert.match(off, /Berlin and Cologne by area/);
    assert.match(off, /Berlin und Köln nach Stadtteil/);
    assert.doesNotMatch(off, /Munich citywide only/);
    assert.doesNotMatch(off, /München nur stadtweit/);
    const labels = [...methodCopy('en').sources, ...methodCopy('de').sources].map((source) => source.label).join('\n');
    assert.doesNotMatch(labels, /Halbjahresreport/);

    process.env.PRICE_REF_MUENCHEN_ENABLED = '1';
    const on = `${methodPlainText('en')}\n${methodPlainText('de')}\n${scoreExplanation(scored, 'en')}\n${scoreExplanation(scored, 'de')}`;
    assert.match(on, /Munich citywide only, so only clear outliers count/);
    assert.match(on, /München nur stadtweit, daher zählen nur deutliche Ausreißer/);
    const onLabels = [...methodCopy('en').sources, ...methodCopy('de').sources].map((source) => source.label).join('\n');
    assert.match(onLabels, /Gutachterausschuss München, Halbjahresreport 2026/);
  } finally {
    if (previous === undefined) delete process.env.PRICE_REF_MUENCHEN_ENABLED;
    else process.env.PRICE_REF_MUENCHEN_ENABLED = previous;
  }
});

test('a split Munich district keeps the full name, or loses a dangling hyphen', () => {
  const split = parseListing(page(`
    <div>Engadinerstr. 32</div>
    <div>81475 München-</div>
    <div>Fürstenried-West</div>
    <div>Kaufpreis</div><div>500.000 €</div>
    <div>Wohnfläche</div><div>70 m²</div>
  `), 'https://example.test/muenchen');
  assert.match(split.address, /Fürstenried-West/);
  assert.doesNotMatch(split.address, /München-\s*$/);
  assert.equal(split.facts.city, 'München');

  const dangling = parseListing(page(`
    <div>Engadinerstr. 32</div>
    <div>81475 München-</div>
    <div>Kaufpreis</div><div>500.000 €</div>
    <div>Wohnfläche</div><div>70 m²</div>
  `), 'https://example.test/muenchen-cut');
  assert.doesNotMatch(dangling.address, /München-/);
  assert.match(dangling.address, /München/);
});

test('an empty Zimmer field does not become a 1-room flat from Schlafzimmer', () => {
  const report = parseListing(page(`
    <h1>Wohnung in Köln</h1>
    <div>Zimmer</div>
    <div>Schlafzimmer</div>
    <div>1</div>
    <div>Wohnfläche</div><div>55 m²</div>
    <div>Kaufpreis</div><div>250.000 €</div>
    <div>50667 Köln</div>
  `), 'https://example.test/koeln');
  assert.equal(report.facts.rooms, 'not stated');
  assert.doesNotMatch(report.title, /1-room|1-Zimmer/);
});

test('sample images are badged as samples and are not called photos from the listing', () => {
  const url = `${CDN}/sample.jpg?sig=1&exp=9`;
  const html = `<img alt="Beispielbild" src="${url}">`;
  const marks = stagedPhotoMarks(html, [url]);
  assert.deepEqual(marks.sampleIndexes, [0]);
  assert.equal(marks.listingWideSample, false);

  const wide = stagedPhotoMarks(`<p>Die Bilder sind Beispielbilder.</p><img alt="Wohnzimmer" src="${url}">`, [url]);
  assert.deepEqual(wide.sampleIndexes, []);
  assert.equal(wide.listingWideSample, true);

  for (const phrase of ['Musterbilder', 'Symbolbild']) {
    const tagged = stagedPhotoMarks(`<img alt="${phrase}" src="${url}">`, [url]);
    assert.deepEqual(tagged.sampleIndexes, [0], phrase);
  }
  const clear = stagedPhotoMarks(`<p>keine Beispielbilder</p><img alt="Wohnzimmer" src="${url}">`, [url]);
  assert.equal(clear.listingWideSample, undefined);
  assert.deepEqual(clear.sampleIndexes ?? [], []);

  assert.equal(copy.en.report.photoSample, 'Sample image (per listing)');
  assert.equal(copy.de.report.photoSample, 'Beispielbild (laut Angebot)');
  assert.doesNotMatch(copy.en.report.photosSampleCaption, /Photos from the listing/);
  assert.doesNotMatch(copy.de.report.photosSampleCaption, /Fotos aus dem Angebot/);

  const report = parseListing(page(`
    <p>Die Bilder sind Beispielbilder.</p>
    <img alt="Wohnzimmer" src="${url}">
    <div>Kaufpreis</div><div>250.000 €</div>
    <div>Wohnfläche</div><div>55 m²</div>
    <div>50667 Köln</div>
  `), 'https://example.test/samples');
  assert.equal(report.facts.photoStaging.listingWideSample, true);
  const plain = parseListing(page(`
    <img alt="Wohnzimmer" src="${url}">
    <div>Kaufpreis</div><div>250.000 €</div>
    <div>Wohnfläche</div><div>55 m²</div>
    <div>50667 Köln</div>
  `), 'https://example.test/plain');
  assert.equal(report.score, plain.score);
});
