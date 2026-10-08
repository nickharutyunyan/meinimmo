import koeln from '../data/price-ref/koeln.json' with { type: 'json' };
import muenchen from '../data/price-ref/muenchen.json' with { type: 'json' };
import type { Report } from './types.ts';

export type PriceBand = {
  from: number | null;
  to: number | null;
  n: number;
  mean: number;
  min: number;
  max: number;
};

export type PriceSegment = {
  n: number;
  mean?: number;
  min?: number;
  max?: number;
  byBuildYear?: PriceBand[];
};

export type CologneArea = {
  name: string;
  resale?: PriceSegment;
  newBuild?: PriceSegment;
};

type PlzShare = [string, number];

export const colognePriceRef = koeln;
export const munichPriceRef = muenchen;

export const COLOGNE_CITY_NEW_BUILD_MEAN = koeln.cityNewBuild.mean;
export const MUNICH_GOOD_NEW_BUILD = muenchen.newBuild.goodLocation;
export const MUNICH_AVERAGE_NEW_BUILD = muenchen.newBuild.averageLocation;
/** 1.4 × the good-location new-build figure. City-tier ceiling score starts here. */
export const MUNICH_SCORE_CEILING = 14_770;

const COLOGNE_ALIASES = new Set(koeln.aliases.map(foldCityToken));
const MUNICH_ALIASES = new Set(muenchen.aliases.map(foldCityToken));
const COLOGNE_PLZ = new Set(Object.keys(koeln.mapping.plzToStadtteil));
const COLOGNE_OUTSIDE = new Set(koeln.mapping.plzOutside);
const MUNICH_PLZ = new Set(Object.keys(muenchen.mapping.plzToStadtbezirk));
const MUNICH_OUTSIDE = new Set(muenchen.mapping.plzOutside);
const COLOGNE_HOMONYMS = new Set(koeln.mapping.homonyms.map(foldAreaName));
const COLOGNE_BROAD = new Set(koeln.mapping.broadNames.map(foldAreaName));
const COLOGNE_UNPUBLISHED = new Set(koeln.mapping.unpublished.map(foldAreaName));
const MUNICH_CENTRAL = new Set(muenchen.mapping.central.map(foldAreaName));

const cologneByFold = new Map<string, string>();
for (const area of koeln.areas) cologneByFold.set(foldAreaName(area.name), area.name);
for (const [alias, name] of Object.entries(koeln.mapping.aliases)) cologneByFold.set(foldAreaName(alias), name);
for (const name of koeln.mapping.unpublished) cologneByFold.set(foldAreaName(name), name);

export function cologneArea(name: string) {
  return koeln.areas.find((area) => area.name === name) as CologneArea | undefined;
}

/** Off unless PRICE_REF_MUENCHEN_ENABLED is exactly `1`. Read at call time so tests can toggle it. */
export function munichPriceReferenceEnabled() {
  return process.env['PRICE_REF_MUENCHEN_ENABLED'] === '1';
}

