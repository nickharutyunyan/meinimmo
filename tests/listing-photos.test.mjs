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
import { displayableListingPhotos, displayedListingPhotoExpired, extractListingPhotoUrls, listingPhotoExpirySeconds, listingPhotoHref, listingPhotoSlot, listingPhotosExpireAt, listingPhotosToShow, listingThumbnailUrl, stagedPhotoMarks } from '../lib/listing-photos.ts';
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
  assert.deepEqual(stagedPhotoMarks(berlin, first), { indexes: [0, 3], listingWide: false });
  assert.deepEqual(report.facts.photoStaging, { indexes: [0, 3], listingWide: false });
  assert.equal(report.redFlags.some((flag) => flag.id === 'aiStaging'), false);
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
    // Map tiles for the market search and listing pages.
    'https://tile.openstreetmap.org',
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
    const label = copy[locale].report.photoAlt.replaceAll('{n}', '1').replaceAll('{total}', '1');
    assert.equal(label, locale === 'de' ? 'Foto 1 von 1' : 'Photo 1 of 1');
    assert.doesNotMatch(label, /ohne-makler|immoscout|immowelt|kleinanzeigen/i);
    assert.equal(html.includes(`aria-label="${label}"`), true);
    assert.match(html, /<button type="button" aria-label="/);
    assert.doesNotMatch(html, /target="_blank"/);
    assert.match(html, /<img src="https:\/\/media\.ohne-makler\.net\/a\.jpg" alt="" width="160" height="120" loading="lazy" referrerpolicy="no-referrer" decoding="async"/i);
    assert.equal([...html.matchAll(/<img /g)].length, 1);

    const signed = `${CDN}/b.jpg?sig=1&exp=9999999999`;
    const pair = renderToStaticMarkup(createElement(ListingPhotos, {
      urls: [`${CDN}/a.jpg`, signed],
      listingUrl,
      locale,
    }));
    const second = copy[locale].report.photoAlt.replaceAll('{n}', '2').replaceAll('{total}', '2');
    assert.equal(second, locale === 'de' ? 'Foto 2 von 2' : 'Photo 2 of 2');
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
  assert.match(source, /listingPhotosToShow\(urls, failed, now, listingUrl\)/);
  assert.match(source, /loading="lazy"/);
  assert.match(source, /referrerPolicy="no-referrer"/);
  assert.match(source, /image\.hidden = true/);
  assert.doesNotMatch(source, /photosExpireAt|rs:fill/);
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
  assert.match(thumbs, /picture\/0\/medium\.jpg/);
  assert.match(thumbs, /picture\/1\/medium\.jpg/);
  assert.equal(renderToStaticMarkup(createElement(ListingPhotos, { urls, listingUrl: 'Exposé.pdf', locale: 'en' })), '');
  assert.equal(renderToStaticMarkup(createElement(ListingPhotos, { urls: [], listingUrl, locale: 'de' })), '');

  const stagedHtml = renderToStaticMarkup(createElement(ListingPhotos, {
    urls: [`${CDN}/a.jpg`, `${CDN}/b.jpg`],
    stagedIndexes: [0],
    listingUrl,
    locale: 'en',
  }));
  assert.match(stagedHtml, /aria-label="Photo 1 of 2\. AI visualisation \(per listing\)"/);
  assert.match(stagedHtml, /class="listing-photo-badge"/);
  assert.equal(stagedHtml.includes('Photo 2 of 2. AI'), false);
  const stagedDe = renderToStaticMarkup(createElement(ListingPhotos, {
    urls: [`${CDN}/a.jpg`],
    stagedIndexes: [0],
    listingUrl,
    locale: 'de',
  }));
  assert.match(stagedDe, /KI-Visualisierung \(laut Angebot\)/);
  const css = await readFile(new URL('../app/editorial.css', import.meta.url), 'utf8');
  assert.match(css, /@media print\s*\{[^}]*\.listing-photos\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.listing-photos-strip \.listing-photo-badge/);
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
  assert.deepEqual(listingPhotosToShow([expired], new Set(), Date.now(), listing), [expired]);
});

