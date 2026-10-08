import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { localizedValue } from '../lib/i18n.ts';
import { normalizedCondition, parseListing } from '../lib/listing-parser.ts';
import { methodPlainText } from '../lib/method-copy.ts';
import {
  RENTED_OCCUPIER_PENALTY,
  calculatePropertyScore,
  grossYieldLine,
  isInvestmentProperty,
  scoreConfidence,
} from '../lib/property-score.ts';
import { detectRedFlags, redFlagSentence } from '../lib/red-flags.ts';
import { EXTRACTION_VERSION, reportIsStale } from '../lib/report-integrity.ts';

function listing(body, title = 'Wohnung') {
  return parseListing(`<html><head><title>${title}</title></head><body><main>${body}</main></body></html>`, 'https://example.test/v23');
}

function shell(facts = {}, extra = {}) {
  return {
    id: 'score-v23',
    title: extra.title || 'Test',
    address: 'Testweg 1',
    propertyType: extra.propertyType || 'flat',
    typeSource: 'structured',
    source: 'test',
    createdAt: '2026-10-08T00:00:00.000Z',
    extractionVersion: EXTRACTION_VERSION,
    score: null,
    summary: extra.summary || '',
    considerations: [],
    sunOrientation: 'not stated',
    qualityWarnings: [],
    aiEnriched: false,
    redFlags: [],
    location: 'Test',
    facts: {
      price: 400_000,
      area: 80,
      rooms: '3',
      year: '2001',
      floor: '2. OG',
      energy: 'C',
      heating: 'Fernwärme',
      totalCost: 440_000,
      city: 'Berlin',
      district: 'Mitte',
      housegeld: 280,
      locationPrecision: 'address',
      condition: 'Well maintained',
      neighborhood: {},
      ...facts,
    },
  };
}

test('extraction v2.3 is the single newer version and only older reports are stale', () => {
  assert.equal(EXTRACTION_VERSION, 2026100807);
  assert.equal(reportIsStale({ extractionVersion: 2026100807, country: 'DE' }), false);
  assert.equal(reportIsStale({ extractionVersion: 2026100806, country: 'DE' }), true);
  assert.equal(reportIsStale({ extractionVersion: 2026100808, country: 'DE' }), false);
});

test('Lage-Check pairs a label line with the next bare distance', () => {
  const osnabruck = parseListing(
    readFileSync(new URL('./fixtures/listings/ohne-makler-502050.html', import.meta.url), 'utf8'),
    'https://www.ohne-makler.net/immobilie/502050/',
  );
  assert.equal(osnabruck.facts.neighborhood.transitMinutes, 2);
  assert.equal(osnabruck.facts.neighborhood.dailyNeedsMinutes, 4);

  const cologne = listing(`
    <p>Vogelsanger Straße 10 a, 50825 Köln</p>
    <div>Kaufpreis</div><div>529.000 €</div>
    <div>Wohnfläche</div><div>83 m²</div>
    <h4>Lage-Check</h4>
    <div><span>Einkaufen</span><div><span>50m</span></div></div>
    <div><span>ÖPNV</span><div><span>250m</span></div></div>
    <div><span>Energie</span><span>0</span><span>25</span><span>50</span></div>
  `);
  assert.equal(cologne.facts.neighborhood.transitMinutes, 3);
  assert.equal(cologne.facts.neighborhood.dailyNeedsMinutes, 1);

  const prose = listing(`
    <p>50825 Köln</p><div>Kaufpreis</div><div>400.000 €</div><div>Wohnfläche</div><div>70 m²</div>
    <h4>Lage-Check</h4>
    <p>ÖPNV</p>
    <p>Der Stadtteil ist ruhig und grün.</p>
    <p>250m</p>
  `);
  assert.equal(prose.facts.neighborhood.transitMinutes, undefined);
  assert.equal(listing('<p>10439 Berlin</p><div>Kaufpreis</div><div>400.000 €</div><div>Wohnfläche</div><div>70 m²</div><p>ÖPNV 250m</p>').facts.neighborhood.transitMinutes, 3);
});

