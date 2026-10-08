import assert from 'node:assert/strict';
import test from 'node:test';
import { homePresentation } from '../lib/i18n.ts';
import { termsSections } from '../lib/terms-copy.ts';

const purchaseWords = /€\s?\d|day pass|Tagespass|Ultra|Pro costs|Pro kostet|Bezahlpakete|paid plans/i;

test('hiding plans removes paid prices and leaves the how-it-works free line unchanged', () => {
  for (const locale of ['en', 'de']) {
    const home = homePresentation(locale, false);
    const visible = `${home.approachFree} ${home.approachFreeNote} ${home.approachIntro} ${home.faqs.flat().join(' ')}`;
    assert.equal(home.approachFree, locale === 'de' ? 'Berichte sind kostenlos.' : 'Reports are free.');
    assert.doesNotMatch(visible, /first report is free|erster Bericht ist kostenlos|two reports per day|zwei Berichte pro Tag/i);
    assert.match(home.approachFreeNote, locale === 'de' ? /Ohne Anmeldung, ohne Abo/ : /No sign-up, no subscription/);
    assert.match(home.approachIntro, locale === 'de' ? /deutschen Immobilienportal/ : /German property portal/);
    assert.doesNotMatch(visible, /immoscout|ohne-makler|two a day|zwei am tag|per day|pro tag/i);
    assert.doesNotMatch(visible, purchaseWords);
  }
});

test('paid-plan copy returns when plans are offered again', () => {
  const offered = homePresentation('en', true);
  assert.match(offered.faqs.at(-1)[0], /paid plans/);
  assert.match(offered.faqs.at(-1)[1], /no daily limit/);
  assert.match(offered.approachFreeNote, /No sign-up, no subscription/);
  assert.match(homePresentation('de', true).faqs.at(-1)[1], /Tagespass/);
  assert.match(homePresentation('de', true).approachIntro, /Immobilienportal/);
  assert.doesNotMatch(offered.approachIntro, /ImmoScout24|Ohne-Makler/);
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
