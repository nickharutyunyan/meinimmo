import type { FactualTaxonomy, TaxonomyEvidence } from './property-taxonomy';
import type { RedFlag } from './red-flags';

/** Fields a buyer can trace to one listing sentence. Derived figures are not stored here. */
export type FactKey =
  | 'price'
  | 'area'
  | 'usableArea'
  | 'rooms'
  | 'year'
  | 'floor'
  | 'energy'
  | 'energyDemand'
  | 'heating'
  | 'housegeld'
  | 'buyerCommission'
  | 'buyerCosts'
  | 'tenancy'
  | 'availabilityDate'
  | 'address'
  | 'advertisedYield';

export type StatedFactEvidence = { excerpt: string; kind: 'stated' };

export type FactEvidence = Partial<Record<FactKey, StatedFactEvidence>>;

export type Facts = {
  price: number;
  area: number;
  usableArea?: number;
  rooms: string;
  year: string;
  floor: string;
  energy: string;
  heating: string;
  energySource?: string;
  energyDemand?: number;
  energyCertificate?: string;
  totalCost: number;
  buyerCosts?: number;
  parkingPrice?: number;
  brokerFee?: number;
  buyerCommission?: string;
  housegeld?: number;
  housegeldYear?: string;
  tenancy?: string;
  /** Table says not rented, but the description says the property is rented. */
  tenancyConflict?: boolean;
  /** Verbatim fragment such as "Ende November 2026". */
  rentedUntilText?: string;
  availabilityDate?: string;
  /** Year the current tenancy started, when the listing states it. */
  tenancySinceYear?: number;
  /** The listing states an active Sperrfrist or eviction ban. */
  evictionBan?: boolean;
  /** Whole building sold as an investment. A single flat or house is not one. */
  investmentUse?: boolean;
  /** Gross yield from the stated net cold rent, in percent. */
  grossYield?: number;
  plotArea?: number;
  soldAsIs?: boolean;
  /** Timber-frame construction, when the listing states it for this building. */
  construction?: string;
  groundLease?: boolean;
  /** Erbbaurecht and a Pachtgrundstück are different rights. */
  groundLeaseKind?: 'leasehold' | 'pacht' | 'both';
  groundRentYear?: number;
  groundRentMonth?: number;
  groundRentInServiceCharge?: boolean;
  heatingYear?: number;
  advertisedYield?: number;
  condition?: string;
  features?: string[];
  /** Garden is stated as private use (Sondernutzungsrecht), not a shared courtyard. */
  privateGarden?: boolean;
  postalCode?: string;
  city?: string;
  district?: string;
  street?: string;
  transitStop?: string;
  locationPrecision?: 'address' | 'street' | 'neighborhood' | 'postal' | 'transit' | 'city';
  neighborhood?: {
    transitMinutes?: number;
    parkMinutes?: number;
    dailyNeedsMinutes?: number;
    transitMentioned?: boolean;
    parkMentioned?: boolean;
    dailyNeedsMentioned?: boolean;
  };
  /** Absolute https image URLs from the listing page, including any signed query. Bytes are never stored. */
  photoUrls?: string[];
  /** Caption or listing-text marks for AI staging. Indexes point into the displayable photo list. Not a pixel check. */
  photoStaging?: { indexes: number[]; listingWide: boolean };
  /** Earliest `exp` unix time among stored `photoUrls`, as an ISO timestamp. Display does not use this as a strip-wide cutoff. */
  photosExpireAt?: string;
};

export type ScoreBreakdown = {
  /** Null outside areas with official local sales prices. Excluded from the total. */
  price: number | null;
  neighborhood: number;
  space: number;
  building: number;
  energy: number;
  light: number;
  costs: number;
  source: number;
};

export type PropertyCategoryDecision = {
  value: string;
  confidence: number;
};

export type PropertyCategories = {
  schemaVersion: 1;
  model: string;
  buildingProfile: PropertyCategoryDecision;
  buyerFit: PropertyCategoryDecision;
  locationStyle: PropertyCategoryDecision;
  purchaseSituation: PropertyCategoryDecision;
};

export type Report = {
  extractionVersion?: number;
  verificationAttempted?: boolean;
  sourceUnavailable?: boolean;
  sourceReviewAttemptedAt?: string;
  /** Legacy excerpts. Kept for reports saved before value-matched evidence. Not shown. */
  evidence?: Record<string, string[]>;
  /** Value-matched listing quotes, stored at parse time. Views do not re-parse. */
  factEvidence?: FactEvidence;
  country?: 'DE' | 'AM';
  armenia?: {
    currency: 'AMD';
    originalPrice: number;
    originalCurrency: 'AMD' | 'USD' | 'EUR' | 'RUB';
    priceBasis: 'total' | 'per-m2';
    fx?: { rate: number; date: string; sourceUrl: string };
    plotArea?: number;
    livingArea?: number;
    landUse?: string;
    buildingFloors?: number;
    construction?: string;
    renovation?: string;
    newConstruction?: boolean;
    elevator?: string;
    balcony?: string;
    utilities?: string;
    roadAccess?: string;
    approximate: boolean;
    sourceUpdated?: string;
    importMethod: 'url' | 'text' | 'pdf' | 'browser';
    evidence: Record<string, string>;
  };
  id: string;
  title: string;
  address: string;
  location?: string;
  propertyType: 'flat' | 'house' | 'land';
  /** Where propertyType came from. Fallback means the listing did not state a type. */
  typeSource?: 'structured' | 'keyword' | 'fallback';
  source: string;
  sourceFile?: {
    displayName: string;
    size: number;
  };
  createdAt: string;
  facts: Facts;
  /** Null when the page withholds the score, so the API cannot show a number the page hides. */
  score: number | null;
  /** Legacy stored phrase. Never shown. New reports leave it unset. */
  scoreTitle?: string;
  scoreBreakdown?: ScoreBreakdown;
  summary: string;
  considerations: string[];
  offerQuestions?: string[];
  offerQuestionsDe?: string[];
  sunOrientation: string;
  daylight?: string;
  qualityWarnings?: string[];
  redFlags?: RedFlag[];
  aiEnriched: boolean;
  aiLocationChecked?: boolean;
  aiFactChecked?: boolean;
  jevCategorized?: boolean;
  categories?: PropertyCategories;
  taxonomyEvidence?: TaxonomyEvidence;
  taxonomy?: FactualTaxonomy;
  locationEvidence?: string;
  /** One Nominatim result stored with the report. Later views read this and do not geocode again. */
  geocode?: {
    lat: number;
    lon: number;
    /** street: a street or house number was stated. postcode: only a coarser area was stated. */
    precision: 'street' | 'postcode';
  };
};
export type Comparison = { id: string; reportIds: [string, string]; createdAt: string };
