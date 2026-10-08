import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  GRUNDERWERBSTEUER,
  GRUNDERWERBSTEUER_CHECKED,
  buyerCostBreakdown,
  buyerCostComparisonValue,
  buyerCostView,
  stateForReport,
  transferTaxRate,
} from '../lib/buyer-costs.ts';
import { acquisitionCosts } from '../lib/finance.ts';
import { money, percent } from '../lib/format.ts';

const RATES = {
  BW: 5.0, BY: 3.5, BE: 6.0, BB: 6.5, HB: 5.5, HH: 5.5, HE: 6.0, MV: 6.0,
  NI: 5.0, NW: 6.5, RP: 5.0, SL: 6.5, SN: 5.5, ST: 5.0, SH: 6.5, TH: 5.0,
};

const CITIES = {
  Berlin: 'BE', Hamburg: 'HH', München: 'BY', Köln: 'NW', 'Frankfurt am Main': 'HE', Stuttgart: 'BW',
  Düsseldorf: 'NW', Leipzig: 'SN', Dortmund: 'NW', Essen: 'NW', Bremen: 'HB', Dresden: 'SN', Hannover: 'NI',
  Nürnberg: 'BY', Duisburg: 'NW', Bochum: 'NW', Wuppertal: 'NW', Bielefeld: 'NW', Bonn: 'NW', Münster: 'NW',
  Mannheim: 'BW', Karlsruhe: 'BW', Augsburg: 'BY', Wiesbaden: 'HE', Gelsenkirchen: 'NW', Mönchengladbach: 'NW',
  Braunschweig: 'NI', Kiel: 'SH', Aachen: 'NW', Chemnitz: 'SN', Halle: 'ST', Magdeburg: 'ST', Freiburg: 'BW',
  Krefeld: 'NW', Lübeck: 'SH', Mainz: 'RP', Erfurt: 'TH', Oberhausen: 'NW', Rostock: 'MV', Kassel: 'HE',
  Potsdam: 'BB', Saarbrücken: 'SL', Oldenburg: 'NI', Osnabrück: 'NI', Heidelberg: 'BW', Darmstadt: 'HE',
  Regensburg: 'BY', Würzburg: 'BY', Ingolstadt: 'BY', Ulm: 'BW', Wolfsburg: 'NI', Göttingen: 'NI', Koblenz: 'RP',
  Jena: 'TH', Trier: 'RP', Coburg: 'BY', Reinbek: 'SH', Erfde: 'SH',
};

function listing(facts = {}, extra = {}) {
  return { address: '', location: '', propertyType: 'flat', ...extra, facts: { price: 400_000, ...facts } };
}