test('only a whole building skips the tenancy deduction, and the yield stays visible', () => {
  const flat = listing(`
    <p>10439 Berlin</p><div>Kaufpreis</div><div>400.000 €</div><div>Wohnfläche</div><div>70 m²</div>
    <p>Die Wohnung ist vermietet und eignet sich auch als Kapitalanlage.</p>
    <div>Nettokaltmiete</div><div>1.200,00 €</div>
  `, 'Altbauwohnung als Kapitalanlage');
  assert.equal(flat.facts.investmentUse, undefined);
  assert.equal(isInvestmentProperty(flat), false);
  assert.equal(flat.facts.tenancy, 'Rented');
  assert.equal(calculatePropertyScore(flat).adjustments[0].points, -RENTED_OCCUPIER_PENALTY);
  assert.match(grossYieldLine(flat, 'en'), /Gross yield/);

  const house = listing(`
    <p>24103 Kiel</p><div>Kaufpreis</div><div>450.000 €</div><div>Wohnfläche</div><div>140 m²</div>
    <div>Zimmer</div><div>5</div>
    <p>Das Einfamilienhaus ist vermietet, auch als Kapitalanlage interessant.</p>
  `, 'Einfamilienhaus als Kapitalanlage');
  assert.equal(house.facts.investmentUse, undefined);
  assert.equal(isInvestmentProperty(house), false);
  assert.equal(calculatePropertyScore(house).adjustments.some((item) => item.id === 'rented'), true);

  const block = listing(`
    <p>Lindenstraße 12, 44879 Bochum</p>
    <div>Kaufpreis</div><div>1.180.000 €</div><div>Wohnfläche</div><div>439 m²</div>
    <div>Zimmer</div><div>17</div><div>Baujahr</div><div>2022</div>
    <div>Energieeffizienzklasse</div><div>B</div><div>Heizungsart</div><div>Fernwärme</div>
    <div>Objekttyp</div><div>Mehrfamilienhaus</div>
    <p>Das Mehrfamilienhaus ist vermietet. Sechs Wohnungen.</p>
    <div>Jahresnettokaltmiete</div><div>37.552,92 €</div>
    <p>Ein öffentlich gefördertes Mehrfamilienhaus.</p>
  `, 'Mehrfamilienhaus als Kapitalanlage');
  assert.equal(block.facts.investmentUse, true);
  assert.equal(isInvestmentProperty(block), true);
  assert.equal(calculatePropertyScore(block).adjustments.some((item) => item.id === 'rented'), false);
  assert.equal(scoreConfidence(block).level, 'medium');
  assert.equal(block.facts.grossYield, 3.18);
  assert.match(grossYieldLine(block, 'de'), /Bruttorendite/);
  assert.equal(block.redFlags.some((flag) => flag.id === 'socialHousing'), true);

  const berlinBlock = shell({ tenancy: 'Rented', investmentUse: true }, { propertyType: 'house', title: 'Zinshaus' });
  assert.equal(scoreConfidence(berlinBlock).level, 'medium');
  assert.equal(calculatePropertyScore(berlinBlock).adjustments.length, 0);
});

test('public funding, WBS, Sozialbindung and a rent cap are a red flag in both languages', () => {
  const phrases = [
    'öffentlich gefördertes Mehrfamilienhaus',
    'Vermietung nur mit WBS.',
    'Es besteht eine Sozialbindung bis 2040.',
    'Die Wohnung unterliegt der Mietpreisbindung.',
  ];
  for (const phrase of phrases) {
    const flag = detectRedFlags([phrase], shell()).find((item) => item.id === 'socialHousing');
    assert.ok(flag, phrase);
    assert.match(redFlagSentence(shell(), flag, 'en'), /WBS|Sozialbindung|rent cap|Publicly funded/);
    assert.match(redFlagSentence(shell(), flag, 'de'), /Sozialbindung|Wohnberechtigungsschein|Mietpreisbindung|Frag/);
    assert.doesNotMatch(`${redFlagSentence(shell(), flag, 'en')} ${redFlagSentence(shell(), flag, 'de')}`, /ImmoScout|Ohne-Makler|ohne-makler/i);
  }
  assert.equal(detectRedFlags(['Das Haus ist nicht öffentlich gefördert.'], shell()).some((flag) => flag.id === 'socialHousing'), false);
  assert.equal(detectRedFlags(['Keine Mietpreisbindung.'], shell()).some((flag) => flag.id === 'socialHousing'), false);
});

test('English pages translate orientation and German pages keep the listing words', () => {
  assert.equal(localizedValue('Südwest', 'en'), 'South-west');
  assert.equal(localizedValue('Süd', 'en'), 'South');
  assert.equal(localizedValue('Süd- und West-Ausrichtung', 'en'), 'South and west facing');
  assert.equal(localizedValue('Süd-/Südwest', 'en'), 'South / south-west');
  assert.equal(localizedValue('nach Süden ausgerichtet', 'en'), 'South facing');
  assert.equal(localizedValue('Südwest', 'de'), 'Südwest');
  assert.equal(localizedValue('Süd- und West-Ausrichtung', 'de'), 'Süd- und West-Ausrichtung');
  const report = listing('<p>50825 Köln</p><div>Kaufpreis</div><div>400.000 €</div><div>Wohnfläche</div><div>70 m²</div><div>Ausrichtung</div><div>Südwest</div>');
  assert.equal(localizedValue(report.sunOrientation, 'en'), 'South-west');
  assert.equal(localizedValue(report.sunOrientation, 'de'), 'Südwest');
});

