import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseListing } from '../lib/listing-parser.ts';
import { glanceFacts } from '../lib/report-copy.ts';
import { methodPlainText } from '../lib/method-copy.ts';
import { EXTRACTION_VERSION, scoreAvailable } from '../lib/report-integrity.ts';
import { comparisonPriceNotes, comparisonScoreText } from '../lib/comparison.ts';
import {
  RENTED_FIXED_PENALTY,
  RENTED_LONG_PENALTY,
  RENTED_OCCUPIER_PENALTY,
  RENTED_SOON_PENALTY,
  alignHeatingFacts,
  calculatePropertyScore,
  grossYieldLine,
  isHeatPumpPhrase,
  isInvestmentProperty,
  scoreAdjustmentLine,
  scoreConfidence,
  scorePriceFromDelta,
} from '../lib/property-score.ts';

function shell(facts = {}, extra = {}) {
  return {
    id: 'score-v22',
    title: extra.title || 'Test',
    address: extra.address || 'Testweg 1',
    propertyType: extra.propertyType || 'flat',
    typeSource: 'structured',
    source: 'test',
    createdAt: extra.createdAt || '2026-10-08T00:00:00.000Z',
    extractionVersion: EXTRACTION_VERSION,
    score: null,
    summary: extra.summary || '',
    considerations: [],
    sunOrientation: 'not stated',
    qualityWarnings: [],
    aiEnriched: false,
    redFlags: extra.redFlags || [],
    location: extra.location || 'Test',
    facts: {
      price: 400_000,
      area: 80,
      rooms: '3',
      year: '2001',
      floor: '2. OG',
      energy: 'C',
      heating: 'Fernwärme',
      totalCost: 440_000,
      city: 'Leipzig',
      district: 'Zentrum',
      housegeld: 280,
      locationPrecision: 'address',
      condition: 'Well maintained',
      neighborhood: {},
      ...facts,
    },
  };
}

function listing(body, title = 'Wohnung') {
  return parseListing(`<html><head><title>${title}</title></head><body><main>${body}</main></body></html>`, 'https://example.test/v22');
}

function saved(name) {
  const report = JSON.parse(readFileSync(new URL(`./fixtures/score-reports/${name}.json`, import.meta.url), 'utf8'));
  report.extractionVersion = EXTRACTION_VERSION;
  return report;
}

const SCORES = {
  adlershof: { total: 5.77, confidence: 'high', price: 1.5 },
  bochum: { total: 7.23, confidence: 'medium', price: null },
  chodowiecki: { total: 6.04, confidence: 'high', price: 2.5 },
  cologne: { total: 5.96, confidence: 'medium', price: 3.3 },
  erfde: { total: 7.58, confidence: 'medium', price: null },
  hohenschoenhausen: { total: null, confidence: 'high', price: 7.5 },
  lichterfelde: { total: 6.22, confidence: 'high', price: 2.4 },
  metzer: { total: 6.71, confidence: 'high', price: 3 },
  munich: { total: 8.46, confidence: 'medium', price: null },
  osnabruck: { total: 5.23, confidence: 'medium', price: null },
  pberg: { total: 6.06, confidence: 'medium', price: 4.5 },
  steglitz: { total: 7.28, confidence: 'high', price: 6 },
  tegel: { total: 6.34, confidence: 'high', price: 2.2 },
  wannsee: { total: 5.58, confidence: 'high', price: 2.3 },
};

test('saved reports keep the v2.2 totals, and a shown score is never Low', () => {
  assert.equal(EXTRACTION_VERSION, 2026100807);
  for (const [name, expected] of Object.entries(SCORES)) {
    const report = saved(name);
    const score = calculatePropertyScore(report);
    const confidence = scoreConfidence(report);
    const shown = scoreAvailable(report);
    assert.equal(shown ? score.total : null, expected.total, name);
    assert.equal(confidence.level, expected.confidence, name);
    assert.equal(score.breakdown.price, expected.price, name);
    if (shown) assert.notEqual(confidence.level, 'low', name);
  }
});

