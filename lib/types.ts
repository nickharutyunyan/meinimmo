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
  housegeld?: number;
  tenancy?: string;
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

export type Report = {
  id: string;
  title: string;
  address: string;
  location?: string;
  propertyType: 'flat' | 'house';
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
  locationEvidence?: string;
};
export type Comparison = { id: string; reportIds: [string, string]; createdAt: string };
