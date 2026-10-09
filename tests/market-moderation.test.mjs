import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPatch, blankListing } from '../lib/market/validate.ts';
import { decide, isPublic, LISTINGS_PER_EMAIL, moderationOnPublish, newEmailCode, spamFlags } from '../lib/market/moderation.ts';
import { listingCodeEmail } from '../lib/market/email-content.ts';

const NOW = '2026-10-10T09:00:00.000Z';

function listing(overrides = {}) {
  const base = blankListing({ id: 'abcdef123456', locale: 'en', propertyType: 'flat', now: NOW });
  const complete = applyPatch({ ...base, photos: [{ kind: 'stored', id: '0123456789abcdef', width: 1, height: 1 }] }, {
    facts: { price: 545000, area: 82, rooms: 3 },
    address: { street: 'Akazienstraße 14', postalCode: '10823', city: 'Berlin' },
    contact: { name: 'Ada', email: 'ada@example.com' },
    consent: true,
  }, NOW);
  return applyPatch(complete, overrides, NOW);
}

test('a plain listing passes every check', () => {
  assert.deepEqual(spamFlags(listing({ description: 'Bright flat with a balcony over the courtyard. Price 545.000 €, Hausgeld 310 € a month.' })), []);
});

test('generated text is never flagged; only what the seller wrote is checked', () => {
  const generated = listing();
  assert.equal(generated.autoDescription, true);
  assert.deepEqual(spamFlags(generated), []);
});

test('links, contact details, scam wording and rentals hold a listing for review', () => {
  assert.deepEqual(spamFlags(listing({ description: 'More photos on www.my-flat-deals.ru' })), ['link']);
  assert.deepEqual(spamFlags(listing({ description: 'Call me on +49 170 1234567 or write to ada@example.com' })), ['contact_in_text']);
  assert.deepEqual(spamFlags(listing({ description: 'I am currently abroad, the keys will be sent by post after a deposit via Western Union.' })), ['scam_phrase']);
  assert.deepEqual(spamFlags(listing({ description: 'Schöne Wohnung zu vermieten, Kaltmiete 900 €.' })), ['rental']);
  // A rented flat for sale is not a rental listing.
  assert.deepEqual(spamFlags(listing({ description: 'Die Wohnung ist vermietet, die Mieter zahlen pünktlich.' })), []);
});

test('implausible prices and shouted headlines are flagged', () => {
  assert.deepEqual(spamFlags(listing({ facts: { price: 5000 } })), ['price_outlier']);
  assert.deepEqual(spamFlags(listing({ facts: { price: 9_000_000 } })), ['price_outlier']);
  assert.deepEqual(spamFlags(listing({ title: 'TRAUMWOHNUNG SOFORT KAUFEN' })), ['shouting']);
  assert.deepEqual(spamFlags(listing({ title: 'Bright flat with WC and EBK' })), []);
});

test('many listings from one email wait for a person', () => {
  assert.deepEqual(spamFlags(listing(), { recentListingsForEmail: LISTINGS_PER_EMAIL - 1 }), []);
  assert.deepEqual(spamFlags(listing(), { recentListingsForEmail: LISTINGS_PER_EMAIL }), ['many_listings']);
});

test('imported listings are not checked as seller content', () => {
  assert.deepEqual(spamFlags({ ...listing({ description: 'www.example.ru' }), origin: 'imported' }), []);
});

test('publishing holds flagged listings, keeps approvals and never revives a hidden one', () => {
  const clean = listing();
  assert.equal(moderationOnPublish(clean, []).state, 'none');
  assert.equal(moderationOnPublish(clean, ['link']).state, 'pending');
  const approved = decide({ ...clean, moderation: { state: 'pending', flags: ['link'], note: '', reviewedAt: null } }, 'approve', '', NOW);
  assert.equal(moderationOnPublish(approved, ['link']).state, 'approved');
  assert.equal(moderationOnPublish(approved, ['link', 'scam_phrase']).state, 'pending');
  const hidden = decide(clean, 'hide', '', NOW);
  assert.equal(moderationOnPublish(hidden, []).state, 'hidden');
});

test('only published listings that are not held, hidden or rejected are public', () => {
  const live = { ...listing(), status: 'published' };
  assert.equal(isPublic(live), true);
  assert.equal(isPublic({ ...live, moderation: { state: 'approved', flags: [], note: '', reviewedAt: NOW } }), true);
  for (const state of ['pending', 'hidden', 'rejected']) assert.equal(isPublic({ ...live, moderation: { state, flags: [], note: '', reviewedAt: null } }), false, state);
  assert.equal(isPublic(listing()), false);
});

test('a rejection carries the moderator note to the seller', () => {
  const rejected = decide(listing(), 'reject', '  Please remove the phone number from the text.  ', NOW);
  assert.equal(rejected.moderation.state, 'rejected');
  assert.equal(rejected.moderation.note, 'Please remove the phone number from the text.');
});

test('codes are six digits and the email escapes the listing title', () => {
  for (let index = 0; index < 50; index += 1) assert.match(newEmailCode(), /^[1-9]\d{5}$/);
  const email = listingCodeEmail('123456', '<script>x</script> flat', 'en');
  assert.match(email.subject, /^123456 /);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(listingCodeEmail('123456', 'Wohnung', 'de').text, /30 Minuten/);
});
