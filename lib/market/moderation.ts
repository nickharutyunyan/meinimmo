import type { Listing, ListingModeration, ModerationFlag } from './types.ts';

/** Distinct buyer reports that take a listing down until a moderator looks at it. */
export const REPORTS_TO_HIDE = 3;
/** Seller listings per contact email in 30 days before the next one waits for review. */
export const LISTINGS_PER_EMAIL = 3;

export const NO_MODERATION: ListingModeration = { state: 'none', flags: [], note: '', reviewedAt: null };

export function moderationOf(listing: Pick<Listing, 'moderation'>): ListingModeration {
  return listing.moderation || NO_MODERATION;
}

/** Visible on the site and in search: published, and not held, hidden or rejected. */
export function isPublic(listing: Pick<Listing, 'status' | 'moderation'>) {
  const state = moderationOf(listing).state;
  return listing.status === 'published' && (state === 'none' || state === 'approved');
}

const LINK = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.|\b[a-z0-9-]+\.(?:com|de|net|org|ru|io|xyz|info|biz|shop|top)\b/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
// Eight or more digits with the separators people put in phone numbers. Prices are excluded below.
const PHONE = /(?:\+|\b0)\d[\d\s/().-]{7,}\d/;
const SCAM = [
  /western\s*union/i, /money\s*gram/i, /\bbitcoin\b|\bcrypto/i, /gift\s*cards?|gutschein(?:karte)?n?\b/i,
  /deposit before (?:the )?viewing|pay (?:a |the )?deposit (?:first|in advance)/i,
  /kaution (?:im )?voraus|vorkasse|vor der besichtigung (?:zu )?(?:überweisen|zahlen)/i,
  /keys? (?:will be )?(?:sent|posted) by (?:post|mail)|schlüssel per post/i,
  /\bairbnb\b/i, /currently (?:abroad|overseas|working abroad)|(?:derzeit|zurzeit) im ausland/i,
  /whats\s*app only|nur (?:per )?whats\s*app/i,
];
const RENTAL = /\bfor rent\b|\bto let\b|\brent per month\b|\bmonthly rent\b|\bzu vermieten\b|\bkaltmiete\b|\bwarmmiete\b|\bmietwohnung\b|\bwg-zimmer\b|\bnachmieter\b/i;

function textOf(listing: Pick<Listing, 'title' | 'description' | 'autoTitle' | 'autoDescription'>) {
  // Generated text is built from the facts and cannot carry spam; only the seller's words are checked.
  return [listing.autoTitle ? '' : listing.title, listing.autoDescription ? '' : listing.description].join('\n');
}

/**
 * Automatic checks before a seller listing goes live. Any flag holds the listing for
 * a person to review; none of them reject on their own.
 */
export function spamFlags(listing: Listing, context: { recentListingsForEmail: number } = { recentListingsForEmail: 0 }): ModerationFlag[] {
  if (listing.origin !== 'seller') return [];
  const flags = new Set<ModerationFlag>();
  const text = textOf(listing);
  // An email address is a contact detail, not a link, even though its domain looks like one.
  if (LINK.test(text.replace(/[^\s@]+@[^\s@]+/g, ' '))) flags.add('link');
  const withoutPrices = text.replace(/\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d+)?\s*(?:€|eur|euro)|€\s*\d{1,3}(?:[.,\s]\d{3})+/gi, ' ');
  if (EMAIL.test(text) || PHONE.test(withoutPrices)) flags.add('contact_in_text');
  if (SCAM.some(pattern => pattern.test(text))) flags.add('scam_phrase');
  if (RENTAL.test(text)) flags.add('rental');
  const { price, area, plotArea } = listing.facts;
  const size = listing.propertyType === 'land' ? plotArea || 0 : area;
  const perSqm = size > 0 ? price / size : 0;
  const plausible = listing.propertyType === 'land' ? perSqm >= 5 && perSqm <= 15_000 : perSqm >= 400 && perSqm <= 35_000;
  if (price > 0 && (price < 10_000 || (size > 0 && !plausible))) flags.add('price_outlier');
  const title = listing.autoTitle ? '' : listing.title;
  const letters = title.replace(/[^a-zäöüß]/gi, '');
  if (letters.length >= 12 && letters.replace(/[^A-ZÄÖÜ]/g, '').length / letters.length > 0.6) flags.add('shouting');
  if (context.recentListingsForEmail >= LISTINGS_PER_EMAIL) flags.add('many_listings');
  return [...flags];
}

/** The moderation a listing gets when its seller publishes it. Approved listings stay approved unless new flags appear. */
export function moderationOnPublish(listing: Listing, flags: ModerationFlag[]): ListingModeration {
  const current = moderationOf(listing);
  // Taken down after reports: only a moderator brings it back.
  if (current.state === 'hidden') return current;
  if (!flags.length) return current.state === 'approved' ? current : { ...NO_MODERATION };
  // A moderator already accepted exactly these flags; do not ask again.
  if (current.state === 'approved' && flags.every(flag => current.flags.includes(flag))) return current;
  return { state: 'pending', flags, note: '', reviewedAt: current.reviewedAt };
}

export type ModerationDecision = 'approve' | 'reject' | 'hide';

export function decide(listing: Listing, decision: ModerationDecision, note: string, now: string): Listing {
  const current = moderationOf(listing);
  const state = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'hidden';
  return {
    ...listing,
    moderation: { state, flags: current.flags, note: note.trim().slice(0, 500), reviewedAt: now },
    updatedAt: now,
  };
}

/** Six digits, never starting with zero, from the platform's random source. */
export function newEmailCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 900_000;
  return String(100_000 + value);
}
