import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import prices from '../data/berlin-etw-prices.json' with { type: 'json' };
import directory from '../data/berlin-ortsteile.json' with { type: 'json' };
import { parseListing } from '../lib/listing-parser.ts';
import { askingPriceIsComparable, berlinPriceAvailability, berlinPriceCheck, matchOfficialPriceArea } from '../lib/price-check.ts';
import { priceCheckLead, priceCheckPresentation } from '../lib/price-check-copy.ts';
import { provenanceForField, provenanceSentence } from '../lib/fact-provenance.ts';

const pdf2025 = {
  Mitte: [779, 3501, 15914, 9374],
  Tiergarten: [301, 3097, 8477, 5486],
  Wedding: [307, 2546, 6078, 4197],
  Friedrichshain: [832, 3844, 8060, 5887],
  Kreuzberg: [458, 3160, 8212, 5647],
  'Prenzlauer Berg': [663, 3911, 8656, 6300],
  Weißensee: [162, 3139, 7629, 5563],
  Pankow: [540, 2751, 7673, 5194],
  Charlottenburg: [936, 3019, 7583, 5201],
  Wilmersdorf: [761, 3251, 8009, 5547],
  Grunewald: [61, 4005, 8560, 6111],
  Schmargendorf: [106, 3166, 7558, 5183],
  Spandau: [456, 1981, 4579, 3235],
  Steglitz: [712, 2435, 6428, 4390],
  Zehlendorf: [271, 2833, 6892, 4768],
  Dahlem: [57, 4400, 8340, 6427],
  Schöneberg: [677, 3253, 7566, 5421],
  Tempelhof: [495, 2474, 5707, 4011],
  Neukölln: [500, 2200, 6776, 4425],
  Treptow: [320, 2220, 6184, 4066],
  Köpenick: [711, 2158, 11841, 7134],
  Marzahn: [45, 2336, 4500, 3372],
  Hellersdorf: [56, 1735, 5354, 3356],
  Lichtenberg: [311, 2985, 6925, 4990],
  Rummelsburg: [41, 2948, 7789, 5538],
  Hohenschönhausen: [104, 2227, 5059, 3494],
  Reinickendorf: [539, 2262, 5528, 3755],
};

function report(overrides = {}) {
  const facts = {
    price: 450_000,
    area: 70,
    rooms: '2',
    year: '1990',
    floor: '2',
    energy: '',
    heating: '',
    totalCost: 0,
    city: 'Berlin',
    district: 'Prenzlauer Berg',
    ...overrides.facts,
  };
  return {
    id: 'price-check',
    title: '',
    address: overrides.address || 'Address not stated',
    location: overrides.location ?? facts.district ?? facts.city,
    propertyType: overrides.propertyType || 'flat',
    source: 'test',
    createdAt: '2026-10-08T00:00:00.000Z',
    country: overrides.country,
    facts,
    score: 0,
    summary: '',
    considerations: [],
    sunOrientation: '',
    aiEnriched: false,
  };
}

test('the official 2025 table is complete and every range is sane', () => {
  assert.equal(prices.year, 2025);
  assert.equal(prices.license, 'dl-de/zero-2-0');
  assert.equal(prices.url, 'https://www.berlin.de/gutachterausschuss/_assets/amarktinformationen/amarktanalyse/04-03-010-2500.pdf');
  assert.equal(prices.newBuildFirstSaleMean, 8108);
  assert.deepEqual(Object.keys(prices.areas).sort(), Object.keys(pdf2025).sort());
  for (const [area, [n, low, high, mean]] of Object.entries(pdf2025)) {
    const row = prices.areas[area];
    assert.deepEqual([row.n, row.low, row.high, row.mean], [n, low, high, mean], area);
    assert.ok(Number.isInteger(row.n) && row.n > 0, area);
    assert.ok(row.low > 0 && row.low < row.mean && row.mean < row.high, area);
  }
  assert.equal(prices.areas.Köpenick.meanExcludingMicroApartments, 5321);
  assert.ok(prices.areas.Köpenick.meanExcludingMicroApartments < prices.areas.Köpenick.mean);
  const lowCount = Object.entries(prices.areas).filter(([, row]) => row.n < 50).map(([area]) => area).sort();
  assert.deepEqual(lowCount, ['Marzahn', 'Rummelsburg']);
});

