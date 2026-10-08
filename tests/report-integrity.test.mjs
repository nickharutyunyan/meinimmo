import test from 'node:test';
import assert from 'node:assert/strict';
import { parseListing } from '../lib/listing-parser.ts';
import { reportConflicts, scoreAvailable, EXTRACTION_VERSION } from '../lib/report-integrity.ts';
import { guardEnrichment, openRouterFactCheckAccepted } from '../lib/verification-guard.ts';
import { fetchListing } from '../lib/listing-fetch.ts';

const source = '3-Zimmer-Wohnung in Berlin\n10115 Berlin\nKaufpreis: 400.000 €\nWohnfläche: 80 m²\nBaujahr: 1980\nZustand: gepflegt\nKaufnebenkosten: 30.000 €\nGesamtkosten: 430.000 €\nEnergieeffizienzklasse: C\nAusrichtung\nSüd\nDie U-Bahn ist 6 Gehminuten entfernt.';
test('source conflicts suppress the verdict even when AI flags claim verification', () => {
 const r = parseListing(source, 'test');
 assert.equal(scoreAvailable(r), true);
 r.facts.buyerCosts = 400000;
 r.aiFactChecked = r.aiLocationChecked = true;
 assert.equal(scoreAvailable(r), false);
 assert.match(reportConflicts(r).join(' '), /do not agree/);
 r.facts.buyerCosts = 30000;
 r.extractionVersion = 0;
 assert.equal(scoreAvailable(r), false);
 r.extractionVersion = EXTRACTION_VERSION;
 r.sourceUnavailable = true;
 assert.equal(scoreAvailable(r), false);
});
test('AI extraction cannot overwrite evidence or call partial output fully verified', () => {
 const original = parseListing(source, 'test');
 const proposed = structuredClone(original);
 proposed.facts.price = 123;
 proposed.facts.condition = 'New build';
 proposed.aiFactChecked = true;
 const result = guardEnrichment(original, proposed);
 assert.equal(result.facts.price, 400000);
 assert.equal(result.facts.condition, 'Well maintained');
 assert.equal(result.aiFactChecked, false);
 original.qualityWarnings = ['The listing gives conflicting room counts.'];
 assert.deepEqual(guardEnrichment(original, proposed).facts, original.facts);
});
test('a real successful check sets the fact-check flag only when evidenced facts stay intact', () => {
 const original = parseListing(source, 'test');
 const agreed = structuredClone(original);
 agreed.aiFactChecked = true;
 agreed.aiLocationChecked = true;
 const checked = guardEnrichment(original, agreed);
 assert.equal(checked.aiFactChecked, true);
 assert.equal(checked.aiLocationChecked, true);
 assert.equal(checked.facts.price, original.facts.price);

 const conflicted = structuredClone(original);
 conflicted.facts.buyerCosts = 400000;
 conflicted.aiFactChecked = true;
 assert.equal(guardEnrichment(conflicted, { ...conflicted, aiFactChecked: true }).aiFactChecked, false);

 const empty = openRouterFactCheckAccepted(original, {}, source);
 assert.equal(empty.facts, false);
 const disagreed = openRouterFactCheckAccepted(original, { factEvidence: { price: 'Kaufpreis: 123 €', propertyType: 'Wohnung', rooms: '3-Zimmer', area: '80 m²', condition: 'gepflegt', year: '1980', energy: 'Energieeffizienzklasse: C' } }, source);
 assert.equal(disagreed.facts, false);
 const accepted = openRouterFactCheckAccepted(original, {
  factEvidence: {
   propertyType: '3-Zimmer-Wohnung in Berlin',
   price: 'Kaufpreis: 400.000 €',
   rooms: '3-Zimmer-Wohnung',
   area: 'Wohnfläche: 80 m²',
   condition: 'Zustand: gepflegt',
   year: 'Baujahr: 1980',
   energy: 'Energieeffizienzklasse: C',
  },
  location: { city: 'Berlin', postalCode: '10115', evidence: '10115 Berlin' },
 }, source);
 assert.equal(accepted.facts, true);
 assert.equal(accepted.location, true);
});
test('listing importer bounds content and validates every redirect', async () => {
 await assert.rejects(fetchListing('https://example.com/listing', async () => new Response(null, {status:302,headers:{location:'http://127.0.0.1/'}})), /invalid/);
 await assert.rejects(fetchListing('https://example.com/listing', async () => new Response('denied', {status:403})), /blocked/);
 await assert.rejects(fetchListing('https://example.com/listing', async () => new Response('big', {headers:{'content-length':'2000001'}})), /too_large/);
 assert.equal(await fetchListing('https://example.com/listing', async () => new Response(source)), source);
});
