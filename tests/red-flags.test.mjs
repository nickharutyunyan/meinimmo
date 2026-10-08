import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { parseListing } from '../lib/listing-parser.ts';
import {
  buyerCommissionPercent,
  commissionAboveUsualBuyerShare,
  detectRedFlags,
  findGroundLease,
  mentionIsNegated,
  redFlagSentence,
  redFlagSummary,
} from '../lib/red-flags.ts';
import { offerQuestionsFor } from '../lib/report-copy.ts';
import { performance } from 'node:perf_hooks';

function report(facts = {}, extra = {}) {
  return {
    propertyType: 'flat',
    title: 'Wohnung zum Kauf',
    createdAt: '2026-10-08T12:00:00.000Z',
    facts: {
      price: 250000,
      area: 70,
      rooms: '2',
      tenancy: 'Not rented',
      condition: 'Well maintained',
      year: '2001',
      floor: '2. OG',
      energy: 'C',
      energyCertificate: 'Verbrauchsausweis',
      housegeld: 250,
      heating: 'Zentralheizung',
      energySource: 'Fernwärme',
      ...facts,
    },
    ...extra,
  };
}

function ids(lines, facts, extra) {
  return detectRedFlags(Array.isArray(lines) ? lines : [lines], report(facts, extra)).map(flag => flag.id);
}

function has(lines, id, facts, extra) {
  return ids(lines, facts, extra).includes(id);
}

const quiet = [
  'Wohnung zum Kauf in Berlin',
  'Kaufpreis 250.000 €',
  'Wohnfläche 70 m²',
  'Zustand gepflegt',
  'Energieausweis Verbrauchsausweis',
  'Energieeffizienzklasse C',
  'Hausgeld 250 €',
  'Die Wohnung ist nicht vermietet und bezugsfrei.',
];

test('a complete ordinary listing raises no red flag', () => {
  assert.deepEqual(detectRedFlags(quiet, report()), []);
  assert.equal(redFlagSummary(report(), 'en'), 'None');
  assert.equal(redFlagSummary(report(), 'de'), 'Keine');
});

test('negation within the same sentence suppresses a keyword', () => {
  assert.equal(mentionIsNegated('Es besteht kein Erbbaurecht.', 16, 11), true);
  assert.equal(mentionIsNegated('Das Grundstück steht im Erbbaurecht.', 26, 11), false);
  assert.equal(mentionIsNegated('Denkmalschutz: nein', 0, 13), true);
});