test('every current Ortsteil maps to exactly one official row', () => {
  const rows = new Set(Object.keys(prices.areas));
  assert.equal(Object.keys(directory.ortsteile).length, 97);
  for (const [ortsteil, row] of Object.entries(directory.ortsteile)) {
    assert.equal(matchOfficialPriceArea(ortsteil), row, ortsteil);
    assert.ok(rows.has(row), ortsteil);
    assert.equal(matchOfficialPriceArea(`Berlin-${ortsteil}`), row, ortsteil);
    assert.equal(matchOfficialPriceArea(`${ortsteil}-Kiez`), row, ortsteil);
  }
  assert.equal(matchOfficialPriceArea('Adlershof'), 'Treptow');
  assert.equal(matchOfficialPriceArea('Schlachtensee'), 'Zehlendorf');
  assert.equal(matchOfficialPriceArea('Prenzlberg'), 'Prenzlauer Berg');
  assert.equal(matchOfficialPriceArea('Prenzlauer Berg'), 'Prenzlauer Berg');
  assert.equal(matchOfficialPriceArea('Kreuzberg 36'), 'Kreuzberg');
  assert.equal(matchOfficialPriceArea('Kreuzberg 61'), 'Kreuzberg');
  assert.equal(matchOfficialPriceArea('Weissensee'), 'Weißensee');
  assert.equal(matchOfficialPriceArea('Berlin-Steglitz OT Lichterfelde'), 'Steglitz');
  assert.equal(matchOfficialPriceArea('Tegel'), 'Reinickendorf');
});

test('ambiguous, unknown and non-local names match nothing', () => {
  for (const name of [
    'Friedrichshain-Kreuzberg',
    'Charlottenburg-Wilmersdorf',
    'Treptow-Köpenick',
    'Marzahn-Hellersdorf',
    'Steglitz-Zehlendorf',
    'Tempelhof-Schöneberg',
    'Schöneweide',
    'Winsviertel',
    'Hamburg',
    'Eimsbüttel',
    '',
  ]) assert.equal(matchOfficialPriceArea(name), undefined, name);
  assert.equal(matchOfficialPriceArea('Mitte', '13355'), undefined);
  assert.equal(matchOfficialPriceArea('Mitte', '10557'), undefined);
  assert.equal(matchOfficialPriceArea('Mitte', '10115'), 'Mitte');
  assert.equal(matchOfficialPriceArea('Mitte'), 'Mitte');
  assert.equal(matchOfficialPriceArea('Wedding', '13355'), 'Wedding');
  assert.equal(matchOfficialPriceArea('10115'), undefined);
});

test('Prenzlauer Berg examples use the rounded percent and the published range', () => {
  const same = berlinPriceCheck(report());
  assert.equal(same.area, 'Prenzlauer Berg');
  assert.equal(same.year, 2025);
  assert.equal(Math.round(same.askingPerSqm), 6429);
  assert.equal(same.deltaPct, 2);
  assert.equal(same.position, 'within');
  assert.equal(same.confidence, 'normal');
  assert.equal(same.mean, 6300);
  assert.equal(same.newBuildCaveat, false);
  const en = priceCheckPresentation(report(), 'en');
  const de = priceCheckPresentation(report(), 'de');
  assert.equal(en.kind, 'matched');
  assert.equal(en.glanceLabel, 'vs. area average');
  assert.equal(en.glanceValue, '+2%');
  assert.equal(en.lead, 'Asking €6,429/m² is about the same as the 2025 average sales price for flats in Prenzlauer Berg: €6,300/m², 663 sales; typical range €3,911–€8,656/m².');
  assert.equal(en.positionNote, '');
  assert.equal(de.glanceLabel, 'ggü. Gebietsmittel');
  assert.equal(de.glanceValue, '+2 %');
  assert.equal(de.lead, 'Der Angebotspreis von 6.429 €/m² liegt etwa auf dem Niveau des durchschnittlichen Kaufpreises 2025 für Eigentumswohnungen in Prenzlauer Berg: 6.300 €/m², 663 Verkäufe; übliche Spanne 3.911–8.656 €/m².');

  const within = berlinPriceCheck(report({ facts: { price: 500_000, area: 60 } }));
  assert.equal(Math.round(within.askingPerSqm), 8333);
  assert.equal(within.deltaPct, 32);
  assert.equal(within.position, 'within');
  assert.equal(within.askingPerSqm <= within.high, true);
  const withinEn = priceCheckPresentation(report({ facts: { price: 500_000, area: 60 } }), 'en');
  assert.match(withinEn.lead, /Asking €8,333\/m² is 32% above/);
  assert.equal(withinEn.positionNote, '');
  assert.equal(withinEn.glanceValue, '+32%');
  assert.equal(priceCheckPresentation(report({ facts: { price: 500_000, area: 60 } }), 'de').glanceValue, '+32 %');
});

