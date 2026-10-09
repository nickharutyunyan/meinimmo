import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseListing } from '../lib/listing-parser.ts';
import { glanceFacts, localizedConsiderations, localizedSummary, localizedWarnings, offerQuestionsFor } from '../lib/report-copy.ts';
import { copy, homePresentation } from '../lib/i18n.ts';

const visible = (value) => value.replace(/\u00a0/g, ' ');
const root = path.resolve(import.meta.dirname, '..');
const fixtureDir = path.join(root, 'tests/fixtures/listings');
const portalNames = /immobilienscout|immoscout|ohne-makler|kleinanzeigen|immowelt|immonet/i;
const limitedReports = /two (free )?reports (a|per) day|zwei Berichte pro Tag|first report is free|erster Bericht ist kostenlos/i;
const broken = /undefined|NaN|\bnull\b|\[object|0 €|€0(?!\d)/;
const germanThousands = /\d\.\d{3}(?!\d)/;
const englishThousands = /\d,\d{3}(?!\d)/;
const englishArea = /\d\.\d m²/;
const germanEuro = /€ ?\d+\.\d{3}/;

function rendered(report, locale) {
  return [
    localizedSummary(report, locale),
    ...localizedConsiderations(report, locale),
    ...localizedWarnings(report, locale),
    ...glanceFacts(report, locale).flat(),
    ...offerQuestionsFor(report, locale),
  ].join('\n');
}

function walk(dir, suffix) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, suffix);
    return entry.name.endsWith(suffix) ? [full] : [];
  });
}

test('fixture reports use locale number formats and no broken placeholders', () => {
  const files = readdirSync(fixtureDir).filter((name) => name.endsWith('.html'));
  assert.ok(files.length >= 9);
  for (const name of files) {
    const report = parseListing(readFileSync(path.join(fixtureDir, name), 'utf8'), `https://example.test/${name}`);
    for (const locale of ['en', 'de']) {
      const text = rendered(report, locale);
      assert.doesNotMatch(text, broken, `${name} ${locale}`);
      assert.doesNotMatch(text, portalNames, `${name} ${locale}`);
      if (locale === 'en') {
        assert.doesNotMatch(text, germanThousands, `${name} EN thousands`);
        assert.doesNotMatch(text, germanEuro, `${name} EN euro`);
      } else {
        assert.doesNotMatch(text, englishThousands, `${name} DE thousands`);
        assert.doesNotMatch(text, englishArea, `${name} DE area`);
      }
    }
  }
});

test('Adlershof and Neu-Hohenschönhausen summaries use the right place and number format', () => {
  const parse = (id) => parseListing(readFileSync(path.join(fixtureDir, `ohne-makler-${id}.html`), 'utf8'), `https://example.test/${id}`);
  const adlershof = parse('471956');
  const english = visible(localizedSummary(adlershof, 'en'));
  const german = visible(localizedSummary(adlershof, 'de'));
  assert.match(english, /This 1-room flat at Dörpfeldstraße 5, Berlin, has 30 m² of living area and 32\.2 m² of usable area\. The asking price is €172,000 \(€5,733\/m²\)\./);
  assert.match(german, /Diese 1-Zimmer-Wohnung \(Dörpfeldstraße 5, Berlin\) hat 30 m² Wohnfläche und 32,2 m² Nutzfläche\./);
  assert.match(visible(glanceFacts(adlershof, 'de').map(([, value]) => value).join(' ')), /32,2 m²/);
  assert.match(english, /district heating/i);
  assert.doesNotMatch(english, /Fernwärme|Luft-\/Wasserwärme/);

  const areaOnly = parse('496161');
  assert.match(visible(localizedSummary(areaOnly, 'en')), /This 3-room flat in Neu-Hohenschönhausen, Berlin, has /);
  assert.doesNotMatch(localizedSummary(areaOnly, 'en'), / at Neu-Hohenschönhausen/);
  assert.match(visible(localizedSummary(areaOnly, 'de')), /Diese 3-Zimmer-Wohnung in Neu-Hohenschönhausen, Berlin, hat /);

  const house = parse('502750');
  assert.match(visible(localizedSummary(house, 'en')), /air-to-water heat pump/i);
  assert.doesNotMatch(localizedSummary(house, 'en'), /Luft-\/Wasserwärme/);
  assert.match(localizedSummary(house, 'de'), /Luft-\/Wasserwärme/);
});

test('an unknown report does not render zero euros or empty tokens', () => {
  const report = {
    id: 'unknown', title: '', address: '', location: '', propertyType: 'flat', source: 'test', createdAt: new Date(0).toISOString(),
    facts: { heating: '', totalCost: 0 },
    score: 0, summary: '', considerations: [], sunOrientation: 'not stated', qualityWarnings: ['The listing separately quotes €0 for parking.'],
    aiEnriched: false,
  };
  for (const locale of ['en', 'de']) {
    const text = rendered(report, locale);
    assert.doesNotMatch(text, broken, locale);
  }
});

test('user-facing copy names no listing portal and no limited free plan', () => {
  const files = [
    ...walk(path.join(root, 'components'), '.tsx'),
    ...walk(path.join(root, 'app'), '.tsx'),
    path.join(root, 'lib/i18n.ts'),
    path.join(root, 'lib/guide.ts'),
    path.join(root, 'lib/glossary.ts'),
    path.join(root, 'lib/method-copy.ts'),
    path.join(root, 'lib/page-meta.ts'),
    path.join(root, 'lib/terms-copy.ts'),
    path.join(root, 'lib/identity/copy.ts'),
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, portalNames, file);
    assert.doesNotMatch(source, limitedReports, file);
  }
  for (const locale of ['en', 'de']) {
    const home = homePresentation(locale, false);
    const visibleCopy = `${home.approachFree} ${home.approachFreeNote} ${home.faqs.flat().join(' ')}`;
    assert.doesNotMatch(visibleCopy, limitedReports);
  }
  assert.equal(copy.en.report.components.neighborhood, 'Neighbourhood');
  assert.equal(copy.en.compare.neighborhood, 'Neighbourhood');
  assert.equal(copy.en.map.label, 'NEIGHBOURHOOD');
  assert.match(copy.en.home.faqs[5][1], /from 0 to 10/);
  assert.match(copy.de.home.faqs[5][1], /von 0 bis 10/);
});

test('report surfaces do not hard-code a German currency formatter', () => {
  const files = [
    'components/ReportView.tsx',
    'components/PrintReport.tsx',
    'components/ComparisonView.tsx',
    'components/FinanceCalculator.tsx',
    'lib/report-copy.ts',
    'lib/listing-parser.ts',
  ];
  for (const file of files) {
    const source = readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /NumberFormat\('de-DE'|toLocaleString\('de-DE'\)/, file);
  }
});
