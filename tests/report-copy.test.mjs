import assert from 'node:assert/strict';
import test from 'node:test';
import { copy, localizedValue } from '../lib/i18n.ts';
import { localizedSummary, offerQuestionsFor, questionsAreConcise } from '../lib/report-copy.ts';

const report = {
  id: 'test', title: '', address: 'Address not stated', location: 'Mitte', propertyType: 'flat', source: 'test', createdAt: new Date(0).toISOString(),
  facts: { price: 450000, area: 70, rooms: '3', year: '1990', floor: 'not stated', energy: 'D', heating: 'Gas', totalCost: 490000, city: 'Berlin', district: 'Mitte', housegeld: 320 },
  score: 0, summary: '', considerations: [], sunOrientation: 'not stated', aiEnriched: false,
};

test('fallback offer questions stay short and cover material property-specific gaps', () => {
  const english = offerQuestionsFor(report, 'en');
  const german = offerQuestionsFor(report, 'de');
  assert.equal(questionsAreConcise(english), true);
  assert.equal(questionsAreConcise(german), true);
  assert.match(english.join(' '), /rented or vacant/i);
  assert.match(english.join(' '), /WEG reserve/i);
  assert.match(german.join(' '), /vermietet oder frei/i);
});

test('unknown occupancy is omitted from summary instead of being guessed', () => {
  assert.doesNotMatch(localizedSummary(report, 'de'), /vermietet verkauft|bezugsfrei|selbst genutzt/i);
});

test('all explicit legacy non-rented states use the new rental-status wording', () => {
  for (const value of ['Not rented', 'Available to move in', 'Vacant', 'Owner-occupied']) {
    assert.equal(localizedValue(value, 'en'), 'Not rented');
    assert.equal(localizedValue(value, 'de'), 'Nicht vermietet');
  }
  const notRented = { ...report, facts: { ...report.facts, tenancy: 'Not rented' }, summary: 'The listing states that it is not rented; confirm the handover date and vacant possession in the purchase contract.' };
  assert.match(localizedSummary(notRented, 'en'), /not rented/i);
  assert.match(localizedSummary(notRented, 'de'), /nicht vermietet/i);
  assert.doesNotMatch(localizedSummary(notRented, 'en'), /available to move/i);
});

test('removed reasoning copy is not exposed in either language', () => {
  const visibleCopy = JSON.stringify(copy);
  assert.doesNotMatch(visibleCopy, /Core due diligence|Answers and supporting documents|Built consistently from listing facts/i);
  assert.doesNotMatch(visibleCopy, /Wichtige Grundfragen|Unterlagen und klare Antworten|Einheitlich aus den Angaben/i);
});
