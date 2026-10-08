import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseListing } from '../lib/listing-parser.ts';
import { reportConflicts, reportVerdict, scoreAvailable, scoreBasisLine, scoreExplanation, EXTRACTION_VERSION } from '../lib/report-integrity.ts';
import { berlinPriceCheck } from '../lib/price-check.ts';
import { localizedTenancy } from '../lib/i18n.ts';
import {
  activeScoreWeights,
  calculatePropertyScore,
  formatScore,
  scoreConfidence,
  scoreConfidenceLabel,
  scorePriceFromDelta,
} from '../lib/property-score.ts';

const row = (label, value) => `<div>${label}</div><div>${value}</div>`;

test('property score is deterministic, bounded and driven by property characteristics', () => {
  const strong = parseListing(`
    <title>3-Zimmer-Wohnung in Berlin-Kreuzberg</title><main>
    <p>10997 Berlin (Kreuzberg)</p>
    ${row('Kaufpreis', '390.000 €')}${row('Wohnfläche', '82 m²')}${row('Etage', '3. OG')}
    ${row('Baujahr', '2018')}${row('Zustand', 'Kernsaniert')}${row('Energieeffizienzklasse', 'A')}
    ${row('Heizung', 'Wärmepumpe')}${row('Hausgeld mtl.', '280 €')}${row('Ausrichtung', 'Südwest')}
    ${row('Ausstattung', 'Balkon, Keller, Aufzug')}
    <p>Die U-Bahn ist 4 Gehminuten entfernt, der Park 5 Minuten und der Supermarkt 3 Minuten.</p>
    </main>`, 'https://example.test/strong');
  const weak = parseListing(`
    <title>3-Zimmer-Wohnung in Berlin-Kreuzberg</title><main>
    <p>10997 Berlin (Kreuzberg)</p>
    ${row('Kaufpreis', '920.000 €')}${row('Wohnfläche', '48 m²')}${row('Etage', 'Souterrain')}
    ${row('Baujahr', '1965')}${row('Zustand', 'Sanierungsbedürftig')}${row('Energieeffizienzklasse', 'H')}
    ${row('Heizung', 'Ölheizung')}${row('Hausgeld mtl.', '520 €')}${row('Ausrichtung', 'Nord')}
    <p>Die U-Bahn ist 25 Minuten entfernt.</p>
    </main>`, 'https://example.test/weak');

  const strongScore = calculatePropertyScore(strong);
  const repeated = calculatePropertyScore(strong);
  const weakScore = calculatePropertyScore(weak);

  assert.deepEqual(strongScore, repeated);
  assert.ok(strongScore.total <= 10 && strongScore.total >= 0);
  assert.ok(weakScore.total <= 10 && weakScore.total >= 0);
  assert.ok(strongScore.total > weakScore.total + 2);
  assert.equal(strong.facts.neighborhood?.transitMinutes, 4);
  assert.equal(strong.facts.neighborhood?.dailyNeedsMinutes, 3);
  assert.equal(strong.score, strongScore.total);
});

test('source completeness is only five percent of the total score', () => {
  const complete = parseListing(`
    <title>2-Zimmer-Wohnung in Leipzig-Zentrum</title><main><p>04109 Leipzig (Zentrum)</p>
    ${row('Kaufpreis', '240.000 €')}${row('Wohnfläche', '58 m²')}${row('Etage', '2. OG')}
    ${row('Baujahr', '2008')}${row('Energieeffizienzklasse', 'B')}${row('Heizung', 'Fernwärme')}
    </main>`, 'PDF Exposé');
  const score = calculatePropertyScore(complete);
  assert.ok(score.breakdown.source >= 8);
  assert.ok(score.total < score.breakdown.source);
});