test('tenancy scales with the end date, and a near free date does not cap confidence', () => {
  const berlin = { city: 'Berlin', district: 'Mitte' };
  const soon = shell({ ...berlin, tenancy: 'Rented', availabilityDate: '2026-12-01' });
  const boundary = shell({ ...berlin, tenancy: 'Rented', availabilityDate: '2027-04-08' });
  const dated = shell({ ...berlin, tenancy: 'Rented', rentedUntilText: 'Ende März 2028' });
  const open = shell({ ...berlin, tenancy: 'Rented' });
  const nineYears = shell({ ...berlin, tenancy: 'Rented', tenancySinceYear: 2018 });
  const long = shell({ ...berlin, tenancy: 'Rented', tenancySinceYear: 2016 });
  const ban = shell({ ...berlin, tenancy: 'Rented', evictionBan: true });
  const both = shell({ ...berlin, tenancy: 'Rented', tenancySinceYear: 1998, evictionBan: true });
  const datedWithBan = shell({ ...berlin, tenancy: 'Rented', rentedUntilText: 'Ende März 2028', evictionBan: true });

  assert.equal(calculatePropertyScore(soon).adjustments[0].points, -RENTED_SOON_PENALTY);
  assert.equal(scoreAdjustmentLine(calculatePropertyScore(soon).adjustments[0], 'en'), 'Free from 1 December 2026: −0.2.');
  assert.equal(scoreAdjustmentLine(calculatePropertyScore(soon).adjustments[0], 'de'), 'Frei ab 1. Dezember 2026: −0,2.');
  assert.equal(scoreConfidence(soon).level, 'high');
  assert.equal(calculatePropertyScore(boundary).adjustments[0].points, -RENTED_SOON_PENALTY);
  assert.equal(calculatePropertyScore(dated).adjustments[0].points, -RENTED_FIXED_PENALTY);
  assert.equal(scoreAdjustmentLine(calculatePropertyScore(dated).adjustments[0], 'en'), 'Rented until about March 2028: −0.4.');
  assert.equal(scoreAdjustmentLine(calculatePropertyScore(dated).adjustments[0], 'de'), 'Vermietet bis etwa März 2028: −0,4.');
  assert.equal(scoreConfidence(dated).level, 'medium');
  assert.equal(calculatePropertyScore(open).adjustments[0].points, -RENTED_OCCUPIER_PENALTY);
  assert.equal(scoreAdjustmentLine(calculatePropertyScore(open).adjustments[0], 'en'), 'Rented, open-ended: −0.8.');
  assert.equal(scoreAdjustmentLine(calculatePropertyScore(open).adjustments[0], 'de'), 'Vermietet, unbefristet: −0,8.');
  assert.equal(calculatePropertyScore(nineYears).adjustments[0].points, -RENTED_OCCUPIER_PENALTY);
  assert.equal(calculatePropertyScore(long).adjustments[0].points, -RENTED_LONG_PENALTY);
  assert.equal(scoreAdjustmentLine(calculatePropertyScore(long).adjustments[0], 'en'), 'Rented since 2016: −1.0.');
  assert.equal(scoreAdjustmentLine(calculatePropertyScore(ban).adjustments[0], 'en'), 'Sperrfrist still applies: −1.0.');
  assert.equal(scoreAdjustmentLine(calculatePropertyScore(ban).adjustments[0], 'de'), 'Die Sperrfrist gilt noch: −1,0.');
  assert.equal(scoreAdjustmentLine(calculatePropertyScore(both).adjustments[0], 'en'), 'Rented since 1998; the Sperrfrist still applies: −1.0.');
  assert.equal(scoreAdjustmentLine(calculatePropertyScore(both).adjustments[0], 'de'), 'Vermietet seit 1998; die Sperrfrist gilt noch: −1,0.');
  assert.equal(calculatePropertyScore(datedWithBan).adjustments[0].points, -RENTED_FIXED_PENALTY);

  const osnabruck = saved('osnabruck');
  const line = scoreAdjustmentLine(calculatePropertyScore(osnabruck).adjustments[1], 'en');
  assert.equal(line, 'Free from 1 December 2026: −0.2.');
  assert.equal(scoreConfidence(osnabruck).level, 'medium');
});

