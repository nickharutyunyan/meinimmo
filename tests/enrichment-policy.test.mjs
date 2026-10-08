import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ENRICHMENT_RATE_LIMIT_LOG,
  enrichmentIsRateLimited,
  enrichmentPaused,
  openRouterChatBody,
  pauseEnrichment,
  resetEnrichmentPause,
  runEnrichmentModels,
} from '../lib/enrichment-policy.ts';

test('a 429 or daily quota does not try another model', async () => {
  resetEnrichmentPause();
  const models = ['one', 'two', 'three'];
  const limited = [
    [429, ''],
    [402, '{"error":{"message":"insufficient credits"}}'],
    [403, 'Rate limit exceeded: free-models-per-day'],
    [503, 'daily quota exceeded'],
  ];
  for (const [status, body] of limited) {
    let calls = 0;
    const result = await runEnrichmentModels(models, async () => {
      calls += 1;
      return { ok: false, status, body };
    });
    assert.equal(result.outcome, 'rate_limited', body || String(status));
    assert.equal(calls, 1, body || String(status));
  }
  assert.equal(enrichmentIsRateLimited(500, 'upstream exploded'), false);
  let calls = 0;
  const recovered = await runEnrichmentModels(models, async (model) => {
    calls += 1;
    if (model === 'one') return { ok: false, status: 503, body: 'unavailable' };
    return { ok: true, status: 200, body: '', json: { choices: [{ message: { content: '{}' } }] } };
  });
  assert.equal(recovered.outcome, 'ok');
  assert.equal(calls, 2);
  const payload = openRouterChatBody('google/gemma-4-26b-a4b-it:free', [], 420);
  assert.equal(payload.model, 'google/gemma-4-26b-a4b-it:free');
  assert.equal(payload.provider.allow_fallbacks, false);
  assert.equal(Object.hasOwn(payload, 'models'), false);
  pauseEnrichment(1_000, 5_000);
  assert.equal(enrichmentPaused(1_000), true);
  assert.equal(enrichmentPaused(6_000), false);
  resetEnrichmentPause();
  assert.equal(enrichmentPaused(), false);
});

test('the assess path logs a quota once and returns the parsed report', async () => {
  const assessment = await readFile(new URL('../lib/assessment.ts', import.meta.url), 'utf8');
  const fn = assessment.slice(assessment.indexOf('export async function enrichAssessment'), assessment.indexOf('export const enrichOnlyWhenNeeded'));
  const pauseAt = fn.indexOf('enrichmentPaused()');
  const linesAt = fn.indexOf('htmlToLines');
  const fetchAt = fn.indexOf('openrouter.ai');
  assert.ok(pauseAt >= 0 && pauseAt < linesAt && pauseAt < fetchAt);
  assert.equal(fn.split('ENRICHMENT_RATE_LIMIT_LOG').length, 2);
  assert.match(fn, /pauseEnrichment\(\)/);
  assert.match(fn, /outcome === 'rate_limited'/);
  assert.match(fn, /return refreshDerivedReport\(fallback\)/);
  assert.doesNotMatch(fn, /allow_fallbacks:\s*true/);
  const i18n = await readFile(new URL('../lib/i18n.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(`${i18n}\n${ENRICHMENT_RATE_LIMIT_LOG}`, /ImmoScout|Ohne-Makler/);
  assert.doesNotMatch(i18n, /OpenRouter|openrouter/);
});
