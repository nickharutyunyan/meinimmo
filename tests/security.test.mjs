import assert from 'node:assert/strict';
import test from 'node:test';
import { PASSWORD_ITERATIONS, hashPassword, hmacSha256Hex, normalizeEmail, publicListingUrl, safeReturnTo, validEmail, validPassword, validPasswordResetToken, verifyPassword, verifyStripeSignature } from '../lib/security.ts';

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

test('recovery emails and replacement passwords are validated before database use', () => {
  assert.equal(normalizeEmail('  Nick@Example.COM '), 'nick@example.com');
  assert.equal(validEmail('nick@example.com'), true);
  assert.equal(validEmail('nick@example.com\r\nBcc: attacker@example.com'), false);
  assert.equal(validEmail('not-an-email'), false);
  assert.equal(validPassword('safe-password-7'), true);
  assert.equal(validPassword('onlyletters'), false);
  assert.equal(validPasswordResetToken('A'.repeat(43)), true);
  assert.equal(validPasswordResetToken('short'), false);
  assert.equal(validPasswordResetToken(`${'A'.repeat(42)}!`), false);
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

test('listing imports accept public web URLs and reject private-network fetch targets', () => {
  assert.equal(publicListingUrl('https://www.immobilienscout24.de/expose/123')?.hostname, 'www.immobilienscout24.de');
  for (const unsafe of [
    'http://localhost/listing',
    'http://127.0.0.1/listing',
    'http://2130706433/listing',
    'http://10.2.3.4/listing',
    'http://169.254.169.254/latest/meta-data',
    'http://192.168.1.2/listing',
    'http://[::1]/listing',
    'http://[fd00::1]/listing',
    'https://user:password@example.com/listing',
    'https://example.com:8443/listing',
  ]) assert.equal(publicListingUrl(unsafe), undefined, unsafe);
});