test('new construction with a heat pump scores strongly without inventing an energy class', () => {
  const report = parseListing(`
    <title>2,5-Zimmer-Neubauwohnung in Berlin</title><main>
    ${row('Kaufpreis', '494.000 €')}${row('Wohnfläche', '67,23 m²')}
    ${row('Baujahr', '2027')}${row('Objektzustand', 'Erstbezug')}
    ${row('Heizungsart', 'Wärmepumpe')}${row('Wesentliche Energieträger', 'Umweltwärme')}
    ${row('Energieausweistyp', 'Bedarfsausweis')}${row('Energieeffizienzklasse', '')}
    </main>`, 'PDF Exposé');

  const score = calculatePropertyScore(report);
  assert.equal(report.facts.energy, 'not stated');
  assert.equal(score.breakdown.energy, 9);
  assert.ok(score.breakdown.energy < 10, 'an unstated class must not be treated as verified A+');
});

function shell(overrides = {}) {
  const facts = {
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
    neighborhood: { transitMinutes: 6 },
    ...(overrides.facts || {}),
  };
  return {
    id: 'score',
    title: 'Test',
    address: 'Testweg 1, 04109 Leipzig',
    propertyType: 'flat',
    typeSource: 'structured',
    source: 'test',
    createdAt: '2026-10-08T00:00:00.000Z',
    extractionVersion: EXTRACTION_VERSION,
    score: null,
    summary: '',
    considerations: [],
    sunOrientation: 'South',
    qualityWarnings: [],
    aiEnriched: false,
    redFlags: [],
    ...overrides,
    facts,
  };
}

function berlin(facts) {
  return shell({
    address: 'Buddestraße 7, 13507 Berlin',
    facts: { city: 'Berlin', district: 'Reinickendorf', locationPrecision: 'address', ...facts },
  });
}

test('price bands follow the Berlin delta, including every boundary', () => {
  assert.equal(scorePriceFromDelta(-15), 8.5);
  assert.equal(scorePriceFromDelta(-15.01), 8.5);
  assert.equal(scorePriceFromDelta(-14.99), 7.5);
  assert.equal(scorePriceFromDelta(-5), 7.5);
  assert.equal(scorePriceFromDelta(-4.99), 6);
  assert.equal(scorePriceFromDelta(0), 6);
  assert.equal(scorePriceFromDelta(4.99), 6);
  assert.equal(scorePriceFromDelta(5), 4.5);
  assert.equal(scorePriceFromDelta(14.99), 4.5);
  assert.equal(scorePriceFromDelta(15), 3);
  assert.equal(scorePriceFromDelta(20), 3);
  assert.equal(scorePriceFromDelta(20, 'low'), 4.5);
  assert.equal(scorePriceFromDelta(-11, 'low'), 6.75);
  assert.equal(scorePriceFromDelta(-20, 'low'), 7.25);
  assert.equal(scorePriceFromDelta(0, 'low'), 6);

  const above = calculatePropertyScore(berlin({ price: 450_600, area: 100, totalCost: 450_600 }));
  const below = calculatePropertyScore(berlin({ price: 334_195, area: 100, totalCost: 334_195 }));
  assert.equal(above.breakdown.price, 3);
  assert.equal(below.breakdown.price, 7.5);

  const thin = calculatePropertyScore(berlin({
    price: 202_320,
    area: 50,
    totalCost: 202_320,
    district: 'Marzahn',
  }));
  assert.equal(thin.breakdown.price, 4.5);
});

test('yield and buyer-cost adjustments apply only when price is scored', () => {
  const level = calculatePropertyScore(berlin({ price: 375_500, area: 100, totalCost: 375_500 }));
  const yielded = calculatePropertyScore(berlin({ price: 375_500, area: 100, totalCost: 375_500, advertisedYield: 6 }));
  const costly = calculatePropertyScore(berlin({ price: 375_500, area: 100, totalCost: 428_070 }));
  assert.equal(level.breakdown.price, 6);
  assert.equal(yielded.breakdown.price, 6.4);
  assert.equal(costly.breakdown.price, 5.6);

  const outside = calculatePropertyScore(shell());
  const outsideYield = calculatePropertyScore(shell({ facts: { advertisedYield: 6 } }));
  assert.equal(outside.breakdown.price, null);
  assert.equal(outsideYield.breakdown.price, null);
  assert.equal(outside.total, outsideYield.total);
});

