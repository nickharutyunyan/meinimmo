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
import { LISTING_IMAGE_HOSTS, LISTING_THUMBNAIL_HOSTS } from '../lib/listing-image-hosts.ts';
import { displayableListingPhotos, extractListingPhotoUrls, listingPhotoExpirySeconds, listingPhotosExpireAt, listingPhotosToShow, listingThumbnailUrl } from '../lib/listing-photos.ts';
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
      assert.match(url, /[?&]sig=/);
      assert.match(url, /[?&]exp=\d+$/);
    }
    assert.equal(new Set(urls).size, urls.length);
    if (!first) first = urls;
    else assert.deepEqual(urls, first);
  }
  assert.equal(first[0], `${CDN}/rs:fit:1920:1080/q:90/czM6Ly9vbS1saXN0aW5ncy91cGxvYWQvcGljdHVyZXMvT00vNTAyNzI5L3d5NmsyNXR3?sig=xTNubJdvln1aqwY4N-nBaIiHxMr5ksFE-XHGB3j-nuA&exp=1791507718`);
  const report = parseListing(berlin, source);
  assert.deepEqual(report.facts.photoUrls, first);
  assert.equal(report.facts.photoUrls.length, 8);
  assert.equal(report.facts.photosExpireAt, new Date(1791507718 * 1000).toISOString());
  assert.equal(parseListing(berlin, 'Pasted listing').facts.photoUrls, undefined);
  assert.equal(parseListing(berlin, 'Pasted listing').facts.photosExpireAt, undefined);
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
    `${CDN}/light.jpg?sig=1&exp=9`,
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