test('seit-year and Sperrfrist match only in a tenancy sentence', () => {
  const parsed = (paragraph) => listing(`<p>10439 Berlin</p><div>Kaufpreis</div><div>400.000 €</div><div>Wohnfläche</div><div>70 m²</div><p>${paragraph}</p>`);
  assert.equal(parsed('Die Wohnung wurde seit 2019 saniert.').facts.tenancySinceYear, undefined);
  assert.equal(parsed('Familienbesitz seit 1985.').facts.tenancySinceYear, undefined);
  assert.equal(parsed('Die Hausverwaltung besteht seit 2010.').facts.tenancySinceYear, undefined);
  assert.equal(parsed('Vermietung seit 1998, die Wohnung ist bezugsfrei.').facts.tenancySinceYear, undefined);
  assert.equal(parsed('Die Wohnung ist seit 1998 stabil vermietet.').facts.tenancySinceYear, 1998);
  assert.equal(parsed('Das Mietverhältnis besteht seit 2010.').facts.tenancySinceYear, 2010);
  assert.equal(parsed('Der Mieter wohnt seit 12 Jahren hier.').facts.tenancySinceYear, new Date().getUTCFullYear() - 12);

  assert.equal(parsed('Es wird eine Sperrfrist erwähnt.').facts.evictionBan, undefined);
  assert.equal(parsed('Eine umwandlungsbedingte Sperrfrist nach § 577a BGB besteht nicht mehr.').facts.evictionBan, undefined);
  assert.equal(parsed('Die Sperrfrist endete am 1. Januar 2020.').facts.evictionBan, undefined);
  assert.equal(parsed('Es gilt ein Kündigungsverbot im Gesellschaftsvertrag.').facts.evictionBan, undefined);
  assert.equal(parsed('Die Sperrfrist für den Mieter läuft bis 31.12.2030.').facts.evictionBan, true);
  assert.equal(parsed('Der Mieter unterliegt einem Kündigungsverbot.').facts.evictionBan, true);
});

test('unit renovation wins over a well-kept staircase or shared estate', () => {
  const lichtenrade = `
    Wir verkaufen eine komplett und sehr hochwertig renovierte ruhige 2-Zimmer-Wohnung mit Ausblick.
    Das Gemeinschaftseigentum befindet sich in einem sehr gepflegten Zustand.
  `;
  assert.equal(normalizedCondition('keine Angaben', lichtenrade), 'Renovated');
  assert.equal(normalizedCondition('', 'Das Treppenhaus ist frisch renoviert. Die Wohnung ist gepflegt.'), 'Well maintained');
  assert.equal(normalizedCondition('', 'Das Haus ist in einem gepflegten Zustand.'), 'Well maintained');
  const parsed = listing(`
    <p>12309 Berlin</p><div>Kaufpreis</div><div>250.000 €</div><div>Wohnfläche</div><div>60 m²</div>
    <div>Zimmer</div><div>2</div><div>Baujahr</div><div>1964</div>
    <div>Zustand</div><div>keine Angaben</div>
    <p>Wir verkaufen eine komplett und sehr hochwertig renovierte 2-Zimmer-Wohnung.</p>
    <p>Das Gemeinschaftseigentum befindet sich in einem sehr gepflegten Zustand.</p>
  `);
  assert.equal(parsed.facts.condition, 'Renovated');
  assert.equal(calculatePropertyScore(parsed).breakdown.building, 7.3);
});

test('the method page states the space steps and a plain price scale', () => {
  const en = methodPlainText('en');
  const de = methodPlainText('de');
  assert.match(en, /area per room plus absolute size/);
  assert.match(en, /14 m² is 3\.5/);
  assert.match(en, /30 m² is 4/);
  assert.match(en, /55%/);
  assert.match(en, /15% over about 3 and 50% over about 1/);
  assert.match(de, /Wohnfläche pro Zimmer plus die absolute Größe/);
  assert.match(de, /14 m² ergibt 3,5/);
  assert.match(de, /30 m² ergibt 4/);
  assert.match(de, /15 % darüber etwa 3 und 50 % darüber etwa 1/);
  assert.doesNotMatch(de, /40 % darüber liegt unter/);
  assert.doesNotMatch(de, /\bWohnung\b/);
  assert.doesNotMatch(`${en}\n${de}`, /ImmoScout|Ohne-Makler|ohne-makler/i);
});

