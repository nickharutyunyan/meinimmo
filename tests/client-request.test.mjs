import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJson, shownRequestError } from '../lib/client-request.ts';
import { listingImportStatus } from '../lib/listing-fetch.ts';

test('network errors, non-JSON proxy errors and hung requests settle instead of spinning forever', async () => {
 const original = globalThis.fetch;
 try {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(requestJson('/test', {}), /fetch/);
  globalThis.fetch = async () => new Response('<html>502</html>', {status:502});
  await assert.rejects(requestJson('/test', {}), SyntaxError);
  globalThis.fetch = () => new Promise(() => {});
  await assert.rejects(requestJson('/test', {}, 10), /request_timeout/);
  globalThis.fetch = async () => Response.json({id:'ok'});
  assert.equal((await requestJson('/test', {})).data.id, 'ok');
  globalThis.fetch = async () => Response.json({ error: 'The listing portal took too long to respond. Try again or upload its Exposé.' }, { status: 504 });
  const timedOut = await requestJson('/test', {});
  assert.equal(timedOut.response.status, 504);
  assert.equal(shownRequestError(timedOut.data.error, 'fallback'), 'The listing portal took too long to respond. Try again or upload its Exposé.');
  globalThis.fetch = async () => Response.json({ error: 'Das Portal hat nicht rechtzeitig geantwortet. Versuche es erneut oder lade das Exposé hoch.' }, { status: 504 });
  const timedOutDe = await requestJson('/test', {});
  assert.equal(shownRequestError(timedOutDe.data.error, 'fallback'), 'Das Portal hat nicht rechtzeitig geantwortet. Versuche es erneut oder lade das Exposé hoch.');
 } finally { globalThis.fetch = original; }
});

test('a portal timeout is HTTP 504 and other import failures keep their statuses', () => {
  assert.equal(listingImportStatus('timeout'), 504);
  assert.equal(listingImportStatus('too_large'), 413);
  assert.equal(listingImportStatus('blocked'), 422);
  assert.equal(listingImportStatus('unavailable'), 422);
  assert.equal(shownRequestError('request_timeout', 'The connection failed.'), 'The connection failed.');
});
