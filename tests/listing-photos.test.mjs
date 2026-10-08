import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import esbuild from 'esbuild';
import { CONTENT_SECURITY_POLICY } from '../lib/content-security-policy.ts';
import { LISTING_IMAGE_HOSTS } from '../lib/listing-image-hosts.ts';
import { displayableListingPhotos, extractListingPhotoUrls, listingPhotosToShow, stableListingPhotoUrl } from '../lib/listing-photos.ts';
import { parseListing } from '../lib/listing-parser.ts';
import { copy } from '../lib/i18n.ts';

async function loadListingPhotos() {
  const directory = await mkdtemp(join(process.cwd(), 'tests/.listing-photos-render-'));
  try {
    const outfile = join(directory, 'ListingPhotos.mjs');
    await esbuild.build({
      entryPoints: [new URL('../components/ListingPhotos.tsx', import.meta.url).pathname],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'node',
      jsx: 'automatic',
      packages: 'external',
    });
    const loaded = await import(pathToFileURL(outfile).href);
    return loaded.ListingPhotos;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const PARSE_BUDGET_MS = 80;
const CDN = 'https://media.ohne-makler.net';

function sources(csp, name) {
  const part = csp.split(';').map((item) => item.trim()).find((item) => item === name || item.startsWith(`${name} `));
  assert.ok(part, name);
  return part.slice(name.length).trim().split(/\s+/).filter(Boolean);
}

const berlin = readFileSync(new URL('./fixtures/listings/ohne-makler-502729.html', import.meta.url), 'utf8');

test('Berlin 502729 yields a stable set of absolute https gallery URLs', () => {
  const source = 'https://www.ohne-makler.net/immobilie/502729/';
  let first;
  for (let run = 0; run < 10; run += 1) {
    const urls = extractListingPhotoUrls(berlin);
    assert.ok(urls.length >= 1 && urls.length <= 8, `run ${run + 1} extracted ${urls.length}`);
    for (const url of urls) {
      assert.match(url, /^https:\/\/media\.ohne-makler\.net\//);
      assert.equal(url.includes('data:'), false);
      assert.equal(url.includes('&amp;'), false);
      assert.equal(/[?&](?:sig|signature|exp)=/i.test(url), false);
      assert.equal(url.includes('?'), false);
    }
    assert.equal(new Set(urls).size, urls.length);
    if (!first) first = urls;
    else assert.deepEqual(urls, first);
  }
  const report = parseListing(berlin, source);
  assert.deepEqual(report.facts.photoUrls, first);
  assert.equal(report.facts.photoUrls.length, 8);
  assert.equal(parseListing(berlin, 'Pasted listing').facts.photoUrls, undefined);
  assert.equal(parseListing(berlin, 'Exposé.pdf').facts.photoUrls, undefined);
});

test('photo extraction ignores tracking pixels, data URIs and off-allowlist hosts', () => {
  const html = `
    <meta property="og:image" content="${CDN}/og.jpg">
    <meta property="og:image" content="data:image/gif;base64,AAAA">
    <script type="application/ld+json">{"@type":"ImageObject","contentUrl":"${CDN}/ld.jpg"}</script>
    <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" width="1" height="1">
    <img src="${CDN}/pixel.jpg" width="1" height="1">
    <img src="https://evil.example/secret.jpg">
    <img src="http://media.ohne-makler.net/insecure.jpg">
    <img src="/logo.svg" srcset="data:image/gif;base64,xx 1w, ${CDN}/set.jpg 400w">
    <a href="${CDN}/light.jpg?sig=1&amp;exp=9" data-glightbox="type: image;description: Zimmer"></a>
    <img src="https://www.ohne-makler.net/immobilie/1/picture/0/medium.jpg">
  `;
  assert.deepEqual(extractListingPhotoUrls(html), [
    `${CDN}/og.jpg`,
    `${CDN}/ld.jpg`,
    `${CDN}/set.jpg`,
    `${CDN}/light.jpg`,
  ]);
  assert.deepEqual(displayableListingPhotos([
    'data:image/png;base64,xx',
    'http://media.ohne-makler.net/a.jpg',
    'https://evil.example/a.jpg',
    `${CDN}/kept.jpg`,
    `${CDN}/kept.jpg`,
  ]), [`${CDN}/kept.jpg`]);
  assert.deepEqual(listingPhotosToShow([`${CDN}/a.jpg`, `${CDN}/b.jpg`], new Set([`${CDN}/a.jpg`, `${CDN}/b.jpg`])), []);
});

test('signed exp and sig query parameters are stored as a stable URL', () => {
  const signed = `${CDN}/rs:fit:1920:1080/q:90/path?sig=abc&exp=1`;
  const stable = `${CDN}/rs:fit:1920:1080/q:90/path`;
  assert.equal(stableListingPhotoUrl(signed), stable);
  assert.equal(stableListingPhotoUrl(`${CDN}/room.jpg?w=400&signature=zzz&exp=9`), `${CDN}/room.jpg?w=400`);
  assert.equal(stableListingPhotoUrl(`${CDN}/room.jpg?Exp=9&SIG=abc&fmt=jpg`), `${CDN}/room.jpg?fmt=jpg`);
  assert.deepEqual(displayableListingPhotos([
    signed,
    stable,
    `${CDN}/room.jpg?w=400&sig=1&exp=2`,
  ]), [stable, `${CDN}/room.jpg?w=400`]);
  assert.equal(stableListingPhotoUrl('https://evil.example/a.jpg?sig=1'), '');
});

test('listing photo hosts in CSP img-src are exactly the shared allowlist', async () => {
  const baseline = [
    "'self'", 'data:', 'blob:',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://*.google-analytics.com',
    'https://analytics.google.com',
    'https://*.analytics.google.com',
  ];
  const img = sources(CONTENT_SECURITY_POLICY, 'img-src');
  assert.deepEqual(img.filter((item) => !baseline.includes(item)), [...LISTING_IMAGE_HOSTS]);
  assert.equal(img.includes('https:'), false);
  assert.deepEqual(sources(CONTENT_SECURITY_POLICY, 'script-src'), [
    "'self'", "'unsafe-inline'", 'https://www.googletagmanager.com', 'https://cdnjs.cloudflare.com',
  ]);
  const policy = await readFile(new URL('../lib/content-security-policy.ts', import.meta.url), 'utf8');
  const hosts = await readFile(new URL('../lib/listing-image-hosts.ts', import.meta.url), 'utf8');
  const config = await readFile(new URL('../next.config.ts', import.meta.url), 'utf8');
  assert.match(policy, /LISTING_IMAGE_HOSTS/);
  assert.doesNotMatch(policy, /media\.ohne-makler\.net/);
  assert.match(hosts, /https:\/\/media\.ohne-makler\.net/);
  assert.match(config, /CONTENT_SECURITY_POLICY/);
  assert.doesNotMatch(config, /img-src|script-src/);
  for (const host of LISTING_IMAGE_HOSTS) assert.ok(img.includes(host), host);
});

test('report overview renders EN and DE captions and print and compare omit photos', async () => {
  const ListingPhotos = await loadListingPhotos();
  const listingUrl = 'https://www.ohne-makler.net/immobilie/502729/';
  const urls = [`${CDN}/a.jpg`, 'https://evil.example/nope.jpg', 'data:image/gif;base64,xx'];
  for (const locale of ['en', 'de']) {
    const html = renderToStaticMarkup(createElement(ListingPhotos, { urls, listingUrl, locale }));
    const caption = copy[locale].report.photosCaption;
    assert.equal(caption, locale === 'de'
      ? 'Fotos aus dem Angebot · öffnet die Originalseite'
      : 'Photos from the listing · opens the original page');
    assert.equal(html.includes(caption), true);
    assert.doesNotMatch(caption, /ohne-makler|immoscout|immowelt|kleinanzeigen/i);
    assert.equal(html.includes('https://evil.example/nope.jpg'), false);
    assert.equal(html.includes('data:image'), false);
    assert.match(html, /class="listing-photos"/);
    const label = copy[locale].report.photoLink.replaceAll('{n}', '1').replaceAll('{total}', '1');
    assert.equal(label, locale === 'de'
      ? 'Foto 1 von 1, öffnet das Originalangebot in einem neuen Tab'
      : 'Photo 1 of 1, opens the original listing in a new tab');
    assert.doesNotMatch(label, /ohne-makler|immoscout|immowelt|kleinanzeigen/i);
    assert.equal(html.includes(`aria-label="${label}"`), true);
    assert.match(html, new RegExp(`<a href="${listingUrl}" target="_blank" rel="noreferrer" aria-label="`));
    assert.match(html, /<img src="https:\/\/media\.ohne-makler\.net\/a\.jpg" alt="" width="160" height="120" loading="lazy" referrerpolicy="no-referrer" decoding="async"/i);
    assert.equal([...html.matchAll(/<img /g)].length, 1);

    const pair = renderToStaticMarkup(createElement(ListingPhotos, {
      urls: [`${CDN}/a.jpg`, `${CDN}/b.jpg?sig=1&exp=2`],
      listingUrl,
      locale,
    }));
    const second = copy[locale].report.photoLink.replaceAll('{n}', '2').replaceAll('{total}', '2');
    assert.equal(second, locale === 'de'
      ? 'Foto 2 von 2, öffnet das Originalangebot in einem neuen Tab'
      : 'Photo 2 of 2, opens the original listing in a new tab');
    assert.equal(pair.includes(`aria-label="${second}"`), true);
    assert.match(pair, /src="https:\/\/media\.ohne-makler\.net\/b\.jpg"/);
    assert.equal(pair.includes('sig='), false);
    assert.equal(pair.includes('exp='), false);
  }
  assert.equal(renderToStaticMarkup(createElement(ListingPhotos, { urls, listingUrl: 'Exposé.pdf', locale: 'en' })), '');
  assert.equal(renderToStaticMarkup(createElement(ListingPhotos, { urls: [], listingUrl, locale: 'de' })), '');

  const css = await readFile(new URL('../app/editorial.css', import.meta.url), 'utf8');
  assert.match(css, /@media print\s*\{[^}]*\.listing-photos\s*\{[^}]*display:\s*none/);
  const print = await readFile(new URL('../components/PrintReport.tsx', import.meta.url), 'utf8');
  const compare = await readFile(new URL('../components/ComparisonView.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(print, /ListingPhotos|photoUrls|listing-photos|photosCaption/);
  assert.doesNotMatch(compare, /ListingPhotos|photoUrls|listing-photos|photosCaption/);
});

test('adversarial photo markup stays inside the parse budget', () => {
  extractListingPhotoUrls(`<img src="${CDN}/warm.jpg">`);
  const attacks = [
    ['unterminated img tags', '<img '.repeat(100_000)],
    ['huge srcset', `<img srcset="${`${CDN}/a.jpg 100w, `.repeat(12_000)}">`],
  ];
  for (const [label, input] of attacks) {
    assert.ok(input.length >= 500_000, `${label} is ${input.length} chars`);
    const started = performance.now();
    const urls = extractListingPhotoUrls(input);
    const elapsed = performance.now() - started;
    assert.ok(Array.isArray(urls));
    assert.ok(urls.length <= 8);
    assert.ok(elapsed < PARSE_BUDGET_MS, `${label} took ${elapsed.toFixed(1)} ms (${input.length} chars)`);
  }
});
