import type { Report, ScoreBreakdown } from './types';
import { copy, type Locale } from './i18n.ts';
import { validStreet } from './location-validation.ts';
import { calculatePropertyScore, energyClassGap, missingKeyFacts, scoreConfidence, scoreConfidenceLabel } from './property-score.ts';

export const EXTRACTION_VERSION = 2026100806;

export const STALE_REPORT_WARNING = 'This saved report needs a fresh source review. Re-import the listing or upload its Exposé.';

/** A rollback must not treat a newer saved extraction as stale or re-score it. */
export function storedVersionIsNewer(version: number | null | undefined) {
  return typeof version === 'number' && Number.isFinite(version) && version > EXTRACTION_VERSION;
}

/**
 * Only a strictly older extraction is stale. A missing version is older.
 * A newer version is fresh: its stored score stays, and backfill must not select it.
 * Armenian reports use their own rubric.
 */
export function reportIsStale(report: Pick<Report, 'country' | 'extractionVersion' | 'sourceUnavailable'>) {
  if (storedVersionIsNewer(report.extractionVersion)) return false;
  if (report.sourceUnavailable) return true;
  if (report.country === 'AM') return false;
  if (typeof report.extractionVersion !== 'number' || !Number.isFinite(report.extractionVersion)) return true;
  return report.extractionVersion < EXTRACTION_VERSION;
}

/** Attach the stale warning for this response. Does not read archived HTML or write D1. */
export function presentStoredReport<T extends Report>(report: T): T {
  if (!reportIsStale(report)) return report;
  if ((report.qualityWarnings || []).includes(STALE_REPORT_WARNING)) return report;
  return { ...report, qualityWarnings: [...(report.qualityWarnings || []), STALE_REPORT_WARNING] };
}

const CONFLICT_NOTE = /conflicting|conflicts with|occupants remain|class and consumption|needs a fresh source review/i;

export function reportConflicts(report: Report) {
  const problems: string[] = [];
  const f = report.facts;
  if (reportIsStale(report)) problems.push(STALE_REPORT_WARNING);
  if (f.street && !validStreet(f.street)) problems.push('The extracted street is not a valid property location.');
  if (f.buyerCosts !== undefined && f.totalCost >= f.price && Math.abs(f.price + f.buyerCosts - f.totalCost) > 2) problems.push('The stated purchase price, buyer costs and total do not agree. Financing uses the stated total; confirm the breakdown.');
  if (/^New build$/i.test(f.condition || '') && Number(f.year) < Number(report.createdAt.slice(0, 4)) - 5) problems.push('Construction year and new-build condition conflict. Confirm the actual condition.');
  // A separately priced garage stays a data note. It is not a conflict and must not withhold the score.
  // A table-vs-text tenancy that R3 already resolved to one status is not a contradiction either.
  // An energy class one step off the stated demand is a data note. Two or more classes apart still conflict.
  const adjacentEnergy = energyClassGap(report) === 1;
  problems.push(...(report.qualityWarnings || []).filter(w => {
    if (!CONFLICT_NOTE.test(w) || /separately quotes/i.test(w)) return false;
    if (adjacentEnergy && /class and consumption|one step off the stated demand/i.test(w)) return false;
    return true;
  }));
  return [...new Set(problems)];
}

export function scoreAvailable(report: Report) {
  // A newer extraction already decided the score. This code must not withhold it.
  if (storedVersionIsNewer(report.extractionVersion)) return typeof report.score === 'number' && Number.isFinite(report.score);
  // Armenian reports use a separate rubric and must keep the previous rule.
  if (report.country === 'AM') return Boolean(report.facts.price > 0 && report.facts.area > 0 && (report.facts.city || report.location) && !reportConflicts(report).length);
  if (!(report.facts.price > 0 && report.facts.area > 0)) return false;
  if (!report.facts.city) return false;
  if (report.typeSource === 'fallback') return false;
  // Missing walking times and sun orientation never withhold. Only a real conflict, or 4 or fewer key facts, does.
  // A confidence cap (leasehold, tenancy, no local prices) does not withhold by itself.
  // Low confidence means four or fewer key facts, and that withholds the score. An energy class one step off demand never does.
  if (reportConflicts(report).length > 0) return false;
  return scoreConfidence(report).present >= 5;
}

/**
 * The number the API returns. Current reports use this rubric, which fills a
 * null score after a refresh that did not write one. A newer extraction keeps
 * the score already stored on the row.
 */
export function attachCalculatedScore<T extends Report>(report: T): T {
  if (report.country === 'AM' || storedVersionIsNewer(report.extractionVersion)) return report;
  if (!scoreAvailable(report)) {
    if (report.score == null && report.scoreBreakdown == null) return report;
    return { ...report, score: null, scoreBreakdown: undefined };
  }
  const calculation = calculatePropertyScore(report);
  if (report.score === calculation.total && sameBreakdown(report.scoreBreakdown, calculation.breakdown)) return report;
  return { ...report, score: calculation.total, scoreBreakdown: calculation.breakdown };
}

/**
 * Read path for one saved report. A newer extraction is returned unchanged,
 * including its score and any fields this code does not know. Older and current
 * reports still receive the stale warning and the current rubric.
 */
export function renderStoredReport<T extends Report>(report: T): T {
  if (storedVersionIsNewer(report.extractionVersion)) return report;
  return attachCalculatedScore(presentStoredReport(report));
}

