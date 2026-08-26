import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalSource, reportSubtitle, reportTitle, resolveLocation } from '../lib/display.ts';

const base = {
  title: '', source: 'test', propertyType: 'flat', address: 'Address not stated', location: 'Prenzlauer Berg',
  facts: { rooms: '3', area: 81, year: '1908', city: 'Berlin', district: 'Prenzlauer Berg' },
};

test('uses a factual neighborhood in the title and keeps the city in the subtitle', () => {
  assert.equal(reportTitle(base), '3-room flat · Prenzlauer Berg');
  assert.equal(reportTitle(base, 'de'), '3-Zimmer-Wohnung · Prenzlauer Berg');
  assert.equal(reportSubtitle(base), 'Prenzlauer Berg, Berlin');
  assert.doesNotMatch(reportTitle(base), /not stated|unknown|couldn.t find/i);
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

test('canonicalizes tracking variants for duplicate detection', () => {
  assert.equal(canonicalSource('https://Example.com/home/42/?utm_source=mail#details'), 'https://example.com/home/42');
});

test('removes repeated neighborhoods and street phrases from titles', () => {
  const district = { ...base, location: 'Mitte Mitte', facts: { ...base.facts, district: 'Mitte Mitte' } };
  assert.equal(reportTitle(district), '3-room flat · Mitte');
  const street = { ...base, address: 'Danziger Straße Danziger Straße 89, 10405 Berlin', facts: { ...base.facts, district: undefined, street: 'Danziger Straße Danziger Straße 89', locationPrecision: 'address' } };
  assert.equal(reportTitle(street), '3-room flat · Danziger Straße 89');
});

test('uses only property type when both rooms and area are unavailable', () => {
  const report = { ...base, propertyType: 'house', facts: { ...base.facts, rooms: 'not stated', area: 0, year: '2024' } };
  assert.equal(reportTitle(report), 'House · Prenzlauer Berg');
  assert.doesNotMatch(reportTitle(report), /2024-built/);
});
