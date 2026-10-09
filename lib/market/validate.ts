import type { Listing, ListingPhoto, ListingSummary, ListingType } from './types.ts';
import { marketFor } from './cities.ts';
import { featureKeys } from './features.ts';
import { emptyContact } from './from-report.ts';
import { generatedDescription, generatedTitle } from './describe.ts';
import { parseRooms } from './format.ts';

export const MAX_PHOTOS = 30;
export const LIMITS = { title: 120, description: 6000, text: 80, street: 120, name: 80, email: 160, phone: 40 };

const ENERGY_CLASSES = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
const PHONE = /^\+?[\d\s()/.-]{6,}$/;

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : undefined;
}

function longText(value: unknown, max: number) {
  if (typeof value !== 'string') return undefined;
  return value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

function amount(value: unknown, max: number): number | null | undefined {
  if (value === null || value === '') return null;
  const digits = typeof value === 'string' ? value.replace(/[^\d.,]/g, '') : '';
  // Text with no digits ("lots") is not a number; it must not become zero.
  const parsed = typeof value === 'number' ? value : digits ? Number(digits.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')) : NaN;
  if (!Number.isFinite(parsed)) return undefined;
  return parsed >= 0 && parsed <= max ? Math.round(parsed * 100) / 100 : undefined;
}

export function validEmail(value: string) {
  return value.length <= LIMITS.email && EMAIL.test(value);
}

export function validPhone(value: string) {
  return value.length <= LIMITS.phone && PHONE.test(value) && (value.match(/\d/g) || []).length >= 6;
}

/** A blank seller draft, for someone who starts with photos only. */
export function blankListing(options: { id: string; locale: 'en' | 'de'; propertyType: ListingType; now: string }): Listing {
  return {
    id: options.id,
    status: 'draft',
    origin: 'seller',
    locale: options.locale,
    propertyType: options.propertyType,
    title: '',
    description: '',
    autoTitle: true,
    autoDescription: true,
    facts: { price: 0, area: 0, rooms: null, floor: '', year: '', plotArea: null, condition: '', energyClass: '', heating: '', housegeld: null, availableFrom: '', features: [] },
    address: { street: '', postalCode: '', city: '', district: '', showExactAddress: false },
    market: null,
    geo: null,
    photos: [],
    contact: emptyContact(),
    sourceUrl: null,
    sourceName: null,
    reportId: null,
    score: null,
    consent: false,
    createdAt: options.now,
    updatedAt: options.now,
    publishedAt: null,
  };
}

/** The headline a reader sees: the seller's own, or one generated in the reader's language. */
export function displayTitle(listing: Listing, locale: 'en' | 'de') {
  return listing.autoTitle || !listing.title ? generatedTitle(listing, locale) : listing.title;
}

export function displayDescription(listing: Listing, locale: 'en' | 'de') {
  return listing.autoDescription || !listing.description ? generatedDescription(listing, locale) : listing.description;
}

export type ListingPatch = {
  propertyType?: unknown;
  title?: unknown;
  description?: unknown;
  facts?: Record<string, unknown>;
  address?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  photoOrder?: unknown;
  consent?: unknown;
};

/**
 * Applies the fields a seller may edit. Unknown keys are ignored, and a value that
 * does not parse leaves the stored value in place rather than clearing it.
 */
export function applyPatch(listing: Listing, patch: ListingPatch, now: string): Listing {
  const next: Listing = { ...listing, facts: { ...listing.facts }, address: { ...listing.address }, contact: { ...listing.contact } };
  if (patch.propertyType === 'flat' || patch.propertyType === 'house' || patch.propertyType === 'land') next.propertyType = patch.propertyType;
  // Writing text switches the generated version off; clearing it switches it back on.
  const title = text(patch.title, LIMITS.title);
  if (title !== undefined) { next.title = title; next.autoTitle = !title; }
  const description = longText(patch.description, LIMITS.description);
  if (description !== undefined) { next.description = description; next.autoDescription = !description; }

  const facts = patch.facts && typeof patch.facts === 'object' ? patch.facts : {};
  const price = amount(facts.price, 200_000_000);
  if (price !== undefined) next.facts.price = Math.round(price || 0);
  const area = amount(facts.area, 100_000);
  if (area !== undefined) next.facts.area = area || 0;
  const plotArea = amount(facts.plotArea, 10_000_000);
  if (plotArea !== undefined) next.facts.plotArea = plotArea;
  const housegeld = amount(facts.housegeld, 100_000);
  if (housegeld !== undefined) next.facts.housegeld = housegeld === null ? null : Math.round(housegeld);
  if ('rooms' in facts) next.facts.rooms = facts.rooms === null || facts.rooms === '' ? null : parseRooms(facts.rooms) ?? next.facts.rooms;
  for (const key of ['floor', 'heating', 'condition', 'availableFrom'] as const) {
    const value = text(facts[key], LIMITS.text);
    if (value !== undefined) next.facts[key] = value;
  }
  const year = text(facts.year, 4);
  if (year !== undefined && (year === '' || /^(1[5-9]\d\d|20\d\d)$/.test(year))) next.facts.year = year;
  const energyClass = text(facts.energyClass, 2);
  if (energyClass !== undefined && (energyClass === '' || ENERGY_CLASSES.includes(energyClass.toUpperCase()))) next.facts.energyClass = energyClass.toUpperCase();
  if (Array.isArray(facts.features)) next.facts.features = featureKeys(facts.features.filter((value): value is string => typeof value === 'string'));

  const address = patch.address && typeof patch.address === 'object' ? patch.address : {};
  const street = text(address.street, LIMITS.street);
  if (street !== undefined) next.address.street = street;
  const postalCode = text(address.postalCode, 5);
  if (postalCode !== undefined && (postalCode === '' || /^\d{5}$/.test(postalCode))) next.address.postalCode = postalCode;
  for (const key of ['city', 'district'] as const) {
    const value = text(address[key], LIMITS.text);
    if (value !== undefined) next.address[key] = value;
  }
  if (typeof address.showExactAddress === 'boolean') next.address.showExactAddress = address.showExactAddress;

  const contact = patch.contact && typeof patch.contact === 'object' ? patch.contact : {};
  const name = text(contact.name, LIMITS.name);
  if (name !== undefined) next.contact.name = name;
  const email = text(contact.email, LIMITS.email);
  if (email !== undefined) next.contact.email = email.toLowerCase();
  const phone = text(contact.phone, LIMITS.phone);
  if (phone !== undefined) next.contact.phone = phone;
  if (typeof contact.showEmail === 'boolean') next.contact.showEmail = contact.showEmail;
  if (typeof contact.showPhone === 'boolean') next.contact.showPhone = contact.showPhone;

  if (Array.isArray(patch.photoOrder)) next.photos = reorderPhotos(listing.photos, patch.photoOrder);
  if (typeof patch.consent === 'boolean') next.consent = patch.consent;

  if (next.propertyType === 'land') {
    next.facts.area = 0;
    next.facts.rooms = null;
    next.facts.floor = '';
    next.facts.housegeld = null;
  }
  if (next.propertyType === 'house') next.facts.housegeld = null;
  next.market = marketFor(next.address);
  // A changed address makes the stored pin wrong. The server geocodes again before publishing.
  if (next.address.street !== listing.address.street || next.address.postalCode !== listing.address.postalCode || next.address.city !== listing.address.city) next.geo = null;
  next.updatedAt = now;
  return next;
}

export function photoKey(photo: ListingPhoto) {
  return photo.kind === 'stored' ? photo.id : photo.url;
}

/** Keeps every existing photo exactly once, in the requested order first. */
export function reorderPhotos(photos: ListingPhoto[], order: unknown[]): ListingPhoto[] {
  const byKey = new Map(photos.map(photo => [photoKey(photo), photo]));
  const ordered: ListingPhoto[] = [];
  for (const key of order) {
    if (typeof key !== 'string') continue;
    const photo = byKey.get(key);
    if (photo) { ordered.push(photo); byKey.delete(key); }
  }
  return [...ordered, ...byKey.values()];
}

export type ReadinessItem = 'title' | 'price' | 'size' | 'location' | 'photos' | 'contact' | 'consent';

/** What is still missing before a seller listing can go live, in the order the editor asks for it. */
export function missingForPublish(listing: Listing): ReadinessItem[] {
  const missing: ReadinessItem[] = [];
  if (displayTitle(listing, listing.locale).trim().length < 6) missing.push('title');
  if (!(listing.facts.price > 0)) missing.push('price');
  if (listing.propertyType === 'land' ? !(listing.facts.plotArea && listing.facts.plotArea > 0) : !(listing.facts.area > 0)) missing.push('size');
  if (!listing.address.city || !(listing.address.street || listing.address.postalCode)) missing.push('location');
  if (!listing.photos.length) missing.push('photos');
  const email = validEmail(listing.contact.email);
  const phone = listing.contact.phone ? validPhone(listing.contact.phone) : false;
  if (!email || (listing.contact.phone && !phone) || !((listing.contact.showEmail && email) || (listing.contact.showPhone && phone))) missing.push('contact');
  if (!listing.consent) missing.push('consent');
  return missing;
}

/** The street without its house number, for sellers who show the area only. */
export function streetOnly(street: string) {
  return street.replace(/\s+\d+\s*[a-z]?(?:\s*[-–/]\s*\d+\s*[a-z]?)?\s*$/i, '').trim();
}

/** Rounds a pin to about 300 m, so a hidden house number is not revealed by the map. */
export function blurredGeo(geo: Listing['geo']): Listing['geo'] {
  if (!geo) return null;
  return { lat: Math.round(geo.lat * 300) / 300, lon: Math.round(geo.lon * 200) / 200, precision: 'postcode' };
}

/** The public copy of a listing: hidden contact fields and an exact address the seller did not share are removed. */
export function publicListing(listing: Listing): Listing {
  const exact = listing.address.showExactAddress;
  return {
    ...listing,
    address: exact ? listing.address : { ...listing.address, street: streetOnly(listing.address.street) },
    geo: exact ? listing.geo : blurredGeo(listing.geo),
    contact: {
      name: listing.contact.name,
      email: listing.contact.showEmail ? listing.contact.email : '',
      phone: listing.contact.showPhone ? listing.contact.phone : '',
      showEmail: listing.contact.showEmail,
      showPhone: listing.contact.showPhone,
    },
  };
}

export function photoSrc(listingId: string, photo: ListingPhoto, variant: 'full' | 'thumb' = 'full') {
  return photo.kind === 'remote' ? photo.url : `/api/listings/${listingId}/photos/${photo.id}${variant === 'thumb' ? '?v=thumb' : ''}`;
}

export function listingSummary(listing: Listing, locale: 'en' | 'de' = listing.locale): ListingSummary {
  const shown = publicListing(listing);
  return {
    id: listing.id,
    title: displayTitle(listing, locale),
    propertyType: listing.propertyType,
    price: listing.facts.price,
    area: listing.facts.area,
    plotArea: listing.facts.plotArea,
    rooms: listing.facts.rooms,
    floor: listing.facts.floor,
    district: listing.address.district,
    city: listing.address.city,
    market: listing.market,
    lat: shown.geo?.lat ?? null,
    lon: shown.geo?.lon ?? null,
    photos: listing.photos.slice(0, 8).map(photo => photoSrc(listing.id, photo, 'thumb')),
    score: listing.score,
    reportId: listing.reportId,
    origin: listing.origin,
    publishedAt: listing.publishedAt || listing.updatedAt,
  };
}
