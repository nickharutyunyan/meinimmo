import 'server-only';
import type { Report } from '../types.ts';
import { defaultOfferQuestions, deterministicAssessment, looksLikeListing } from '../assessment.ts';
import { unsupportedListingReason } from '../listing-parser.ts';
import { fetchListing } from '../listing-fetch.ts';
import { attachReportGeocode, cachedNeighborhood } from '../geocode-runtime.ts';
import { stableReportId } from '../report-id.ts';
import { report as findReport, replaceReport, saveReport, saveReportSource } from '../store.ts';
import { publicListingUrl } from '../security.ts';
import type { Listing, ListingType } from './types.ts';
import { listingFromReport } from './from-report.ts';
import { blankListing } from './validate.ts';
import { listingAsSourceText } from './review-source.ts';
import { insertListing, listingBySourceUrl, newListingId, saveListing } from './store.ts';
import { extractFreeText } from './extract.ts';
import { marketFor } from './cities.ts';
import { cleanDistrict } from './from-report.ts';

async function storeReport(text: string, source: string, id: string) {
  const parsed = deterministicAssessment(text, source);
  let report: Report = {
    ...parsed,
    id,
    sourceReviewAttemptedAt: new Date().toISOString(),
    offerQuestions: defaultOfferQuestions(parsed),
    offerQuestionsDe: defaultOfferQuestions(parsed, 'de'),
  };
  report = await attachReportGeocode(report);
  const existing = await findReport(id);
  await saveReportSource(id, text);
  if (existing) await replaceReport({ ...report, createdAt: existing.createdAt });
  else await saveReport(report);
  return report;
}

export type ImportOutcome =
  | { ok: true; listing: Listing; created: boolean }
  | { ok: false; reason: string };

/**
 * Imports one public portal listing as a published market listing with its own review.
 * The portal stays the contact channel: the seller's details are not copied.
 */
export async function importPortalListing(input: { url: string; district?: string; refresh?: boolean; listedAt?: string }): Promise<ImportOutcome> {
  const url = publicListingUrl(input.url);
  if (!url) return { ok: false, reason: 'invalid url' };
  const source = url.toString();
  const existing = await listingBySourceUrl(source);
  if (existing && !input.refresh) return { ok: true, listing: existing, created: false };
  const text = await fetchListing(source);
  const unsupported = unsupportedListingReason(text);
  if (unsupported) return { ok: false, reason: unsupported };
  if (!looksLikeListing(text)) return { ok: false, reason: 'not a listing' };
  const report = await storeReport(text, source, await stableReportId(source));
  if (!(report.facts.price > 0)) return { ok: false, reason: 'no price' };
  const now = new Date().toISOString();
  const listing: Listing = {
    ...listingFromReport(report, {
      id: existing?.id || newListingId(),
      origin: 'imported',
      locale: 'de',
      now,
      sourceUrl: source,
      sourceName: url.hostname.replace(/^www\./, ''),
      district: input.district,
    }),
    status: 'published',
    consent: true,
    createdAt: existing?.createdAt || now,
    // The importer passes a time that keeps the portal's newest-first order.
    publishedAt: existing?.publishedAt || input.listedAt || now,
  };
  if (existing) await saveListing(listing);
  else await insertListing(listing, false);
  return { ok: true, listing, created: !existing };
}

/** Fills only what is still empty, so a labelled Exposé always wins over a loose sentence. */
export function withFreeTextFacts(listing: Listing, text: string): Listing {
  if (!text) return listing;
  const found = extractFreeText(text);
  const facts = { ...listing.facts };
  if (!facts.price && found.price) facts.price = found.price;
  if (!facts.area && found.area && listing.propertyType !== 'land') facts.area = found.area;
  if (!facts.rooms && found.rooms && listing.propertyType !== 'land') facts.rooms = found.rooms;
  if (!facts.floor && found.floor && listing.propertyType === 'flat') facts.floor = found.floor;
  if (!facts.year && found.year) facts.year = found.year;
  if (!facts.plotArea && found.plotArea && listing.propertyType !== 'flat') facts.plotArea = found.plotArea;
  if (!facts.condition && found.condition) facts.condition = found.condition;
  if (!facts.energyClass && found.energyClass) facts.energyClass = found.energyClass;
  if (!facts.heating && found.heating) facts.heating = found.heating;
  if (!facts.housegeld && found.housegeld && listing.propertyType === 'flat') facts.housegeld = found.housegeld;
  const address = { ...listing.address };
  if (!address.street && found.address?.street) address.street = found.address.street;
  if (!address.postalCode && found.address?.postalCode) address.postalCode = found.address.postalCode;
  if (!address.city && found.address?.city) address.city = found.address.city;
  return { ...listing, facts, address, market: marketFor(address) };
}

/** A seller draft from whatever text the seller uploaded: an Exposé, a floor-plan note or nothing at all. */
export async function createSellerDraft(input: { text: string; locale: 'en' | 'de'; propertyType: ListingType }) {
  const now = new Date().toISOString();
  const id = newListingId();
  const text = input.text.trim();
  let listing = blankListing({ id, locale: input.locale, propertyType: input.propertyType, now });
  if (text.length >= 80 && !unsupportedListingReason(text)) {
    const parsed = deterministicAssessment(text, 'Seller upload');
    const fromText = listingFromReport(parsed, { id, origin: 'seller', locale: input.locale, now });
    listing = {
      ...fromText,
      // The seller picked the type; a stray keyword in a document should not override it.
      propertyType: input.propertyType,
      reportId: null,
      score: null,
      geo: null,
      photos: [],
      address: { ...fromText.address, showExactAddress: false },
    };
  }
  listing = withFreeTextFacts(listing, text);
  const token = await insertListing(listing, true);
  return { listing, token: token! };
}

/** Reviews a seller listing with the same parser and score as any other listing, and stores the pin. */
export async function reviewSellerListing(listing: Listing): Promise<Listing> {
  const text = listingAsSourceText(listing);
  const reportId = listing.reportId || await stableReportId(`listing:${listing.id}`);
  const report = await storeReport(text, `Review a House listing ${listing.id}`, reportId);
  const district = listing.address.district || cleanDistrict(report.facts.district) || cleanDistrict(await cachedNeighborhood(report));
  return {
    ...listing,
    address: { ...listing.address, district: district === listing.address.city ? '' : district },
    reportId: report.id,
    score: typeof report.score === 'number' ? report.score : null,
    geo: report.geocode ? { lat: report.geocode.lat, lon: report.geocode.lon, precision: report.geocode.precision } : listing.geo,
  };
}
