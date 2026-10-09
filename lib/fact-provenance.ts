import { area, money } from './format.ts';
import { acquisitionCosts } from './finance.ts';
import { copy, type Locale } from './i18n.ts';
import { factSourceCopy } from './fact-source-copy.ts';
import { glossListingQuote } from './listing-gloss.ts';
import { priceCheckCitation } from './price-check-copy.ts';
import { FACT_KEYS } from './fact-evidence.ts';
import type { FactKey, Report } from './types.ts';

/**
 * Read-time kinds. Stated quotes stay on the report; these are not stored.
 * F03 registers itemised buyer-cost lines. This module does not compute tax or notary fees.
 */
export type ProvenanceKind = 'stated' | 'calculated' | 'estimated' | 'official' | 'notStated';

export const DERIVED_PROVENANCE = {
  perSqm: 'calculated',
  totalFromParts: 'calculated',
  transferTax: 'calculated',
  notary: 'estimated',
  unknownStateTax: 'estimated',
  estimatedBuyerCosts: 'estimated',
  priceCheck: 'official',
  mortgageRate: 'official',
} as const;

export type DerivedProvenanceKey = keyof typeof DERIVED_PROVENANCE;

/** Feedback may name a stored fact or a derived line. F03 keys are reserved. */
export const FEEDBACK_FIELDS = [
  ...FACT_KEYS,
  'perSqm',
  'plotArea',
  'condition',
  'sunOrientation',
  'daylight',
  'priceCheck',
  'mortgageRate',
  'totalCost',
  'transferTax',
  'notary',
  'grossYield',
] as const;

export type FeedbackField = (typeof FEEDBACK_FIELDS)[number];

export function isFeedbackField(value: string): value is FeedbackField {
  return (FEEDBACK_FIELDS as readonly string[]).includes(value);
}

export type BuyerCostProvenanceLine = {
  key: 'transferTax' | 'notary' | 'agentCommission' | 'buyerCosts';
  kind: 'calculated' | 'estimated' | 'stated';
  detail: { en: string; de: string };
};

type BuyerCostProvider = (report: Report) => BuyerCostProvenanceLine[] | undefined;

let buyerCostProvider: BuyerCostProvider | undefined;

/** F03 calls this. Passing nothing clears a previous registration (tests). */
export function registerBuyerCostProvenance(provider?: BuyerCostProvider) {
  buyerCostProvider = provider;
}

export function buyerCostProvenanceLines(report: Report) {
  return buyerCostProvider?.(report);
}

export type FactProvenance = {
  field: FeedbackField;
  kind: ProvenanceKind;
  quotes: string[];
  formula?: string;
  basis?: string;
  source?: string;
  reportedValue: string;
};

export function perSqmFormula(report: Report, locale: Locale) {
  if (!(report.facts.price > 0) || !(report.facts.area > 0)) return '';
  return `${money(report.facts.price, locale)} ÷ ${area(report.facts.area, locale)}`;
}

const FIELD_LABEL: Record<FactKey, (locale: Locale) => string> = {
  price: locale => copy[locale].report.asking,
  area: locale => copy[locale].report.living,
  usableArea: locale => copy[locale].report.usable,
  rooms: locale => copy[locale].report.rooms,
  year: locale => copy[locale].report.built,
  floor: locale => copy[locale].report.floor,
  energy: locale => copy[locale].report.energy,
  energyDemand: locale => (locale === 'de' ? 'Energiebedarf' : 'Energy demand'),
  heating: locale => copy[locale].report.heating,
  housegeld: () => 'Hausgeld',
  buyerCommission: locale => copy[locale].report.commission,
  buyerCosts: locale => copy[locale].finance.buyerCosts,
  tenancy: locale => copy[locale].report.use,
  availabilityDate: locale => (locale === 'de' ? 'Bezugsdatum' : 'Availability'),
  address: locale => (locale === 'de' ? 'Adresse' : 'Address'),
  advertisedYield: locale => copy[locale].report.return,
};

export function factFieldLabel(field: FactKey, locale: Locale) {
  return FIELD_LABEL[field](locale);
}

export function labelledFactEvidence(report: Report, locale: Locale) {
  const evidence = report.factEvidence || {};
  return FACT_KEYS.flatMap(field => {
    const excerpt = evidence[field]?.excerpt;
    return excerpt ? [{ field, label: factFieldLabel(field, locale), excerpt }] : [];
  });
}

function statedProvenance(report: Report, field: FactKey, reportedValue: string): FactProvenance {
  const quotes = [report.factEvidence?.[field]?.excerpt].filter((quote): quote is string => Boolean(quote));
  if (field === 'energy') {
    const demand = report.factEvidence?.energyDemand?.excerpt;
    if (demand && !quotes.includes(demand)) quotes.push(demand);
  }
  return { field, kind: 'stated', quotes, reportedValue };
}

