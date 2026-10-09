import type { Report } from '../types.ts';
import type { Listing, ListingOrigin } from './types.ts';
import { marketFor } from './cities.ts';
import { parseRooms, statedText } from './format.ts';
import { featureKeys } from './features.ts';

const ENERGY_CLASS = /^(A\+|[A-H])\b/;

/** "Mitte Mitte" and "Kollwitzkiez Kollwitzkiez" come from a repeated label in some portals. */
export function cleanDistrict(value: unknown) {
  const text = statedText(value).replace(/\s+/g, ' ');
  const words = text.split(' ');
  const half = words.length / 2;
  if (words.length > 1 && Number.isInteger(half) && words.slice(0, half).join(' ') === words.slice(half).join(' ')) return words.slice(0, half).join(' ');
  return text;
}

export function emptyContact(): Listing['contact'] {
  return { name: '', email: '', phone: '', showEmail: true, showPhone: false };
}

/**
 * Turns a parsed report into a listing draft. Only facts travel; the portal's own
 * description and title are not copied, the text is generated from those facts.
 */
export function listingFromReport(report: Report, options: {
  id: string;
  origin: ListingOrigin;
  locale: 'en' | 'de';
  now: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  district?: string;
  photoUrls?: string[];
}): Listing {
  const facts = report.facts;
  const energyClass = statedText(facts.energy).match(ENERGY_CLASS)?.[1] || '';
  const address: Listing['address'] = {
    street: statedText(facts.street),
    postalCode: statedText(facts.postalCode),
    city: statedText(facts.city),
    district: cleanDistrict(options.district || facts.district || (report.location !== facts.city ? report.location : '')),
    showExactAddress: true,
  };
  const listingFacts: Listing['facts'] = {
    price: facts.price > 0 ? Math.round(facts.price) : 0,
    area: report.propertyType === 'land' ? 0 : facts.area > 0 ? facts.area : 0,
    rooms: report.propertyType === 'land' ? null : parseRooms(facts.rooms),
    floor: report.propertyType === 'flat' ? statedText(facts.floor) : '',
    year: statedText(facts.year).match(/\b(1[5-9]\d\d|20\d\d)\b/)?.[1] || '',
    plotArea: facts.plotArea && facts.plotArea > 0 ? facts.plotArea : null,
    condition: statedText(facts.condition),
    energyClass,
    heating: statedText(facts.heating),
    housegeld: report.propertyType === 'flat' && facts.housegeld && facts.housegeld > 0 ? Math.round(facts.housegeld) : null,
    availableFrom: statedText(facts.availabilityDate),
    features: featureKeys(facts.features),
  };
  const photos = (options.photoUrls ?? facts.photoUrls ?? []).map(url => ({ kind: 'remote' as const, url }));
  return {
    id: options.id,
    status: 'draft',
    origin: options.origin,
    locale: options.locale,
    propertyType: report.propertyType,
    title: '',
    description: '',
    autoTitle: true,
    autoDescription: true,
    facts: listingFacts,
    address,
    market: marketFor(address),
    geo: report.geocode ? { lat: report.geocode.lat, lon: report.geocode.lon, precision: report.geocode.precision } : null,
    photos,
    contact: emptyContact(),
    sourceUrl: options.sourceUrl ?? null,
    sourceName: options.sourceName ?? null,
    reportId: report.id,
    score: typeof report.score === 'number' ? report.score : null,
    consent: false,
    createdAt: options.now,
    updatedAt: options.now,
    publishedAt: null,
  };
}