const rules = [
  {
    id: 'leasehold',
    positive: [
      'Das Grundstück steht im Erbbaurecht. Der Erbbauzins beträgt 1.200 € im Jahr.',
      'Es handelt sich um ein Pachtgrundstück mit einer jährlichen Belastung von 997 €.',
      'This flat is sold on a ground lease.',
      'The building is leasehold and ground rent is payable.',
    ],
    negative: [
      'Es besteht kein Erbbaurecht.',
      'Die Wohnung ist frei von Erbpacht.',
      'Verkauf ohne Erbbaurecht und ohne Erbbauzins.',
      'Ruhige Lage, Balkon und Einbauküche.',
    ],
  },
  {
    id: 'lifeInterest',
    positive: [
      'Im Grundbuch ist ein lebenslanges Wohnrecht für die Mutter eingetragen.',
      'Die Verkäuferin behält sich den Nießbrauch vor.',
      'The seller keeps a right of residence for life.',
      'Verkauft wird gegen Leibrente im Wege der Verrentung.',
    ],
    negative: [
      'Die Wohnung ist frei von Wohnrechten.',
      'Es besteht kein Nießbrauch.',
      'Verkauf ohne Wohnungsrecht und ohne Leibrente.',
      'The listing states no right of residence.',
    ],
  },
  {
    id: 'specialLevy',
    positive: [
      'Eine Sonderumlage in Höhe von 8.000 € wurde beschlossen.',
      'Die Sonderumlage über 12.500 € ist fällig.',
      'Eine Sonderumlage ist geplant und anstehend.',
    ],
    negative: [
      'Sonderumlagen sind nicht geplant.',
      'Eine Sonderumlage ist nicht beschlossen.',
      'Sonderumlagen sind ausgeschlossen.',
      'Die Rücklage ist gut gefüllt.',
    ],
  },
  {
    id: 'maintenanceBacklog',
    positive: [
      'Es besteht ein erheblicher Instandhaltungsstau am Dach.',
      'Der Sanierungsstau betrifft Heizung und Fassade.',
    ],
    negative: [
      'Es besteht kein Instandhaltungsstau.',
      'Das Haus ist ohne Sanierungsstau.',
      'Die Instandhaltung ist regelmäßig erfolgt.',
    ],
  },
  {
    id: 'teileigentum',
    positive: [
      'Diese Einheit ist eine Gewerbeeinheit.',
      'Die angebotene Einheit ist als Teileigentum eingetragen.',
      'Die Räume werden als Wohnung genutzt, eine Genehmigung fehlt.',
    ],
    negative: [
      'Es gilt Wohnungs- und Teileigentum nach der Teilungserklärung.',
      'Das Haus hat zwölf Eigentumswohnungen sowie zwei Gewerbeeinheiten.',
      'Es besteht kein Teileigentum.',
      'Die Wohnung hat einen Balkon.',
    ],
  },
  {
    id: 'forcedSale',
    positive: [
      'Verkauf im Wege der Zwangsversteigerung.',
      'Der Versteigerungstermin steht fest.',
    ],
    negative: [
      'Es handelt sich um keine Zwangsversteigerung.',
      'Normaler freihändiger Verkauf durch den Eigentümer.',
    ],
  },
  {
    id: 'socialHousing',
    positive: [
      'Vermietung nur mit Wohnberechtigungsschein.',
      'Die Wohnung unterliegt einer Belegungsbindung bis 2034.',
    ],
    negative: [
      'Es ist kein WBS erforderlich.',
      'Verkauf ohne Wohnberechtigungsschein.',
      'Frei finanzierte Eigentumswohnung.',
    ],
  },
  {
    id: 'listedBuilding',
    positive: [
      'Das Haus steht unter Denkmalschutz.',
      'Die Fassade ist denkmalgeschützt.',
    ],
    negative: [
      'Denkmalschutz: nein',
      'Das Gebäude steht nicht unter Denkmalschutz.',
      'Kein Baudenkmal.',
    ],
  },
];

for (const rule of rules) {
  test(`${rule.id} flags real mentions and ignores negations`, () => {
    assert.ok(rule.positive.length >= 2, rule.id);
    assert.ok(rule.negative.length >= 2, rule.id);
    for (const line of rule.positive) {
      const found = detectRedFlags([line], report()).find(flag => flag.id === rule.id);
      assert.ok(found, line);
      assert.ok(found.evidence && line.includes(found.evidence.slice(0, 40)), line);
      assert.ok(found.evidence.length <= 220);
    }
    for (const line of rule.negative) assert.equal(has(line, rule.id), false, line);
    const sample = detectRedFlags([rule.positive[0]], report())[0];
    assert.match(redFlagSentence(report(), sample, 'en'), /\w/);
    assert.match(redFlagSentence(report(), sample, 'de'), /\w/);
    assert.doesNotMatch(`${redFlagSentence(report(), sample, 'en')} ${redFlagSentence(report(), sample, 'de')}`, /ImmoScout|Ohne-Makler|ohne-makler/i);
  });
}

test('ground rent on a following line is still recorded', () => {
  const found = findGroundLease([
    '3,5 Zimmer Eigentumswohnung im 6.OG - Erbbaurecht',
    'Derzeit ca. 710 € pro Jahr. Das Erbbaurecht besteht noch bis zum Jahr 2069.',
  ]);
  assert.equal(found.year, 710);
  assert.equal(found.month, undefined);
  assert.match(found.evidence, /Erbbaurecht/);
});

test('a bare Sonderumlage without amount or decision is not a flag', () => {
  assert.equal(has('Im Protokoll kommt das Wort Sonderumlage vor.', 'specialLevy'), false);
});

test('rented listings are flagged and vacant listings are not', () => {
  assert.equal(has('Die Wohnung ist vermietet.', 'rentedOccupied', { tenancy: 'Rented' }), true);
  assert.equal(has('Die Wohnung ist nicht vermietet.', 'rentedOccupied', { tenancy: 'Not rented' }), false);
  assert.equal(has(quiet, 'rentedOccupied'), false);
});