export function foldCityToken(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('de-DE')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

export function foldAreaName(value: string) {
  return foldCityToken(value)
    .replace(/[–—−‑]/g, '-')
    .replace(/^(?:koeln|cologne|muenchen|munich)[\s-]+/, '')
    .replace(/^(?:stadtteil|stadtbezirk|bezirk)\s+/, '')
    .replace(/\//g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function placeBlob(report: Pick<Report, 'address' | 'location' | 'facts'>) {
  return [report.facts.city, report.facts.district, report.location, report.address].filter(Boolean).join(' ');
}

export function postalCodeOf(report: Pick<Report, 'address' | 'facts'>) {
  return report.facts.postalCode?.match(/\b\d{5}\b/)?.[0]
    || report.address?.match(/\b\d{5}\b/)?.[0]
    || '';
}

function mentionsCity(blob: string, aliases: Set<string>) {
  const folded = foldCityToken(blob).replace(/[^a-z0-9]+/g, ' ');
  for (const alias of aliases) {
    if (new RegExp(`(?:^| )${alias}(?: |$)`).test(folded)) return true;
  }
  return false;
}

export type CoveredCity = 'Berlin' | 'Köln' | 'München';

export function coveredPriceCity(report: Pick<Report, 'country' | 'address' | 'location' | 'facts'>): CoveredCity | null {
  if (report.country === 'AM') return null;
  const blob = placeBlob(report);
  const city = (report.facts.city || '').replace(/^kreisfreie\s+stadt\s+/i, '').trim();
  if (/^berlin(?:\b|[-,])/i.test(city) || /^berlin(?:\b|[-,])/i.test(report.location || '') || /\bberlin\b/i.test(blob)) return 'Berlin';
  const postal = postalCodeOf(report);
  if (mentionsCity(blob, COLOGNE_ALIASES) || (COLOGNE_PLZ.has(postal) && !COLOGNE_OUTSIDE.has(postal))) return 'Köln';
  if (!munichPriceReferenceEnabled()) return null;
  if (MUNICH_OUTSIDE.has(postal)) return null;
  if (mentionsCity(blob, MUNICH_ALIASES) || MUNICH_PLZ.has(postal)) return 'München';
  return null;
}

export type CologneResolution =
  | { status: 'area'; name: string }
  | { status: 'tooBroad' }
  | { status: 'tooFew'; name: string };

function plzCandidates(postal: string) {
  const rows = (koeln.mapping.plzToStadtteil as Record<string, PlzShare[]>)[postal];
  return rows || [];
}

function nameAmong(name: string, rows: PlzShare[]) {
  const key = foldAreaName(name);
  return rows.some(([candidate]) => foldAreaName(candidate) === key);
}

/**
 * One Cologne Stadtteil, or a reason the name is too broad / unpublished.
 * Order: normalised name, homonym needs the postcode, postcode alone only at share ≥ 0.9, contradiction loses.
 */
export function resolveCologneArea(name: string, postal = ''): CologneResolution {
  const key = foldAreaName(name);
  const rows = postal ? plzCandidates(postal) : [];
  const usableName = Boolean(key) && !COLOGNE_BROAD.has(key) && key !== 'koeln' && key !== 'cologne';
  if (COLOGNE_BROAD.has(key)) return { status: 'tooBroad' };
  if (usableName && cologneByFold.has(key)) {
    const official = cologneByFold.get(key)!;
    const homonym = COLOGNE_HOMONYMS.has(foldAreaName(official)) || COLOGNE_HOMONYMS.has(key);
    if (homonym && !nameAmong(official, rows)) return { status: 'tooBroad' };
    if (rows.length && !nameAmong(official, rows)) return { status: 'tooBroad' };
    if (COLOGNE_UNPUBLISHED.has(foldAreaName(official)) || !cologneArea(official)) return { status: 'tooFew', name: official };
    return { status: 'area', name: official };
  }
  if (!usableName) {
    const dominant = rows.filter(([, share]) => share >= 0.9);
    if (dominant.length === 1) {
      const official = dominant[0][0];
      if (COLOGNE_UNPUBLISHED.has(foldAreaName(official)) || !cologneArea(official)) return { status: 'tooFew', name: official };
      return { status: 'area', name: official };
    }
  }
  return { status: 'tooBroad' };
}

function centralShare(postal: string) {
  const rows = (muenchen.mapping.plzToStadtbezirk as Record<string, PlzShare[]>)[postal] || [];
  return rows.reduce((sum, [name, share]) => sum + (MUNICH_CENTRAL.has(foldAreaName(name)) ? share : 0), 0);
}

export function munichIsCentral(name: string, postal = '') {
  const key = foldAreaName(name);
  if (key && MUNICH_CENTRAL.has(key)) return true;
  if (/\bbezirk\s*[1-5]\b/i.test(name)) return true;
  if (postal && centralShare(postal) >= 0.5) return true;
  return false;
}

export function munichInside(report: Pick<Report, 'address' | 'location' | 'facts'>) {
  const postal = postalCodeOf(report);
  if (MUNICH_OUTSIDE.has(postal)) return false;
  const blob = placeBlob(report);
  return mentionsCity(blob, MUNICH_ALIASES) || MUNICH_PLZ.has(postal);
}
