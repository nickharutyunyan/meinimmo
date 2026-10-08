import dataset from '../data/berlin-etw-prices.json' with { type: 'json' };
import directory from '../data/berlin-ortsteile.json' with { type: 'json' };
import { reportNeighborhood } from './display.ts';
import { isNewOrFirstOccupancy } from './property-condition.ts';
import {
  COLOGNE_CITY_NEW_BUILD_MEAN,
  MUNICH_AVERAGE_NEW_BUILD,
  MUNICH_GOOD_NEW_BUILD,
  cologneArea,
  colognePriceRef,
  coveredPriceCity,
  munichInside,
  munichIsCentral,
  munichPriceRef,
  postalCodeOf as listedPostalCode,
  resolveCologneArea,
  type PriceBand,
  type PriceSegment,
} from './price-ref.ts';
import type { Report } from './types.ts';

export type PriceCheckPosition = 'below' | 'within' | 'above';
export type PriceCheckConfidence = 'normal' | 'low';
export type PriceCheckTier = 'area' | 'city';
export type PriceRangeKind = 'typical' | 'minmax' | 'none';
export type PriceSegmentKind = 'resale' | 'newBuild';
export type PriceUnmatchedReason = 'tooBroad' | 'tooFewSales' | 'noBuildYearBand' | 'areaUnclear';

export type PriceCheck = {
  area: string;
  year: number;
  mean: number;
  low: number;
  high: number;
  n: number;
  askingPerSqm: number;
  deltaPct: number;
  position: PriceCheckPosition;
  confidence: PriceCheckConfidence;
  newBuildCaveat: boolean;
  note?: 'microApartmentsExcluded';
  tier?: PriceCheckTier;
  city?: 'Berlin' | 'Köln' | 'München';
  segment?: PriceSegmentKind;
  rangeKind?: PriceRangeKind;
  buildYearBand?: { from?: number; to?: number };
  central?: boolean;
  ceiling?: boolean;
  /** Chart reads are shown rounded; deltaPct keeps the unrounded mean. */
  approximate?: boolean;
  newBuildNote?: { mean: number; place: string; calculated?: boolean; year: number };
  alternateMean?: number;
};

export type PriceCheckAvailability =
  | { status: 'hidden' }
  | { status: 'unmatched'; reason?: PriceUnmatchedReason; area?: string; year?: number }
  | { status: 'matched'; check: PriceCheck };

type AreaRow = {
  n: number;
  low: number;
  high: number;
  mean: number;
  meanExcludingMicroApartments?: number;
};

const areas = dataset.areas as Record<string, AreaRow>;
const LOW_SALE_COUNT = 50;
const MICRO_APARTMENT_MAX_SQM = 30;

const areaByKey = new Map<string, string | null>();
for (const name of directory.ambiguous) areaByKey.set(foldAreaName(name), null);
for (const [ortsteil, row] of Object.entries(directory.ortsteile)) areaByKey.set(foldAreaName(ortsteil), row);
for (const [alias, row] of Object.entries(directory.aliases)) areaByKey.set(foldAreaName(alias), row);

const weddingOrTiergartenPostalCodes = new Set(directory.weddingOrTiergartenPostalCodes);

for (const row of areaByKey.values()) {
  if (row && !areas[row]) throw new Error(`Berlin price row “${row}” is not in the official table.`);
}

