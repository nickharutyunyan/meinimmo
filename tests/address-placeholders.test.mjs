import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanAddressPlaceholders, hasHouseNumber } from '../lib/location-validation.ts';
import { parseListing, refreshDerivedReport } from '../lib/listing-parser.ts';
import { reportTitle, reportSubtitle, resolveLocation } from '../lib/display.ts';

// Relevant visible source excerpt from ohne-makler.net/immobilie/500988,
// retrieved 3 October 2026. Keep the unrelated transit sentence as a regression.
const listing = `1-Zimmer Altbauwohnung zum Kauf
Chodowieckistr. XX,
10405 Berlin
(Prenzlauer Berg)
Kaufpreis
329.000 €
Wohnfläche
42,42 m²
Zimmer
1
Baujahr
1910
Die Straßenbahnen sind nah und bieten eine schnelle Verbindung zum Alexanderplatz.
Eigentumswohnung provisionsfrei`;

test('masked house numbers are removed, never inferred or partially retained', () => {
  for (const token of ['XX','xx','X','***','???','___','12XX','12??','0','000','–','...','n.n.','k.A.']) {
    assert.equal(cleanAddressPlaceholders(`Chodowieckistr. ${token}, 10405 Berlin`),'Chodowieckistr., 10405 Berlin',token);
    assert.equal(hasHouseNumber(`Chodowieckistr. ${token}`),false,token);
  }
});
test('actual numbers, suffixes, ranges and numeric street names remain intact', () => {
  for (const street of ['Chodowieckistr. 12','Danziger Straße 12a','Danziger Straße 12 A','Danziger Straße 12–14','Danziger Straße 12/14','Straße des 17. Juni 115','Straße 17','Max-Planck-Straße 8']) {
    assert.equal(cleanAddressPlaceholders(street),street);
    assert.equal(hasHouseNumber(street),true,street);
  }
  assert.equal(cleanAddressPlaceholders('Straße des 17. Juni'),'Straße des 17. Juni');
});
test('user listing keeps Chodowieckistr. rather than a transit sentence', () => {
  const report = parseListing(listing,'https://www.ohne-makler.net/immobilie/500988/');
  assert.equal(report.facts.street,'Chodowieckistr.');
  assert.equal(report.facts.locationPrecision,'street');
  assert.equal(reportTitle(report),'1-room flat · Chodowieckistr.');
  assert.equal(reportTitle(report,'de'),'1-Zimmer-Wohnung · Chodowieckistr.');
  assert.equal(reportSubtitle(report),'Chodowieckistr., 10405 Berlin');
  assert.equal(resolveLocation(report).exact,false);
  assert.equal(resolveLocation(report).mapQuery,'Chodowieckistr., 10405 Berlin, Germany');
});
test('saved and model-enriched reports lose placeholders and false exact-address status', () => {
  const base=parseListing(listing,'test');
  for (const address of ['Chodowieckistr. XX, 10405 Berlin','Address not stated']) {
    const old={...base,address,facts:{...base.facts,street:'Chodowieckistr. XX',locationPrecision:'address'}};
    assert.doesNotMatch(reportTitle(old),/XX/);
    assert.doesNotMatch(reportSubtitle(old),/XX/);
    assert.equal(resolveLocation(old).exact,false);
    const fixed=refreshDerivedReport(old);
    assert.equal(fixed.facts.street,'Chodowieckistr.');
    assert.equal(fixed.facts.locationPrecision,'street');
    assert.doesNotMatch(fixed.title+' '+fixed.summary,/XX/);
  }
});
test('structured addresses receive the same placeholder rule', () => {
  const raw=`<script type="application/ld+json">${JSON.stringify({'@type':'Apartment',address:{streetAddress:'Chodowieckistr. XX',postalCode:'10405',addressLocality:'Berlin'}})}</script><p>${listing}</p>`;
  const report=parseListing(raw,'test');
  assert.equal(report.facts.street,'Chodowieckistr.');
  assert.equal(report.facts.locationPrecision,'street');
});
