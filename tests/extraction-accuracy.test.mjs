import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseListing } from '../lib/listing-parser.ts';
import { scoreAvailable } from '../lib/report-integrity.ts';
import { resolveLocation } from '../lib/display.ts';
import { clarifyBeforeDecision, localizedConsiderations, localizedSummary, localizedWarnings, offerQuestionsFor } from '../lib/report-copy.ts';
import { localizedFactualTaxonomy, parseFactualTaxonomy, taxonomyFields } from '../lib/property-taxonomy.ts';
import { localizedTenancy } from '../lib/i18n.ts';
import { redFlagSentence } from '../lib/red-flags.ts';
import { priceCheckPresentation } from '../lib/price-check-copy.ts';

const fixture = (id) => readFileSync(new URL(`./fixtures/listings/ohne-makler-${id}.html`, import.meta.url), 'utf8');
const parse = (id) => parseListing(fixture(id), `https://www.ohne-makler.net/immobilie/${id}/`);

const FLAT_ADVICE = /Hausgeld|\bWEG\b|Teilungserklärung|which floor|\blift\b|Aufzug|\bEtage\b/i;

function stable(report) {
  const { id, createdAt, evidence, ...rest } = report;
  return rest;
}

function facing(report) {
  return [
    report.title,
    report.summary,
    report.address,
    ...(report.considerations || []),
    ...(report.qualityWarnings || []),
    ...offerQuestionsFor(report, 'en'),
    localizedSummary(report, 'de'),
    ...localizedConsiderations(report, 'de'),
    ...localizedWarnings(report, 'de'),
    ...offerQuestionsFor(report, 'de'),
  ].join('\n');
}

test('Erfde bungalow is a house in Erfde with a flagged postcode and no flat advice', () => {
  const report = parse('502750');
  assert.equal(report.propertyType, 'house');
  assert.equal(report.typeSource, 'structured');
  assert.equal(report.address, 'Erfde');
  assert.equal(report.facts.city, 'Erfde');
  assert.equal(report.facts.condition, 'Like new');
  assert.equal(report.facts.floor, 'not stated');
  assert.equal(report.facts.district, 'Bargen');
  assert.equal(report.facts.postalCode, undefined);
  assert.equal(report.facts.rooms, '4');
  assert.equal(typeof report.score, 'number');
  assert.ok(report.scoreBreakdown);
  assert.equal(report.scoreBreakdown.price, null);
  assert.equal(scoreAvailable(report), true);
  assert.notEqual(resolveLocation(report).basis, 'none');
  assert.match(report.qualityWarnings.join(' '), /2803/);
  assert.match(report.qualityWarnings.join(' '), /not a valid 5-digit code/);
  assert.doesNotMatch(facing(report), FLAT_ADVICE);
  assert.match(localizedSummary(report, 'de'), /^Dieses 4-Zimmer-Haus/);
  assert.doesNotMatch(facing(report), /ImmoScout|Ohne-Makler|ohne-makler/i);
});

test('Osnabrück address keeps a street that has no standard suffix', () => {
  const report = parse('502050');
  assert.equal(report.address, 'Molenseten 60, 49086 Osnabrück');
  assert.equal(report.facts.street, 'Molenseten 60');
  assert.equal(report.facts.city, 'Osnabrück');
  assert.equal(report.facts.postalCode, '49086');
  assert.equal(report.facts.district, 'Voxtrup');
  assert.equal(report.propertyType, 'flat');
  assert.equal(report.typeSource, 'structured');
  assert.equal(report.facts.rooms, '3');
  assert.doesNotMatch(report.qualityWarnings.join(' '), /street address is not disclosed/i);
  assert.equal(typeof report.score, 'number');
  assert.equal(report.scoreBreakdown.price, null);
});

test('Berlin-Tegel keeps the labelled room count and shows a score', () => {
  const report = parse('502729');
  assert.equal(report.facts.rooms, '3');
  assert.equal(report.facts.city, 'Berlin');
  assert.equal(report.facts.district, 'Tegel');
  assert.equal(report.facts.postalCode, '13507');
  assert.equal(report.address, 'Buddestraße 7, 13507 Berlin');
  assert.equal(report.propertyType, 'flat');
  assert.equal(report.typeSource, 'structured');
  assert.equal(scoreAvailable(report), true);
  assert.equal(typeof report.score, 'number');
  assert.ok(report.score > 0);
  assert.ok(report.scoreBreakdown);
  assert.doesNotMatch(report.qualityWarnings.join(' '), /conflicting room counts/);
  assert.doesNotMatch(report.title, /not stated/);
});

test('five parses of each listing are identical aside from id and time', () => {
  for (const id of ['502750', '502050', '502729']) {
    const reports = Array.from({ length: 5 }, () => stable(parse(id)));
    for (const report of reports) assert.deepEqual(report, reports[0]);
  }
});

