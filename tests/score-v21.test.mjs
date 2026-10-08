import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseListing, checkedCharacteristic } from '../lib/listing-parser.ts';
import { glossaryPieces } from '../lib/glossary.ts';
import { glanceFacts, localizedWarnings } from '../lib/report-copy.ts';
import { attachCalculatedScore, reportConflicts, scoreAvailable, EXTRACTION_VERSION } from '../lib/report-integrity.ts';
import { mergedBackfillReport } from '../lib/report-backfill.ts';
import { moneyPerSqm } from '../lib/format.ts';
import { localizedValue } from '../lib/i18n.ts';
import { priceCheckLead } from '../lib/price-check-copy.ts';
import { berlinPriceCheck } from '../lib/price-check.ts';
import {
  LEASEHOLD_PENALTY,
  RENTED_SOON_PENALTY,
  calculatePropertyScore,
  conditionPoints,
  energyClassGap,
  lowerEnergyClass,
  priceNotCheckedLine,
  scoreConfidence,
} from '../lib/property-score.ts';

function fixture(id) {
  return parseListing(
    readFileSync(new URL(`./fixtures/listings/ohne-makler-${id}.html`, import.meta.url), 'utf8'),
    `https://www.ohne-makler.net/immobilie/${id}/`,
  );
}

test('S1 condition moves the building score off 5.5', () => {
  assert.equal(conditionPoints('Renovated'), 8);
  assert.equal(conditionPoints('saniert'), 8);
  assert.equal(conditionPoints('renoviert'), 8);
  assert.equal(conditionPoints('Well maintained'), 7);
  assert.equal(conditionPoints('gepflegt'), 7);
  assert.equal(conditionPoints('Needs modernization'), 4);
  assert.equal(conditionPoints('modernisierungsbedürftig'), 4);
  assert.equal(conditionPoints('Needs renovation'), 3);
  assert.equal(conditionPoints('renovierungsbedürftig'), 3);
  assert.equal(conditionPoints('sanierungsbedürftig'), 3);
  assert.equal(conditionPoints('Erstbezug'), 9.3);
  assert.equal(conditionPoints('neuwertig'), 9.3);
  assert.equal(conditionPoints('Erstbezug nach Sanierung'), 8.5);
  assert.equal(conditionPoints('Abbruchreif'), 1);
  assert.equal(conditionPoints('mystery finish'), undefined);

  const tegel = fixture('502729');
  const osnabruck = fixture('502050');
  const needsWork = fixture('496161');
  assert.equal(tegel.facts.condition, 'Well maintained');
  assert.equal(calculatePropertyScore(tegel).breakdown.building, 6.8);
  assert.equal(osnabruck.facts.condition, 'Renovated');
  assert.ok(calculatePropertyScore(osnabruck).breakdown.building > 6);
  assert.equal(needsWork.facts.condition, 'Needs modernization');
  assert.ok(calculatePropertyScore(needsWork).breakdown.building < 5.5);
});

test('S11 leasehold and a sitting tenant move the score and cap confidence', () => {
  const osnabruck = fixture('502050');
  const score = calculatePropertyScore(osnabruck);
  assert.equal(osnabruck.facts.tenancy, 'Rented');
  assert.equal(osnabruck.facts.groundLease, true);
  assert.deepEqual(score.adjustments.map((item) => item.points), [-LEASEHOLD_PENALTY, -RENTED_SOON_PENALTY]);
  assert.ok(score.total < 5.5, `Osnabrück scored ${score.total}`);
  assert.notEqual(Number(score.total.toFixed(1)), 6.4);
  assert.equal(scoreConfidence(osnabruck).level, 'medium');
  assert.equal(scoreAvailable(osnabruck), true);
  assert.match(priceNotCheckedLine(osnabruck, 'en'), /Price not checked: no local reference data yet/);
  assert.equal(priceNotCheckedLine(osnabruck, 'de'), 'Preis nicht geprüft: noch keine lokalen Vergleichsdaten');

  const listed = fixture('501514');
  const withoutNotes = {
    ...listed,
    redFlags: (listed.redFlags || []).filter((flag) => flag.id !== 'listedBuilding'),
    qualityWarnings: (listed.qualityWarnings || []).filter((warning) => !/separately quotes/i.test(warning)),
    facts: { ...listed.facts, parkingPrice: undefined },
  };
  assert.equal(calculatePropertyScore(listed).total, calculatePropertyScore(withoutNotes).total);
  assert.equal(calculatePropertyScore(listed).adjustments.length, 0);
});

