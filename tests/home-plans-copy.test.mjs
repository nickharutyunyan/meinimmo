import assert from 'node:assert/strict';
import test from 'node:test';
import { homePresentation } from '../lib/i18n.ts';
import { termsSections } from '../lib/terms-copy.ts';

const purchaseWords = /€\s?\d|day pass|Tagespass|Ultra|Pro costs|Pro kostet|Bezahlpakete|paid plans/i;

test('the landing stays free and unlimited, with no sign-up and no paid tiers, while both flags are off', () => {
  for (const locale of ['en', 'de']) {
    const home = homePresentation(locale, { paidPlansOffered: false, limitsEnabled: false });
    const strip = `${home.approachFree} ${home.approachFreeNote}`;
    const visible = `${strip} ${home.approachIntro} ${home.faqs.flat().join(' ')}`;
    assert.match(home.approachFree, locale === 'de' ? /kostenlos/ : /free/i);
    assert.match(home.approachFreeNote, locale === 'de' ? /Anmeldung/ : /sign-up/i);
    assert.doesNotMatch(strip, /two a day|first report|zwei am tag|erste bericht|pro tag|per day/i);
    assert.doesNotMatch(visible, purchaseWords);
    assert.doesNotMatch(visible, /immoscout|immobilienscout|ohne-makler|ohnemakler/i);
  }
});

test('a daily free allowance is described only while report limits are on', () => {
  const limited = homePresentation('en', { paidPlansOffered: false, limitsEnabled: true });
  assert.match(limited.approachFreeNote, /Two a day/);
  assert.doesNotMatch(limited.faqs.at(-1)[1], /Pro costs|Ultra/);
  const offered = homePresentation('en', { paidPlansOffered: true, limitsEnabled: true });
  assert.match(offered.faqs.at(-1)[0], /paid plans/);
  assert.match(offered.approachFreeNote, /No sign-up/);
  assert.match(homePresentation('de', { paidPlansOffered: true, limitsEnabled: true }).faqs.at(-1)[1], /Tagespass/);
  const unlimitedPlans = homePresentation('en', { paidPlansOffered: true, limitsEnabled: false });
  assert.match(unlimitedPlans.approachFree, /Reports are free/);
  assert.doesNotMatch(`${unlimitedPlans.approachFree} ${unlimitedPlans.approachFreeNote} ${unlimitedPlans.faqs.at(-1)[1]}`, /two reports per day for free/i);
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