test('position follows the published range, including the boundaries', () => {
  const atLow = berlinPriceCheck(report({ facts: { price: 391_100, area: 100 } }));
  const underLow = berlinPriceCheck(report({ facts: { price: 391_000, area: 100 } }));
  const atHigh = berlinPriceCheck(report({ facts: { price: 865_600, area: 100 } }));
  const overHigh = berlinPriceCheck(report({ facts: { price: 865_700, area: 100 } }));
  assert.equal(atLow.askingPerSqm, 3911);
  assert.equal(atLow.position, 'within');
  assert.equal(underLow.position, 'below');
  assert.equal(atHigh.askingPerSqm, 8656);
  assert.equal(atHigh.position, 'within');
  assert.equal(overHigh.position, 'above');
  const below = priceCheckPresentation(report({ facts: { price: 200_000, area: 100 } }), 'en');
  const above = priceCheckPresentation(report({ facts: { price: 500_000, area: 50 } }), 'en');
  assert.equal(below.positionNote, 'That is below the typical range; check why (condition, tenancy, leasehold).');
  assert.equal(above.positionNote, 'That is above the typical range.');
  assert.match(below.lead, /below the 2025 average/);
  const belowDe = priceCheckPresentation(report({ facts: { price: 200_000, area: 100 } }), 'de');
  assert.equal(belowDe.positionNote, 'Das liegt unter der üblichen Spanne; prüfe, warum (Zustand, Vermietung, Erbbaurecht).');
  assert.match(belowDe.lead, /unter dem durchschnittlichen Kaufpreis/);
});

test('Köpenick drops micro-apartments only above 30 m², and thin samples stay low confidence', () => {
  const micro = berlinPriceCheck(report({ facts: { district: 'Köpenick', price: 210_000, area: 30 } }));
  const larger = berlinPriceCheck(report({ facts: { district: 'Köpenick', price: 240_000, area: 40 } }));
  assert.equal(micro.mean, 7134);
  assert.equal(micro.note, undefined);
  assert.equal(larger.mean, 5321);
  assert.equal(larger.note, 'microApartmentsExcluded');
  assert.match(priceCheckPresentation(report({ facts: { district: 'Köpenick', price: 240_000, area: 40 } }), 'en').notes.join(' '), /micro-apartments up to 30 m²/);
  assert.match(priceCheckPresentation(report({ facts: { district: 'Köpenick', price: 240_000, area: 40 } }), 'de').notes.join(' '), /Mikroapartments bis 30 m²/);
  assert.doesNotMatch(priceCheckPresentation(report({ facts: { district: 'Köpenick', price: 210_000, area: 30 } }), 'en').notes.join(' '), /micro-apartments/);

  const marzahn = berlinPriceCheck(report({ facts: { district: 'Marzahn', price: 180_000, area: 55 } }));
  const rummelsburg = berlinPriceCheck(report({ facts: { district: 'Rummelsburg', price: 280_000, area: 55 } }));
  const hellersdorf = berlinPriceCheck(report({ facts: { district: 'Hellersdorf', price: 180_000, area: 55 } }));
  assert.equal(marzahn.confidence, 'low');
  assert.equal(rummelsburg.confidence, 'low');
  assert.equal(hellersdorf.confidence, 'normal');
  assert.match(priceCheckPresentation(report({ facts: { district: 'Marzahn', price: 180_000, area: 55 } }), 'en').notes.join(' '), /Few sales/);
  assert.match(priceCheckPresentation(report({ facts: { district: 'Marzahn', price: 180_000, area: 55 } }), 'de').notes.join(' '), /Wenige Verkäufe/);
});

