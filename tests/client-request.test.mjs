import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJson } from '../lib/client-request.ts';

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
 } finally { globalThis.fetch = original; }
});
