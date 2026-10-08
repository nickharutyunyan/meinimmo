import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalSource, reportNeighborhood, reportSubtitle, reportTitle, reportTitleLocation, resolveLocation } from '../lib/display.ts';

const base = {
  title: '', source: 'test', propertyType: 'flat', address: 'Address not stated', location: 'Prenzlauer Berg',
  facts: { rooms: '3', area: 81, year: '1908', city: 'Berlin', district: 'Prenzlauer Berg' },
};

test('uses a factual neighborhood in the title and keeps the city in the subtitle', () => {
  assert.equal(reportTitle(base), '3-room flat · Prenzlauer Berg');
  assert.equal(reportTitleLocation(base, 'de'), 'Prenzlauer Berg');
  assert.equal(reportTitle(base, 'de'), '3-Zimmer-Wohnung · Prenzlauer Berg');
  assert.equal(reportSubtitle(base), 'Prenzlauer Berg, Berlin');
  assert.doesNotMatch(reportTitle(base), /not stated|unknown|couldn.t find/i);
});

test('returns a clean neighborhood separately for comparisons', () => {
  assert.equal(reportNeighborhood(base), 'Prenzlauer Berg');
  assert.equal(reportNeighborhood({ ...base, location: 'Mitte Mitte', facts: { ...base.facts, district: 'Mitte Mitte' } }), 'Mitte');
  assert.equal(reportNeighborhood({ ...base, location: 'Berlin', facts: { ...base.facts, district: undefined } }), '');
});

test('cleans sales claims and postal codes from an exact-address title', () => {
  const report = { ...base, address: 'Provisionsfrei Stockholmer Straße 30, 13359 Berlin' };
  const location = resolveLocation(report);
  assert.equal(reportTitle(report), '3-room flat · Stockholmer Straße 30');
  assert.equal(reportSubtitle(report), 'Stockholmer Straße 30, 13359 Berlin');
  assert.equal(location.mapQuery, 'Stockholmer Straße 30, 13359 Berlin, Germany');
  assert.equal(location.exact, true);
});

test('falls back to area for a house without a room count', () => {
  const report = { ...base, propertyType: 'house', address: 'Address not stated', location: 'Krämpfervorstadt', facts: { ...base.facts, rooms: 'not stated', area: 126, city: 'Erfurt', district: 'Krämpfervorstadt' } };
  assert.equal(reportTitle(report), '126 m² house · Krämpfervorstadt');
  assert.equal(reportTitle(report, 'de'), '126 m² Haus · Krämpfervorstadt');
});

test('uses a named transit stop only when no address, postal area or neighborhood exists', () => {
  const report = { ...base, address: 'Address not stated', location: 'Berlin', facts: { ...base.facts, district: undefined, postalCode: undefined, transitStop: 'Südkreuz' } };
  assert.equal(reportTitle(report), '3-room flat · near Südkreuz');
  assert.equal(reportTitle(report, 'de'), '3-Zimmer-Wohnung · bei Südkreuz');
  assert.equal(resolveLocation(report).basis, 'transit stop');
});

test('always keeps the best available factual place in the report title', () => {
  const cityOnly = { ...base, address: 'Address not stated', location: 'Berlin', facts: { ...base.facts, district: undefined, postalCode: undefined, transitStop: undefined } };
  assert.equal(reportTitle(cityOnly), '3-room flat · Berlin');
  assert.equal(resolveLocation(cityOnly).basis, 'city');
});

test('never exposes a postal code as the title location', () => {
  const postalOnly = {
    ...base,
    address: 'Address not stated',
    location: '10437 Berlin',
    facts: { ...base.facts, district: undefined, postalCode: '10437', locationPrecision: 'postal' },
  };
  assert.equal(reportTitle(postalOnly), '3-room flat · Berlin');
  assert.equal(reportTitle(postalOnly, 'de'), '3-Zimmer-Wohnung · Berlin');
  assert.equal(reportSubtitle(postalOnly), '10437 Berlin');
  assert.doesNotMatch(reportTitle(postalOnly), /\d{5}/);
});

test('uses the resolved neighborhood instead of its source postal code', () => {
  const resolved = {
    ...base,
    address: 'Address not stated',
    location: 'Prenzlauer Berg',
    facts: { ...base.facts, district: 'Prenzlauer Berg', postalCode: '10437', locationPrecision: 'neighborhood' },
  };
  assert.equal(reportTitle(resolved), '3-room flat · Prenzlauer Berg');
  assert.doesNotMatch(reportTitle(resolved), /10437/);
});

test('drops a bogus zero house number without losing the street', () => {
  const report = { ...base, address: 'Musterstraße 0, 10115 Berlin' };
  assert.equal(reportTitle(report), '3-room flat · Musterstraße');
  assert.equal(reportSubtitle(report), 'Musterstraße, 10115 Berlin');
  assert.equal(resolveLocation(report).mapQuery, 'Musterstraße, 10115 Berlin, Germany');
});

test('uses a stated street cleanly in the title without implying a house number', () => {
  const report = { ...base, address: 'Address not stated', facts: { ...base.facts, district: undefined, postalCode: '10439', street: 'Danziger Straße', locationPrecision: 'street' } };
  assert.equal(reportTitle(report), '3-room flat · Danziger Straße');
  assert.equal(reportTitle(report, 'de'), '3-Zimmer-Wohnung · Danziger Straße');
  assert.equal(reportSubtitle(report), 'Danziger Straße, 10439 Berlin');
});

test('canonicalizes tracking variants for duplicate detection', () => {
  assert.equal(canonicalSource('https://Example.com/home/42/?utm_source=mail#details'), 'https://example.com/home/42');
});