test('buyer commission above 3.57 percent is flagged, the usual half share is not', () => {
  assert.equal(buyerCommissionPercent('3,00 % zzgl. MwSt.'), 3.57);
  assert.equal(commissionAboveUsualBuyerShare(report({ buyerCommission: '3,00 % zzgl. MwSt.' })), false);
  assert.equal(commissionAboveUsualBuyerShare(report({ buyerCommission: '3,57 % inkl. MwSt.' })), false);
  assert.equal(has('Käuferprovision 4,76 % inkl. MwSt.', 'commissionAboveShare', { buyerCommission: '4,76 % inkl. MwSt.' }), true);
  assert.equal(has('Käuferprovision 7,14 %.', 'commissionAboveShare', { buyerCommission: '7,14 %' }), true);
  assert.equal(commissionAboveUsualBuyerShare(report({ buyerCommission: '5,95 %' }, { propertyType: 'land' })), false);
  assert.equal(commissionAboveUsualBuyerShare(report({ buyerCommission: '5,95 %' }, { propertyType: 'house', title: 'Mehrfamilienhaus mit 8 Wohnungen' }), 'Mehrfamilienhaus mit 8 Wohnungen'), false);
  assert.equal(has('External commission 3.00 % plus VAT', 'commissionAboveShare', { buyerCommission: '3.00 % plus VAT' }), false);
});

test('oil and gas heating installed 30 or more years ago is flagged', () => {
  const old = 'Baujahr der Heizung: 1990';
  assert.equal(has(old, 'heatingAge', { energySource: 'Gas', heating: 'Gasheizung' }), true);
  const flagged = detectRedFlags([old], report({ energySource: 'Gas', heating: 'Gasheizung' })).find(flag => flag.id === 'heatingAge');
  assert.match(redFlagSentence({ ...report(), createdAt: '2026-10-08T00:00:00.000Z', facts: { ...report().facts, heatingYear: 1990 } }, flagged, 'en'), /36 years/);
  assert.match(redFlagSentence({ ...report(), createdAt: '2026-10-08T00:00:00.000Z', facts: { ...report().facts, heatingYear: 1990 } }, flagged, 'de'), /36 Jahre/);
  assert.equal(has('Baujahr der Heizung: 2018', 'heatingAge', { energySource: 'Gas' }), false);
  assert.equal(has('Baujahr der Heizung: 1988', 'heatingAge', { energySource: 'Luft-/Wasserwärme', heating: 'Wärmepumpe' }), false);
  assert.equal(has('kein Baujahr der Heizung: 1980', 'heatingAge', { energySource: 'Öl' }), false);
});

test('missing energy data and missing Hausgeld are cautions, with the house exceptions', () => {
  assert.equal(has('Keine weiteren Angaben.', 'noEnergyData', { energy: 'not stated', energyCertificate: undefined }), true);
  assert.equal(has('Energieausweis liegt vor, Klasse C.', 'noEnergyData', { energy: 'not stated', energyCertificate: undefined }), false);
  assert.equal(has(quiet, 'noEnergyData'), false);
  assert.equal(has('Wohnung ohne Kostenangabe.', 'noHausgeld', { housegeld: undefined }), true);
  assert.equal(has('Haus ohne Hausgeld.', 'noHausgeld', { housegeld: undefined }, { propertyType: 'house' }), false);
  assert.equal(has(quiet, 'noHausgeld'), false);
});

test('a basement flat is a caution and an upper floor is not', () => {
  assert.equal(has('Lage: Souterrain', 'basement', { floor: 'Souterrain' }), true);
  assert.equal(has('Lage: 2. OG', 'basement', { floor: '2. OG' }), false);
});

test('high flags are listed before cautions', () => {
  const found = detectRedFlags(
    ['Das Grundstück steht im Erbbaurecht.', 'Keine Energieangaben.'],
    report({ energy: 'not stated', energyCertificate: undefined, housegeld: undefined }),
  );
  assert.equal(found[0].id, 'leasehold');
  assert.equal(found[0].severity, 'high');
  assert.ok(found.some(flag => flag.id === 'noEnergyData' && flag.severity === 'caution'));
  assert.equal(redFlagSummary({ redFlags: found }, 'en'), '3 · Leasehold, No energy data, No Hausgeld');
  assert.equal(redFlagSummary({ redFlags: found }, 'de'), '3 · Erbbaurecht, Keine Energiedaten, Kein Hausgeld');
});

