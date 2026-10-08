import dataset from '../data/berlin-etw-prices.json' with { type: 'json' };
import directory from '../data/berlin-ortsteile.json' with { type: 'json' };
import { reportNeighborhood } from './display.ts';
import { isNewOrFirstOccupancy } from './property-condition.ts';
import type { Report } from './types.ts';

export type PriceCheckPosition = 'below' | 'within' | 'above';
export type PriceCheckConfidence = 'normal' | 'low';

export type PriceCheck = {
  area: string;
  year: 2025;
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
};

export type PriceCheckAvailability =
  | { status: 'hidden' }
  | { status: 'unmatched' }
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
  return report.facts.postalCode?.match(/\b\d{5}\b/)?.[0]
    || report.address?.match(/\b\d{5}\b/)?.[0]
    || '';
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