test('new-build caveat follows condition or a build year in the last two years', () => {
  const year = new Date().getFullYear();
  assert.equal(berlinPriceCheck(report({ facts: { condition: 'New build', year: '1990' } })).newBuildCaveat, true);
  assert.equal(berlinPriceCheck(report({ facts: { condition: 'First occupancy', year: '1990' } })).newBuildCaveat, true);
  assert.equal(berlinPriceCheck(report({ facts: { condition: 'Erstbezug', year: '1990' } })).newBuildCaveat, true);
  assert.equal(berlinPriceCheck(report({ facts: { condition: 'Renovated', year: String(year - 2) } })).newBuildCaveat, true);
  assert.equal(berlinPriceCheck(report({ facts: { condition: 'Renovated', year: String(year - 3) } })).newBuildCaveat, false);
  assert.equal(berlinPriceCheck(report({ facts: { condition: 'Well maintained', year: 'not stated' } })).newBuildCaveat, false);
  const caveat = priceCheckPresentation(report({ facts: { condition: 'New build', year: '2025' } }), 'en');
  assert.match(caveat.notes.join(' '), /€8,108\/m²/);
  assert.match(priceCheckPresentation(report({ facts: { condition: 'New build', year: '2025' } }), 'de').notes.join(' '), /8\.108 €\/m²/);
  assert.equal(priceCheckPresentation(report(), 'en').notes.some((note) => /New flats/.test(note)), false);
});

test('a merged borough is too broad, and houses or other cities get no card', () => {
  const broad = priceCheckPresentation(report({ facts: { district: 'Friedrichshain-Kreuzberg' } }), 'en');
  const broadDe = priceCheckPresentation(report({ facts: { district: 'Friedrichshain-Kreuzberg' } }), 'de');
  assert.equal(broad.kind, 'unmatched');
  assert.equal(broad.message, "No area comparison: the listing's location is too broad to match an official price area.");
  assert.equal(broadDe.message, 'Kein Gebietsvergleich: Die Lage im Angebot ist zu ungenau für ein amtliches Preisgebiet.');
  assert.equal(berlinPriceCheck(report({ facts: { district: 'Friedrichshain-Kreuzberg' } })), undefined);
  assert.equal(priceCheckPresentation(report({ facts: { city: 'Hamburg', district: 'Eimsbüttel' }, location: 'Eimsbüttel' }), 'en').kind, 'hidden');
  assert.equal(priceCheckPresentation(report({ propertyType: 'house' }), 'de').kind, 'hidden');
  assert.equal(berlinPriceAvailability(report({ facts: { price: 12_000 } })).status, 'hidden');
  assert.equal(askingPriceIsComparable(450_000, 70), true);
  assert.equal(berlinPriceCheck(report({ facts: { district: 'Mitte', postalCode: '13355' } })), undefined);
  assert.equal(berlinPriceCheck(report({ facts: { district: 'Mitte', postalCode: '10179' } })).area, 'Mitte');
});

test('the Berlin-Tegel listing fixture compares with Reinickendorf', () => {
  const source = readFileSync(new URL('./fixtures/listings/ohne-makler-502729.html', import.meta.url), 'utf8');
  const parsed = parseListing(source, 'https://example.test/listing/502729');
  assert.equal(parsed.facts.city, 'Berlin');
  assert.equal(parsed.facts.district, 'Tegel');
  assert.equal(parsed.propertyType, 'flat');
  const check = berlinPriceCheck(parsed);
  assert.ok(check, 'Tegel maps to an official row');
  assert.equal(check.area, 'Reinickendorf');
  assert.equal(check.mean, 3755);
  assert.equal(check.low, 2262);
  assert.equal(check.high, 5528);
  assert.equal(check.position, 'within');
  assert.equal(Math.round(check.askingPerSqm), 4846);
  assert.equal(check.deltaPct, 29);
  const en = priceCheckPresentation(parsed, 'en');
  const de = priceCheckPresentation(parsed, 'de');
  assert.equal(en.kind, 'matched');
  assert.equal(de.kind, 'matched');
  assert.match(en.lead, /in Reinickendorf \(official price area, includes Tegel\)/);
  assert.doesNotMatch(en.lead, /\)\s*\(/);
  assert.doesNotMatch(de.lead, /\)\s*\(/);
  assert.match(de.lead, /in Reinickendorf \(amtliches Preisgebiet, umfasst Tegel\)/);
  assert.match(en.lead, /typical range €2,262–€5,528\/m²/);
  assert.match(de.lead, /übliche Spanne 2\.262–5\.528 €\/m²/);
  assert.equal(en.compareLabel, 'vs. area average (2025)');
  assert.equal(de.compareLabel, 'ggü. Gebietsmittel (2025)');
  assert.match(en.lead, /€4,846\/m² is 29% above/);
  assert.match(de.lead, /4\.846 €\/m² liegt 29 % über/);
});

