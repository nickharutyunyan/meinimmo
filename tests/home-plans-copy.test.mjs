import assert from 'node:assert/strict';
import test from 'node:test';
import { homePresentation } from '../lib/i18n.ts';
import { termsSections } from '../lib/terms-copy.ts';

const purchaseWords = /€\s?\d|day pass|Tagespass|Ultra|Pro costs|Pro kostet|Bezahlpakete|paid plans/i;

test('hiding plans removes paid prices and leaves the how-it-works free line unchanged', () => {
  for (const locale of ['en', 'de']) {
    const home = homePresentation(locale, false);
    const visible = home.faqs.flat().join(' ');
    assert.equal(home.approachFree, locale === 'de' ? 'Der erste Bericht ist kostenlos.' : 'The first report is free.');
    assert.match(home.approachFreeNote, locale === 'de' ? /Zwei am Tag/ : /Two a day/);
    assert.match(home.approachIntro, locale === 'de' ? /ImmoScout24 oder Ohne-Makler/ : /ImmoScout24 or Ohne-Makler/);
    assert.doesNotMatch(visible, purchaseWords);
  }
});

test('paid-plan copy returns when plans are offered again', () => {
  assert.match(homePresentation('en', true).faqs.at(-1)[0], /paid plans/);
  assert.match(homePresentation('en', true).approachFreeNote, /Two a day/);
  assert.match(homePresentation('de', true).faqs.at(-1)[1], /Tagespass/);
  assert.match(homePresentation('de', true).approachIntro, /ImmoScout24/);
});

test('terms stop offering new plans and still explain how an existing subscription is cancelled', () => {
  for (const locale of ['en', 'de']) {
    const hidden = termsSections(locale, false).map(([, body]) => body).join(' ');
    const offered = termsSections(locale, true).map(([, body]) => body).join(' ');
    assert.match(hidden, locale === 'de' ? /nicht angeboten/ : /not currently offered/);
    assert.match(hidden, /Stripe/);
    assert.doesNotMatch(hidden, /€\s?\d|€5|€10|€20/);
    assert.match(offered, locale === 'de' ? /Tagespass/ : /day pass/);
  }
});