test('page chrome reads /api/access, and the nav reads only /api/session', async () => {
  const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const path of [
    'components/Sidebar.tsx',
    'components/LandingPage.tsx',
    'components/ReportView.tsx',
    'components/TermsPage.tsx',
    'components/QuotaModal.tsx',
  ]) {
    const text = await source(path);
    assert.doesNotMatch(text, /\/api\/auth\/me/, path);
    assert.match(text, /\/api\/access/, path);
  }
  const session = await source('app/api/session/route.ts');
  const access = await source('app/api/access/route.ts');
  const nav = await source('components/AccountNav.tsx');
  const account = await source('components/AccountPage.tsx');
  assert.match(session, /readLightSession/);
  assert.doesNotMatch(session, /accessState|userReportIds|sessionUser/);
  assert.match(access, /accessState/);
  assert.doesNotMatch(access, /userReportIds|stripe/i);
  assert.match(nav, /\/api\/session/);
  assert.doesNotMatch(nav, /\/api\/auth\/me|\/api\/access/);
  assert.match(account, /\/api\/auth\/me/);
  const note = await source('components/ReportNote.tsx');
  const sessionAt = note.indexOf("'/api/session'");
  const noteAt = note.indexOf('/api/reports/');
  assert.ok(sessionAt >= 0 && noteAt > sessionAt);
  assert.match(note, /!session\.response\.ok \|\| !session\.data\.user/);
  assert.doesNotMatch(note, /\/api\/auth\/me/);
});

test('AI staging is taken from captions or listing text, and it does not change the score', () => {
  const image = (index, caption) => `<a href="https://media.ohne-makler.net/stage-${index}.jpg" data-glightbox="type: image;description: ${caption}"></a>`;
  const most = listing(`
    ${image(0, 'Visualisierung Wohnzimmer')}${image(1, 'Visualisierung Küche')}${image(2, 'Visualisierung Bad')}
    <p>10439 Berlin</p><div>Kaufpreis</div><div>400.000 €</div><div>Wohnfläche</div><div>70 m²</div>
  `);
  assert.deepEqual(most.facts.photoStaging, { indexes: [0, 1, 2], listingWide: false });
  assert.equal(most.redFlags.some((flag) => flag.id === 'aiStaging' && flag.severity === 'caution'), true);
  assert.match(redFlagSentence(most, most.redFlags.find((flag) => flag.id === 'aiStaging'), 'en'), /Most of the photos are labelled in the listing/);
  assert.match(redFlagSentence(most, most.redFlags.find((flag) => flag.id === 'aiStaging'), 'de'), /Die meisten Fotos sind im Angebot/);
  assert.doesNotMatch(`${redFlagSentence(most, { id: 'aiStaging', severity: 'caution' }, 'en')} ${redFlagSentence(most, { id: 'aiStaging', severity: 'caution' }, 'de')}`, /pixel|ImmoScout|Ohne-Makler/i);
  const plain = { ...most, redFlags: most.redFlags.filter((flag) => flag.id !== 'aiStaging'), facts: { ...most.facts, photoStaging: undefined } };
  assert.equal(calculatePropertyScore(most).total, calculatePropertyScore(plain).total);

  const wide = listing(`
    <p>10439 Berlin</p><div>Kaufpreis</div><div>400.000 €</div><div>Wohnfläche</div><div>70 m²</div>
    <p>Einige Bilder sind KI generiert.</p>
  `);
  assert.deepEqual(wide.facts.photoStaging, { indexes: [], listingWide: true });
  const wideFlag = wide.redFlags.find((flag) => flag.id === 'aiStaging');
  assert.equal(wideFlag.severity, 'caution');
  assert.match(redFlagSentence(wide, wideFlag, 'en'), /without saying which photo/);
  assert.match(redFlagSentence(wide, wideFlag, 'de'), /ohne ein bestimmtes Foto zu nennen/);

  const captioned = listing(`
    <img alt="virtuell gestaged" src="https://media.ohne-makler.net/one.jpg">
    <img alt="Zimmer" src="https://media.ohne-makler.net/two.jpg">
    <img alt="virtual staging of the hall" src="https://media.ohne-makler.net/three.jpg">
    <img alt="Küche" src="https://media.ohne-makler.net/four.jpg">
    <p>10439 Berlin</p><div>Kaufpreis</div><div>400.000 €</div><div>Wohnfläche</div><div>70 m²</div>
  `);
  assert.deepEqual(captioned.facts.photoStaging, { indexes: [0, 2], listingWide: false });
  assert.equal(captioned.redFlags.some((flag) => flag.id === 'aiStaging'), false);

  const clear = listing(`
    <p>10439 Berlin</p><div>Kaufpreis</div><div>400.000 €</div><div>Wohnfläche</div><div>70 m²</div>
    <p>Es gibt keine Visualisierung. Die virtuelle Möblierung ist unverbindlich.</p>
  `);
  assert.equal(clear.facts.photoStaging, undefined);
  assert.equal(clear.redFlags.some((flag) => flag.id === 'aiStaging'), false);
});