test('signed photo URLs are kept verbatim and expired ones are hidden', () => {
  const signed = `${CDN}/room.jpg?sig=abc&exp=2000000000`;
  const expired = `${CDN}/old.jpg?sig=zzz&exp=1`;
  const plain = `${CDN}/plain.jpg`;
  const html = `
    <a href="${CDN}/room.jpg?sig=abc&amp;exp=2000000000" data-glightbox="type: image;description: Zimmer"></a>
    <a href="${CDN}/old.jpg?sig=zzz&amp;exp=1" data-glightbox="type: image;description: Flur"></a>
    <img src="${plain}">
    <img src="${plain}">
  `;
  assert.deepEqual(extractListingPhotoUrls(html), [signed, expired, plain]);
  assert.equal(listingPhotoExpirySeconds(signed), 2000000000);
  assert.equal(listingPhotoExpirySeconds(plain), undefined);
  assert.equal(listingPhotoExpirySeconds(`${CDN}/room.jpg?w=400&exp=soon`), undefined);
  assert.equal(listingPhotosExpireAt([signed, expired, plain]), new Date(1000).toISOString());
  assert.equal(listingPhotosExpireAt([plain]), undefined);
  const now = Date.parse('2026-10-08T00:00:00.000Z');
  assert.deepEqual(listingPhotosToShow([expired], new Set(), now), []);
  assert.deepEqual(listingPhotosToShow([signed, expired, plain], new Set(), now), [signed, plain]);
  assert.deepEqual(listingPhotosToShow([plain, plain, `${plain}?sig=other`], new Set(), now), [plain, `${plain}?sig=other`]);
  assert.deepEqual(listingPhotosToShow([`${CDN}/room.jpg?w=400`], new Set(), now), [`${CDN}/room.jpg?w=400`]);
  const edge = `${CDN}/edge.jpg?exp=1700000000`;
  assert.deepEqual(listingPhotosToShow([edge], new Set(), 1_700_000_000_000 - 1), [edge]);
  assert.deepEqual(listingPhotosToShow([edge], new Set(), 1_700_000_000_000), []);
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
  assert.deepEqual(img.filter((item) => !baseline.includes(item)), [...LISTING_IMAGE_HOSTS, ...LISTING_THUMBNAIL_HOSTS]);
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
  assert.match(config, /security-headers\.ts/);
  assert.match(await readFile(new URL('../lib/security-headers.ts', import.meta.url), 'utf8'), /CONTENT_SECURITY_POLICY/);
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

    const signed = `${CDN}/b.jpg?sig=1&exp=9999999999`;
    const pair = renderToStaticMarkup(createElement(ListingPhotos, {
      urls: [`${CDN}/a.jpg`, signed],
      listingUrl,
      locale,
    }));
    const second = copy[locale].report.photoLink.replaceAll('{n}', '2').replaceAll('{total}', '2');
    assert.equal(second, locale === 'de'
      ? 'Foto 2 von 2, öffnet das Originalangebot in einem neuen Tab'
      : 'Photo 2 of 2, opens the original listing in a new tab');
    assert.equal(pair.includes(`aria-label="${second}"`), true);
    assert.ok(pair.includes(signed) || pair.includes(signed.replaceAll('&', '&amp;')));
  }
  const expired = `${CDN}/old.jpg?sig=zzz&exp=1`;
  const future = `${CDN}/fresh.jpg?sig=abc&exp=9999999999`;
  const plain = `${CDN}/plain.jpg`;
  const mixed = renderToStaticMarkup(createElement(ListingPhotos, {
    urls: [expired, future, plain],
    listingUrl,
    locale: 'en',
  }));
  assert.equal(mixed.includes('old.jpg'), false);
  assert.ok(mixed.includes(future) || mixed.includes(future.replaceAll('&', '&amp;')));
  assert.equal(mixed.includes(plain), true);
  assert.equal(mixed.includes('Photo 1 of 2'), true);
  assert.equal(mixed.includes('Photo 2 of 2'), true);
  const cachedExpired = renderToStaticMarkup(createElement(ListingPhotos, {
    urls: [expired, `${CDN}/also-old.jpg?exp=2`],
    listingUrl,
    locale: 'de',
    renderedAt: Date.now(),
  }));
  assert.equal(cachedExpired.includes('old.jpg'), false);
  assert.equal(cachedExpired.includes('also-old.jpg'), false);
  const source = await readFile(new URL('../components/ListingPhotos.tsx', import.meta.url), 'utf8');
  assert.match(source, /renderedAt \?\? Date\.now\(\)/);
  assert.match(source, /useEffect\(\(\) => \{\s*setNow\(Date\.now\(\)\);/);
  assert.match(source, /listingPhotosToShow\(urls, failed, now\)/);
  assert.deepEqual(listingPhotosToShow([expired, future, plain], new Set(), Date.now()), [future, plain]);
  assert.deepEqual(listingPhotosToShow([expired, `${CDN}/also-old.jpg?exp=2`], new Set(), Date.now()), []);
  const thumbSigned = `${CDN}/rs:fit:1920:1080/q:90/plain/photo.jpg?sig=YcsrfoeC&exp=9999999999`;
  const thumbExpired = `${CDN}/rs:fit:1920:1080/q:90/plain/old.jpg?sig=YcsrfoeC&exp=1`;
  const thumbs = renderToStaticMarkup(createElement(ListingPhotos, {
    urls: [thumbExpired, thumbSigned],
    listingUrl,
    locale: 'en',
    renderedAt: Date.now(),
  }));
  assert.equal(thumbs.includes('old.jpg'), false);
  assert.equal(thumbs.includes('rs:fit:1920'), false);
  assert.match(thumbs, /picture\/1\/medium\.jpg/);
  assert.equal(renderToStaticMarkup(createElement(ListingPhotos, { urls, listingUrl: 'Exposé.pdf', locale: 'en' })), '');
  assert.equal(renderToStaticMarkup(createElement(ListingPhotos, { urls: [], listingUrl, locale: 'de' })), '');

  const css = await readFile(new URL('../app/editorial.css', import.meta.url), 'utf8');
  assert.match(css, /@media print\s*\{[^}]*\.listing-photos\s*\{[^}]*display:\s*none/);
  const print = await readFile(new URL('../components/PrintReport.tsx', import.meta.url), 'utf8');
  const compare = await readFile(new URL('../components/ComparisonView.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(print, /ListingPhotos|photoUrls|listing-photos|photosCaption/);
  assert.doesNotMatch(compare, /ListingPhotos|photoUrls|listing-photos|photosCaption/);
});

test('thumbnails use a smaller frame when the URL scheme allows it', () => {
  const signed = `${CDN}/rs:fit:1920:1080/q:90/plain/photo.jpg?sig=YcsrfoeC&exp=9999999999`;
  const listing = 'https://www.ohne-makler.net/immobilie/502729/';
  assert.equal(listingThumbnailUrl(signed, listing, 2), 'https://www.ohne-makler.net/immobilie/502729/picture/2/medium.jpg');
  assert.equal(listingThumbnailUrl(signed, 'https://example.test/paste', 2), signed);
  const open = `${CDN}/rs:fit:1920:1080/q:90/plain/photo.jpg`;
  assert.equal(listingThumbnailUrl(open, listing, 0), `${CDN}/rs:fit:320:240/q:90/plain/photo.jpg`);
  const expired = `${CDN}/rs:fit:1920:1080/q:90/plain/old.jpg?sig=YcsrfoeC&exp=1`;
  assert.deepEqual(listingPhotosToShow([expired], new Set(), Date.now()), []);
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
