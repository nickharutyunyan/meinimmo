import assert from 'node:assert/strict';
import test from 'node:test';
import { PASSWORD_ITERATIONS, hashPassword, hmacSha256Hex, safeReturnTo, verifyPassword, verifyStripeSignature } from '../lib/security.ts';

test('production password hashing stays within the Cloudflare Web Crypto limit', () => {
  assert.equal(PASSWORD_ITERATIONS, 100_000);
});

test('password hashes are salted and verify without storing the password', async () => {
  const first = await hashPassword('correct-horse-7', 10_000);
  const second = await hashPassword('correct-horse-7', 10_000);
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await verifyPassword('correct-horse-7', first.salt, first.hash, first.iterations), true);
  assert.equal(await verifyPassword('wrong-horse-7', first.salt, first.hash, first.iterations), false);
});

test('Stripe signatures require a correct signature and a fresh timestamp', async () => {
  const payload = '{"id":"evt_test"}';
  const secret = 'whsec_test';
  const now = 1_800_000_000_000;
  const timestamp = String(now / 1000);
  const signature = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  assert.equal(await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, now), true);
  assert.equal(await verifyStripeSignature(`${payload}x`, `t=${timestamp},v1=${signature}`, secret, now), false);
  assert.equal(await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, now + 301_000), false);
});

test('OAuth return paths cannot leave this site', () => {
  assert.equal(safeReturnTo('/de/account?plan=pro'), '/de/account?plan=pro');
  assert.equal(safeReturnTo('//attacker.example'), '/account');
  assert.equal(safeReturnTo('https://attacker.example'), '/account');
  assert.equal(safeReturnTo('/account\r\nLocation: https://attacker.example'), '/account');
});
