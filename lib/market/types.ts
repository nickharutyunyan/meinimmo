export type MarketSlug = 'berlin' | 'munich' | 'cologne';
export type ListingStatus = 'draft' | 'published' | 'archived';
export type ListingOrigin = 'seller' | 'imported';
export type ListingType = 'flat' | 'house' | 'land';

/**
 * A seller photo lives in D1 and is served from /api/listings/{id}/photos/{photoId}.
 * An imported photo is the portal's own URL, hotlinked and never copied.
 */
export type ListingPhoto =
  | { kind: 'stored'; id: string; width: number; height: number }
  | { kind: 'remote'; url: string };

export type ListingContact = {
  name: string;
  email: string;
  phone: string;
  showEmail: boolean;
  showPhone: boolean;
};

export type ListingFacts = {
  price: number;
  /** Living area. Zero for land. */
  area: number;
  rooms: number | null;
  /** Free text such as "3rd floor" or "EG", as the seller writes it. */
  floor: string;
  year: string;
  plotArea: number | null;
  condition: string;
  energyClass: string;
  heating: string;
  /** Monthly Hausgeld in euros. Flats only. */
  housegeld: number | null;
  availableFrom: string;
  features: string[];
};

export type ListingAddress = {
  street: string;
  postalCode: string;
  city: string;
  district: string;
  /** False shows the street without the house number, and the map pin is blurred to the area. */
  showExactAddress: boolean;
};

export type Listing = {
  id: string;
  status: ListingStatus;
  origin: ListingOrigin;
  /** The language the seller wrote in. Imported listings use German. */
  locale: 'en' | 'de';
  propertyType: ListingType;
  /** Seller text. Empty while `autoTitle` / `autoDescription` is on. */
  title: string;
  description: string;
  /** Generated text follows the facts and the reader's language until the seller writes their own. */
  autoTitle: boolean;
  autoDescription: boolean;
  facts: ListingFacts;
  address: ListingAddress;
  market: MarketSlug | null;
  geo: { lat: number; lon: number; precision: 'street' | 'postcode' } | null;
  photos: ListingPhoto[];
  contact: ListingContact;
  /** Imported listings: the portal page buyers contact through. */
  sourceUrl: string | null;
  sourceName: string | null;
  /** Our own review of this listing. Free to open for every visitor. */
  reportId: string | null;
  score: number | null;
  /** The seller confirmed they may sell the property and own the photos. */
  consent: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

/** What the search list and the map need, and nothing else. */
export type ListingSummary = {
  id: string;
  title: string;
  propertyType: ListingType;
  price: number;
  area: number;
  plotArea: number | null;
  rooms: number | null;
  floor: string;
  district: string;
  city: string;
  market: MarketSlug | null;
  lat: number | null;
  lon: number | null;
  photos: string[];
  score: number | null;
  reportId: string | null;
  origin: ListingOrigin;
  publishedAt: string;
};