test('an investment property has no move-in deduction and shows the gross yield', () => {
  const bochum = saved('bochum');
  assert.equal(isInvestmentProperty(bochum), false);
  assert.equal(calculatePropertyScore(bochum).adjustments[0].points, -RENTED_OCCUPIER_PENALTY);
  assert.equal(scoreAvailable(bochum), true);
  assert.equal(scoreConfidence(bochum).level, 'medium');

  const rentedHouse = shell({ tenancy: 'Rented', rooms: '4', area: 140, grossYield: 4.2 }, { propertyType: 'house', title: 'Einfamilienhaus als Kapitalanlage' });
  assert.equal(isInvestmentProperty(rentedHouse), false);
  assert.equal(calculatePropertyScore(rentedHouse).adjustments[0].points, -RENTED_OCCUPIER_PENALTY);
  assert.equal(grossYieldLine(rentedHouse, 'en'), 'Gross yield 4.20%.');

  const flatInBlock = shell({ tenancy: 'Rented', grossYield: 4.2, investmentUse: true }, { title: 'Wohnung im Mehrfamilienhaus' });
  assert.equal(isInvestmentProperty(flatInBlock), false);
  assert.equal(calculatePropertyScore(flatInBlock).adjustments[0].points, -RENTED_OCCUPIER_PENALTY);
  assert.equal(grossYieldLine(flatInBlock, 'en'), 'Gross yield 4.20%.');

  const block = shell({
    tenancy: 'Rented', grossYield: 3.18, investmentUse: true, rooms: '17', area: 439, city: 'Berlin', district: 'Mitte',
  }, { propertyType: 'house', title: 'Mehrfamilienhaus' });
  assert.equal(isInvestmentProperty(block), true);
  assert.equal(calculatePropertyScore(block).adjustments.length, 0);
  assert.equal(scoreConfidence(block).level, 'medium');
  assert.equal(grossYieldLine(block, 'en'), 'Gross yield 3.18%.');
  assert.equal(grossYieldLine(block, 'de').replace(/\u00a0/g, ' '), 'Bruttorendite 3,18 %.');
  assert.doesNotMatch(comparisonScoreText(block, 'en'), /Rented, open-ended/);
  assert.doesNotMatch(`${grossYieldLine(block, 'en')} ${grossYieldLine(block, 'de')}`, /move in|einziehen|buyer who wants/i);
});

test('one energy class off demand cannot push a shown score below Medium', () => {
  const cologne = saved('cologne');
  assert.equal(scoreAvailable(cologne), true);
  assert.equal(scoreConfidence(cologne).present, 7);
  assert.equal(scoreConfidence(cologne).level, 'medium');
  assert.equal(calculatePropertyScore(cologne).breakdown.energy, 8.4);

  const gap = shell({
    energy: 'A',
    energyDemand: 50,
    city: 'Köln',
    district: 'Ehrenfeld',
    locationPrecision: 'neighborhood',
  });
  assert.equal(scoreConfidence(gap).present, 7);
  assert.equal(scoreConfidence(gap).level, 'medium');
  assert.equal(scoreAvailable(gap), true);

  const thin = shell({
    rooms: 'not stated',
    year: 'not stated',
    floor: 'not stated',
    energy: 'not stated',
    energyDemand: undefined,
    housegeld: undefined,
    locationPrecision: 'city',
  });
  assert.equal(scoreConfidence(thin).level, 'low');
  assert.equal(scoreAvailable(thin), false);
});

test('price keeps the old band interiors and keeps falling from +15% to +50%', () => {
  assert.equal(scorePriceFromDelta(0), 6);
  assert.equal(scorePriceFromDelta(-10), 7.5);
  assert.equal(scorePriceFromDelta(10), 4.5);
  assert.equal(scorePriceFromDelta(15), 3);
  assert.equal(scorePriceFromDelta(41), 1.51);
  assert.ok(scorePriceFromDelta(41) < scorePriceFromDelta(15) - 1);
  const adlershof = calculatePropertyScore(saved('adlershof'));
  const metzer = calculatePropertyScore(saved('metzer'));
  assert.equal(adlershof.breakdown.price, 1.5);
  assert.equal(metzer.breakdown.price, 3);
  assert.ok(adlershof.breakdown.price < metzer.breakdown.price);
});

test('living area per room and absolute size rise together', () => {
  const space = (area, rooms) => calculatePropertyScore(shell({
    area,
    rooms,
    city: 'Berlin',
    district: 'Mitte',
  })).breakdown.space;
  const studio = space(30, '1');
  const largerStudio = space(42, '1');
  const twoRoom = space(136, '2');
  assert.equal(studio, 6.9);
  assert.equal(largerStudio, 7.8);
  assert.equal(twoRoom, 9.3);
  assert.ok(studio < largerStudio);
  assert.ok(studio < twoRoom);
});

