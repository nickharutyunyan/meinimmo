import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { parseListing } from '../lib/listing-parser.ts';
import { financeFootnote } from '../lib/i18n.ts';
import { localizedWarnings } from '../lib/report-copy.ts';

const PARSE_BUDGET_MS = 80;
const LISTING_BUDGET_MS = 200;

function stable(report) {
  const { id, createdAt, evidence, ...rest } = report;
  return rest;
}

function largestListing() {
  const directory = new URL('./fixtures/listings/', import.meta.url);
  const files = readdirSync(directory).filter(name => name.endsWith('.html'));
  let best = { name: '', bytes: 0 };
  for (const name of files) {
    const bytes = statSync(new URL(name, directory)).size;
    if (bytes > best.bytes) best = { name, bytes };
  }
  const html = readFileSync(new URL(best.name, directory), 'utf8');
  const padded = html.length >= 300_000 ? html : `${html}\n${' '.repeat(300_000 - html.length)}`;
  return { name: best.name, html: padded, bytes: padded.length };
}

test('adversarial listing text stays inside the parse budget', () => {
  const attacks = [
    ['street tokens', `${'uweg '.repeat(100_000)}`],
    ['whitespace', ' '.repeat(500_000)],
    ['room words', `${'Zimmer '.repeat(70_000)}`],
    ['unterminated script', '<script '.repeat(25_000)],
    ['nested tags', '<span>'.repeat(12_000)],
    ['near street', `${'Hauptstraße '.repeat(40_000)}`],
    ['header words', `${'Aa weg '.repeat(60_000)}`],
  ];
  parseListing('<main><h1>Warmup Wohnung</h1><p>Kaufpreis 1 €</p></main>', 'warmup');
  for (const [label, input] of attacks) {
    assert.ok(input.length >= 70_000, label);
    parseListing(input, `https://example.test/${label}`);
    if (global.gc) global.gc();
    const started = performance.now();
    const report = parseListing(input, `https://example.test/${label}`);
    const elapsed = performance.now() - started;
    assert.equal(typeof report.address, 'string');
    assert.ok(elapsed < PARSE_BUDGET_MS, `${label} took ${elapsed.toFixed(1)} ms (${input.length} chars)`);
  }
});

test('ten parses of the largest listing match, stay in budget, and do not grow the heap', () => {
  assert.equal(typeof global.gc, 'function');
  const listing = largestListing();
  for (let warm = 0; warm < 3; warm += 1) parseListing(listing.html, 'https://example.test/warm');
  global.gc();
  const before = process.memoryUsage().heapUsed;
  let first;
  for (let run = 0; run < 10; run += 1) {
    const started = performance.now();
    const report = stable(parseListing(listing.html, 'https://example.test/repeat'));
    const elapsed = performance.now() - started;
    assert.ok(elapsed < LISTING_BUDGET_MS, `${listing.name} run ${run + 1} took ${elapsed.toFixed(1)} ms`);
    if (!first) first = report;
    else assert.deepEqual(report, first);
  }
  global.gc();
  const growth = process.memoryUsage().heapUsed - before;
  assert.ok(growth < 2 * 1024 * 1024, `heap grew by ${growth} bytes across 10 parses of ${listing.name}`);
});

test('house financing copy does not mention Hausgeld or a rented unit', () => {
  for (const locale of ['en', 'de']) {
    const house = financeFootnote('house', locale);
    const flat = financeFootnote('flat', locale);
    assert.doesNotMatch(house, /Hausgeld|rented unit|vermieteten Wohnungen/i);
    assert.match(flat, /Hausgeld/);
    assert.doesNotMatch(`${house}\n${flat}`, /ImmoScout|Ohne-Makler|ohne-makler/i);
  }
  const warnings = localizedWarnings({ qualityWarnings: ['The house is rented but no verified yield was extracted.'], facts: {} }, 'de');
  assert.equal(warnings[0], 'Das Haus ist vermietet, aber es wurde keine verlässliche Renditeangabe gefunden.');
});