test('transfer-tax table covers all 16 states as checked on 2026-10-08', () => {
  assert.equal(GRUNDERWERBSTEUER_CHECKED, '2026-10-08');
  assert.equal(GRUNDERWERBSTEUER.length, 16);
  for (const row of GRUNDERWERBSTEUER) {
    assert.equal(row.rate, RATES[row.state]);
    assert.match(row.since, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(transferTaxRate('BE'), 6);
  assert.equal(transferTaxRate('BY'), 3.5);
  assert.equal(transferTaxRate('SH'), 6.5);
  assert.equal(transferTaxRate('NW'), 6.5);
  assert.equal(transferTaxRate('NI'), 5);
});

test('city and wholly-in-state postcode detection', () => {
  for (const [city, state] of Object.entries(CITIES)) {
    assert.equal(stateForReport(listing({ city })).state, state, city);
    assert.equal(stateForReport(listing({ city })).basis, 'city');
  }
  assert.equal(stateForReport(listing({ postalCode: '10115' })).state, 'BE');
  assert.equal(stateForReport(listing({ postalCode: '14199' })).basis, 'postal');
  assert.equal(stateForReport(listing({ postalCode: '10114' })).basis, 'unknown');
  assert.equal(stateForReport(listing({ postalCode: '14200' })).basis, 'unknown');
  assert.equal(stateForReport(listing({ postalCode: '20095' })).state, 'HH');
  assert.equal(stateForReport(listing({ postalCode: '20999' })).state, 'HH');
  assert.equal(stateForReport(listing({ postalCode: '21000' })).basis, 'unknown');
  assert.equal(stateForReport(listing({ postalCode: '28195' })).state, 'HB');
  assert.equal(stateForReport(listing({ postalCode: '28779' })).state, 'HB');
  assert.equal(stateForReport(listing({ postalCode: '28780' })).basis, 'unknown');
  assert.equal(stateForReport(listing({ postalCode: '80331' })).state, 'BY');
  assert.equal(stateForReport(listing({ postalCode: '81929' })).state, 'BY');
  assert.equal(stateForReport(listing({ postalCode: '81931' })).basis, 'unknown');
  assert.equal(stateForReport({ address: 'Buddestraße 7, 13507 Berlin', facts: {} }).state, 'BE');
});

test('Berlin 6.0%, Bavaria 3.5%, Erfde, Bochum and Osnabrück use their state rates', () => {
  const berlin = buyerCostBreakdown(listing({ city: 'Berlin', buyerCommission: 'Commission-free' }));
  assert.equal(berlin.estimateLow, 32_000);
  assert.equal(berlin.lines.find(line => line.key === 'tax').low, 24_000);
  assert.equal(berlin.lines.find(line => line.key === 'notary').low, 8_000);
  assert.equal(berlin.lines.find(line => line.key === 'broker').low, 0);

  const bavaria = buyerCostView(listing({ city: 'München', buyerCommission: '3,57 % inkl. MwSt.' }), 'en');
  assert.match(bavaria.rows[0].label, /Bavaria/);
  assert.match(bavaria.rows[0].label, /3\.5%/);
  assert.equal(bavaria.rows[0].amount, money(14_000, 'en'));
  assert.equal(bavaria.rows[1].amount, money(8_000, 'en'));
  assert.equal(bavaria.rows[2].amount, money(14_280, 'en'));
  assert.equal(bavaria.summaryAmount, money(36_280, 'en'));
  const bavariaDe = buyerCostView(listing({ city: 'München', buyerCommission: '3,57 % inkl. MwSt.' }), 'de');
  assert.match(bavariaDe.rows[0].label, /Bayern/);
  assert.match(bavariaDe.rows[0].label, /3,5\s%/);
  assert.equal(bavariaDe.summaryAmount, money(36_280, 'de'));

  const erfde = buyerCostView(listing({ city: 'Erfde', buyerCommission: 'Commission-free' }), 'en');
  assert.match(erfde.rows[0].label, /Schleswig-Holstein/);
  assert.match(erfde.rows[0].label, /6\.5%/);
  assert.equal(erfde.rows[0].amount, money(26_000, 'en'));
  assert.match(buyerCostView(listing({ city: 'Erfde' }), 'de').rows[0].label, /Schleswig-Holstein/);
  assert.match(buyerCostView(listing({ city: 'Erfde' }), 'de').rows[0].label, /6,5\s%/);

  const bochum = buyerCostView(listing({ city: 'Bochum', postalCode: '44879' }), 'en');
  assert.match(bochum.rows[0].label, /North Rhine-Westphalia/);
  assert.match(bochum.rows[0].label, /6\.5%/);
  const bochumDe = buyerCostView(listing({ city: 'Bochum' }), 'de');
  assert.match(bochumDe.rows[0].label, /Nordrhein-Westfalen/);

  const osnabrueck = buyerCostView(listing({ city: 'Osnabrück', postalCode: '49086' }), 'en');
  assert.match(osnabrueck.rows[0].label, /Lower Saxony/);
  assert.match(osnabrueck.rows[0].label, /5\.0%/);
  assert.match(buyerCostView(listing({ city: 'Osnabrück' }), 'de').rows[0].label, /Niedersachsen/);
  assert.match(buyerCostView(listing({ city: 'Osnabrück' }), 'de').rows[0].basis, /Schätzung|gesetzlich|Geprüft/);
});

test('an unidentified state is a labelled rate range, not a single assumed rate', () => {
  const costs = buyerCostBreakdown(listing({ city: 'Atlantis' }));
  assert.equal(costs.basis, 'unknown');
  assert.equal(costs.estimateIsRange, true);
  assert.equal(costs.lines.find(line => line.key === 'tax').low, 14_000);
  assert.equal(costs.lines.find(line => line.key === 'tax').high, 26_000);
  assert.equal(costs.financingLow, 22_000);
  assert.equal(costs.financingHigh, 34_000);
  assert.notEqual(costs.financingLow, Math.round(400_000 * 0.065) + 8_000);
  const en = buyerCostView(listing({ city: 'Atlantis' }), 'en');
  const de = buyerCostView(listing({ city: 'Atlantis' }), 'de');
  assert.match(en.rows[0].label, /state not identified/);
  assert.match(en.rows[0].label, /3\.5%/);
  assert.match(en.rows[0].label, /6\.5%/);
  assert.match(en.rows[0].basis, /lowest state rate/);
  assert.doesNotMatch(en.rows[0].label, /highest rate assumed/i);
  assert.match(de.rows[0].label, /Bundesland unklar/);
  assert.match(de.rows[0].label, /3,5\s%/);
  assert.match(de.rows[0].label, /6,5\s%/);
  assert.equal(en.summaryAmount, `${money(22_000, 'en')}–${money(34_000, 'en')}`);
  assert.match(en.rows[1].basis, /Estimate/);
  assert.match(en.rows[1].basis, /1\.5%/);
  assert.match(en.rows[1].basis, /2\.5%/);
});

test('commission is used only as stated, including VAT, a euro amount, free, and not stated', () => {
  const price = 400_000;
  const percentCosts = buyerCostBreakdown(listing({ city: 'Berlin', buyerCommission: '3,57 % inkl. MwSt.' }));
  assert.equal(percentCosts.lines.find(line => line.key === 'broker').low, 14_280);
  assert.equal(percentCosts.estimateLow, 24_000 + 8_000 + 14_280);
  assert.match(buyerCostView(listing({ city: 'Berlin', buyerCommission: '3,57 % inkl. MwSt.' }), 'en').rows[2].basis, /incl\. VAT/);
  const bare = buyerCostView(listing({ city: 'Berlin', buyerCommission: '3,57 %' }), 'en');
  assert.equal(bare.rows[2].amount, money(14_280, 'en'));
  assert.doesNotMatch(bare.rows[2].basis, /VAT|MwSt/);

  const plusVat = buyerCostView(listing({ city: 'Berlin', buyerCommission: '3,00 % zzgl. MwSt.' }), 'en');
  assert.equal(plusVat.rows[2].amount, money(14_280, 'en'));
  assert.match(plusVat.rows[2].basis, /plus VAT/);
  assert.match(plusVat.rows[2].basis, /3\.57%/);
  const plusVatDe = buyerCostView(listing({ city: 'Berlin', buyerCommission: '3.00 % plus VAT' }), 'de');
  assert.match(plusVatDe.rows[2].basis, /zzgl\. MwSt/);
  assert.match(plusVatDe.rows[2].basis, /3,57\s%/);

  const euros = buyerCostBreakdown(listing({ city: 'Berlin', buyerCommission: '12.500 €' }));
  assert.equal(euros.lines.find(line => line.key === 'broker').low, 12_500);
  assert.match(buyerCostView(listing({ city: 'Berlin', buyerCommission: '12.500 €' }), 'de').rows[2].basis, /Laut Angebot/);

  const free = buyerCostView(listing({ city: 'Berlin', buyerCommission: 'Commission-free' }), 'en');
  assert.equal(free.rows[2].amount, '€0');
  assert.match(free.rows[2].basis, /commission-free/);
  const freeDe = buyerCostView(listing({ city: 'Berlin', buyerCommission: 'provisionsfrei' }), 'de');
  assert.equal(freeDe.rows[2].amount.replace(/\u00a0/g, ' '), '0 €');
  assert.match(freeDe.rows[2].basis, /provisionsfrei/);

  const omitted = buyerCostView(listing({ city: 'Berlin' }), 'en');
  assert.equal(omitted.rows[2].amount, '');
  assert.match(omitted.rows[2].basis, /Not stated/);
  assert.match(omitted.rows[2].basis, /3\.57%/);
  assert.match(buyerCostView(listing({ city: 'Berlin' }), 'de').rows[2].basis, /Nicht angegeben/);
  assert.match(buyerCostView(listing({ city: 'Berlin' }), 'de').rows[2].basis, /3,57\s%/);
  assert.equal(buyerCostBreakdown(listing({ city: 'Berlin' })).estimateLow, 32_000);

  const withParking = buyerCostBreakdown(listing({ city: 'Berlin', buyerCommission: 'Commission-free', parkingPrice: 25_000 }));
  assert.equal(withParking.estimateLow, 32_000);
});

test('stated buyer costs stay in the financing total, with a note only past the divergence threshold', () => {
  const listed = buyerCostBreakdown(listing({ city: 'Berlin', price: 172_000, buyerCosts: 13_105, totalCost: 185_104, buyerCommission: 'Commission-free' }));
  assert.equal(listed.financingLow, 13_105);
  assert.equal(listed.totalLow, 185_104);
  assert.equal(listed.estimateLow, 13_760);
  assert.equal(listed.divergence, false);
  assert.equal(buyerCostView(listing({ city: 'Berlin', price: 172_000, buyerCosts: 13_105, totalCost: 185_104, buyerCommission: 'Commission-free' }), 'en').divergence, undefined);

  const under = listing({ city: 'Berlin', price: 100_000, buyerCosts: 9_000, buyerCommission: 'Commission-free' });
  assert.equal(buyerCostBreakdown(under).estimateLow, 8_000);
  assert.equal(buyerCostBreakdown(under).divergence, false);

  const over = listing({ city: 'Berlin', price: 100_000, buyerCosts: 9_001, buyerCommission: 'Commission-free' });
  assert.equal(buyerCostBreakdown(over).divergence, true);
  const note = buyerCostView(over, 'en');
  assert.match(note.divergence, /€9,001/);
  assert.match(note.divergence, new RegExp(money(8_000, 'en').replace('€', '\\€')));
  assert.match(note.divergence, /Berlin/);
  assert.match(buyerCostView(over, 'de').divergence, /Berlin/);
  assert.match(buyerCostView(over, 'de').divergence, /Frag nach/);
  assert.equal(acquisitionCosts(over).buyerCosts, 9_001);
  assert.equal(acquisitionCosts(over).buyerCostsAreEstimated, false);
});

test('financing uses the itemised total, and the flat 8% fallback is gone', () => {
  const berlin = acquisitionCosts(listing({ city: 'Berlin', buyerCommission: 'Commission-free' }));
  assert.equal(berlin.buyerCosts, 32_000);
  assert.equal(berlin.total, 432_000);
  assert.equal(berlin.buyerCostsAreEstimated, true);
  assert.equal(berlin.buyerCostsAreRange, undefined);

  const munich = acquisitionCosts({ price: 400_000, city: 'München' });
  assert.equal(munich.buyerCosts, 22_000);
  assert.notEqual(munich.buyerCosts, Math.round(400_000 * 0.08));

  const unknown = acquisitionCosts({ price: 400_000, city: 'Somewhere' });
  assert.equal(unknown.buyerCosts, 22_000);
  assert.equal(unknown.buyerCostsHigh, 34_000);
  assert.equal(unknown.totalHigh, 434_000);
  assert.equal(unknown.buyerCostsAreRange, true);

  const source = readFileSync(new URL('../lib/finance.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /0\.08/);
  assert.equal(buyerCostComparisonValue(listing({ city: 'Berlin', buyerCommission: 'Commission-free' }), 'en'), `${money(32_000, 'en')} (est.)`);
  assert.equal(buyerCostComparisonValue(listing({ city: 'Berlin', buyerCommission: 'Commission-free' }), 'de'), `${money(32_000, 'de')} (geschätzt)`);
  assert.equal(buyerCostComparisonValue(listing({ city: 'Berlin', price: 172_000, buyerCosts: 13_105, totalCost: 185_104 }), 'en'), money(13_105, 'en'));
});

test('buyer-cost copy is in both languages and does not name a listing portal', () => {
  assert.equal(percent(3.5, 'en', 1), '3.5%');
  assert.equal(percent(6, 'en', 1), '6.0%');
  assert.match(percent(3.5, 'de', 1), /^3,5\s%$/);
  assert.equal(money(172_000, 'en'), '€172,000');
  assert.match(money(172_000, 'de'), /^172\.000\s€$/);
  for (const locale of ['en', 'de']) {
    const view = buyerCostView(listing({ city: 'Erfde', buyerCommission: 'Commission-free' }), locale);
    const text = JSON.stringify(view);
    assert.doesNotMatch(text, /immobilienscout|immoscout|ohne-makler|kleinanzeigen|immowelt|immonet/i);
    assert.match(view.footnote, locale === 'de' ? /GNotKG/ : /GNotKG/);
    assert.match(view.rows[1].label, locale === 'de' ? /Schätzung/ : /estimate/i);
  }
});

test('the Adlershof listing still finances the stated buyer costs', async () => {
  const { parseListing } = await import('../lib/listing-parser.ts');
  const source = readFileSync(new URL('./fixtures/listings/ohne-makler-471956.html', import.meta.url), 'utf8');
  const report = parseListing(source, 'https://example.test/listing/471956');
  const costs = acquisitionCosts(report);
  assert.equal(report.facts.city, 'Berlin');
  assert.equal(costs.buyerCosts, 13_105);
  assert.equal(costs.total, 185_104);
  assert.equal(buyerCostBreakdown(report).divergence, false);
  assert.equal(buyerCostBreakdown(report).estimateLow, 13_760);
});
