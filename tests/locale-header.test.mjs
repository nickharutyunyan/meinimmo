import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONTENT_SECURITY_POLICY } from '../lib/content-security-policy.ts';

function sources(csp, name) {
  const part = csp.split(';').map(item => item.trim()).find(item => item === name || item.startsWith(`${name} `));
  assert.ok(part, name);
  return part.slice(name.length).trim().split(/\s+/).filter(Boolean);
}

test('one CSP covers every locale and allows only the GA4 hosts the tag uses', async () => {
  const config = await readFile(new URL('../next.config.ts', import.meta.url), 'utf8');
  assert.equal([...config.matchAll(/Content-Security-Policy/g)].length, 1);
  assert.match(config, /source:\s*'\/\(\.\*\)'/);
  assert.match(config, /CONTENT_SECURITY_POLICY/);
  assert.equal([...config.matchAll(/script-src/g)].length, 0);
  const csp = CONTENT_SECURITY_POLICY;
  assert.ok(csp);

  const script = sources(csp, 'script-src');
  const connect = sources(csp, 'connect-src');
  const img = sources(csp, 'img-src');
  assert.ok(script.includes('https://www.googletagmanager.com'));
  for (const host of [
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://*.google-analytics.com',
    'https://analytics.google.com',
    'https://*.analytics.google.com',
  ]) {
    assert.ok(connect.includes(host), host);
    assert.ok(img.includes(host), host);
  }

  for (const blocked of ['doubleclick.net', 'cloudflareinsights.com', 'googlesyndication.com', 'googleadservices.com', 'pagead2']) {
    assert.equal(csp.includes(blocked), false, blocked);
  }
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /frame-src 'self' https:\/\/www\.openstreetmap\.org https:\/\/\*\.stripe\.com/);
  assert.match(csp, /worker-src 'self' blob: https:\/\/cdnjs\.cloudflare\.com/);
  assert.doesNotMatch(csp, /frame-src[^;]*googletagmanager/);
});

test('country picker width follows the selected label in English and German', async () => {
  const css = await readFile(new URL('../app/countries.css', import.meta.url), 'utf8');
  const component = await readFile(new URL('../components/CountrySwitch.tsx', import.meta.url), 'utf8');
  assert.match(component, /className="country-switch-value" aria-hidden="true">\{label\(country\)\}/);
  assert.match(component, /locale === 'de' && code === 'DE' \? 'Deutschland'/);
  assert.match(css, /\.country-switch\s*\{[^}]*display:\s*inline-grid/);
  assert.match(css, /\.country-switch-value\s*\{[^}]*visibility:\s*hidden;[^}]*white-space:\s*nowrap/);
  assert.match(css, /\.country-switch select\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0/);
  assert.doesNotMatch(css, /country-switch[^{]*\{[^}]*max-width/);
  assert.match(css, /\.country-switch svg\s*\{[^}]*top:\s*50%;[^}]*transform:\s*translateY\(-50%\)/);
});