test('an energy class one step off the demand is a note and still scores', () => {
  const html = `<html><head><title>NEUWERTIGES MEHRFAMILIENHAUS IN BOCHUM-LINDEN</title></head><body><main>
    <div>44879 Bochum (Linden)</div>
    <div>Kaufpreis: 1.180.000 €</div>
    <div>17</div><div>Zimmer</div>
    <div>439,12 m²</div><div>Wohnfläche</div>
    <p>Dieses im Jahr 2022 errichtete Mehrfamilienhaus.</p>
    <div>Aktuelle Nutzung</div><div>Vermietet</div>
    <div>Objektart</div><div>Haus</div>
    <div>Energieeffizienzklasse</div><div>A</div>
    <div>Endenergiebedarf</div><div>24,00 kWh/(m²a)</div>
  </main></body></html>`;
  const bochum = parseListing(html, 'https://example.test/bochum-linden');
  assert.equal(energyClassGap(bochum), 1);
  assert.equal(lowerEnergyClass('A', 24), 'A');
  assert.equal(calculatePropertyScore(bochum).breakdown.energy, 9.4);
  assert.equal(scoreAvailable(bochum), true);
  assert.notEqual(bochum.score, null);
  assert.equal(scoreConfidence(bochum).level, 'medium');
  assert.equal(reportConflicts(bochum).some((problem) => /energy|class and consumption/i.test(problem)), false);
  assert.match(localizedWarnings(bochum, 'de').join(' '), /eine Stufe/);
  assert.match(localizedWarnings(bochum, 'en').join(' '), /one step off the stated demand/);

  const buckow = fixture('501591');
  assert.equal(energyClassGap(buckow), 1);
  assert.equal(lowerEnergyClass(buckow.facts.energy, buckow.facts.energyDemand), 'F');
  assert.equal(reportConflicts(buckow).some((problem) => /energy|one step|class and consumption/i.test(problem)), false);
  assert.match(localizedWarnings(buckow, 'en').join(' '), /one step off the stated demand/);
});

test('S2 outside Berlin the header says the price was not checked and confidence is Medium', () => {
  const erfde = fixture('502750');
  const berlin = fixture('502729');
  assert.equal(calculatePropertyScore(erfde).breakdown.price, null);
  assert.equal(priceNotCheckedLine(erfde, 'en'), 'Price not checked: no local reference data yet');
  assert.equal(priceNotCheckedLine(erfde, 'de'), 'Preis nicht geprüft: noch keine lokalen Vergleichsdaten');
  assert.equal(scoreConfidence(erfde).level, 'medium');
  assert.equal(scoreAvailable(erfde), true);
  assert.equal(priceNotCheckedLine(berlin, 'en'), '');
  assert.equal(scoreConfidence(berlin).level, 'high');
  const munich = parseListing(`<title>Wohnung München</title><main>
    <p>Sterrhubenweg, 81247 München (Obermenzing)</p>
    <div>Kaufpreis</div><div>1.300.000 €</div>
    <div>Wohnfläche</div><div>81,81 m²</div>
    <div>Zimmer</div><div>3</div>
    <div>Etage</div><div>1. OG</div>
    <div>Baujahr</div><div>2022</div>
    <div>Zustand</div><div>Neuwertig</div>
    <div>Energieeffizienzklasse</div><div>A+</div>
    <div>Endenergiebedarf</div><div>21,5 kWh/(m²a)</div>
    <div>Heizung</div><div>Fußbodenheizung und Rollläden</div>
    <div>Hausgeld</div><div>357 €</div>
    <p>S-Bahn Obermenzing ca. 8 Gehminuten. Die Räume haben viel Tageslicht. Fertigstellung 03/2024.</p>
  </main>`, 'https://www.ohne-makler.net/immobilie/502977/');
  const munichScore = calculatePropertyScore(munich);
  assert.equal(munichScore.breakdown.price, null);
  assert.equal(scoreConfidence(munich).level, 'medium');
  assert.equal(priceNotCheckedLine(munich, 'en'), 'Price not checked: no local reference data yet');
  assert.equal(scoreAvailable(munich), true);
  const berlinScore = calculatePropertyScore(berlin);
  assert.equal((munichScore.breakdown.price === null) !== (berlinScore.breakdown.price === null), true);
});

test('S5 oil heating matches whole terms only', () => {
  const clean = parseListing(`<title>Wohnung</title><main>
    <p>10115 Berlin</p><div>Kaufpreis</div><div>400.000 €</div><div>Wohnfläche</div><div>70 m²</div>
    <div>Energieeffizienzklasse</div><div>A+</div><div>Heizung</div><div>Wärmepumpe</div>
    <p>Rollläden, Solar und Holzfenster.</p>
  </main>`, 'https://example.test/shutters');
  const oiled = parseListing(`<title>Wohnung</title><main>
    <p>10115 Berlin</p><div>Kaufpreis</div><div>400.000 €</div><div>Wohnfläche</div><div>70 m²</div>
    <div>Energieeffizienzklasse</div><div>A+</div><div>Heizung</div><div>Ölheizung</div>
  </main>`, 'https://example.test/oil');
  assert.equal(calculatePropertyScore(clean).breakdown.energy, 10);
  assert.ok(calculatePropertyScore(oiled).breakdown.energy < 10);
});