test('price-check copy avoids deal language and portal names, and the score reads the Berlin delta', () => {
  const files = [
    'lib/price-check.ts',
    'lib/price-check-copy.ts',
    'components/PriceCheckCard.tsx',
  ].map((path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(files, /\b(deal|bargain|undervalued|schnäppchen|unterbewertet)\b/i);
  assert.doesNotMatch(files, /ImmoScout|Ohne-Makler|ohne-makler/i);
  const score = readFileSync(new URL('../lib/property-score.ts', import.meta.url), 'utf8');
  assert.match(score, /localPriceCheck/);
  const steglitz = report({ facts: { district: 'Lichterfelde', price: 300_000, area: 70 } });
  const steglitzEn = priceCheckPresentation(steglitz, 'en');
  const steglitzDe = priceCheckPresentation(steglitz, 'de');
  assert.match(steglitzEn.lead, /in Steglitz \(official price area, includes Lichterfelde\)/);
  assert.match(steglitzEn.lead, /typical range €2,435–€6,428\/m²/);
  assert.match(steglitzDe.lead, /in Steglitz \(amtliches Preisgebiet, umfasst Lichterfelde\)/);
  assert.match(steglitzDe.lead, /übliche Spanne 2\.435–6\.428 €\/m²/);
  const sameArea = priceCheckPresentation(report({ facts: { district: 'Steglitz', price: 300_000, area: 70 } }), 'en');
  assert.match(sameArea.lead, /in Steglitz:/);
  assert.doesNotMatch(sameArea.lead, /official price area/);
  const sample = priceCheckLead(berlinPriceCheck(report()), 'en') + priceCheckLead(berlinPriceCheck(report()), 'de');
  assert.doesNotMatch(sample, /\b(deal|bargain|undervalued|schnäppchen|unterbewertet)\b/i);
});

test('the price-check source names the reference for that city, or none', () => {
  const berlin = report({ facts: { price: 329_000, area: 42.42, district: 'Prenzlauer Berg' } });
  assert.equal(
    provenanceSentence(provenanceForField(berlin, 'priceCheck', '+23%', 'en'), 'en'),
    'Official data: Gutachterausschuss Berlin, Immobilienmarktbericht 2025/2026 (dl-de/zero-2.0)',
  );
  assert.equal(
    provenanceSentence(provenanceForField(berlin, 'priceCheck', '+23 %', 'de'), 'de'),
    'Amtliche Daten: Gutachterausschuss Berlin, Immobilienmarktbericht 2025/2026 (dl-de/zero-2.0)',
  );

  const cologne = report({
    facts: { city: 'Köln', district: 'Lindenthal', postalCode: '50931', year: '1960', price: 560_000, area: 100 },
    location: 'Lindenthal',
  });
  assert.equal(
    provenanceSentence(provenanceForField(cologne, 'priceCheck', '', 'en'), 'en'),
    'Official data: Gutachterausschuss Köln, Grundstücksmarktbericht 2026 (dl-de/zero-2.0)',
  );
  assert.equal(
    provenanceSentence(provenanceForField(cologne, 'priceCheck', '', 'de'), 'de'),
    'Amtliche Daten: Gutachterausschuss Köln, Grundstücksmarktbericht 2026 (dl-de/zero-2.0)',
  );

  const house = report({ propertyType: 'house' });
  const hamburg = report({ facts: { city: 'Hamburg', district: 'Eimsbüttel' }, location: 'Eimsbüttel' });
  for (const item of [house, hamburg]) {
    for (const locale of ['en', 'de']) {
      const sentence = provenanceSentence(provenanceForField(item, 'priceCheck', '', locale), locale);
      assert.doesNotMatch(sentence, /Gutachterausschuss/);
      assert.equal(sentence, locale === 'de'
        ? 'Für diesen Bericht gibt es keine amtliche Preisquelle.'
        : 'No official price reference applies to this report.');
    }
  }
});