test('a null price is dropped and the remaining weights sum to 1', () => {
  const score = calculatePropertyScore(shell());
  assert.equal(score.breakdown.price, null);
  const weights = activeScoreWeights(score.breakdown);
  const sum = Object.values(weights).reduce((total, weight) => total + weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.equal(weights.price, undefined);
  assert.equal(weights.neighborhood, 0.2 / 0.75);
  const full = activeScoreWeights(calculatePropertyScore(berlin({ price: 375_500, area: 100, totalCost: 375_500 })).breakdown);
  const fullSum = Object.values(full).reduce((total, weight) => total + weight, 0);
  assert.ok(Math.abs(fullSum - 1) < 1e-9);
  assert.equal(full.price, 0.25);
});

test('confidence counts eight facts, with floor and Hausgeld present for houses', () => {
  const omitted = { floor: 'not stated', housegeld: undefined, locationPrecision: 'street' };
  const house = scoreConfidence(shell({
    address: 'Buddestraße 7, 13507 Berlin',
    propertyType: 'house',
    facts: { ...omitted, city: 'Berlin', district: 'Reinickendorf' },
  }));
  const flat = scoreConfidence(shell({ propertyType: 'flat', facts: omitted }));
  assert.equal(house.present, flat.present + 2);
  assert.equal(house.level, 'high');
  assert.equal(flat.present, 6);
  assert.equal(flat.level, 'medium');

  const basement = scoreConfidence(shell({
    facts: { floor: 'Souterrain' },
    redFlags: [{ id: 'basement', severity: 'caution' }],
  }));
  assert.equal(basement.present, scoreConfidence(shell({ facts: { floor: 'Souterrain' } })).present - 1);

  assert.equal(scoreConfidenceLabel({ present: 6, total: 8, level: 'medium' }, 'en'), 'Confidence: Medium · 6 of 8 key facts');
  assert.equal(scoreConfidenceLabel({ present: 6, total: 8, level: 'medium' }, 'de'), 'Verlässlichkeit: Mittel · 6 von 8 Kernangaben');
  assert.equal(formatScore(7.5, 'en'), '7.5');
  assert.equal(formatScore(7.5, 'de'), '7,5');
});

test('four of eight key facts withholds the score in English and German', () => {
  const thin = shell({
    facts: {
      rooms: '3',
      year: '1990',
      floor: 'not stated',
      energy: 'not stated',
      housegeld: undefined,
      locationPrecision: 'neighborhood',
    },
  });
  assert.equal(scoreConfidence(thin).present, 4);
  assert.equal(scoreConfidence(thin).level, 'low');
  assert.equal(scoreAvailable(thin), false);
  assert.equal(scoreExplanation(thin, 'en'), 'Not enough stated facts for a score (4 of 8). Missing: floor, energy class, Hausgeld, street address. Ask the seller for the missing details.');
  assert.equal(scoreExplanation(thin, 'de'), 'Zu wenige Angaben für einen Score (4 von 8). Es fehlen: Etage, Energieklasse, Hausgeld, Straße. Frag beim Verkäufer nach den fehlenden Angaben.');
  assert.equal(reportVerdict(thin, 'en'), scoreExplanation(thin, 'en'));

  const five = shell({ facts: { ...thin.facts, floor: '2. OG' } });
  assert.equal(scoreConfidence(five).present, 5);
  assert.equal(scoreAvailable(five), true);

  const conflicted = shell({
    address: 'Buddestraße 7, 13507 Berlin',
    facts: { city: 'Berlin', district: 'Reinickendorf' },
    qualityWarnings: ['The listing gives conflicting room counts. Confirm the floor plan.'],
  });
  assert.equal(scoreConfidence(conflicted).level, 'high');
  assert.equal(scoreAvailable(conflicted), false);
  assert.equal(scoreExplanation(conflicted, 'en'), 'Score withheld: the listing contradicts itself on the room count.');
  assert.equal(scoreExplanation(conflicted, 'de'), 'Kein Score: Das Angebot widerspricht sich bei der Zimmerzahl.');
});

test('German withhold reasons use the right preposition for each fact', () => {
  const cases = [
    [shell({ qualityWarnings: ['The description says occupants remain.'] }), 'bei der Vermietung'],
    [shell({ qualityWarnings: ['The listing gives conflicting room counts.'] }), 'bei der Zimmerzahl'],
    [shell({ qualityWarnings: ['The energy class and consumption figures conflict.'] }), 'beim Energieausweis'],
    [shell({ facts: { price: 100_000, buyerCosts: 20_000, totalCost: 100_000 } }), 'beim Kaufpreis'],
    [shell({ facts: { condition: 'New build', year: '2001' } }), 'beim Baujahr'],
  ];
  for (const [report, phrase] of cases) {
    const text = scoreExplanation(report, 'de');
    assert.match(text, new RegExp(phrase));
    assert.doesNotMatch(text, /bei dem/);
  }
  const both = shell({ qualityWarnings: ['The energy class and consumption figures conflict.', 'The listing gives conflicting room counts.'] });
  assert.equal(scoreExplanation(both, 'de'), 'Kein Score: Das Angebot widerspricht sich beim Energieausweis und bei der Zimmerzahl.');
});

test('a withheld score replaces the confidence line with the reason', () => {
  const conflicted = shell({
    address: 'Buddestraße 7, 13507 Berlin',
    facts: { city: 'Berlin', district: 'Reinickendorf' },
    qualityWarnings: ['The listing gives conflicting room counts. Confirm the floor plan.'],
  });
  assert.equal(scoreConfidence(conflicted).level, 'high');
  assert.equal(scoreAvailable(conflicted), false);
  assert.equal(scoreBasisLine(conflicted, 'en'), 'Score withheld: the listing contradicts itself on the room count.');
  assert.equal(scoreBasisLine(conflicted, 'de'), 'Kein Score: Das Angebot widerspricht sich bei der Zimmerzahl.');
  assert.doesNotMatch(scoreBasisLine(conflicted, 'en'), /Confidence/);
  assert.doesNotMatch(scoreBasisLine(conflicted, 'de'), /Verlässlichkeit/);
  assert.match(scoreBasisLine(shell(), 'en'), /^Confidence: Medium · 8 of 8 key facts$/);
  assert.match(scoreBasisLine(shell(), 'de'), /^Verlässlichkeit: Mittel · 8 von 8 Kernangaben$/);

  const staleAndConflict = shell({
    extractionVersion: 1,
    qualityWarnings: [
      'This saved report needs a fresh source review. Re-import the listing or upload its Exposé.',
      'The listing gives conflicting room counts. Confirm the floor plan.',
    ],
  });
  const en = scoreBasisLine(staleAndConflict, 'en');
  const de = scoreBasisLine(staleAndConflict, 'de');
  assert.equal(en, 'Score withheld: the listing contradicts itself on the room count. Score withheld: this saved report needs a fresh source review.');
  assert.equal(de, 'Kein Score: Das Angebot widerspricht sich bei der Zimmerzahl. Kein Score: Dieser gespeicherte Bericht braucht eine neue Quellenprüfung.');
  for (const line of [en, de]) {
    const parts = line.split(/(?<=\.)\s+/);
    assert.equal(new Set(parts).size, parts.length);
  }
  assert.ok(en.indexOf('room count') < en.indexOf('fresh source review'));
  assert.ok(de.indexOf('Zimmerzahl') < de.indexOf('Quellenprüfung'));
});

test('missing walking time and sun orientation do not withhold the score', () => {
  const sparse = shell({
    address: 'Buddestraße 7, 13507 Berlin',
    sunOrientation: 'not stated',
    daylight: undefined,
    facts: { city: 'Berlin', district: 'Reinickendorf', neighborhood: { transitMentioned: false, parkMentioned: false, dailyNeedsMentioned: false } },
  });
  assert.equal(scoreConfidence(sparse).level, 'high');
  assert.equal(scoreAvailable(sparse), true);
  assert.equal(reportVerdict(sparse, 'en'), 'Assessment of the listing’s stated facts');
});

test('a separately priced garage is a note, not a conflict, and stays out of the Berlin price', () => {
  const note = 'The listing separately quotes €12,500 for parking. Confirm whether this is additional and required; it is not included in the stated total.';
  const lichterfelde = shell({
    address: 'Lichterfelde, 12209 Berlin',
    sunOrientation: 'not stated',
    qualityWarnings: [note],
    facts: {
      city: 'Berlin',
      district: 'Lichterfelde',
      locationPrecision: 'street',
      price: 442_512,
      area: 80,
      totalCost: 442_512,
      parkingPrice: 12_500,
      neighborhood: {},
    },
  });
  const check = berlinPriceCheck(lichterfelde);
  assert.equal(check.area, 'Steglitz');
  assert.equal(check.deltaPct, 26);
  assert.equal(check.askingPerSqm, 442_512 / 80);
  const score = calculatePropertyScore(lichterfelde);
  assert.equal(score.breakdown.price, 3);
  assert.equal(scoreAvailable(lichterfelde), true);
  assert.ok(['high', 'medium'].includes(scoreConfidence(lichterfelde).level));
  assert.equal(reportConflicts(lichterfelde).some(problem => /separately quotes/i.test(problem)), false);
  assert.match(lichterfelde.qualityWarnings.join(' '), /separately quotes/);
});

test('saved fixtures score price only for the Berlin flat', () => {
  assert.equal(EXTRACTION_VERSION, 2026100805);
  const parsed = (id) => parseListing(
    readFileSync(new URL(`./fixtures/listings/ohne-makler-${id}.html`, import.meta.url), 'utf8'),
    `https://example.test/${id}`,
  );
  const berlinFlat = parsed('502729');
  const erfde = parsed('502750');
  const osnabruck = parsed('502050');
  const berlinScore = calculatePropertyScore(berlinFlat);
  const erfdeScore = calculatePropertyScore(erfde);
  const osnabruckScore = calculatePropertyScore(osnabruck);

  assert.equal(berlinScore.breakdown.price, 3);
  assert.equal(scoreConfidence(berlinFlat).present, 8);
  assert.equal(scoreConfidence(berlinFlat).level, 'high');
  assert.equal(scoreAvailable(berlinFlat), true);
  assert.equal(berlinFlat.scoreTitle, undefined);

  assert.equal(erfdeScore.breakdown.price, null);
  assert.equal(scoreConfidence(erfde).present, 7);
  assert.equal(scoreConfidence(erfde).level, 'medium');
  assert.equal(scoreAvailable(erfde), true);

  assert.equal(osnabruckScore.breakdown.price, null);
  assert.equal(scoreConfidence(osnabruck).present, 8);
  assert.equal(scoreConfidence(osnabruck).level, 'medium');
  assert.equal(osnabruck.facts.tenancyConflict, true);
  assert.equal(reportConflicts(osnabruck).length, 0);
  assert.equal(scoreAvailable(osnabruck), true);
  assert.equal(localizedTenancy(osnabruck.facts.tenancy, osnabruck.facts.availabilityDate, 'en'), 'Rented, free from 1 December 2026');
  assert.equal(localizedTenancy(osnabruck.facts.tenancy, osnabruck.facts.availabilityDate, 'de'), 'Vermietet, frei ab 1. Dezember 2026');
  assert.doesNotMatch(scoreExplanation(osnabruck, 'en'), /contradict/);
  assert.doesNotMatch(scoreExplanation(osnabruck, 'de'), /widerspricht/);
  assert.equal(reportConflicts(osnabruck).some(problem => /separately quotes/i.test(problem)), false);
});
