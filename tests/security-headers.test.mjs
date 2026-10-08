import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { LISTING_IMAGE_HOSTS, LISTING_THUMBNAIL_HOSTS } from '../lib/listing-image-hosts.ts';
import { applySecurityHeaders, DIRECT_ASSET_PATHS, securityHeaders, staticAssetHeadersFile } from '../lib/security-headers.ts';
import { writeStaticAssetHeaders } from '../scripts/publish-static-pages.mjs';

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
  for (const host of [...LISTING_IMAGE_HOSTS, ...LISTING_THUMBNAIL_HOSTS]) assert.ok(csp.includes(host), host);
  assert.equal(asset.get('strict-transport-security'), 'max-age=31536000');
  assert.equal(asset.get('x-frame-options'), 'DENY');
  assert.equal(asset.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(asset.get('x-content-type-options'), 'nosniff');
  assert.equal(asset.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
});

test('assets that skip the worker publish HSTS and nosniff from the same header list', async () => {
  const transport = securityHeaders.find(header => header.key === 'Strict-Transport-Security');
  const sniffing = securityHeaders.find(header => header.key === 'X-Content-Type-Options');
  assert.equal(transport.value, 'max-age=31536000');
  assert.doesNotMatch(transport.value, /includeSubDomains/i);
  assert.equal(sniffing.value, 'nosniff');
  const file = staticAssetHeadersFile();
  for (const assetPath of DIRECT_ASSET_PATHS) {
    const pattern = assetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(file, new RegExp(`${pattern}\\n  ${transport.key}: ${transport.value}\\n  ${sniffing.key}: ${sniffing.value}`));
  }
  assert.doesNotMatch(file, /Content-Security-Policy|includeSubDomains|X-Frame-Options/);
  const wrangler = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  const skipped = wrangler.assets.run_worker_first.filter(rule => rule.startsWith('!')).map(rule => rule.slice(1));
  assert.deepEqual(skipped, [...DIRECT_ASSET_PATHS]);
  const root = await mkdtemp(path.join(tmpdir(), 'asset-headers-'));
  try {
    await writeStaticAssetHeaders(root);
    assert.equal(await readFile(path.join(root, '_headers'), 'utf8'), file);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts['build:worker'], /publish-static-pages\.mjs/);
});
