import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import koeln from '../data/price-ref/koeln.json' with { type: 'json' };
import muenchen from '../data/price-ref/muenchen.json' with { type: 'json' };
import { parseListing, preferStatedLivingArea } from '../lib/listing-parser.ts';
import { localPriceAvailability, localPriceCheck, berlinPriceCheck } from '../lib/price-check.ts';
import { priceCheckLead, priceCheckPresentation } from '../lib/price-check-copy.ts';
import { foldAreaName, munichIsCentral, resolveCologneArea } from '../lib/price-ref.ts';
import { calculatePropertyScore, cityTierPriceScore, lacksLocalPriceReference, priceNotCheckedLine, priceUnscoredLabel, scoreConfidence, scorePriceFromDelta } from '../lib/property-score.ts';
import { localizedWarnings } from '../lib/report-copy.ts';
import { methodCopy, methodPlainText } from '../lib/method-copy.ts';

const braunsfeldHtml = readFileSync(new URL('./fixtures/listings/koeln-braunsfeld-496176.html', import.meta.url), 'utf8');

function flat(overrides = {}) {
  const facts = {
    price: 400_000,
    area: 70,
    rooms: '3',
    year: '1960',
    floor: '2',
    energy: 'C',
    heating: 'Gas',
    housegeld: 200,
    totalCost: 0,
    city: 'Köln',
    district: 'Lindenthal',
    postalCode: '50931',
    locationPrecision: 'street',
    ...overrides.facts,
  };
  return {
    id: 'price-ref',
    title: '',
    address: overrides.address || `${facts.postalCode || ''} ${facts.city || ''}`.trim(),
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
    qualityWarnings: overrides.qualityWarnings || [],
    aiEnriched: false,
  };
}

function plzListing(name) {
  const key = foldAreaName(name);
  return Object.entries(koeln.mapping.plzToStadtteil).find(([, rows]) => rows.some(([candidate]) => foldAreaName(candidate) === key))?.[0] || '';
}