test('address header accepts streets without a suffix and ignores seller prose', () => {
  const listing = (header) => parseListing(`
    <title>Wohnung zum Kauf</title><main>
    ${header}
    <div>Kaufpreis</div><div>420.000 €</div>
    <div>Wohnfläche</div><div>120 m²</div>
    <div>4</div><div>Zimmer</div>
    <div>Objektart</div><div>Haus</div>
    </main>`, 'https://example.test/street');

  for (const [header, address] of [
    ['<div>Am Markt 3,</div><div>20095 Hamburg</div>', 'Am Markt 3, 20095 Hamburg'],
    ['<div>An der Alster 5,</div><div>20095 Hamburg</div>', 'An der Alster 5, 20095 Hamburg'],
    ['<div>Zur Mühle 2,</div><div>20095 Hamburg</div>', 'Zur Mühle 2, 20095 Hamburg'],
    ['<div>Unter den Linden 10,</div><div>10117 Berlin</div>', 'Unter den Linden 10, 10117 Berlin'],
    ['<div>Ella-Kay-Straße</div><div>10405 Berlin</div>', 'Ella-Kay-Straße, 10405 Berlin'],
  ]) {
    const report = listing(header);
    assert.equal(report.address, address, header);
    assert.doesNotMatch(report.qualityWarnings.join(' '), /street address is not disclosed/i);
  }

  const prose = listing('<p>Das Haus liegt ruhig in der Molenseten Gegend, unweit vom Markt.</p><div>20095 Hamburg</div>');
  assert.equal(prose.address, '20095 Hamburg');
  assert.equal(prose.facts.street, undefined);
  assert.equal(prose.facts.city, 'Hamburg');
  assert.match(prose.qualityWarnings.join(' '), /street address is not disclosed/i);

  const areaOnly = listing('<div>Prenzlauer Berg, 10439 Berlin</div>');
  assert.equal(areaOnly.address, '10439 Berlin');
  assert.equal(areaOnly.facts.street, undefined);
  assert.equal(areaOnly.facts.city, 'Berlin');
  assert.equal(areaOnly.facts.postalCode, '10439');
});

test('property type prefers structured fields, then keywords, then a scored-withheld fallback', () => {
  const base = (body) => parseListing(`<title>${body.title}</title><main>
    <div>10115 Berlin</div>
    <div>Kaufpreis</div><div>400.000 €</div>
    <div>Wohnfläche</div><div>90 m²</div>
    <div>Baujahr</div><div>1990</div>
    <div>Zustand</div><div>gepflegt</div>
    <div>Energieeffizienzklasse</div><div>C</div>
    <div>Ausrichtung</div><div>Süd</div>
    <p>Die U-Bahn ist 6 Gehminuten entfernt.</p>
    ${body.extra || ''}
  </main>`, 'https://example.test/type');

  const structured = base({ title: 'Wohnung im Vorderhaus', extra: '<div>Objektart Haus</div><div>Objekttyp Bungalow</div>' });
  assert.equal(structured.propertyType, 'house');
  assert.equal(structured.typeSource, 'structured');

  const keyword = base({ title: 'Holzbungalow mit Garten' });
  assert.equal(keyword.propertyType, 'house');
  assert.equal(keyword.typeSource, 'keyword');

  const flatInHouse = base({ title: 'Wohnung im Mehrfamilienhaus' });
  assert.equal(flatInHouse.propertyType, 'flat');
  assert.equal(flatInHouse.typeSource, 'keyword');

  const fallback = base({ title: 'Charming home near the park' });
  assert.equal(fallback.propertyType, 'flat');
  assert.equal(fallback.typeSource, 'fallback');
  assert.equal(fallback.score, null);
  assert.equal(scoreAvailable(fallback), false);
  assert.equal(keyword.score === null, false);
});

