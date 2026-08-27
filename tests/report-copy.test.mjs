import assert from 'node:assert/strict';
import test from 'node:test';
import { copy, localizedFeatures, localizedValue } from '../lib/i18n.ts';
import { isObviousAddressQuestion, localizedSummary, offerQuestionsFor, questionsAreConcise } from '../lib/report-copy.ts';

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

test('exact-address questions are rejected as too obvious for due diligence', () => {
  assert.equal(isObviousAddressQuestion('What is the exact street address of the property?'), true);
  assert.equal(isObviousAddressQuestion('Could you provide the full address?'), true);
  assert.equal(isObviousAddressQuestion('Wie lautet die genaue Straßenadresse der Wohnung?'), true);
  assert.equal(isObviousAddressQuestion('Are there registered building restrictions at this address?'), false);

  const otherwiseValid = [
    'What is the exact street address of the property?',
    'What is the current WEG reserve balance?',
    'Are any major repairs already planned?',
    'Which Hausgeld costs are not recoverable?',
  ];
  assert.equal(questionsAreConcise(otherwiseValid), false);
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

test('saniert is always renovated and remains distinct from neuwertig', () => {
  assert.equal(localizedValue('saniert', 'en'), 'Renovated');
  assert.equal(localizedValue('Saniert', 'de'), 'Renoviert');
  assert.equal(localizedValue('Neuwertig', 'en'), 'Like new');
  assert.equal(localizedValue('Neuwertig', 'de'), 'Neuwertig');

  const legacy = {
    ...report,
    facts: { ...report.facts, condition: 'saniert' },
    summary: 'It is built in 1912, described as new condition, energy class C.',
  };
  assert.match(localizedSummary(legacy, 'en'), /described as renovated/i);
  assert.doesNotMatch(localizedSummary(legacy, 'en'), /new condition/i);
  assert.match(localizedSummary(legacy, 'de'), /Zustand laut Angebot: Renoviert/i);
});

test('removed reasoning copy is not exposed in either language', () => {
  const visibleCopy = JSON.stringify(copy);
  assert.doesNotMatch(visibleCopy, /Core due diligence|Answers and supporting documents|Built consistently from listing facts/i);
  assert.doesNotMatch(visibleCopy, /Wichtige Grundfragen|Unterlagen und klare Antworten|Einheitlich aus den Angaben/i);
});

test('the German financing section uses the product-style calculator label', () => {
  assert.equal(copy.de.finance.label, 'BAUFINANZIERUNGSRECHNER');
});

test('common German listing details are translated and separated on English reports', () => {
  assert.deepEqual(localizedFeatures(['Keller Vollbad Einbauküche Laminat Fliesen'], 'en'), [
    'Basement / cellar',
    'Bathroom with bathtub',
    'Fitted kitchen',
    'Laminate flooring',
    'Tiled flooring',
  ]);
  assert.deepEqual(localizedFeatures(['Balkon', 'Fußbodenheizung', 'barrierefrei'], 'en'), [
    'Balcony',
    'Underfloor heating',
    'Step-free access',
  ]);
});

test('German listing details remain German on German reports', () => {
  assert.deepEqual(localizedFeatures(['Keller Vollbad Einbauküche'], 'de'), ['Keller', 'Vollbad', 'Einbauküche']);
});

test('English reports localize common German floor and heating labels', () => {
  assert.equal(localizedValue('3. OG', 'en'), '3rd floor');
  assert.equal(localizedValue('EG', 'en'), 'Ground floor');
  assert.equal(localizedValue('Etagenheizung', 'en'), 'Individual heating system');
  assert.equal(localizedValue('Zentralheizung', 'en'), 'Central heating');
  assert.equal(localizedValue('3. OG', 'de'), '3. OG');
});

test('explicit buyer commission wording is localized clearly', () => {
  assert.equal(localizedValue('Commission-free', 'en'), "Commission-free / no buyer's commission");
  assert.equal(localizedValue('Commission-free', 'de'), 'Provisionsfrei / keine Käuferprovision');
  assert.equal(localizedValue('3,57 % inkl. MwSt.', 'en'), '3,57 % incl. VAT');
  assert.equal(localizedValue('3,57 % inkl. MwSt.', 'de'), '3,57 % inkl. MwSt.');
});
