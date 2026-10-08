import assert from 'node:assert/strict';
import test from 'node:test';
import { LISTING_IMAGE_HOSTS } from '../lib/listing-image-hosts.ts';
import { applySecurityHeaders, securityHeaders } from '../lib/security-headers.ts';

const ROUTES = ['/', '/de', '/guide', '/r/59531030123f2eba'];

function headerMap(headers) {
  const values = new Map();
  for (const { key } of securityHeaders) values.set(key.toLowerCase(), headers.get(key));
  return values;
}

test('asset and report-cache responses carry the same security headers Next sets', () => {
  const asset = new Headers();
  applySecurityHeaders(asset);
  const cacheHit = new Headers({ 'cache-control': 'private, no-store', 'content-type': 'text/html; charset=utf-8' });
  applySecurityHeaders(cacheHit);
  const nextRendered = new Headers();
  for (const { key, value } of securityHeaders) nextRendered.set(key, value);

  const expected = headerMap(nextRendered);
  for (const route of ROUTES) {
    assert.equal(route.startsWith('/'), true);
    assert.deepEqual(headerMap(asset), expected, route);
    assert.deepEqual(headerMap(cacheHit), expected, route);
  }
  const csp = asset.get('content-security-policy');
  assert.equal(csp, securityHeaders.find(header => header.key === 'Content-Security-Policy').value);
  assert.match(csp, /script-src[^;]*'unsafe-inline'/);
  assert.match(csp, /https:\/\/www\.googletagmanager\.com/);
  assert.doesNotMatch(csp, /nonce-/);
  for (const host of LISTING_IMAGE_HOSTS) assert.ok(csp.includes(host), host);
  assert.equal(asset.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
  assert.equal(asset.get('x-frame-options'), 'DENY');
  assert.equal(asset.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(asset.get('x-content-type-options'), 'nosniff');
  assert.equal(asset.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
});