test('Osnabrück shows the ground lease and the rented-until conflict, never vacant', () => {
  const html = fixture('502050');
  const report = parse('502050');
  const pacht = report.redFlags.find(flag => flag.id === 'pacht');
  const rented = report.redFlags.find(flag => flag.id === 'rentedOccupied');
  assert.ok(pacht);
  assert.equal(pacht.severity, 'high');
  assert.ok(pacht.evidence.length <= 220);
  assert.equal(html.includes(pacht.evidence), true);
  assert.match(pacht.evidence, /Pachtgrundstück/);
  assert.equal(report.redFlags.some(flag => flag.id === 'leasehold'), false);
  assert.match(redFlagSentence(report, pacht, 'en'), /Land is leased \(Pachtgrundstück\)/);
  assert.match(redFlagSentence(report, pacht, 'de'), /^Pachtgrundstück:/);
  assert.doesNotMatch(`${redFlagSentence(report, pacht, 'en')} ${redFlagSentence(report, pacht, 'de')}`, /Erbbaurecht|Erbbauzins/);
  assert.ok(rented);
  assert.equal(html.includes(rented.evidence), true);
  assert.match(redFlagSentence(report, rented, 'en'), /3 to 10 years depending on the area/);
  assert.match(redFlagSentence(report, rented, 'de'), /je nach Ort 3 bis 10 Jahre gesperrt sein/);
  assert.doesNotMatch(`${redFlagSentence(report, rented, 'en')} ${redFlagSentence(report, rented, 'de')}`, /Berlin/);
  assert.equal(report.facts.city, 'Osnabrück');
  assert.equal(report.facts.tenancy, 'Rented');
  assert.equal(report.facts.tenancyConflict, true);
  assert.equal(report.facts.rentedUntilText, 'Ende November 2026');
  assert.equal(report.facts.availabilityDate, '2026-12-01');
  assert.equal(report.facts.groundLease, true);
  assert.equal(report.facts.groundLeaseKind, 'pacht');
  assert.equal(report.facts.groundRentYear, 997);
  assert.equal(report.facts.groundRentMonth, 83);
  assert.equal(report.facts.groundRentInServiceCharge, true);
  const corpus = facing(report);
  assert.match(corpus, /Pacht|lease|annual rent/i);
  assert.match(corpus, /November|Dezember|December|until the end|bis Ende|currently rented|is rented until/i);
  assert.match(report.summary, /until the end of November 2026/);
  assert.match(report.summary, /free from 1 December 2026/);
  assert.match(report.summary, /The land is leased \(Pachtgrundstück\)/);
  assert.match(report.summary, /Annual rent is about €997 a year/);
  assert.doesNotMatch(report.summary, /Erbbaurecht|ground rent/i);
  assert.doesNotMatch(corpus, /\bvacant\b/i);
  assert.doesNotMatch(corpus, /Berlin/);
  assert.equal(priceCheckPresentation(report, 'en').kind, 'hidden');
  assert.equal(priceCheckPresentation(report, 'de').kind, 'hidden');
  assert.match(offerQuestionsFor(report, 'en')[0], /lease contract/);
  assert.match(offerQuestionsFor(report, 'de')[0], /Pachtvertrag/);
  assert.match(localizedSummary(report, 'de'), /Pachtgrundstück/);
  assert.match(localizedSummary(report, 'de'), /bis Ende November 2026/);
  assert.doesNotMatch(localizedSummary(report, 'de'), /widerspricht/);
  assert.doesNotMatch(`${report.summary}\n${localizedSummary(report, 'de')}\n${localizedWarnings(report, 'en').join('\n')}\n${localizedWarnings(report, 'de').join('\n')}`, /key-facts table says it is not rented|widerspricht/);
  for (const locale of ['en', 'de']) {
    const notes = localizedWarnings(report, locale);
    const clarify = clarifyBeforeDecision(report, locale);
    for (const item of clarify) assert.equal(notes.includes(item), false, item);
    assert.doesNotMatch(clarify.join('\n'), /key-facts table says it is not rented|widerspricht/);
  }
  const taxonomy = parseFactualTaxonomy({
    model: 'jev-test',
    answers: Object.fromEntries(taxonomyFields.map(field => [field, { type: 'choice', choice: field === 'occupancy' ? 'not_rented' : 'unknown', confidence: 0.99 }])),
  }, report, 'hash');
  const profiled = { ...report, taxonomy };
  assert.equal(localizedFactualTaxonomy(profiled, 'en').find(row => row.startsWith('Rental status:')), `Rental status: ${localizedTenancy(report.facts.tenancy, report.facts.availabilityDate, 'en')}`);
  assert.equal(localizedFactualTaxonomy(profiled, 'de').find(row => row.startsWith('Vermietung:')), `Vermietung: ${localizedTenancy(report.facts.tenancy, report.facts.availabilityDate, 'de')}`);
  assert.doesNotMatch(localizedFactualTaxonomy(profiled, 'en').join('\n'), /Not rented/);
  assert.doesNotMatch(localizedFactualTaxonomy(profiled, 'de').join('\n'), /Nicht vermietet/);
  assert.doesNotMatch(localizedSummary(report, 'de'), /Erbbaurecht|Erbbauzins/);
});

test('Berlin does not invent a balcony or terrace from other flats, and is sold as-is', () => {
  const report = parse('502729');
  assert.deepEqual(report.facts.features, ['Keller']);
  assert.equal(report.facts.soldAsIs, true);
  assert.match(facing(report), /Ist-Zustand|as-is|current condition/i);
  assert.doesNotMatch(facing(report), /terrace|garden|Terrasse|Garten|Balkon|balcony/i);
  assert.equal((report.redFlags || []).some(flag => flag.id === 'teileigentum'), false);
});

test('Erfde keeps like-new condition, the heat pump, the plot and timber construction', () => {
  const report = parse('502750');
  assert.equal(report.facts.condition, 'Like new');
  assert.match(report.facts.energySource, /Luft|Wasserwärme|Wärmepumpe|heat pump/i);
  assert.equal(report.facts.plotArea, 500);
  assert.equal(report.facts.construction, 'Timber frame');
  assert.match(facing(report), /timber|wood|Holz/i);
  assert.match(localizedSummary(report, 'de'), /Neuwertig/);
  assert.match(localizedSummary(report, 'de'), /500 m² Grundstück/);
  assert.match(localizedSummary(report, 'de'), /Luft-\/Wasserwärme/);
  assert.doesNotMatch(facing(report), FLAT_ADVICE);
  assert.equal((report.redFlags || []).some(flag => flag.id === 'noHausgeld'), false);
});
