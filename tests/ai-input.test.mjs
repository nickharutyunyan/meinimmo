import assert from 'node:assert/strict';
import test from 'node:test';
import { listingAiExcerpt, MAX_AI_LISTING_CHARS, parseAiJson } from '../lib/ai-input.ts';

test('AI listing excerpts put decision-critical facts ahead of generic page copy', () => {
  const lines = Array.from({ length: 160 }, (_, index) => `Generic navigation and marketing line ${index} with plenty of filler content.`);
  lines.push('Adresse: Danziger Straße 89, 10405 Berlin');
  lines.push('Wohnfläche: 72 m²');
  lines.push('Energieeffizienzklasse: C');
  const excerpt = listingAiExcerpt(lines);
  assert.ok(excerpt.startsWith('Adresse: Danziger Straße 89, 10405 Berlin'));
  assert.match(excerpt, /Wohnfläche: 72 m²/);
  assert.match(excerpt, /Energieeffizienzklasse: C/);
  assert.ok(excerpt.length <= MAX_AI_LISTING_CHARS);
});

test('AI listing excerpts remove duplicate lines', () => {
  assert.equal(listingAiExcerpt(['Baujahr: 1910', 'Baujahr: 1910']), 'Baujahr: 1910');
});

test('AI JSON parsing tolerates reasoning wrappers and fenced output', () => {
  assert.deepEqual(parseAiJson('<think>Check { evidence }</think>Result:\n```json\n{"location":{"city":"Berlin"}}\n```'), {
    location: { city: 'Berlin' },
  });
});