test('a lettered ss street is the address, and orientation, rent, heat pumps and distances are read', () => {
  const addressed = listing('<p>Vogelsanger Strasse 10 a, 50825 Köln</p><div>Kaufpreis</div><div>250.000 €</div><div>Wohnfläche</div><div>60 m²</div>', 'Wohnung Köln');
  assert.equal(addressed.facts.street, 'Vogelsanger Straße 10 a');
  assert.equal(addressed.facts.locationPrecision, 'address');
  assert.match(addressed.address, /Vogelsanger Straße 10 a/);
  assert.doesNotMatch(addressed.qualityWarnings.join(' '), /not disclosed/i);

  const streetOnly = listing('<p>Vogelsanger Strasse, 50825 Köln</p><div>Kaufpreis</div><div>250.000 €</div><div>Wohnfläche</div><div>60 m²</div>', 'Wohnung Köln');
  assert.equal(streetOnly.facts.street, 'Vogelsanger Straße');
  assert.equal(streetOnly.facts.locationPrecision, 'street');
  assert.match(streetOnly.address, /^Vogelsanger Straße,/);
  assert.doesNotMatch(streetOnly.facts.street, /\d/);
  assert.doesNotMatch(streetOnly.qualityWarnings.join(' '), /not disclosed/i);

  for (const [phrase, pattern] of [
    ['Südwest Balkon', /Südwest/],
    ['Süd- und West-Ausrichtung', /Süd- und West-Ausrichtung/],
    ['Westbalkon', /West/],
    ['nach Süden ausgerichtet', /Süden/],
  ]) {
    const report = listing(`<p>10439 Berlin</p><div>Kaufpreis</div><div>400.000 €</div><div>Wohnfläche</div><div>70 m²</div><p>${phrase}</p>`);
    assert.match(report.sunOrientation, pattern, phrase);
  }

  const monthly = listing('<p>10439 Berlin (Prenzlauer Berg)</p><div>Kaufpreis</div><div>749.000 €</div><div>Wohnfläche</div><div>111 m²</div><div>Nettokaltmiete</div><div>743,31 €</div><p>Die Wohnung ist vermietet.</p>');
  assert.equal(monthly.facts.grossYield, 1.19);
  assert.equal(monthly.facts.tenancy, 'Rented');
  assert.equal(grossYieldLine(monthly, 'en'), 'Gross yield 1.19%.');
  assert.equal(grossYieldLine(monthly, 'de').replace(/\u00a0/g, ' '), 'Bruttorendite 1,19 %.');
  assert.equal(glanceFacts(monthly, 'en').find(([label]) => label === 'Gross yield')[1], '1.19%');
  assert.doesNotMatch(monthly.qualityWarnings.join(' '), /no verified yield/i);

  const annual = listing('<p>10439 Berlin</p><div>Kaufpreis</div><div>749.000 €</div><div>Wohnfläche</div><div>111 m²</div><div>Nettokaltmiete</div><div>100,00 €</div><div>Jahresnettokaltmiete</div><div>8.919,72 €</div><p>Die Wohnung ist vermietet.</p>');
  assert.equal(annual.facts.grossYield, 1.19);

  for (const phrase of ['Luft-/Wasserwärme', 'Luft-Wasser-Wärmepumpe', 'L/W-WP']) {
    assert.equal(isHeatPumpPhrase(phrase), true, phrase);
    const report = listing(`<p>80331 München</p><div>Kaufpreis</div><div>500.000 €</div><div>Wohnfläche</div><div>80 m²</div><div>Heizung</div><div>${phrase}</div>`);
    assert.equal(report.facts.heating, phrase);
    assert.equal(calculatePropertyScore(report).breakdown.energy, 7);
  }
  const fromSource = listing('<p>80331 München</p><div>Kaufpreis</div><div>1.300.000 €</div><div>Wohnfläche</div><div>82 m²</div><div>Wesentliche Energieträger</div><div>Luft-/Wasserwärme</div><div>Energieeffizienzklasse</div><div>A+</div>');
  assert.equal(fromSource.facts.heating, 'Luft-/Wasserwärme');
  assert.deepEqual(alignHeatingFacts({ heating: 'not stated', energySource: 'Luft-/Wasserwärme' }), {
    heating: 'Luft-/Wasserwärme',
    energySource: 'Luft-/Wasserwärme',
  });
  const munich = saved('munich');
  assert.equal(munich.facts.heating, 'not stated');
  assert.equal(calculatePropertyScore(munich).breakdown.source, 10);

  const transit = (line) => listing(`<p>10439 Berlin</p><div>Kaufpreis</div><div>400.000 €</div><div>Wohnfläche</div><div>70 m²</div><p>${line}</p>`).facts.neighborhood.transitMinutes;
  assert.equal(transit('ÖPNV 250m'), 3);
  assert.equal(transit('Bus 300 m'), 4);
  assert.equal(transit('S-Bahn 1,2 km'), 15);
  assert.equal(transit('Die U-Bahn ist 5 Gehminuten entfernt.'), 5);
});

