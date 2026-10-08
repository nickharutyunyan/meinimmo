import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { copy } from '../lib/i18n.ts';
import { methodCopy, methodPlainText } from '../lib/method-copy.ts';

const FAQ_EN = 'The Review a House score rates each listing from 0 to 10 on the facts it states: price (only where official local sales prices exist), neighbourhood, space, building, energy, light, running costs and how complete the listing is. Each score shows how much data it rests on. It is a screening tool, not a valuation or a substitute for technical and legal checks.';
const FAQ_DE = 'Der Review-a-House-Score bewertet jedes Angebot von 0 bis 10 anhand seiner Angaben: Preis (nur wo amtliche lokale Kaufpreise vorliegen), Lage, Platz, Gebäude, Energie, Licht, laufende Kosten und Vollständigkeit. Jeder Score zeigt, auf wie vielen Angaben er beruht. Er ist ein Filter, kein Wertgutachten und kein Ersatz für technische oder rechtliche Prüfung.';

const FACING = [
  'lib/i18n.ts',
  'lib/method-copy.ts',
  'lib/property-score.ts',
  'lib/report-integrity.ts',
  'components/ReportView.tsx',
  'components/ComparisonView.tsx',
  'components/PrintReport.tsx',
  'components/MethodPage.tsx',
  'components/SiteFooter.tsx',
  'app/method/page.tsx',
  'app/de/method/page.tsx',
  'app/layout.tsx',
];

test('FAQ 06 states the honest score in both languages', () => {
  assert.equal(copy.en.home.faqs[5][1], FAQ_EN);
  assert.equal(copy.de.home.faqs[5][1], FAQ_DE);
});

test('method pages sit in the sitemap, explain the rubric, and avoid portal names', () => {
  const sitemapSource = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8');
  assert.match(sitemapSource, /\$\{base\}\/method/);
  assert.match(sitemapSource, /\$\{base\}\/de\/method/);
  assert.match(sitemapSource, /en: `\$\{base\}\/method`, de: `\$\{base\}\/de\/method`/);

  for (const locale of ['en', 'de']) {
    const words = methodPlainText(locale).split(/\s+/).filter(Boolean);
    assert.ok(words.length >= 380 && words.length <= 560, `${locale} is ${words.length} words`);
    assert.equal(methodCopy(locale).sections.length, 6);
  }

  const text = `${methodPlainText('en')}\n${methodPlainText('de')}`;
  assert.match(text, /Gutachterausschuss/);
  assert.match(text, /dl-de\/zero-2\.0/);
  assert.match(text, /FMH/);
  assert.match(text, /OpenStreetMap/);
  assert.match(text, /Nominatim/);
  assert.match(text, /Transfer tax uses the published rates of the federal states/);
  assert.match(text, /Die Grunderwerbsteuer folgt den veröffentlichten Sätzen der Bundesländer/);
  assert.doesNotMatch(text, /checked on|Stand:/i);
  assert.doesNotMatch(text, /ImmoScout|Ohne-Makler|ohne-makler|Immowelt/i);
  assert.doesNotMatch(text, /proposition|starkes Angebot/i);
});

test('user-visible score copy has no score-title phrases or portal names', () => {
  const text = FACING.map((path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(text, /proposition/i);
  assert.doesNotMatch(text, /starkes Angebot|A strong overall|propertyScoreTitle/);
  assert.doesNotMatch(text, /ImmoScout|Ohne-Makler|ohne-makler|Immowelt/i);
  assert.match(readFileSync(new URL('../components/SiteFooter.tsx', import.meta.url), 'utf8'), /How we review/);
  assert.match(readFileSync(new URL('../components/SiteFooter.tsx', import.meta.url), 'utf8'), /So prüfen wir/);
});
