import assert from 'node:assert/strict';
import test from 'node:test';
import { createBoundedMap } from '../lib/bounded-cache.ts';

test('a full cache refuses new keys and keeps the entries it already holds', () => {
  const cache = createBoundedMap(3);
  assert.equal(cache.set('a', 1), true);
  assert.equal(cache.set('b', 2), true);
  assert.equal(cache.set('c', 3), true);
  assert.equal(cache.size, cache.max);
  assert.equal(cache.set('d', 4), false);
  assert.equal(cache.size, 3);
  assert.equal(cache.has('d'), false);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.set('a', 9), true);
  assert.equal(cache.get('a'), 9);
  assert.equal(cache.size, 3);
  assert.equal(cache.delete('b'), true);
  assert.equal(cache.set('d', 4), true);
  assert.equal(cache.size, 3);
});
