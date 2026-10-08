import assert from 'node:assert/strict';
import test from 'node:test';
import { localizedPropertyCategories, parsePropertyCategories, propertyCategoryRequest, propertyCategoryState } from '../lib/property-categories.ts';

const report = {
  id: 'report-1', title: '3-room flat · Winsviertel', address: 'Danziger Straße, Berlin', location: 'Winsviertel',
  propertyType: 'flat', source: 'Private Exposé.pdf', createdAt: '2026-09-22T10:00:00.000Z',
  facts: {
    price: 620000, area: 82, rooms: '3', year: '2026', floor: '2. OG', energy: 'A', heating: 'Wärmepumpe',
    energySource: 'Umweltwärme', totalCost: 665000, tenancy: 'Not rented', condition: 'New build',
    city: 'Berlin', district: 'Prenzlauer Berg', locationPrecision: 'street', features: ['Balkon', 'Aufzug'],
  },
  score: 8.1,
  scoreBreakdown: { price: 5.3, neighborhood: 8.6, space: 8.8, building: 9.3, energy: 9.8, light: 8, costs: 6, source: 9 },
  summary: 'Private source summary must not be sent.', considerations: [], sunOrientation: 'Süd', aiEnriched: false,
};

test('Jev receives reviewed property state but no source document or generated prose', () => {
  const state = propertyCategoryState(report);
  const serialized = JSON.stringify(state);
  assert.equal(state.property.condition, 'New build');
  assert.equal(state.location.district, 'Prenzlauer Berg');
  assert.equal(state.reviewedScores.energy, 9.8);
  assert.doesNotMatch(serialized, /Private Exposé|Private source summary|report-1/);

  const request = propertyCategoryRequest(report);
  assert.equal(request.model, 'jev-latest');
  assert.deepEqual(Object.keys(request.questions), ['buildingProfile', 'buyerFit', 'locationStyle', 'purchaseSituation']);
  assert.ok(Object.values(request.questions).every(question => question.type === 'choice'));
  assert.ok(Object.values(request.questions).every(question => 'uncertain' in question.criteria));
});

test('Jev category responses are allow-listed and low confidence becomes uncertain', () => {
  const categories = parsePropertyCategories({
    model: 'jev-1.13.0',
    answers: {
      buildingProfile: { type: 'choice', choice: 'new_build', confidence: 0.97, probabilities: {} },
      buyerFit: { type: 'choice', choice: 'family', confidence: 0.81, probabilities: {} },
      locationStyle: { type: 'choice', choice: 'central_urban', confidence: 0.54, probabilities: {} },
      purchaseSituation: { type: 'choice', choice: 'vacant_now', confidence: 0.91, probabilities: {} },
    },
    usage: { input_tokens: 120, output_tokens: 4 },
  });
  assert.equal(categories?.buildingProfile.value, 'new_build');
  assert.equal(categories?.locationStyle.value, 'uncertain');
  assert.deepEqual(localizedPropertyCategories(categories, 'en'), ['New build', 'Family-oriented', 'Not rented']);
  assert.deepEqual(localizedPropertyCategories(categories, 'de'), ['Neubau', 'Familienfreundlich', 'Nicht vermietet']);

  assert.equal(parsePropertyCategories({
    model: 'jev-latest', answers: {
      buildingProfile: { type: 'choice', choice: 'invented_label', confidence: 0.99 },
      buyerFit: { type: 'choice', choice: 'family', confidence: 0.8 },
      locationStyle: { type: 'choice', choice: 'central_urban', confidence: 0.8 },
      purchaseSituation: { type: 'choice', choice: 'vacant_now', confidence: 0.8 },
    },
  })?.buildingProfile.value, 'uncertain');
});

test('invalid Jev response shapes are rejected instead of reaching the report', () => {
  assert.equal(parsePropertyCategories(null), undefined);
  assert.equal(parsePropertyCategories({ model: 'jev-latest', answers: {} }), undefined);
  assert.equal(parsePropertyCategories({ model: 'jev-latest', answers: {
    buildingProfile: { type: 'score', choice: 'new_build', confidence: 1 },
    buyerFit: { type: 'choice', choice: 'family', confidence: 1 },
    locationStyle: { type: 'choice', choice: 'central_urban', confidence: 1 },
    purchaseSituation: { type: 'choice', choice: 'vacant_now', confidence: 1 },
  } }), undefined);
});