test('comparison cells repeat the report header, and each unchecked price gets its own note', () => {
  const munich = saved('munich');
  const erfde = saved('erfde');
  const tegel = saved('tegel');
  const osnabruck = saved('osnabruck');

  for (const locale of ['en', 'de']) {
    const munichText = comparisonScoreText(munich, locale);
    const erfdeText = comparisonScoreText(erfde, locale);
    assert.match(munichText, locale === 'de' ? /Mittel/ : /Medium/);
    assert.match(erfdeText, locale === 'de' ? /Mittel/ : /Medium/);
    assert.match(munichText, locale === 'de' ? /Preis nicht geprüft/ : /Price not checked/);
    assert.match(erfdeText, locale === 'de' ? /Preis nicht geprüft/ : /Price not checked/);
    assert.deepEqual(comparisonPriceNotes(munich, erfde, locale), [
      locale === 'de' ? 'OPTION A: Preis nicht geprüft: noch keine lokalen Vergleichsdaten' : 'OPTION A: Price not checked: no local reference data yet',
      locale === 'de' ? 'OPTION B: Preis nicht geprüft: noch keine lokalen Vergleichsdaten' : 'OPTION B: Price not checked: no local reference data yet',
    ]);
  }

  const mixed = comparisonPriceNotes(tegel, munich, 'en');
  assert.deepEqual(mixed, ['OPTION B: Price not checked: no local reference data yet']);
  assert.doesNotMatch(comparisonScoreText(tegel, 'en'), /Price not checked/);
  assert.match(comparisonScoreText(munich, 'en'), /Price not checked/);
  assert.match(comparisonScoreText(tegel, 'en'), /High/);

  const deducted = comparisonScoreText(osnabruck, 'en');
  assert.match(deducted, /Leasehold or leased land: −1\.5\./);
  assert.match(deducted, /Free from 1 December 2026: −0\.2\./);
  assert.match(comparisonScoreText(osnabruck, 'de'), /Frei ab 1\. Dezember 2026: −0,2\./);
  assert.match(deducted, /Medium/);
});

test('the method explains the scale and that Low withholds the score', () => {
  const en = methodPlainText('en');
  const de = methodPlainText('de');
  assert.match(en, /Free within six months subtracts 0\.2/);
  assert.match(en, /0\.4/);
  assert.match(en, /0\.8/);
  assert.match(en, /1\.0/);
  assert.match(en, /Low means four or fewer key facts, and the score is withheld/);
  assert.match(en, /15% over about 3 and 50% over about 1/);
  assert.match(en, /Kapitalanlage/);
  assert.doesNotMatch(en, /\bhome\b/i);
  assert.doesNotMatch(en, /for a buyer who wants to move in/);
  assert.match(de, /0,2/);
  assert.match(de, /Niedrig heißt vier oder weniger Kernangaben, und dann gibt es keinen Score/);
  assert.match(de, /Zwei oder mehr Stufen verhindern ihn weiterhin/);
  assert.doesNotMatch(de, /verhindern ihn weiter(?!hin)/);
  assert.doesNotMatch(de, /\bWohnung\b/);
  assert.doesNotMatch(`${en}\n${de}`, /ImmoScout|Ohne-Makler|ohne-makler/i);
});
