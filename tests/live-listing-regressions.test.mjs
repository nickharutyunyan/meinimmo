import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseListing, htmlToLines, looksLikePropertyListing } from '../lib/listing-parser.ts';
import { reportTitle, resolveLocation } from '../lib/display.ts';

const source = id => readFileSync(new URL(`./fixtures/listings/ohne-makler-${id}.html`, import.meta.url), 'utf8');
const parse = id => parseListing(source(id), `https://www.ohne-makler.net/immobilie/${id}/`);

test('real Berlin listing excludes seller contact/navigation from title and condition', () => {
  const r = parse('496161');
  assert.equal(r.facts.city, 'Berlin');
  assert.equal(r.facts.district, 'Neu-Hohenschönhausen');
  assert.equal(r.facts.street, undefined);
  assert.equal(r.facts.year, '1987');
  assert.equal(r.facts.tenancy, 'Occupancy unclear');
  assert.match(r.summary, /occupants remain/);
  assert.equal(r.facts.condition, 'Needs modernization');
  assert.equal(reportTitle(r), '3-room flat · Neu-Hohenschönhausen');
  assert.doesNotMatch(resolveLocation(r).mapQuery, /Verkäufer/);
  assert.ok(!htmlToLines(source('496161')).some(line => /Nachricht an Verkäufer/.test(line)));
});

test('real Adlershof listing retains its precise address and property facts', () => {
  const r = parse('471956');
  assert.equal(r.facts.street, 'Dörpfeldstraße 5');
  assert.equal(r.facts.price, 172000);
  assert.equal(r.facts.area, 30);
  assert.equal(r.facts.year, '2017');
  assert.equal(r.facts.availabilityDate, '2026-11-01');
  assert.equal(r.facts.housegeld, 197);
  assert.equal(r.facts.housegeldYear, '2025');
  assert.equal(r.facts.buyerCosts, 13105);
  assert.equal(r.facts.totalCost, 185104);
});

test('old contact-text street values cannot leak into a title or map', () => {
  const r = parse('496161');
  r.facts.street = 'den Verkäufer';
  r.address = 'den Verkäufer, 13058 Berlin';
  assert.doesNotMatch(reportTitle(r), /Verkäufer/);
  assert.doesNotMatch(resolveLocation(r).mapQuery, /Verkäufer/);
});

test('new Buckow listing flags contradictory room counts rather than inventing a title', () => {
 const r = parse('501591');
 assert.equal(r.facts.rooms, 'not stated');
 assert.equal(r.facts.area, 61.7);
 assert.equal(r.facts.price, 228000);
 assert.equal(r.facts.district, 'Buckow');
 assert.match(r.qualityWarnings.join(' '), /conflicting room counts/);
 assert.ok(!r.facts.features.includes('Garten'));
 assert.match(r.qualityWarnings.join(' '), /energy class/);
});
test('new Wilmersdorf listing retains the more precise raised-ground floor', () => {
 const r = parse('501600');
 assert.equal(r.facts.floor, 'Hochparterre');
 assert.equal(r.facts.condition, 'Renovated');
 assert.equal(r.facts.price, 395000);
 assert.equal(r.facts.housegeld, 256);
 assert.equal(r.facts.neighborhood.parkMentioned, false);
});
test('commercial rental is not accepted as a residential purchase', () => {
 assert.equal(looksLikePropertyListing(source('495026')), false);
});

test('new City-West listing does not confuse the building’s raised ground with the unit floor', () => {
 const r = parse('501514');
 assert.equal(r.facts.floor, '1. OG');
 assert.equal(r.facts.street, 'Düsseldorfer Straße 38b');
 assert.equal(r.facts.rooms, '2,5');
 assert.equal(r.facts.price, 420000);
 assert.equal(r.facts.buyerCosts, 30934);
 assert.equal(r.facts.housegeld, 347);
});


test('German and English numeric formatting retain identical purchase facts', () => {
  for (const [price, area, demand, fees] of [
    ['395.000,00', '62,21', '145,7', '256,50'],
    ['395,000.00', '62.21', '145.7', '256.50'],
  ]) {
    const r = parseListing(`Apartment for sale in Berlin
10709 Berlin
Purchase price: ${price} EUR
Living area: ${area} sqm
Rooms: 2
Year of construction: 1938
Final energy demand: ${demand} kWh
Community fees: ${fees} EUR`, 'QA number formats');
    assert.equal(r.facts.price, 395000);
    assert.equal(r.facts.area, 62.21);
    assert.equal(r.facts.energyDemand, 145.7);
    assert.equal(r.facts.housegeld, 256.5);
  }
});