test('removes repeated neighborhoods and street phrases from titles', () => {
  const district = { ...base, location: 'Mitte Mitte', facts: { ...base.facts, district: 'Mitte Mitte' } };
  assert.equal(reportTitle(district), '3-room flat · Mitte');
  const street = { ...base, address: 'Danziger Straße Danziger Straße 89, 10405 Berlin', facts: { ...base.facts, district: undefined, street: 'Danziger Straße Danziger Straße 89', locationPrecision: 'address' } };
  assert.equal(reportTitle(street), '3-room flat · Danziger Straße 89');
});

test('does not treat a town-only address as a street in English or German', () => {
  const house = {
    title: '', source: 'test', propertyType: 'house', address: 'Erfde', location: 'Erfde',
    facts: { rooms: '4', area: 126, year: '1998', city: 'Erfde', street: ' erfde ' },
  };
  const location = resolveLocation(house);
  assert.equal(location.basis, 'city');
  assert.equal(location.mapQuery, 'Erfde, Germany');
  assert.equal(location.mapLabel, 'Erfde');
  assert.equal(reportTitle(house), '4-room house · Erfde');
  assert.equal(reportTitle(house, 'de'), '4-Zimmer-Haus · Erfde');
  assert.equal(reportSubtitle(house), 'Erfde');
  assert.doesNotMatch(location.mapQuery, /Erfde\s+Erfde/i);
  assert.doesNotMatch(location.mapLabel, /Erfde\s+Erfde/i);

  const withDistrict = { ...house, facts: { ...house.facts, district: 'Bargen', street: 'Erfde' } };
  const districtLocation = resolveLocation(withDistrict);
  assert.equal(districtLocation.basis, 'neighborhood');
  assert.equal(districtLocation.mapLabel, 'Bargen, Erfde');
  assert.equal(reportTitle(withDistrict), '4-room house · Bargen');
  assert.equal(reportTitle(withDistrict, 'de'), '4-Zimmer-Haus · Bargen');
  assert.doesNotMatch(districtLocation.mapQuery, /Erfde\s+Erfde/i);
  assert.doesNotMatch(districtLocation.mapLabel, /Erfde\s+Erfde/i);
});

test('uses only property type when both rooms and area are unavailable', () => {
  const report = { ...base, propertyType: 'house', facts: { ...base.facts, rooms: 'not stated', area: 0, year: '2024' } };
  assert.equal(reportTitle(report), 'House · Prenzlauer Berg');
  assert.doesNotMatch(reportTitle(report), /2024-built/);
});

test('omits an unknown room count from English and German titles', () => {
  const unknowns = ['not stated', 'not  stated', 'not\u00a0stated', 'k.A.', 'k. A.', 'keine Angabe', 'nicht angegeben', 'n/a', '—', '0', ''];
  for (const rooms of unknowns) {
    const report = { ...base, facts: { ...base.facts, rooms } };
    assert.equal(reportTitle(report), '81 m² flat · Prenzlauer Berg', JSON.stringify(rooms));
    assert.equal(reportTitle(report, 'de'), '81 m² Wohnung · Prenzlauer Berg', JSON.stringify(rooms));
    assert.doesNotMatch(reportTitle(report), /room/i);
    assert.doesNotMatch(reportTitle(report, 'de'), /Zimmer/);
  }
  const counted = { ...base, facts: { ...base.facts, rooms: '2,5' } };
  assert.equal(reportTitle(counted), '2.5-room flat · Prenzlauer Berg');
  assert.equal(reportTitle(counted, 'de'), '2,5-Zimmer-Wohnung · Prenzlauer Berg');
});

test('shows a town once in the title and the map label', () => {
  const street = {
    ...base,
    address: 'Uthmannstr. 13, Reinbek',
    location: 'Reinbek',
    facts: { ...base.facts, city: 'Reinbek', district: undefined, street: 'Uthmannstr. 13, Reinbek' },
  };
  const streetLocation = resolveLocation(street);
  assert.equal(streetLocation.basis, 'street');
  assert.equal(streetLocation.mapLabel, 'Uthmannstr. 13, Reinbek');
  assert.equal(reportTitle(street), '3-room flat · Uthmannstr. 13, Reinbek');
  assert.equal(reportTitle(street, 'de'), '3-Zimmer-Wohnung · Uthmannstr. 13, Reinbek');
  assert.equal(reportSubtitle(street), 'Uthmannstr. 13, Reinbek');
  assert.doesNotMatch(`${streetLocation.mapLabel} ${reportTitle(street)}`, /Reinbek\s+Reinbek/i);

  const doubled = { ...street, address: 'Uthmannstr. 13, Reinbek Reinbek' };
  assert.equal(resolveLocation(doubled).mapLabel, 'Uthmannstr. 13, Reinbek');
  assert.equal(reportTitle(doubled), '3-room flat · Uthmannstr. 13, Reinbek');

  const town = { ...street, address: 'Reinbek, Reinbek', location: 'Reinbek Reinbek', facts: { ...street.facts, street: 'Reinbek' } };
  const townLocation = resolveLocation(town);
  assert.equal(townLocation.basis, 'city');
  assert.equal(townLocation.mapLabel, 'Reinbek');
  assert.equal(reportTitle(town), '3-room flat · Reinbek');
  assert.equal(reportTitle(town, 'de'), '3-Zimmer-Wohnung · Reinbek');

  const named = { ...street, address: 'Am Reinbek', facts: { ...street.facts, street: 'Am Reinbek' } };
  assert.equal(resolveLocation(named).mapLabel, 'Am Reinbek');
  assert.equal(reportTitle(named), '3-room flat · Am Reinbek');
});