function foldAreaName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('de-DE')
    .replace(/[–—−‑]/g, '-')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/^(?:berlin)[\s-]+/, '')
    .replace(/^(?:bezirk|ortsteil|ot)\s+/, '')
    .replace(/(?:[\s-]*kiez)+$/, '')
    .replace(/[\s-]+\d{1,3}$/, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rowForKey(key: string, postalCode?: string) {
  if (!areaByKey.has(key)) return undefined;
  const row = areaByKey.get(key) || undefined;
  const postal = postalCode?.match(/\b\d{5}\b/)?.[0];
  if (row === 'Mitte' && key === 'mitte' && postal && weddingOrTiergartenPostalCodes.has(postal)) return undefined;
  return row;
}

/** Match a listing area to exactly one official row, or return nothing. */
export function matchOfficialPriceArea(name: string, postalCode?: string) {
  const key = foldAreaName(name);
  if (!key) return undefined;
  if (areaByKey.has(key)) return rowForKey(key, postalCode);
  const specific = key.match(/\bot\s+(.+)$/)?.[1];
  if (!specific || specific === key) return undefined;
  return rowForKey(specific, postalCode);
}

function isBerlin(report: Pick<Report, 'address' | 'location' | 'facts'>) {
  const city = (report.facts.city || '').replace(/^kreisfreie\s+stadt\s+/i, '').trim();
  if (city) return /^berlin(?:\b|[-,])/i.test(city);
  const location = report.location || '';
  return /^berlin(?:\b|[-,])/i.test(location) || /\bberlin\b/i.test(report.address || '');
}

/**
 * Refuse a comparison when price or living area cannot be a flat purchase.
 * F02 owns the listing-level red flags; this gate stays local so a missing
 * or absurd figure never reaches the official table.
 */
export function askingPriceIsComparable(price: number, area: number) {
  if (!Number.isFinite(price) || !Number.isFinite(area)) return false;
  if (price < 20_000 || price > 100_000_000) return false;
  if (area < 8 || area > 800) return false;
  const perSquareMetre = price / area;
  return perSquareMetre >= 400 && perSquareMetre <= 30_000;
}

function postalCodeOf(report: Pick<Report, 'address' | 'facts'>) {
  return listedPostalCode(report);
}

function constructionYear(value: string | undefined) {
  const year = value?.match(/\b(?:18|19|20)\d{2}\b/)?.[0];
  return year ? Number(year) : undefined;
}

function buildCheck(report: Pick<Report, 'facts'>, area: string): PriceCheck {
  const row = areas[area];
  const excludeMicro = area === 'Köpenick'
    && report.facts.area > MICRO_APARTMENT_MAX_SQM
    && typeof row.meanExcludingMicroApartments === 'number';
  const mean = excludeMicro ? row.meanExcludingMicroApartments! : row.mean;
  const askingPerSqm = report.facts.price / report.facts.area;
  const built = constructionYear(report.facts.year);
  const recentBuild = built !== undefined && built >= new Date().getFullYear() - 2;
  return {
    area,
    year: 2025,
    mean,
    low: row.low,
    high: row.high,
    n: row.n,
    askingPerSqm,
    deltaPct: Math.round(((askingPerSqm - mean) / mean) * 100),
    position: askingPerSqm > row.high ? 'above' : askingPerSqm < row.low ? 'below' : 'within',
    confidence: row.n < LOW_SALE_COUNT ? 'low' : 'normal',
    newBuildCaveat: isNewOrFirstOccupancy(report.facts.condition) || recentBuild,
    ...(excludeMicro ? { note: 'microApartmentsExcluded' as const } : {}),
  };
}

export function berlinPriceAvailability(report: Report): PriceCheckAvailability {
  if (report.country === 'AM' || report.propertyType !== 'flat' || !isBerlin(report)) return { status: 'hidden' };
  if (!askingPriceIsComparable(report.facts.price, report.facts.area)) return { status: 'hidden' };
  const area = matchOfficialPriceArea(reportNeighborhood(report), postalCodeOf(report));
  if (!area) return { status: 'unmatched' };
  return { status: 'matched', check: buildCheck(report, area) };
}

/** Official 2025 Berlin flat comparison. Undefined unless city, type, price and area all qualify and the location matches one row. */
export function berlinPriceCheck(report: Report): PriceCheck | undefined {
  const availability = berlinPriceAvailability(report);
  return availability.status === 'matched' ? availability.check : undefined;
}

export const berlinPriceSource = {
  label: dataset.source,
  url: dataset.url,
  license: dataset.license,
  year: dataset.year,
  newBuildFirstSaleMean: dataset.newBuildFirstSaleMean,
};

const LOW_SALE_COUNT_ROW = 10;
const COLOGNE_NEW_BUILD_CAVEAT_MIN = 5;

function deltaPct(asking: number, mean: number) {
  return Math.round(((asking - mean) / mean) * 100);
}

function minmaxPosition(asking: number, low: number, high: number): PriceCheckPosition {
  if (asking > high) return 'above';
  if (asking < low) return 'below';
  return 'within';
}

function segmentUsable(row: PriceSegment | undefined, minimum: number) {
  return Boolean(row && row.n >= minimum && typeof row.mean === 'number' && typeof row.min === 'number' && typeof row.max === 'number');
}

function bandForYear(bands: PriceBand[] | undefined, year: number) {
  return bands?.find((band) => {
    const from = band.from ?? Number.NEGATIVE_INFINITY;
    const to = band.to ?? Number.POSITIVE_INFINITY;
    return year >= from && year <= to;
  });
}

function livingAreaUnclear(report: Report) {
  return (report.qualityWarnings || []).some((warning) => /living area in the listing is unclear/i.test(warning));
}

function recentBuild(report: Pick<Report, 'facts'>) {
  const built = constructionYear(report.facts.year);
  return built !== undefined && built >= new Date().getFullYear() - 2;
}

/** New build or first occupancy. "First occupancy after renovation" stays resale. */
function cologneNewBuild(report: Pick<Report, 'facts'>) {
  if (/\berstbezug\s+nach\b|first occupancy after/i.test(report.facts.condition || '')) return false;
  return isNewOrFirstOccupancy(report.facts.condition) || recentBuild(report);
}

function fromSegment(report: Pick<Report, 'facts'>, area: string, row: PriceSegment, segment: 'resale' | 'newBuild', band?: PriceBand): PriceCheck {
  const mean = band?.mean ?? row.mean!;
  const low = band?.min ?? row.min!;
  const high = band?.max ?? row.max!;
  const n = band?.n ?? row.n;
  const askingPerSqm = report.facts.price / report.facts.area;
  return {
    area,
    year: colognePriceRef.source.dataYear,
    mean,
    low,
    high,
    n,
    askingPerSqm,
    deltaPct: deltaPct(askingPerSqm, mean),
    position: minmaxPosition(askingPerSqm, low, high),
    confidence: n < LOW_SALE_COUNT ? 'low' : 'normal',
    newBuildCaveat: false,
    tier: 'area',
    city: 'Köln',
    segment,
    rangeKind: 'minmax',
    ...(band ? { buildYearBand: { from: band.from ?? undefined, to: band.to ?? undefined } } : {}),
  };
}

function cologneNewBuildNote(areaName: string, row: PriceSegment | undefined): PriceCheck['newBuildNote'] {
  if (segmentUsable(row, COLOGNE_NEW_BUILD_CAVEAT_MIN)) {
    return { mean: row!.mean!, place: areaName, year: colognePriceRef.source.dataYear };
  }
  return { mean: COLOGNE_CITY_NEW_BUILD_MEAN, place: 'Cologne', calculated: true, year: colognePriceRef.source.dataYear };
}

function cologneAvailability(report: Report): PriceCheckAvailability {
  if (!askingPriceIsComparable(report.facts.price, report.facts.area)) return { status: 'hidden' };
  const resolved = resolveCologneArea(reportNeighborhood(report), postalCodeOf(report));
  const year = colognePriceRef.source.dataYear;
  if (resolved.status === 'tooBroad') return { status: 'unmatched', reason: 'tooBroad', year };
  if (resolved.status === 'tooFew') return { status: 'unmatched', reason: 'tooFewSales', area: resolved.name, year };
  const published = cologneArea(resolved.name);
  if (!published) return { status: 'unmatched', reason: 'tooFewSales', area: resolved.name, year };
  const askingPerSqm = report.facts.price / report.facts.area;
  const built = constructionYear(report.facts.year);
  if (cologneNewBuild(report)) {
    if (segmentUsable(published.newBuild, LOW_SALE_COUNT_ROW)) {
      return { status: 'matched', check: fromSegment(report, resolved.name, published.newBuild!, 'newBuild') };
    }
    if (!segmentUsable(published.resale, LOW_SALE_COUNT_ROW)) {
      return { status: 'unmatched', reason: 'tooFewSales', area: resolved.name, year };
    }
    const check = fromSegment(report, resolved.name, published.resale!, 'resale', built !== undefined ? usableBand(published.resale!, built) : undefined);
    check.newBuildCaveat = true;
    check.newBuildNote = cologneNewBuildNote(resolved.name, published.newBuild);
    return { status: 'matched', check };
  }
  const band = built !== undefined ? usableBand(published.resale, built) : undefined;
  if (band) return { status: 'matched', check: fromSegment(report, resolved.name, published.resale!, 'resale', band) };
  if (segmentUsable(published.resale, LOW_SALE_COUNT_ROW)) {
    return { status: 'matched', check: fromSegment(report, resolved.name, published.resale!, 'resale') };
  }
  return { status: 'unmatched', reason: 'tooFewSales', area: resolved.name, year };
}

function usableBand(row: PriceSegment | undefined, year: number) {
  const band = bandForYear(row?.byBuildYear, year);
  if (!band || band.n < LOW_SALE_COUNT_ROW || typeof band.mean !== 'number') return undefined;
  return band;
}

function munichBand(year: number) {
  return munichPriceRef.resaleByBuildYear.find((band) => year >= band.from && year <= band.to);
}

function munichCheck(report: Report, mean: number, extra: Partial<PriceCheck>): PriceCheck {
  const askingPerSqm = report.facts.price / report.facts.area;
  return {
    area: 'München',
    year: extra.year ?? munichPriceRef.source.dataYear,
    low: mean,
    high: mean,
    n: 0,
    askingPerSqm,
    deltaPct: deltaPct(askingPerSqm, mean),
    position: 'within',
    confidence: 'low',
    newBuildCaveat: false,
    tier: 'city',
    city: 'München',
    rangeKind: 'none',
    approximate: true,
    central: munichIsCentral(reportNeighborhood(report), postalCodeOf(report)),
    ...extra,
    mean,
  };
}

function munichAvailability(report: Report): PriceCheckAvailability {
  if (!munichInside(report)) return { status: 'hidden' };
  if (!askingPriceIsComparable(report.facts.price, report.facts.area)) return { status: 'hidden' };
  const askingPerSqm = report.facts.price / report.facts.area;
  const built = constructionYear(report.facts.year);
  if (cologneNewBuild(report)) {
    return {
      status: 'matched',
      check: munichCheck(report, MUNICH_GOOD_NEW_BUILD, {
        year: munichPriceRef.newBuild.year,
        segment: 'newBuild',
        alternateMean: MUNICH_AVERAGE_NEW_BUILD,
      }),
    };
  }
  if (built !== undefined && built >= 1950 && built <= 2023) {
    const band = munichBand(built);
    if (band) {
      return {
        status: 'matched',
        check: munichCheck(report, band.mean, {
          segment: 'resale',
          buildYearBand: { from: band.from, to: band.to },
        }),
      };
    }
  }
  if (askingPerSqm > MUNICH_GOOD_NEW_BUILD) {
    return {
      status: 'matched',
      check: munichCheck(report, MUNICH_GOOD_NEW_BUILD, {
        year: munichPriceRef.newBuild.year,
        segment: 'newBuild',
        ceiling: true,
        alternateMean: MUNICH_AVERAGE_NEW_BUILD,
      }),
    };
  }
  return { status: 'unmatched', reason: 'noBuildYearBand', year: munichPriceRef.source.dataYear };
}

/**
 * Official flat comparison for a covered city.
 * Berlin keeps the F05 table. Cologne is on. Munich stays off unless PRICE_REF_MUENCHEN_ENABLED is `1`.
 */
export function localPriceAvailability(report: Report): PriceCheckAvailability {
  if (report.country === 'AM' || report.propertyType !== 'flat') return { status: 'hidden' };
  const city = coveredPriceCity(report);
  if (!city) return { status: 'hidden' };
  if (livingAreaUnclear(report)) return { status: 'unmatched', reason: 'areaUnclear', year: city === 'München' ? munichPriceRef.source.dataYear : 2025 };
  if (city === 'Berlin') {
    const availability = berlinPriceAvailability(report);
    if (availability.status === 'matched') {
      return { status: 'matched', check: { ...availability.check, tier: 'area', city: 'Berlin', segment: 'resale', rangeKind: 'typical' } };
    }
    if (availability.status === 'unmatched') return { status: 'unmatched', reason: 'tooBroad', year: 2025 };
    return availability;
  }
  if (city === 'Köln') return cologneAvailability(report);
  return munichAvailability(report);
}

export function localPriceCheck(report: Report): PriceCheck | undefined {
  const availability = localPriceAvailability(report);
  return availability.status === 'matched' ? availability.check : undefined;
}
