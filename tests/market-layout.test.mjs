import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../app/market.css', import.meta.url), 'utf8');
const rule = selector => css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] || '';

test('a listing without photos keeps the gallery spacing and a short band, not a 16:9 void', async () => {
  const gallery = await readFile(new URL('../components/market/ListingGallery.tsx', import.meta.url), 'utf8');
  assert.match(gallery, /if \(!visible\.length\) return <section className="listing-gallery"[^>]*><div className="listing-stage is-empty">/);
  assert.match(rule('.listing-stage.is-empty'), /aspect-ratio:\s*auto/);
  assert.match(rule('.listing-gallery'), /margin-bottom:\s*26px/);
});

test('sticky bars stack under the real nav height instead of a hard-coded 64px', async () => {
  const editor = await readFile(new URL('../components/market/ListingEditor.tsx', import.meta.url), 'utf8');
  assert.match(editor, /<div className="editor-shell" ref=\{stickyOffsets\}>/);
  assert.match(editor, /--market-nav-h/);
  assert.match(editor, /--editor-bar-h/);
  assert.match(editor, /new ResizeObserver\(update\)/);
  assert.match(css, /\.editor-bar \{[^}]*top: var\(--market-nav-h, 74px\)/);
  assert.match(rule('.listing-side'), /top: calc\(var\(--market-nav-h, 74px\) \+ 20px\)/);
  assert.match(rule('.editor-shell .listing-side'), /var\(--editor-bar-h, 58px\)/);
  assert.doesNotMatch(css, /top:\s*(?:64|84)px/);
});

test('the long editing side panel scrolls with the page', () => {
  assert.match(rule('.listing-page.is-editing .listing-side'), /position:\s*static/);
});

test('the add-photo tile takes its size from the grid column, so phones do not scroll sideways', () => {
  const tile = rule('.photo-add');
  assert.match(tile, /aspect-ratio:\s*4 \/ 3/);
  assert.doesNotMatch(tile, /min-height/);
});

test('marketplace styles never target a class the report pages use', async () => {
  // The marketplace's facts grid was once also called .listing-details and turned the
  // report's "Listing details" card into a three-column grid.
  const reportFiles = ['ReportView', 'PriceCheckCard', 'PriceRangeBar', 'FinanceCalculator', 'OfferQuestions', 'PrintReport', 'ComparisonView', 'ListingPhotos', 'Sidebar', 'SiteFooter', 'SiteNav', 'ArmeniaReport', 'CountryLanding'];
  const used = new Set();
  for (const name of reportFiles) {
    const source = await readFile(new URL(`../components/${name}.tsx`, import.meta.url), 'utf8').catch(() => '');
    for (const match of source.matchAll(/className=\{?[`"']([^`"']+)/g)) {
      for (const token of match[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) if (/^[a-z][\w-]*$/.test(token)) used.add(token);
    }
  }
  const clashes = [];
  for (const block of css.matchAll(/(?:^|\})\s*([^{}@]+)\{/g)) {
    for (const selector of block[1].split(',')) {
      const first = selector.trim().match(/^\.([\w-]+)/)?.[1];
      if (first && used.has(first)) clashes.push(selector.trim());
    }
  }
  assert.deepEqual(clashes, []);
  const view = await readFile(new URL('../components/market/ListingView.tsx', import.meta.url), 'utf8');
  assert.match(view, /<dl className="listing-specs">/);
});
