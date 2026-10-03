import type { FactualTaxonomy, TaxonomyEvidence } from './property-taxonomy';

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
  brokerFee?: number;
  buyerCommission?: string;
  housegeld?: number;
  housegeldYear?: string;
  tenancy?: string;
  availabilityDate?: string;
  advertisedYield?: number;
  condition?: string;
  features?: string[];
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
};

export type ScoreBreakdown = {
  price: number;
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
  evidence?: Record<string, string[]>;
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
  source: string;
  sourceFile?: {
    displayName: string;
    size: number;
  };
  createdAt: string;
  facts: Facts;
  score: number;
  scoreTitle?: string;
  scoreBreakdown?: ScoreBreakdown;
  summary: string;
  considerations: string[];
  offerQuestions?: string[];
  offerQuestionsDe?: string[];
  sunOrientation: string;
  daylight?: string;
  qualityWarnings?: string[];
  aiEnriched: boolean;
  aiLocationChecked?: boolean;
  aiFactChecked?: boolean;
  jevCategorized?: boolean;
  categories?: PropertyCategories;
  taxonomyEvidence?: TaxonomyEvidence;
  taxonomy?: FactualTaxonomy;
  locationEvidence?: string;
};
export type Comparison = { id: string; reportIds: [string, string]; createdAt: string };