test('medium.jpg thumbnails stay after the stored signed URL expires', async (t) => {
  const ListingPhotos = await loadListingPhotos();
  const at = Date.parse('2026-10-09T12:00:00.000Z');
  const exp = Date.parse('2026-10-09T04:01:00.000Z') / 1000;
  t.mock.timers.enable({ apis: ['Date'], now: at });
  const listing = 'https://www.ohne-makler.net/immobilie/502729/';
  const urls = [0, 1, 2, 3].map((index) => `${CDN}/rs:fit:1920:1080/q:90/plain/photo-${index}.jpg?sig=abc&exp=${exp}`);
  assert.equal(listingPhotosExpireAt(urls), '2026-10-09T04:01:00.000Z');
  const html = renderToStaticMarkup(createElement(ListingPhotos, {
    urls,
    listingUrl: listing,
    locale: 'en',
    renderedAt: at,
  }));
  assert.match(html, /Photos from the listing · opens the original page/);
  for (const index of [0, 1, 2, 3]) assert.match(html, new RegExp(`picture/${index}/medium\\.jpg`));
  assert.equal([...html.matchAll(/<img /g)].length, 4);
  assert.doesNotMatch(html, /rs:fill:|sig=|exp=|expires=|signature=/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /referrerpolicy="no-referrer"/i);
  assert.match(html, /<button type="button" aria-label="Photo 1 of 4"/);
  assert.doesNotMatch(html, /target="_blank"/);
  const german = renderToStaticMarkup(createElement(ListingPhotos, {
    urls, listingUrl: listing, locale: 'de', renderedAt: at,
  }));
  assert.match(german, /Fotos aus dem Angebot · öffnet die Originalseite/);
  assert.equal([...german.matchAll(/<img /g)].length, 4);

  const signedOnly = [
    `${CDN}/only-a.jpg?sig=abc&exp=${exp}`,
    `${CDN}/only-b.jpg?signature=abc&expires=${exp}`,
  ];
  assert.equal(renderToStaticMarkup(createElement(ListingPhotos, {
    urls: signedOnly, listingUrl: listing, locale: 'en', renderedAt: at,
  })), '');
  assert.deepEqual(listingPhotosToShow(signedOnly, new Set(), at, listing), []);
  assert.deepEqual(listingPhotosToShow(urls, new Set(), at, listing), urls);
  const iso = `${CDN}/iso.jpg?signature=abc&expires=2026-10-09T04:01:00.000Z`;
  assert.deepEqual(listingPhotosToShow([iso], new Set(), at), []);
  assert.deepEqual(listingPhotosToShow([`${CDN}/forever.jpg?signature=abc`], new Set(), at), [`${CDN}/forever.jpg?signature=abc`]);
  const medium = `https://www.ohne-makler.net/immobilie/502729/picture/0/medium.jpg`;
  const redirect = `${CDN}/rs:fill:265:199/plain/photo.jpg?sig=fresh&exp=${exp}`;
  assert.equal(displayedListingPhotoExpired(medium, at), false);
  assert.equal(displayedListingPhotoExpired(redirect, at), true);
  assert.equal(listingPhotoHref(listing, medium, at), listing);
  assert.equal(listingPhotoHref(urls[0], medium, at), medium);
  assert.equal(listingPhotoHref(signedOnly[0], signedOnly[0], at), undefined);

  const mixed = [signedOnly[0], urls[0], urls[1]];
  const mixedHtml = renderToStaticMarkup(createElement(ListingPhotos, {
    urls: mixed, listingUrl: listing, locale: 'en', renderedAt: at,
  }));
  assert.doesNotMatch(mixedHtml, /picture\/0\/medium\.jpg/);
  assert.match(mixedHtml, /picture\/1\/medium\.jpg/);
  assert.match(mixedHtml, /picture\/2\/medium\.jpg/);
  assert.equal(mixedHtml.includes('only-a.jpg'), false);
  assert.equal(mixedHtml.includes('Photo 1 of 2'), true);
  assert.equal(mixedHtml.includes('Photo 2 of 2'), true);

  assert.equal(renderToStaticMarkup(createElement(ListingPhotos, {
    urls, listingUrl: listing, locale: 'en', renderedAt: at, initialFailed: urls,
  })), '');
  const oneFailed = renderToStaticMarkup(createElement(ListingPhotos, {
    urls, listingUrl: listing, locale: 'de', renderedAt: at, initialFailed: [urls[0], urls[2]],
  }));
  assert.match(oneFailed, /Fotos aus dem Angebot/);
  assert.doesNotMatch(oneFailed, /picture\/0\/medium\.jpg|picture\/2\/medium\.jpg/);
  assert.match(oneFailed, /picture\/1\/medium\.jpg/);
  assert.match(oneFailed, /picture\/3\/medium\.jpg/);
  assert.equal([...oneFailed.matchAll(/<img /g)].length, 2);

  const extracted = extractListingPhotoUrls(berlin);
  assert.match(berlin, /panorama/);
  assert.equal(extracted.some((url) => url.includes('panorama')), false);
  assert.match(extracted[1], /NTAyNzI5L3Vrejg4aGhz/);
  assert.equal(listingPhotoSlot(extracted, extracted[1]), 1);
  assert.equal(listingThumbnailUrl(extracted[1], listing, listingPhotoSlot(extracted, extracted[1])), 'https://www.ohne-makler.net/immobilie/502729/picture/1/medium.jpg');
  const adlershof = readFileSync(new URL('./fixtures/listings/ohne-makler-471956.html', import.meta.url), 'utf8');
  const adlerPhotos = extractListingPhotoUrls(adlershof);
  assert.match(adlerPhotos[0], /NDcxOTU2L3VnMGJ6b2Nk/);
  assert.equal(adlerPhotos.some((url) => url.includes('/picture/')), false);
  assert.equal(listingPhotoSlot(adlerPhotos, adlerPhotos[0]), 0);
});

test('adversarial photo markup stays inside the parse budget', () => {
  extractListingPhotoUrls(`<img src="${CDN}/warm.jpg">`);
  const attacks = [
    ['unterminated img tags', '<img '.repeat(100_000)],
    ['huge srcset', `<img srcset="${`${CDN}/a.jpg 100w, `.repeat(12_000)}">`],
  ];
  for (const [label, input] of attacks) {
    assert.ok(input.length >= 500_000, `${label} is ${input.length} chars`);
    const measure = () => {
      if (global.gc) global.gc();
      const started = performance.now();
      const urls = extractListingPhotoUrls(input);
      return { urls, elapsed: performance.now() - started };
    };
    let { urls, elapsed } = measure();
    if (elapsed >= PARSE_BUDGET_MS) ({ urls, elapsed } = measure());
    assert.ok(Array.isArray(urls));
    assert.ok(urls.length <= 8);
    assert.ok(elapsed < PARSE_BUDGET_MS, `${label} took ${elapsed.toFixed(1)} ms (${input.length} chars)`);
  }
});
