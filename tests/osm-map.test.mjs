import assert from 'node:assert/strict';
import test from 'node:test';
import { osmExploreHref, placeFromGeocodeResponse } from '../lib/osm-map.ts';

test('the OpenStreetMap link uses a pin when one exists and the address otherwise', () => {
  assert.equal(
    osmExploreHref({ lat: 54.316, lon: 9.316 }, 'Erfde, Germany'),
    'https://www.openstreetmap.org/?mlat=54.316&mlon=9.316#map=16/54.316/9.316',
  );
  assert.equal(
    osmExploreHref(null, 'Erfde, Germany'),
    'https://www.openstreetmap.org/search?query=Erfde%2C%20Germany',
  );
});

test('a geocode error or a body without coordinates drops the pin', () => {
  assert.equal(placeFromGeocodeResponse(403, { error: 'Invalid request origin.' }), null);
  assert.equal(placeFromGeocodeResponse(404, { error: 'Location not found.' }), null);
  assert.equal(placeFromGeocodeResponse(502, { error: 'Map location is temporarily unavailable.' }), null);
  assert.equal(placeFromGeocodeResponse(200, { label: 'Erfde' }), null);
  assert.deepEqual(placeFromGeocodeResponse(200, { lat: 54.316, lon: 9.316, label: 'Erfde' }), {
    lat: 54.316,
    lon: 9.316,
    label: 'Erfde',
  });
});