test('the first offer question addresses a high flag in both languages', () => {
  const parsed = report();
  parsed.redFlags = detectRedFlags(['Verkauf im Erbbaurecht mit Erbbauzins.'], parsed);
  assert.match(offerQuestionsFor(parsed, 'en')[0], /remaining leasehold term/);
  assert.match(offerQuestionsFor(parsed, 'de')[0], /Restlaufzeit/);
  assert.equal(offerQuestionsFor(report(), 'en')[0].includes('leasehold'), false);
});

test('a rented house does not get flat Hausgeld, floor or unit wording', () => {
  const parsed = parseListing(`<title>Holzhaus zum Kauf</title><main>
    <div>Objektart</div><div>Haus</div>
    <div>Kaufpreis</div><div>300.000 €</div>
    <div>Wohnfläche</div><div>100 m²</div>
    <div>24803 Erfde</div>
    <p>Die Immobilie ist vermietet.</p>
  </main>`, 'https://example.test/house');
  const text = [parsed.summary, ...(parsed.qualityWarnings || []), ...(parsed.considerations || []), ...offerQuestionsFor(parsed, 'en'), ...offerQuestionsFor(parsed, 'de')].join('\n');
  assert.equal(parsed.propertyType, 'house');
  assert.equal(parsed.facts.tenancy, 'Rented');
  assert.match(parsed.qualityWarnings.join(' '), /The house is rented/);
  assert.doesNotMatch(text, /The unit is rented|Hausgeld|Teilungserklärung|\bWEG\b|exact floor|which floor|\bEtage\b|Aufzug/i);
  const flag = (parsed.redFlags || []).find(item => item.id === 'rentedOccupied');
  assert.match(redFlagSentence(parsed, flag, 'en'), /house can be handed over vacant/);
  assert.doesNotMatch(redFlagSentence(parsed, flag, 'en'), /flat|Teilungserklärung/i);
});

test('a large adversarial listing still parses within the time budget', () => {
  const attack = `${'1.'.repeat(40_000)}${'bis '.repeat(20_000)}Pachtgrundstück ${'€'.repeat(30)} pro Jahr`;
  const html = `<main><h1>Wohnung zum Kauf</h1><p>Kaufpreis 250.000 €</p><p>Wohnfläche 70 m²</p><p>10115 Berlin</p><p>${attack}</p></main>`;
  const started = performance.now();
  const parsed = parseListing(html, 'https://example.test/adversarial');
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 500, `parse took ${elapsed.toFixed(0)} ms`);
  assert.equal(parsed.facts.city, 'Berlin');
  const huge = Array.from({ length: 2_000 }, () => `${'1.'.repeat(20_000)} bis Pacht Sonderumlage`);
  const scanStarted = performance.now();
  detectRedFlags(huge, report());
  const scanElapsed = performance.now() - scanStarted;
  assert.ok(scanElapsed < 200, `red-flag scan took ${scanElapsed.toFixed(0)} ms`);
});

test('archived fixtures do not invent leasehold, residence rights, levies or Teileigentum', () => {
  const files = readdirSync(new URL('./fixtures/listings/', import.meta.url))
    .filter(name => name.endsWith('.html') && !/502050|502729|502750/.test(name));
  const banned = ['leasehold', 'lifeInterest', 'specialLevy', 'teileigentum'];
  for (const file of files) {
    const html = readFileSync(new URL(`./fixtures/listings/${file}`, import.meta.url), 'utf8');
    const parsed = parseListing(html, `https://example.test/${file}`);
    for (const flag of parsed.redFlags || []) {
      assert.equal(banned.includes(flag.id), false, `${file} ${flag.id}`);
      if (flag.evidence) assert.equal(html.includes(flag.evidence), true, `${file} ${flag.evidence}`);
    }
  }
  const shared = parseListing(readFileSync(new URL('./fixtures/listings/ohne-makler-496161.html', import.meta.url), 'utf8'), 'test');
  assert.equal((shared.redFlags || []).some(flag => flag.severity === 'high'), false);
  assert.equal(shared.facts.tenancy, 'Occupancy unclear');
  assert.match(shared.summary, /occupants remain/);
});
