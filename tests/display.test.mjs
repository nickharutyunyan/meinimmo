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

test('drops a bogus zero house number without losing the street', () => {
  const report = { ...base, address: 'Musterstraße 0, 10115 Berlin' };
  assert.equal(reportTitle(report), '3-room flat · Musterstraße');
  assert.equal(reportSubtitle(report), 'Musterstraße, 10115 Berlin');
  assert.equal(resolveLocation(report).mapQuery, 'Musterstraße, 10115 Berlin, Germany');
});

test('canonicalizes tracking variants for duplicate detection', () => {
  assert.equal(canonicalSource('https://Example.com/home/42/?utm_source=mail#details'), 'https://example.com/home/42');
});
