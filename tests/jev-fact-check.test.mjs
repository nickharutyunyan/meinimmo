import assert from 'node:assert/strict';
import test from 'node:test';
import { parseListing } from '../lib/listing-parser.ts';
import { jevFactCandidates, jevFactCheckRequest, jevFactFields, JEV_MAX_SOURCE_CHARS, parseJevFactReview } from '../lib/jev-fact-check.ts';
import { requestJev } from '../lib/jev-client.ts';
import { jevVerificationFlow } from '../lib/jev-verification-flow.ts';

const source = `3-Zimmer-Wohnung in Berlin\nAdresse: Beispielstraße 12, 10405 Berlin\nKaufpreis: 520.000 €\nWohnfläche: 85 m²\nZimmer: 3\nBaujahr: 1900\nObjektzustand: saniert\nDie Wohnung ist vermietet.\nHausgeld: 350 €\nEtage: 2. OG\nHeizungsart: Zentralheizung\nEnergieeffizienzklasse: D`;
const report = parseListing(source, 'test.pdf');
function acceptedResponse() {
  const candidates = jevFactCandidates(report);
  return { model: 'jev-test', answers: Object.fromEntries(jevFactFields.map(field => [field, {
    type: 'choice', choice: candidates[field] === null ? 'absent' : 'supported', confidence: 0.99,
  }])) };
}

test('Jev verification uses original source, not generated conclusions or private metadata', () => {
  const request = jevFactCheckRequest({ ...report, summary: 'A secret note must not be sent.', id: 'private-id' }, source);
  assert.ok(request.state.source.includes('Die Wohnung ist vermietet.'));
  assert.equal(request.state.candidates.price, 520000);
  assert.doesNotMatch(JSON.stringify(request), /secret note|private-id/);
  assert.equal(Object.keys(request.questions).length, 26);
  assert.equal(jevFactCheckRequest(report, 'too short'), undefined);
  assert.equal(jevFactCheckRequest(report, 'x'.repeat(JEV_MAX_SOURCE_CHARS + 1)), undefined);
});

test('only every confidently supported fact or truly absent value can pass', () => {
  assert.equal(parseJevFactReview(acceptedResponse(), report).accepted, true);
  for (const verdict of ['contradicted', 'uncertain', 'absent']) {
    const response = acceptedResponse();
    response.answers.price.choice = verdict;
    assert.deepEqual(parseJevFactReview(response, report).needsReview, ['price']);
  }
  const low = acceptedResponse();
  low.answers.price.confidence = 0.89;
  assert.equal(parseJevFactReview(low, report).accepted, false);
  const invented = acceptedResponse();
  invented.answers.availabilityDate.choice = 'supported';
  assert.deepEqual(parseJevFactReview(invented, report).needsReview, ['availabilityDate']);
});

test('malformed, missing, extra-enum and nonfinite answers never mark a report verified', () => {
  for (const malformed of [null, {}, { model: 'x', answers: {} }]) assert.equal(parseJevFactReview(malformed, report), undefined);
  for (const patch of [{ type: 'score' }, { choice: 'yes' }, { confidence: NaN }, { confidence: Infinity }, { confidence: -1 }, { confidence: '0.99' }]) {
    const response = acceptedResponse();
    Object.assign(response.answers.price, patch);
    assert.equal(parseJevFactReview(response, report), undefined);
  }
  const before = structuredClone(report);
  parseJevFactReview(acceptedResponse(), report);
  assert.deepEqual(report, before);
});

test('Jev transport handles timeout and HTTP error without leaking response contents', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('private provider response', { status: 503 });
    await assert.rejects(requestJev({}, 'dummy'), /^Error: Jev request failed \(503\)$/);
    globalThis.fetch = async (_, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    await assert.rejects(requestJev({}, 'dummy', 10), { name: 'AbortError' });
  } finally { globalThis.fetch = original; }
});

test('successful Jev review skips the text-generating fact checker', async () => {
  let fallbackCalls = 0;
  const reviewed = await jevVerificationFlow(report, source, 1000, {
    enabled: true,
    request: async () => acceptedResponse(),
    fallback: async candidate => { fallbackCalls++; return candidate; },
  });
  assert.equal(fallbackCalls, 0);
  assert.equal(reviewed.aiFactChecked, true);
  assert.equal(reviewed.aiLocationChecked, true);
  assert.deepEqual(reviewed.facts, report.facts);
});

test('uncertain/missing/error/disabled cases keep fallback and never reuse stale verified flags', async () => {
  const rejected = acceptedResponse();
  rejected.answers.price = { type: 'choice', choice: 'contradicted', confidence: 0.99 };
  for (const [enabled, response] of [[true, rejected], [true, {}], [true, new Error('failure')], [false, acceptedResponse()]]) {
    let requests = 0;
    let fallbackCalls = 0;
    const result = await jevVerificationFlow({ ...report, aiFactChecked: true, aiLocationChecked: true }, source, 1000, {
      enabled,
      request: async () => { requests++; if (response instanceof Error) throw response; return response; },
      fallback: async (candidate, text, budget) => {
        fallbackCalls++;
        assert.equal(candidate.aiFactChecked, false);
        assert.equal(candidate.aiLocationChecked, false);
        assert.ok(budget > 0 && budget <= 1000);
        assert.equal(text, source);
        return candidate;
      },
    });
    assert.equal(fallbackCalls, 1);
    assert.equal(requests, enabled ? 1 : 0);
    assert.equal(result.aiFactChecked, false);
  }
});

test('source over budget is not truncated or sent to Jev', async () => {
  let requests = 0;
  let fallbacks = 0;
  await jevVerificationFlow(report, 'x'.repeat(JEV_MAX_SOURCE_CHARS + 1), 1000, {
    enabled: true,
    request: async () => { requests++; return acceptedResponse(); },
    fallback: async candidate => { fallbacks++; return candidate; },
  });
  assert.equal(requests, 0);
  assert.equal(fallbacks, 1);
});
