import type { Report } from './types';
import { copy, type Locale } from './i18n.ts';
import { validStreet } from './location-validation.ts';
import { defaultScoreComponents, scoreConfidence } from './property-score.ts';

export const EXTRACTION_VERSION = 2026100802;

export function reportConflicts(report: Report) {
  const problems: string[] = [];
  const f = report.facts;
  if (report.sourceUnavailable || (report.extractionVersion !== undefined && report.extractionVersion !== EXTRACTION_VERSION)) problems.push('This saved report needs a fresh source review. Re-import the listing or upload its Exposé.');
  if (f.street && !validStreet(f.street)) problems.push('The extracted street is not a valid property location.');
  if (f.buyerCosts !== undefined && f.totalCost >= f.price && Math.abs(f.price + f.buyerCosts - f.totalCost) > 2) problems.push('The stated purchase price, buyer costs and total do not agree. Financing uses the stated total; confirm the breakdown.');
  if (/^New build$/i.test(f.condition || '') && Number(f.year) < Number(report.createdAt.slice(0, 4)) - 5) problems.push('Construction year and new-build condition conflict. Confirm the actual condition.');
  problems.push(...(report.qualityWarnings || []).filter(w => /conflicting|occupants remain|class and consumption|needs a fresh source review|separately quotes/i.test(w)));
  return [...new Set(problems)];
}

export function scoreAvailable(report: Report) {
  // Armenian reports use a separate rubric and must keep the previous rule.
  if (report.country === 'AM') return Boolean(report.facts.price > 0 && report.facts.area > 0 && (report.facts.city || report.location) && !reportConflicts(report).length);
  if (!(report.facts.price > 0 && report.facts.area > 0)) return false;
  if (!report.facts.city) return false;
  if (report.typeSource === 'fallback') return false;
  if (defaultScoreComponents(report).length >= 2) return false;
  if (reportConflicts(report).length > 0) return false;
  return scoreConfidence(report).level !== 'low';
}

export function scoreExplanation(report: Report, locale: Locale) {
  if (scoreAvailable(report)) return copy[locale].report.scoreExplainer;
  const confidence = scoreConfidence(report);
  if (confidence.level === 'low') return copy[locale].report.lowConfidence.replaceAll('{present}', String(confidence.present));
  return copy[locale].report.scoreWithheld;
}

export function reportVerdict(report: Report, locale: 'en' | 'de') {
  if (!scoreAvailable(report)) return locale === 'de' ? 'Wichtige Angaben zuerst klären' : 'Resolve the key facts first';
  return locale === 'de' ? 'Einordnung der Angebotsangaben' : 'Assessment of the listing’s stated facts';
}

export function evidenceForFacts(lines: string[], facts: Report['facts']) {
  const fields: Record<string, RegExp> = {
    price: /Kaufpreis|purchase price|asking price/i, area: /Wohnfläche|living area/i,
    rooms: /Zimmer|rooms/i, year: /Baujahr|built|errichtet|erbaut/i,
    condition: /Zustand|gepflegt|renoviert|saniert|modernisierung|verbesserungsbedürftig/i,
    occupancy: /vermietet|bewohnt|Bewohner|bezugsfrei|verfügbar|unvermietet/i,
    buyerCosts: /Kaufnebenkosten|Gesamtkosten|Kaufpreis Garage|Kaufpreis Stellplatz/i, housegeld: /Hausgeld|Community fees/i,
    location: /\b\d{5}\s+[A-ZÄÖÜ]|^(?:Adresse|Anschrift|Ort|Stadtteil)/u,
    floor: /Etage|Stockwerk|Obergeschoss|Hochparterre/i,
    energy: /Energieeffizienzklasse|Endenergie|Energieträger|Heizungsart|Heizung/i,
  };
  return Object.fromEntries(Object.entries(fields).map(([field, pattern]) => [field,
    lines.flatMap((line, index) => pattern.test(line) && (field !== 'location' || (Boolean(facts.postalCode && line.includes(facts.postalCode)) && !/Gewerblich|Kontakt|GmbH|Ansprechpartner/i.test(line))) ? [`${line}${field !== 'location' && line.length < 35 ? ` ${lines[index + 1] || ''}` : ''}`.slice(0, 650)] : []).slice(0, 5),
  ]));
}
