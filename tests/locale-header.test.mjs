import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONTENT_SECURITY_POLICY } from '../lib/content-security-policy.ts';
import { copy } from '../lib/i18n.ts';

function sources(csp, name) {
  const part = csp.split(';').map(item => item.trim()).find(item => item === name || item.startsWith(`${name} `));
  assert.ok(part, name);
  return part.slice(name.length).trim().split(/\s+/).filter(Boolean);
}

test('one CSP covers every locale and allows only the GA4 hosts the tag uses', async () => {
  const config = await readFile(new URL('../next.config.ts', import.meta.url), 'utf8');
  const headerSource = await readFile(new URL('../lib/security-headers.ts', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../cloudflare/worker.mjs', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.equal([...config.matchAll(/security-headers\.ts/g)].length, 1);
  assert.match(config, /source:\s*'\/\(\.\*\)'/);
  assert.match(headerSource, /CONTENT_SECURITY_POLICY/);
  assert.match(worker, /applySecurityHeaders/);
  assert.equal([...config.matchAll(/script-src/g)].length, 0);
  const csp = CONTENT_SECURITY_POLICY;
  assert.ok(csp);
  assert.doesNotMatch(csp, /nonce-/);
  assert.match(csp, /script-src[^;]*'unsafe-inline'/);
  assert.match(layout, /https:\/\/www\.googletagmanager\.com\/gtag\/js/);
  assert.doesNotMatch(layout, /nonce=/);

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
  const countries = await readFile(new URL('../lib/countries.ts', import.meta.url), 'utf8');
  assert.match(component, /className="country-switch-value" aria-hidden="true">\{countryLabel\(country, locale\)\}/);
  assert.match(countries, /DE: 'Deutschland'/);
  assert.match(countries, /AM: 'Armenien'/);
  assert.match(countries, /US: 'USA'/);
  assert.match(countries, /CA: 'Kanada'/);
  assert.match(countries, /Land der Immobilie/);
  const theme = await readFile(new URL('../app/theme.css', import.meta.url), 'utf8');
  // The visible label sizes the control; the select is an invisible hit area on top,
  // so a font mismatch between the two can never clip the last letter again.
  assert.match(css, /\.country-switch-value\s*\{[^}]*white-space:\s*nowrap/);
  assert.doesNotMatch(css, /\.country-switch-value\s*\{[^}]*visibility:\s*hidden/);
  assert.match(css, /\.country-switch select\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*opacity:\s*0/);
  assert.doesNotMatch(theme, /\.country-switch select/);
  // On reports the switch lives in the top toolbar, never hidden at any width.
  const report = await readFile(new URL('../components/ReportView.tsx', import.meta.url), 'utf8');
  assert.match(report, /className="report-action-controls"><CountrySwitch locale=\{locale\}\/>/);
  assert.doesNotMatch(css, /\.country-switch[^{]*\{[^}]*display:\s*none/);
  assert.doesNotMatch(css, /country-switch[^{]*\{[^}]*max-width/);
  assert.match(css, /\.country-switch svg\s*\{[^}]*top:\s*50%;[^}]*transform:\s*translateY\(-50%\)/);
});

test('financing card opens simple and toggles the full calculation', async () => {
  const component = await readFile(new URL('../components/FinanceCalculator.tsx', import.meta.url), 'utf8');
  assert.match(component, /const \[detailed, setDetailed\] = useState\(false\)/);
  assert.match(component, /className="finance-mode-toggle" aria-expanded=\{detailed\} aria-controls=\{detailsId\}/);
  // The equity slider is the one control in both views.
  assert.equal(component.match(/\{equityControl\}/g)?.length, 2);
  for (const locale of ['en', 'de']) {
    for (const key of ['includesBuyerCosts', 'loanTerms', 'simpleNote', 'showDetailed', 'showSimple']) assert.ok(copy[locale].finance[key], `${locale}.${key}`);
  }
});

test('footer sits after the page column on sidebar pages, so it never overflows', async () => {
  for (const file of ['ReportView.tsx', 'ArmeniaReport.tsx', 'CountryLanding.tsx']) {
    const source = await readFile(new URL(`../components/${file}`, import.meta.url), 'utf8');
    assert.match(source, /<\/main>\s*<SiteFooter/, file);
  }
  const css = await readFile(new URL('../app/sidebar.css', import.meta.url), 'utf8');
  assert.match(css, /\.sidebar ~ \.site-footer\{margin-left:280px;margin-right:0\}/);
  assert.match(css, /\.sidebar\.collapsed ~ \.site-footer\{margin-left:68px\}/);
});
