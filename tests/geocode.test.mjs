import assert from 'node:assert/strict';
import test from 'node:test';
import { neighborhoodFromAddress } from '../lib/geocode.ts';

test('selects the most precise factual OpenStreetMap neighborhood', () => {
  assert.equal(neighborhoodFromAddress({ suburb: 'Prenzlauer Berg', borough: 'Pankow', city: 'Berlin' }, 'Berlin'), 'Prenzlauer Berg');
  assert.equal(neighborhoodFromAddress({ quarter: 'Südvorstadt', city: 'Leipzig' }, 'Leipzig'), 'Südvorstadt');
});

test('does not mistake a city or postcode for a neighborhood', () => {
  assert.equal(neighborhoodFromAddress({ suburb: 'Berlin', borough: 'Berlin' }, 'Berlin'), '');
  assert.equal(neighborhoodFromAddress({ neighbourhood: '10437' }, 'Berlin'), '');
});