test('Cologne reference data is static and names the official source', () => {
  assert.equal(koeln.$schema, 'price-ref/v1');
  assert.equal(koeln.city, 'Köln');
  assert.equal(koeln.source.publisher, 'Gutachterausschuss für Grundstückswerte in der Stadt Köln');
  assert.equal(koeln.source.title, 'Grundstücksmarktbericht 2026');
  assert.equal(koeln.source.licence, 'dl-de/zero-2-0');
  assert.equal(koeln.source.dataYear, 2025);
  assert.equal(koeln.cityNewBuild.mean, 7104);
  assert.ok(koeln.areas.length >= 80);
  assert.ok(Array.isArray(koeln.gaps));
  assert.equal(koeln.mapping.plzToStadtteil['50931'][0][0], 'Lindenthal');
  const loader = readFileSync(new URL('../lib/price-ref.ts', import.meta.url), 'utf8');
  assert.match(loader, /koeln\.json/);
  assert.doesNotMatch(loader, /\bfetch\(|https?:\/\//);
});

test('every published Cologne Stadtteil and alias maps to its reference row', () => {
  for (const area of koeln.areas) {
    const postal = koeln.mapping.homonyms.includes(area.name) ? plzListing(area.name) : '';
    const named = resolveCologneArea(area.name, postal);
    assert.deepEqual(named, { status: 'area', name: area.name }, area.name);
    assert.equal(resolveCologneArea(`Köln-${area.name}`, postal).name, area.name, area.name);
    assert.equal(resolveCologneArea(`Cologne ${area.name.replaceAll('/', '-')}`, postal).name, area.name, area.name);
  }
  for (const [alias, name] of Object.entries(koeln.mapping.aliases)) {
    const resolved = resolveCologneArea(alias, plzListing(name));
    if (koeln.mapping.unpublished.includes(name)) {
      assert.equal(resolved.status, 'tooFew', alias);
      assert.equal(resolved.name, name, alias);
    } else {
      assert.deepEqual(resolved, { status: 'area', name }, alias);
    }
  }
});

test('Cologne homonyms, broad names and postcode shares follow the mapping rules', () => {
  assert.equal(resolveCologneArea('Köln-Innenstadt').status, 'tooBroad');
  assert.equal(resolveCologneArea('Innenstadt', '50931').status, 'tooBroad');
  assert.equal(resolveCologneArea('Köln-Ehrenfeld').status, 'tooBroad');
  assert.equal(resolveCologneArea('Ehrenfeld', '50825').name, 'Ehrenfeld');
  assert.equal(resolveCologneArea('Köln-Ehrenfeld', '50933').status, 'tooBroad');
  assert.equal(resolveCologneArea('Lindenthal').status, 'tooBroad');
  assert.equal(resolveCologneArea('Lindenthal', '50931').name, 'Lindenthal');
  assert.equal(resolveCologneArea('', '50969').name, 'Zollstock');
  assert.equal(resolveCologneArea('Köln', '50969').status, 'tooBroad');
  assert.equal(resolveCologneArea('', '50825').status, 'tooBroad');
  assert.equal(resolveCologneArea('Godorf').status, 'tooFew');
  assert.equal(resolveCologneArea('Hahnwald', plzListing('Hahnwald')).status, 'area');
  for (const name of koeln.mapping.homonyms) {
    assert.equal(resolveCologneArea(name).status, 'tooBroad', name);
    const postal = plzListing(name);
    assert.ok(postal, name);
    assert.equal(resolveCologneArea(name, postal).name, name, name);
  }
});

test('Cologne row choice uses new-build, build-year, then all-years, and drops thin samples', () => {
  const lindenthal = localPriceCheck(flat({
    facts: { district: 'Lindenthal', postalCode: '50931', year: '1960', price: 560_000, area: 100 },
  }));
  assert.equal(lindenthal.area, 'Lindenthal');
  assert.equal(lindenthal.mean, 5274);
  assert.equal(lindenthal.n, 102);
  assert.equal(lindenthal.low, 1400);
  assert.equal(lindenthal.high, 7895);
  assert.deepEqual(lindenthal.buildYearBand, { from: 1941, to: 1990 });
  assert.equal(lindenthal.position, 'within');
  assert.equal(lindenthal.confidence, 'normal');
  assert.equal(lindenthal.deltaPct, Math.round(((5600 - 5274) / 5274) * 100));
  const en = priceCheckLead(lindenthal, 'en');
  const de = priceCheckLead(lindenthal, 'de');
  assert.match(en, /flats built 1941–1990 in Lindenthal/);
  assert.match(en, /lowest–highest €1,400–€7,895\/m²/);
  assert.match(de, /mit Baujahr 1941–1990 in Lindenthal/);
  assert.match(de, /niedrigster–höchster 1\.400–7\.895 €\/m²/);

  const ehrenfeldNew = localPriceCheck(flat({
    facts: { district: 'Ehrenfeld', postalCode: '50825', year: '1990', condition: 'New build', price: 500_000, area: 70 },
  }));
  assert.equal(ehrenfeldNew.segment, 'newBuild');
  assert.equal(ehrenfeldNew.mean, 7149);
  assert.equal(ehrenfeldNew.n, 141);
  assert.equal(ehrenfeldNew.newBuildCaveat, false);

  const band = localPriceCheck(flat({
    facts: { district: 'Ehrenfeld', postalCode: '50825', year: '1960', condition: 'Renovated', price: 300_000, area: 70 },
  }));
  assert.equal(band.mean, 4311);
  assert.equal(band.n, 34);
  assert.equal(band.confidence, 'low');

  const allYears = localPriceCheck(flat({
    facts: { district: 'Braunsfeld', postalCode: '50933', year: 'not stated', price: 300_000, area: 60 },
  }));
  assert.equal(allYears.mean, 5128);
  assert.equal(allYears.n, 37);
  assert.equal(allYears.buildYearBand, undefined);

  const above = localPriceCheck(flat({
    facts: { district: 'Braunsfeld', postalCode: '50933', year: '1957', price: 505_000, area: 63.01 },
  }));
  assert.equal(above.position, 'above');
  const below = localPriceCheck(flat({
    facts: { district: 'Lindenthal', postalCode: '50931', year: '1960', price: 100_000, area: 100 },
  }));
  assert.equal(below.position, 'below');
  assert.equal(below.askingPerSqm < below.low, true);

  const hahnwald = localPriceAvailability(flat({
    facts: { district: 'Hahnwald', postalCode: plzListing('Hahnwald'), year: '2000', price: 400_000, area: 80 },
  }));
  assert.equal(hahnwald.reason, 'tooFewSales');
  assert.match(priceCheckPresentation(flat({
    facts: { district: 'Hahnwald', postalCode: plzListing('Hahnwald'), year: '2000', price: 400_000, area: 80 },
  }), 'en').message, /too few recorded sales in Hahnwald/);

  const godorf = localPriceAvailability(flat({ facts: { district: 'Godorf', postalCode: '', year: '1980', price: 300_000, area: 70 } }));
  assert.equal(godorf.reason, 'tooFewSales');
  const elsdorf = localPriceAvailability(flat({
    facts: { district: 'Elsdorf', postalCode: plzListing('Elsdorf'), year: '2025', condition: 'New build', price: 400_000, area: 70 },
  }));
  assert.equal(elsdorf.reason, 'tooFewSales');

  const renovated = localPriceCheck(flat({
    facts: { district: 'Braunsfeld', postalCode: '50933', year: '1957', condition: 'Erstbezug nach Sanierung', price: 505_000, area: 63.01 },
  }));
  assert.equal(renovated.segment, 'resale');
  assert.equal(renovated.newBuildCaveat, false);
  assert.equal(renovated.mean, 4612);
});

test('Cologne is a checked city even when one flat is too broad, and Hamburg has no card', () => {
  const broad = flat({ facts: { district: 'Innenstadt', postalCode: '50667', city: 'Köln' } });
  assert.equal(lacksLocalPriceReference(broad), false);
  assert.equal(priceNotCheckedLine(broad, 'en'), '');
  assert.equal(priceNotCheckedLine(broad, 'de'), '');
  assert.equal(localPriceAvailability(broad).reason, 'tooBroad');
  assert.equal(scoreConfidence(broad).level, 'high');

  const hamburg = flat({
    facts: { city: 'Hamburg', district: 'Eimsbüttel', postalCode: '20259' },
    location: 'Eimsbüttel',
    address: '20259 Hamburg',
  });
  assert.equal(localPriceAvailability(hamburg).status, 'hidden');
  assert.equal(priceNotCheckedLine(hamburg, 'en'), 'Price not checked: no local reference data yet');
  assert.equal(priceNotCheckedLine(hamburg, 'de'), 'Preis nicht geprüft: noch keine lokalen Vergleichsdaten');
  assert.equal(calculatePropertyScore(hamburg).breakdown.price, null);
  assert.equal(scoreConfidence(hamburg).level, 'medium');
});

test('Berlin price-check wording stays on the F05 path', () => {
  const report = flat({
    facts: { city: 'Berlin', district: 'Prenzlauer Berg', postalCode: '10405', year: '1990', price: 450_000, area: 70 },
    location: 'Prenzlauer Berg',
    address: '10405 Berlin',
  });
  const direct = berlinPriceCheck(report);
  const local = localPriceCheck(report);
  assert.equal(local.area, 'Prenzlauer Berg');
  assert.equal(local.mean, direct.mean);
  assert.equal(local.deltaPct, direct.deltaPct);
  assert.equal(priceCheckLead(local, 'en', 'Prenzlauer Berg'), priceCheckLead(direct, 'en', 'Prenzlauer Berg'));
  assert.match(priceCheckLead(local, 'en'), /typical range/);
  assert.doesNotMatch(priceCheckLead(local, 'en'), /lowest–highest/);
  assert.equal(priceCheckPresentation(report, 'en').compareLabel, 'vs. area average (2025)');
  assert.equal(priceCheckPresentation(report, 'de').compareLabel, 'ggü. Gebietsmittel (2025)');
});

test('a smaller stated Wohnfläche replaces a header that includes non-living space, and an unexplained gap does not', () => {
  const loft = preferStatedLivingArea([
    '100,51 m²',
    'Wohnfläche',
    'Auf 63,01 qm Wohnfläche stehen drei Zimmer zur Verfügung.',
    'Der unausgebaute Spitzboden hat 37,5 qm Nutzfläche.',
  ], 100.51);
  assert.equal(loft.area, 63.01);
  assert.match(loft.warning, /uses the stated living area of 63.01 m²/);
  assert.match(loft.warning, /37.5 m² of non-living space/);

  const cellar = preferStatedLivingArea([
    'Die Wohnung hat 55 m² Wohnfläche und einen Keller mit 25 m² Nutzfläche.',
  ], 80);
  assert.equal(cellar.area, 55);
  assert.match(cellar.warning, /stated living area of 55 m²/);

  const hobby = preferStatedLivingArea([
    'Wohnfläche 42 m², dazu ein Hobbyraum von 18 m².',
  ], 60);
  assert.equal(hobby.area, 42);
  assert.match(hobby.warning, /hobby room/);

  const reserve = preferStatedLivingArea([
    'Die Wohnfläche beträgt 48 m². Die Ausbaureserve umfasst 12 m².',
  ], 60);
  assert.equal(reserve.area, 48);

  const unclear = preferStatedLivingArea([
    'Die Beschreibung nennt 70 m² Wohnfläche im Wohnbereich.',
  ], 90);
  assert.equal(unclear.area, 90);
  assert.match(unclear.warning, /living area in the listing is unclear/);
  const unclearReport = flat({
    facts: { district: 'Lindenthal', postalCode: '50931', price: 400_000, area: 90 },
    qualityWarnings: [unclear.warning],
  });
  assert.equal(localPriceAvailability(unclearReport).reason, 'areaUnclear');
  assert.match(priceCheckPresentation(unclearReport, 'en').message, /living area in the listing is unclear/);
  assert.match(priceCheckPresentation(unclearReport, 'de').message, /Wohnfläche im Angebot ist unklar/);
});

test('Braunsfeld 496176 uses 63.01 m² and shows about +74%, with an EN and DE note', () => {
  assert.doesNotMatch(braunsfeldHtml, /immobilienscout|immoscout|ohne-makler|immowelt|immonet/i);
  const report = parseListing(braunsfeldHtml, 'https://example.test/496176');
  assert.equal(report.facts.city, 'Köln');
  assert.equal(report.facts.district, 'Braunsfeld');
  assert.equal(report.facts.postalCode, '50933');
  assert.equal(report.facts.price, 505_000);
  assert.equal(report.facts.year, '1957');
  assert.equal(report.facts.area, 63.01);
  assert.equal(report.facts.usableArea, 37.5);
  assert.equal(report.facts.condition, 'Renovated');
  assert.notEqual(report.facts.condition, 'New build');

  const note = report.qualityWarnings.find((warning) => /stated living area/.test(warning));
  assert.ok(note, report.qualityWarnings.join(' | '));
  assert.match(note, /header states 100.51 m²/);
  assert.match(note, /63.01 m² of living space/);
  assert.match(note, /37.5 m² of non-living space \(unfinished loft\)/);
  const de = localizedWarnings(report, 'de').join('\n');
  const en = localizedWarnings(report, 'en').join('\n');
  assert.match(en, /price comparison uses the stated living area of 63.01 m²/);
  assert.match(de, /Im Kopf stehen 100,51 m², die Beschreibung nennt aber 63,01 m² Wohnfläche/);
  assert.match(de, /37,5 m² Nichtwohnfläche \(unausgebauter Dachboden\)/);
  assert.match(de, /angegebene Wohnfläche von 63,01 m²/);
  assert.doesNotMatch(de, /\d\.\d m²/);

  const check = localPriceCheck(report);
  assert.equal(check.area, 'Braunsfeld');
  assert.equal(check.mean, 4612);
  assert.equal(check.n, 27);
  assert.equal(check.low, 2222);
  assert.equal(check.high, 6457);
  assert.equal(check.segment, 'resale');
  assert.equal(check.newBuildCaveat, false);
  assert.equal(Math.round(check.askingPerSqm), 8015);
  assert.equal(check.deltaPct, 74);
  assert.notEqual(check.deltaPct, 9);
  assert.equal(check.position, 'above');
  assert.equal(check.confidence, 'low');

  const cardEn = priceCheckPresentation(report, 'en');
  const cardDe = priceCheckPresentation(report, 'de');
  assert.equal(cardEn.kind, 'matched');
  assert.match(cardEn.lead, /€8,015\/m² is 74% above/);
  assert.match(cardEn.lead, /flats built 1941–1990 in Braunsfeld/);
  assert.match(cardEn.lead, /€4,612\/m², 27 sales/);
  assert.match(cardEn.positionNote, /above the highest recorded sale/);
  assert.match(cardEn.notes.join(' '), /Few sales in this area/);
  assert.match(cardEn.sourceLabel, /Gutachterausschuss Köln, Grundstücksmarktbericht 2026 \(dl-de\/zero-2\.0\)/);
  assert.equal(cardEn.glanceValue, '+74%');
  assert.match(cardDe.lead, /8\.015 €\/m² liegt 74 % über/);
  assert.match(cardDe.lead, /4\.612 €\/m², 27 Verkäufe/);
  assert.equal(cardDe.glanceValue, '+74 %');
  assert.doesNotMatch(`${cardEn.lead} ${cardDe.lead}`, /\+9/);

  assert.equal(calculatePropertyScore(report).breakdown.price, scorePriceFromDelta(74, 'low'));
});

test('Munich stays off unless PRICE_REF_MUENCHEN_ENABLED is exactly 1', () => {
  const previous = process.env.PRICE_REF_MUENCHEN_ENABLED;
  const munich = (facts) => flat({
    facts: { city: 'München', district: 'Obermenzing', postalCode: '81247', ...facts },
    location: facts.district || 'München',
    address: `${facts.postalCode || '81247'} München`,
  });
  try {
    delete process.env.PRICE_REF_MUENCHEN_ENABLED;
    const off = munich({ year: '1965', price: 379_000, area: 57.34 });
    assert.equal(lacksLocalPriceReference(off), true);
    assert.equal(localPriceAvailability(off).status, 'hidden');
    assert.equal(priceNotCheckedLine(off, 'en'), 'Price not checked: no local reference data yet');
    assert.equal(priceNotCheckedLine(off, 'de'), 'Preis nicht geprüft: noch keine lokalen Vergleichsdaten');
    assert.equal(calculatePropertyScore(off).breakdown.price, null);
    assert.equal(scoreConfidence(off).level, 'medium');

    process.env.PRICE_REF_MUENCHEN_ENABLED = 'true';
    assert.equal(localPriceAvailability(off).status, 'hidden');
    assert.equal(priceNotCheckedLine(off, 'en'), 'Price not checked: no local reference data yet');

    process.env.PRICE_REF_MUENCHEN_ENABLED = '1';
    assert.equal(muenchen.$schema, 'price-ref/v1');
    assert.equal(muenchen.newBuild.goodLocation, 10550);
    assert.equal(muenchen.resaleByBuildYear.find((band) => band.from === 1960).mean, 6400);

    const band = localPriceCheck(off);
    assert.equal(band.mean, 6400);
    assert.equal(band.approximate, true);
    assert.equal(band.confidence, 'low');
    assert.equal(band.central, false);
    assert.equal(band.deltaPct, 3);
    assert.deepEqual(band.buildYearBand, { from: 1960, to: 1969 });
    const bandEn = priceCheckPresentation(off, 'en');
    assert.match(bandEn.lead, /about €6,400\/m²/);
    assert.match(bandEn.lead, /rough guide/);
    assert.match(bandEn.lead, /flats built 1960–1969/);
    assert.match(priceCheckPresentation(off, 'de').lead, /rund 6\.400 €\/m²/);
    assert.equal(cityTierPriceScore(band), null);
    assert.equal(calculatePropertyScore(off).breakdown.price, null);
    assert.equal(priceUnscoredLabel(off, 'en'), 'not scored (citywide price data only)');
    assert.equal(priceUnscoredLabel(off, 'de'), 'nicht bewertet (nur stadtweite Preisdaten)');
    assert.equal(priceNotCheckedLine(off, 'en'), '');

    const rounded = localPriceCheck(munich({ year: '1955', price: 386_500, area: 50, district: 'Pasing-Obermenzing' }));
    assert.equal(rounded.mean, 7730);
    assert.equal(rounded.deltaPct, 0);
    assert.match(priceCheckLead(rounded, 'en'), /about €7,750\/m²/);
    assert.match(priceCheckLead(rounded, 'de'), /rund 7\.750 €\/m²/);

    const edges = [
      ['1949', 'unmatched'],
      ['1950', 'matched'],
      ['2023', 'matched'],
    ];
    for (const [year, kind] of edges) {
      const view = localPriceAvailability(munich({ year, price: 400_000, area: 60, district: 'Pasing-Obermenzing' }));
      assert.equal(view.status, kind, year);
      if (year === '1949') assert.equal(view.reason, 'noBuildYearBand');
      if (year === '1950') assert.equal(view.check.mean, 7730);
      if (year === '2023') assert.equal(view.check.mean, 9190);
    }

    const recent = localPriceCheck(munich({ year: '2024', condition: 'Renovated', price: 500_000, area: 50, district: 'Pasing-Obermenzing' }));
    assert.equal(recent.segment, 'newBuild');
    assert.equal(recent.mean, 10550);
    assert.equal(recent.year, 2026);

    const noBand = munich({ year: '1910', price: 450_000, area: 50, district: 'Pasing-Obermenzing' });
    assert.equal(localPriceAvailability(noBand).reason, 'noBuildYearBand');
    assert.equal(priceUnscoredLabel(noBand, 'en'), 'not scored (no local price data)');
    assert.match(priceCheckPresentation(noBand, 'en').message, /none fits this flat/);

    const ceilingReport = munich({ year: '1910', price: 794_500, area: 50, district: 'Pasing-Obermenzing' });
    const ceiling = localPriceCheck(ceilingReport);
    assert.equal(ceiling.ceiling, true);
    assert.equal(ceiling.mean, 10550);
    assert.equal(ceiling.deltaPct, 51);
    assert.match(priceCheckLead(ceiling, 'en'), /51% above the highest Munich-wide average/);
    assert.equal(cityTierPriceScore(ceiling), 4.5);
    assert.equal(calculatePropertyScore(ceilingReport).breakdown.price, scorePriceFromDelta(ceiling.deltaPct, 'low'));

    const outlier = munich({ year: '1965', price: 416_000, area: 50, district: 'Bezirk 19' });
    const outlierCheck = localPriceCheck(outlier);
    assert.equal(outlierCheck.central, false);
    assert.equal(outlierCheck.deltaPct, 30);
    assert.equal(cityTierPriceScore(outlierCheck), 4.5);
    assert.equal(scorePriceFromDelta(outlierCheck.deltaPct, 'low'), 4.07);
    assert.equal(calculatePropertyScore(outlier).breakdown.price, 4.1);

    const mild = munich({ year: '1965', price: 352_000, area: 50, district: 'Bezirk 19' });
    assert.equal(localPriceCheck(mild).deltaPct, 10);
    assert.equal(cityTierPriceScore(localPriceCheck(mild)), null);
    assert.equal(priceUnscoredLabel(mild, 'en'), 'not scored (citywide price data only)');
    assert.equal(calculatePropertyScore(mild).breakdown.price, null);

    const centralAsk = munich({ year: '1975', price: 728_000, area: 70.47, district: 'Maxvorstadt', postalCode: '80331' });
    const centralCheck = localPriceCheck(centralAsk);
    assert.equal(centralCheck.central, true);
    assert.equal(centralCheck.mean, 6450);
    assert.equal(centralCheck.deltaPct, 60);
    assert.equal(cityTierPriceScore(centralCheck), null);
    assert.match(priceCheckPresentation(centralAsk, 'en').notes.join(' '), /Central districts usually sell well above/);

    assert.equal(munichIsCentral('Altstadt-Lehel'), true);
    assert.equal(munichIsCentral('', '80797'), true);
    assert.equal(munichIsCentral('', '80331'), true);
    assert.equal(munichIsCentral('', '81475'), false);
    assert.equal(localPriceCheck(munich({ year: '1965', price: 400_000, area: 60, district: '', postalCode: '80797' })).central, true);
    assert.equal(localPriceCheck(munich({ year: '1965', price: 400_000, area: 60, district: '', postalCode: '81475' })).central, false);

    const haar = munich({ postalCode: '85540', district: 'Haar', year: '1965', price: 400_000, area: 60 });
    assert.equal(localPriceAvailability(haar).status, 'hidden');
    assert.equal(priceNotCheckedLine(haar, 'en'), 'Price not checked: no local reference data yet');

    const below = munich({ year: '1965', price: 200_000, area: 50, district: 'Pasing-Obermenzing' });
    assert.equal(localPriceCheck(below).deltaPct <= -25, true);
    assert.equal(cityTierPriceScore(localPriceCheck(below)), 7.25);
  } finally {
    if (previous === undefined) delete process.env.PRICE_REF_MUENCHEN_ENABLED;
    else process.env.PRICE_REF_MUENCHEN_ENABLED = previous;
  }
});

test('method pages credit OpenStreetMap and the Cologne valuation board', () => {
  const text = `${methodPlainText('en')}\n${methodPlainText('de')}`;
  assert.match(text, /© OpenStreetMap contributors \(ODbL\)/);
  assert.match(text, /Gutachterausschuss für Grundstückswerte in der Stadt Köln/);
  assert.match(text, /Grundstücksmarktbericht 2026/);
  assert.match(text, /Berlin and Cologne by area; the Munich price check is switched off/);
  assert.match(text, /Berlin und Köln nach Stadtteil; die München-Preisprüfung ist aus/);
  assert.doesNotMatch(text, /Munich citywide only|München nur stadtweit/);
  assert.doesNotMatch(text, /ImmoScout|Ohne-Makler|ohne-makler|Immowelt/i);
  const labels = [...methodCopy('en').sources, ...methodCopy('de').sources].map((source) => source.label).join('\n');
  assert.match(labels, /© OpenStreetMap contributors \(ODbL\)/);
  assert.match(labels, /Gutachterausschuss für Grundstückswerte in der Stadt Köln, Grundstücksmarktbericht 2026/);
  assert.doesNotMatch(labels, /Halbjahresreport/);
});