function fromRegisteredCosts(report: Report, field: FeedbackField, reportedValue: string, locale: Locale): FactProvenance | undefined {
  const lines = buyerCostProvenanceLines(report);
  if (!lines?.length) return undefined;
  const wanted = field === 'notary' || field === 'transferTax' || field === 'buyerCosts'
    ? lines.filter(line => line.key === field || (field === 'buyerCosts' && line.key === 'buyerCosts'))
    : lines;
  const relevant = wanted.length ? wanted : lines;
  const estimated = relevant.filter(line => line.kind === 'estimated');
  if (estimated.length) {
    return { field, kind: 'estimated', quotes: [], basis: estimated.map(line => line.detail[locale]).join(' · '), reportedValue };
  }
  const calculated = relevant.filter(line => line.kind === 'calculated');
  if (calculated.length) {
    return { field, kind: 'calculated', quotes: [], formula: calculated.map(line => line.detail[locale]).join(' · '), reportedValue };
  }
  const stated = relevant.find(line => line.kind === 'stated');
  if (stated) return { field, kind: 'stated', quotes: [stated.detail[locale]], reportedValue };
  return undefined;
}

export function provenanceForField(report: Report, field: FeedbackField, reportedValue: string, locale: Locale): FactProvenance {
  if (field === 'perSqm') {
    return { field, kind: 'calculated', quotes: [], formula: perSqmFormula(report, locale), reportedValue };
  }
  if (field === 'grossYield') {
    return { field, kind: 'calculated', quotes: [], formula: factSourceCopy[locale].grossYieldFormula, reportedValue };
  }
  if (field === 'priceCheck') {
    const source = priceCheckCitation(report, locale);
    if (!source) return { field, kind: 'official', quotes: [], reportedValue };
    return { field, kind: 'official', quotes: [], source, reportedValue };
  }
  if (field === 'mortgageRate') {
    return { field, kind: 'official', quotes: [], source: factSourceCopy[locale].fmhSource, reportedValue };
  }
  if (field === 'buyerCosts' || field === 'totalCost' || field === 'transferTax' || field === 'notary') {
    const registered = fromRegisteredCosts(report, field, reportedValue, locale);
    if (registered) return registered;
    const costs = acquisitionCosts(report.facts);
    if (field === 'buyerCosts' && report.factEvidence?.buyerCosts?.excerpt) {
      return { field, kind: 'stated', quotes: [report.factEvidence.buyerCosts.excerpt], reportedValue };
    }
    if (costs.buyerCostsAreEstimated && (field === 'buyerCosts' || field === 'totalCost')) {
      return { field, kind: 'estimated', quotes: [], basis: factSourceCopy[locale].buyerCostsUnstated, reportedValue };
    }
    if (field === 'totalCost' && report.facts.price > 0 && typeof report.facts.buyerCosts === 'number') {
      const sum = report.facts.price + report.facts.buyerCosts;
      if (Math.abs(sum - costs.total) <= 2) {
        return {
          field,
          kind: 'calculated',
          quotes: [],
          formula: `${money(report.facts.price, locale)} + ${money(report.facts.buyerCosts, locale)}`,
          reportedValue,
        };
      }
    }
    if (field === 'notary' || field === 'transferTax') {
      return { field, kind: 'notStated', quotes: [], reportedValue };
    }
    return { field: field === 'totalCost' ? 'totalCost' : 'buyerCosts', kind: 'stated', quotes: [], reportedValue };
  }
  if ((FACT_KEYS as readonly string[]).includes(field)) {
    return statedProvenance(report, field as FactKey, reportedValue);
  }
  return { field, kind: 'stated', quotes: [], reportedValue };
}

export function provenanceSentence(provenance: FactProvenance, locale: Locale) {
  const text = factSourceCopy[locale];
  if (provenance.kind === 'calculated' && provenance.formula) return text.calculated(provenance.formula);
  if (provenance.kind === 'estimated' && provenance.basis) return text.estimate(provenance.basis);
  if (provenance.kind === 'official' && provenance.source) return text.official(provenance.source);
  if (provenance.kind === 'official' && provenance.field === 'priceCheck') return text.priceCheckUnsourced;
  if (provenance.kind === 'notStated') return text.notStated;
  if (provenance.quotes.length) return provenance.quotes.map(quote => `${text.fromListing} ${glossListingQuote(quote, locale)}`).join('\n');
  return text.noQuote;
}

const PRINT_MAX = 120;

export function printExcerpt(excerpt: string) {
  const clean = excerpt.replace(/\s+/g, ' ').trim();
  if (clean.length <= PRINT_MAX) return clean;
  const cut = clean.slice(0, PRINT_MAX - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 70 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function printSourceNotes(report: Report, locale: Locale) {
  return labelledFactEvidence(report, locale).map((item, index) => ({
    ...item,
    n: index + 1,
    excerpt: printExcerpt(item.excerpt),
  }));
}
