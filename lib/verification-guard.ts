import type { Report } from './types';
import { canonicalCondition } from './property-condition.ts';
import { reportConflicts } from './report-integrity.ts';

/** Extraction is not verification. Model suggestions cannot erase source conflicts
 * or silently overwrite an already evidenced deterministic field.
 * A real successful check is the only path that sets the fact-check flags. */
export function guardEnrichment(original: Report, candidate: Report): Report {
  if (reportConflicts(original).length) return { ...original, verificationAttempted: true, aiFactChecked: false, aiLocationChecked: false };
  const facts = { ...candidate.facts };
  let disputed = false;
  for (const key of Object.keys(original.facts) as Array<keyof Report['facts']>) {
    const value = original.facts[key];
    if (value !== undefined && value !== 0 && value !== '' && value !== 'not stated') {
      if (!sameFact(candidate.facts[key], value)) disputed = true;
      Object.assign(facts, { [key]: value });
    }
  }
  const aiFactChecked = Boolean(candidate.aiFactChecked) && !disputed;
  const aiLocationChecked = Boolean(candidate.aiLocationChecked) && !disputed;
  return { ...candidate, facts, evidence: original.evidence, verificationAttempted: true, aiFactChecked, aiLocationChecked };
}

function sameFact(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const FACT_FIELDS = ['propertyType', 'price', 'rooms', 'area', 'housegeld', 'occupancy', 'condition', 'year', 'floor', 'energy'] as const;

function excerpt(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalized(value: string) {
  return value.normalize('NFKD').toLocaleLowerCase('de-DE').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function inSource(source: string, value: string) {
  const needle = normalized(value);
  return needle.length >= 3 && normalized(source).includes(needle);
}

function hasNumber(quote: string, value: number) {
  const compact = quote
    .replace(/(\d)[.\s](?=\d{3}(?:\D|$))/g, '$1')
    .replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1')
    .replace(/(\d),(?=\d{1,2}(?:\D|$))/g, '$1.');
  if (Number.isInteger(value)) return new RegExp(`(?<![\\d.])${value}(?![\\d])`).test(compact);
  return compact.includes(String(value));
}

function stated(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? String(value) : '';
  if (typeof value !== 'string') return '';
  const clean = value.trim();
  if (!clean || /^(?:not stated|unknown|n\/a)$/i.test(clean)) return '';
  return clean;
}

function extractedFact(report: Report, field: typeof FACT_FIELDS[number]) {
  if (field === 'propertyType') return report.propertyType;
  if (field === 'occupancy') return stated(report.facts.tenancy);
  if (field === 'price') return report.facts.price > 0 ? String(report.facts.price) : '';
  if (field === 'area') return report.facts.area > 0 ? String(report.facts.area) : '';
  if (field === 'housegeld') return report.facts.housegeld ? String(report.facts.housegeld) : '';
  if (field === 'year') return stated(report.facts.year);
  if (field === 'floor') return stated(report.facts.floor);
  if (field === 'energy') return stated(report.facts.energy);
  if (field === 'rooms') return stated(report.facts.rooms);
  if (field === 'condition') return stated(report.facts.condition);
  return '';
}

function supports(field: typeof FACT_FIELDS[number], extracted: string, quote: string) {
  if (field === 'price' || field === 'area' || field === 'housegeld') return hasNumber(quote, Number(extracted));
  if (field === 'rooms') return hasNumber(quote, Number(extracted.replace(',', '.')));
  if (field === 'year') return quote.includes(extracted);
  if (field === 'floor') return normalized(quote).includes(normalized(extracted));
  if (field === 'energy') return new RegExp(`(?:^|[^A-H])${extracted.replace('+', '\\+')}(?:[^A-H+]|$)`, 'i').test(quote);
  if (field === 'propertyType') {
    if (extracted === 'house') return /\b(?:haus|bungalow|house)\b/i.test(quote);
    return /\b(?:wohnung|apartment|eigentumswohnung|maisonette)\b/i.test(quote);
  }
  if (field === 'occupancy') {
    if (extracted === 'Rented') return /\b(?:vermietet|rented|tenant)\b/i.test(quote) && !/(?:nicht|un)\s*vermietet/i.test(quote);
    if (extracted === 'Occupancy unclear') return /bewohnt|vermietet|occup/i.test(quote);
    return /nicht\s+vermietet|unvermietet|bezugsfrei|leerstehend|eigengenutzt|vacant|owner[- ]occupied/i.test(quote);
  }
  const mapped = canonicalCondition(quote);
  return mapped === extracted || normalized(quote).includes(normalized(extracted));
}

/**
 * OpenRouter fact check succeeds only when every extracted field the model was
 * asked about is backed by a verbatim source excerpt that agrees with it.
 * Missing, invented or disagreeing excerpts stay unchecked.
 */
export function openRouterFactCheckAccepted(report: Report, payload: unknown, source: string) {
  const failed = { facts: false, location: false };
  if (!payload || typeof payload !== 'object' || !source) return failed;
  const body = payload as { factEvidence?: unknown; location?: unknown };
  if (!body.factEvidence || typeof body.factEvidence !== 'object') return { facts: false, location: locationAccepted(report, body.location, source) };
  const record = body.factEvidence as Record<string, unknown>;
  let confirmed = 0;
  for (const field of FACT_FIELDS) {
    const extracted = extractedFact(report, field);
    const quote = excerpt(record[field]);
    if (!extracted) {
      if (quote && !inSource(source, quote)) return { facts: false, location: false };
      continue;
    }
    if (!quote || !inSource(source, quote) || !supports(field, extracted, quote)) return { facts: false, location: false };
    confirmed += 1;
  }
  return { facts: confirmed > 0, location: locationAccepted(report, body.location, source) };
}

function locationAccepted(report: Report, value: unknown, source: string) {
  if (!value || typeof value !== 'object') return false;
  const location = value as { city?: unknown; postalCode?: unknown; evidence?: unknown };
  const evidence = excerpt(location.evidence);
  const city = excerpt(location.city);
  const postal = excerpt(location.postalCode);
  if (evidence && !inSource(source, evidence)) return false;
  if (city && !inSource(source, city)) return false;
  if (postal && !inSource(source, postal)) return false;
  if (report.facts.city) {
    const blob = `${city} ${evidence}`;
    if (!blob.toLocaleLowerCase('de-DE').includes(report.facts.city.toLocaleLowerCase('de-DE'))) return false;
  }
  if (report.facts.postalCode && !`${postal} ${evidence}`.includes(report.facts.postalCode)) return false;
  return Boolean(report.facts.city || report.facts.postalCode);
}
