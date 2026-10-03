import assert from 'node:assert/strict';
import test from 'node:test';
import { extractTaxonomyEvidence, factualTaxonomyRequest, localizedFactualTaxonomy, parseFactualTaxonomy, supportedTaxonomyValues, taxonomyFields, taxonomyInputHash } from '../lib/property-taxonomy.ts';
import { parseListing, normalizedTenancy } from '../lib/listing-parser.ts';
import { extractAvailabilityDate, formatAvailabilityDate } from '../lib/availability.ts';

const report = parseListing('Wohnung in Berlin\nKaufpreis: 520.000 €\nWohnfläche: 85 m²\nZimmer: 3\nEtage: 4\nObjektzustand: saniert\nHeizungsart: Wärmepumpe\nEnergieeffizienzklasse: A+\nAusrichtung: Süd\nDie Wohnung ist nicht vermietet.\nBezugsfrei ab: ca. 4. Quartal 2028', 'test.pdf');
const response = (choices = {}) => ({ model: 'jev-test', answers: Object.fromEntries(taxonomyFields.map(field => [field, { type: 'choice', choice: choices[field] || 'unknown', confidence: 0.99 }])) });

test('factual categories are supported by scoped evidence, not price, score, summary or demographics', () => {
  const request = factualTaxonomyRequest({ ...report, summary: 'Private summary', score: 10 });
  assert.equal(Object.keys(request.questions).length, 8);
  assert.doesNotMatch(JSON.stringify(request), /Private summary|520000|buyerFit|downsizer/);
  const parsed = parseFactualTaxonomy(response({ floor: 'upper', buildingState: 'renovated', orientation: 'south', occupancy: 'not_rented', availability: 'dated', heating: 'heat_pump', energy: 'a_plus', daylight: 'bright_claimed' }), report, 'hash');
  assert.equal(parsed.fields.buildingState.value, 'renovated');
  assert.equal(parsed.fields.daylight.value, 'unknown'); // South does not prove brightness.
  assert.deepEqual(localizedFactualTaxonomy({ ...report, taxonomy: parsed }, 'en').filter(x => x.startsWith('Condition')), ['Condition: Renovated']);
  assert.ok(localizedFactualTaxonomy({ ...report, taxonomy: parsed }, 'de').includes('Zustand: Renoviert'));
});

test('high-confidence invented or conflicting values stay unknown', () => {
  const bad = parseFactualTaxonomy(response({ floor: 'ground', buildingState: 'new_build', energy: 'constructor' }), report, 'hash');
  // Exact labeled values remain correct even when the model disagrees.
  assert.equal(bad.fields.floor.value, 'upper');
  assert.equal(bad.fields.buildingState.value, 'renovated');
  assert.equal(bad.fields.energy.value, 'a_plus');
  const conflicting = { ...report, taxonomyEvidence: { ...report.taxonomyEvidence, occupancy: ['Die Wohnung ist vermietet.', 'Die Wohnung ist nicht vermietet.'] } };
  assert.equal(parseFactualTaxonomy(response({ occupancy: 'rented' }), conflicting, 'hash').fields.occupancy.status, 'conflict');
  const low = response({ floor: 'upper' }); low.answers.floor.confidence = 0.89;
  assert.equal(parseFactualTaxonomy(low, report, 'hash').fields.floor.method, 'source_rule');
  const invalid = response(); invalid.answers.floor.confidence = NaN;
  assert.equal(parseFactualTaxonomy(invalid, report, 'hash'), undefined);
  assert.equal(parseFactualTaxonomy({ model: 'x', answers: {} }, report, 'hash'), undefined);
});

test('taxonomy guards preserve independent meanings and negation', () => {
  for (const [field, text, expected] of [
    ['floor', 'Etage: 0', ['ground']], ['floor', 'Etage: Hochparterre', ['raised_ground']],
    ['floor', 'Etage: 3 von 5', ['upper']], ['floor', 'Etage: Souterrain', ['basement']],
    ['floor', 'Etage: DG', ['attic']], ['floor', 'Etage: Maisonette', ['multi_level']],
    ['buildingState', 'Condition: First occupancy', ['first_occupancy']],
    ['buildingState', 'Zustand: Erstbezug nach Sanierung', ['renovated']],
    ['buildingState', 'Zustand: neuwertig', ['like_new']],
    ['buildingState', 'Zustand: sanierungsbedürftig', ['needs_work']],
    ['buildingState', 'Zustand: nicht saniert', []],
    ['occupancy', 'Bezugsfrei ab: 2028', []], ['occupancy', 'Vermietet: Nein', ['not_rented']],
    ['daylight', 'Die Wohnung ist nicht hell', ['limited_claimed']],
    ['daylight', 'Die Wohnung ist nicht dunkel', []],
    ['heating', 'Heating type: Central heating system, Underfloor heating', ['mixed']],
    ['orientation', 'Ausrichtung: Südwest', ['multiple']],
    ['energy', 'Energieeffizienzklasse: Baujahr 2027', []],
    ['energy', 'Energieeffizienzklasse: B+', []],
  ]) assert.deepEqual(supportedTaxonomyValues(field, [text]), expected, text);
});

test('agency/related-listing details and empty graphical values are not classification evidence', () => {
  const evidence = extractTaxonomyEvidence(['Etage: 2', 'Energieeffizienzklasse:', 'Baujahr: 2027', 'Weitere Angebote', 'Etage: 5', 'Objektzustand: neuwertig']);
  assert.deepEqual(evidence.floor, ['Etage: 2']);
  assert.deepEqual(evidence.buildingState, []);
  assert.deepEqual(supportedTaxonomyValues('energy', evidence.energy), []);
});

test('changing evidence invalidates category cache; notes and summary do not', async () => {
  const hash = await taxonomyInputHash(report);
  assert.equal(await taxonomyInputHash({ ...report, summary: 'changed' }), hash);
  assert.notEqual(await taxonomyInputHash({ ...report, taxonomyEvidence: { ...report.taxonomyEvidence, floor: ['Etage: 1'] } }), hash);
});

test('preserves approximate quarterly availability and does not invent present vacancy', () => {
  assert.equal(extractAvailabilityDate(['Bezugsfrei ab: ca. 4. Quartal 2028']), '~2028-Q4');
  assert.equal(formatAvailabilityDate('~2028-Q4', 'en'), 'approx. Q4 2028');
  assert.equal(formatAvailabilityDate('~2028-Q4', 'de'), 'ca. 4. Quartal 2028');
  assert.equal(normalizedTenancy('', 'Bezugsfrei ab: ca. 4. Quartal 2028'), undefined);
  assert.equal(normalizedTenancy('', 'Bezugsfrei ab: sofort'), 'Not rented');
});

test('property address block beats nearby neighborhood mentions and retains house number', () => {
  const parsed = parseListing('Perfekt für Paare\nElla-Kay-Straße 24, Prenzlauer Berg, 10405 Berlin\nKaufpreis: 494.000 €\nWohnfläche: 67,23 m²\nZimmer: 2,5\nZwischen Kollwitzkiez und Winsviertel gelegen.\nBezugsfrei ab: ca. 4. Quartal 2028', 'test.pdf');
  assert.equal(parsed.facts.street, 'Ella-Kay-Straße 24');
  assert.equal(parsed.facts.district, 'Prenzlauer Berg');
  assert.equal(parsed.facts.tenancy, undefined);
  assert.equal(parsed.facts.availabilityDate, '~2028-Q4');
  assert.match(parsed.title, /Ella-Kay-Straße 24/);
});