test('S6 heating ignores shutters and English daylight stays English', () => {
  assert.equal(checkedCharacteristic('Fußbodenheizung und Rollläden', 'heating'), 'Fußbodenheizung');
  assert.equal(checkedCharacteristic('und Rollläden', 'heating'), '');
  assert.equal(localizedValue('viel Tageslicht', 'en'), 'Abundant daylight, as the listing states');
  assert.equal(localizedValue('Fußbodenheizung', 'en'), 'Underfloor heating');
});

test('S4 walking minutes are read from the listing prose', () => {
  const buckow = fixture('501591');
  const tegel = fixture('502729');
  assert.equal(buckow.facts.neighborhood.transitMinutes, 2);
  assert.equal(tegel.facts.neighborhood.transitMinutes, 2);
  const munich = parseListing(`<title>Wohnung</title><main>
    <p>81247 München</p><div>Kaufpreis</div><div>500.000 €</div><div>Wohnfläche</div><div>80 m²</div>
    <p>Die S-Bahn ist ca. 8 Gehminuten entfernt.</p>
  </main>`, 'https://example.test/walk');
  assert.equal(munich.facts.neighborhood.transitMinutes, 8);
});

test('S7 the WEG tooltip does not split a -weg street', () => {
  const pieces = glossaryPieces('The flat is on Sterrhubenweg in Munich.', 'en');
  assert.equal(pieces.some((piece) => piece.explanation), false);
  assert.match(glossaryPieces('Ask the WEG.', 'en').map((piece) => piece.text).join(''), /WEG/);
});

test('S8 price per square metre is whole euros', () => {
  assert.equal(moneyPerSqm(1_300_000 / 81.81, 'en'), '€15,890/m²');
  assert.match(moneyPerSqm(1_300_000 / 81.81, 'de'), /^15\.890\s€\/m²$/);
  const report = parseListing(`<title>Wohnung</title><main>
    <p>81247 München</p><div>Kaufpreis</div><div>1.300.000 €</div><div>Wohnfläche</div><div>81,81 m²</div>
  </main>`, 'https://example.test/sqm');
  const glance = glanceFacts(report, 'en').find(([label]) => /m²|square/i.test(label));
  assert.equal(glance?.[1], '€15,890/m²');
});

test('S10 a saved report with an empty score is filled at read time', () => {
  assert.equal(EXTRACTION_VERSION, 2026100805);
  const parsed = fixture('502750');
  const stored = { ...parsed, score: null, scoreBreakdown: undefined };
  const shown = attachCalculatedScore(stored);
  assert.equal(shown.score, calculatePropertyScore(parsed).total);
  assert.equal(shown.id, parsed.id);
  assert.deepEqual(shown.facts.photoUrls, parsed.facts.photoUrls);
  const previous = { ...parsed, id: 'kept-erfde', score: null, extractionVersion: 2026100803, aiEnriched: true, categories: { schemaVersion: 1 } };
  const merged = mergedBackfillReport(previous, { ...parsed, id: 'fresh', aiEnriched: false }, '2026-10-08T16:00:00.000Z');
  assert.equal(merged.id, 'kept-erfde');
  assert.equal(merged.aiEnriched, true);
  assert.equal(merged.categories.schemaVersion, 1);
  assert.equal(merged.score, calculatePropertyScore(parsed).total);
  assert.equal(merged.extractionVersion, EXTRACTION_VERSION);
});

test('S12 price-area copy does not stack parentheses, and S15 notes a later completion year', () => {
  const berlin = fixture('502729');
  const check = berlinPriceCheck(berlin);
  const lead = priceCheckLead(check, 'en', 'Tegel');
  assert.match(lead, /includes Tegel/);
  assert.doesNotMatch(lead, /\)\s*\(/);
  const munich = parseListing(`<title>Wohnung</title><main>
    <p>81247 München</p><div>Kaufpreis</div><div>500.000 €</div><div>Wohnfläche</div><div>80 m²</div>
    <div>Baujahr</div><div>2022</div>
    <p>Fertigstellung 03/2024.</p>
  </main>`, 'https://example.test/completion');
  assert.match(munich.qualityWarnings.join(' '), /year built is 2022/);
  assert.match(munich.qualityWarnings.join(' '), /completion in 2024/);
  assert.equal(reportConflicts(munich).some((problem) => /completion|year built/i.test(problem)), false);
  assert.match(localizedWarnings(munich, 'de').join(' '), /Fertigstellung 2024/);
});