function finiteScore(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function storedBreakdown(value: Report['scoreBreakdown'] | undefined): ScoreBreakdown {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const part = (key: keyof ScoreBreakdown) => finiteScore(record[key]) ?? 0;
  const price = record.price;
  return {
    price: price === null ? null : finiteScore(price) ?? null,
    neighborhood: part('neighborhood'),
    space: part('space'),
    building: part('building'),
    energy: part('energy'),
    light: part('light'),
    costs: part('costs'),
    source: part('source'),
  };
}

/** The score a page shows. Newer saved reports keep the stored total and breakdown. */
export function displayedPropertyScore(report: Report): ReturnType<typeof calculatePropertyScore> {
  if (!storedVersionIsNewer(report.extractionVersion)) return calculatePropertyScore(report);
  return { total: finiteScore(report.score) ?? 0, breakdown: storedBreakdown(report.scoreBreakdown), adjustments: [] };
}

function sameBreakdown(stored: Report['scoreBreakdown'], next: Report['scoreBreakdown']) {
  if (!stored || !next) return false;
  const keys = ['price', 'neighborhood', 'space', 'building', 'energy', 'light', 'costs', 'source'] as const;
  return keys.every((key) => stored[key] === next[key]);
}

type ConflictTopic = 'rental' | 'rooms' | 'energy' | 'price' | 'year' | 'address' | 'source';

const CONFLICT_FACT: Record<Locale, Record<Exclude<ConflictTopic, 'address' | 'source'>, string>> = {
  en: { rental: 'rental status', rooms: 'the room count', energy: 'the energy certificate', price: 'the purchase price', year: 'the year built' },
  de: { rental: 'bei der Vermietung', rooms: 'bei der Zimmerzahl', energy: 'beim Energieausweis', price: 'beim Kaufpreis', year: 'beim Baujahr' },
};

const MISSING_FACT: Record<Locale, Record<ReturnType<typeof missingKeyFacts>[number], string>> = {
  en: { price: 'price', area: 'living area', rooms: 'rooms', year: 'year built', floor: 'floor', energy: 'energy class', hausgeld: 'Hausgeld', location: 'street address' },
  de: { price: 'Kaufpreis', area: 'Wohnfläche', rooms: 'Zimmer', year: 'Baujahr', floor: 'Etage', energy: 'Energieklasse', hausgeld: 'Hausgeld', location: 'Straße' },
};

function conflictTopics(problems: string[]) {
  const found: ConflictTopic[] = [];
  const add = (topic: ConflictTopic) => { if (!found.includes(topic)) found.push(topic); };
  for (const problem of problems) {
    if (/occupants remain|rental status|not rented|conflicts with/i.test(problem)) add('rental');
    else if (/room count/i.test(problem)) add('rooms');
    else if (/class and consumption/i.test(problem)) add('energy');
    else if (/do not agree/i.test(problem)) add('price');
    else if (/new-build condition/i.test(problem)) add('year');
    else if (/not a valid property location/i.test(problem)) add('address');
    else if (/fresh source review/i.test(problem)) add('source');
  }
  return found;
}

/**
 * Why the score is hidden, most specific reason first.
 * A named contradiction comes before a missing-fact list, which comes before
 * a stale saved report. The same sentence is never listed twice.
 */
export function withholdSentences(report: Report, locale: Locale) {
  const text = copy[locale].report;
  const topics = conflictTopics(reportConflicts(report));
  const sentences: string[] = [];
  const facts = topics.filter((topic): topic is Exclude<ConflictTopic, 'address' | 'source'> => topic !== 'address' && topic !== 'source');
  if (facts.length) sentences.push(text.conflictWithheld.replace('{facts}', facts.map(topic => CONFLICT_FACT[locale][topic]).join(locale === 'de' ? ' und ' : ' and ')));
  if (topics.includes('address')) sentences.push(text.addressWithheld);
  const confidence = scoreConfidence(report);
  if (confidence.level === 'low') {
    const missing = missingKeyFacts(report).map(fact => MISSING_FACT[locale][fact]).join(', ');
    const named = text.lowConfidence.replaceAll('{present}', String(confidence.present)).replace('. ', `. ${text.missingFacts.replace('{facts}', missing)} `);
    sentences.push(named);
  }
  if (topics.includes('source')) sentences.push(text.sourceWithheld);
  const unique = [...new Set(sentences)];
  if (unique.length) return unique;
  if (!(report.facts.price > 0 && report.facts.area > 0)) return [text.figuresWithheld];
  if (!report.facts.city) return [text.placeWithheld];
  if (report.typeSource === 'fallback') return [text.typeWithheld];
  return [text.scoreWithheld];
}

/** Why the score is hidden. Conflicts name the fact; low data lists the missing key facts. */
export function withholdReason(report: Report, locale: Locale) {
  return withholdSentences(report, locale).join(' ');
}

export function scoreExplanation(report: Report, locale: Locale) {
  if (scoreAvailable(report)) return copy[locale].report.scoreExplainer;
  return withholdReason(report, locale);
}

/**
 * The line under the score. Confidence when a score is shown.
 * When the score is withheld, the withhold reason — so the panel does not
 * say "Confidence: High" under "Score withheld".
 */
export function scoreBasisLine(report: Report, locale: Locale) {
  if (scoreAvailable(report)) return scoreConfidenceLabel(scoreConfidence(report), locale);
  return withholdReason(report, locale);
}

export function reportVerdict(report: Report, locale: 'en' | 'de') {
  if (!scoreAvailable(report)) return withholdReason(report, locale);
  return locale === 'de' ? 'Einordnung der Angebotsangaben' : 'Assessment of the listing’s stated facts';
}
