import type { Report, ScoreBreakdown } from './types';
import { score as formatLocaleScore } from './format.ts';
import { copy, type Locale } from './i18n.ts';
import { localPriceCheck, type PriceCheck } from './price-check.ts';
import { MUNICH_SCORE_CEILING, coveredPriceCity } from './price-ref.ts';

/** GEG demand bands. A+ is under 30 kWh/(m²·a); H is 250 or more. */
const ENERGY_CLASS_ORDER = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export function energyClassFromDemand(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 30) return 'A+';
  if (value < 50) return 'A';
  if (value < 75) return 'B';
  if (value < 100) return 'C';
  if (value < 130) return 'D';
  if (value < 160) return 'E';
  if (value < 200) return 'F';
  if (value < 250) return 'G';
  return 'H';
}

function energyClassIndex(value: string) {
  const key = value.trim().toUpperCase().replace(/\s+/g, '');
  return ENERGY_CLASS_ORDER.indexOf(key as typeof ENERGY_CLASS_ORDER[number]);
}

/** Steps between the stated class and the class implied by demand. Null when either is missing. */
export function energyClassGap(report: { facts: { energy?: string; energyDemand?: number } }): number | null {
  const stated = report.facts.energy;
  const demand = report.facts.energyDemand;
  if (!stated || !known(stated) || !demand) return null;
  const statedIndex = energyClassIndex(stated);
  const demandIndex = energyClassIndex(energyClassFromDemand(demand));
  if (statedIndex < 0 || demandIndex < 0) return null;
  return Math.abs(statedIndex - demandIndex);
}

/** The worse of the stated class and the class implied by demand. */
export function lowerEnergyClass(stated: string, demand: number) {
  const fromDemand = energyClassFromDemand(demand);
  const statedIndex = energyClassIndex(stated);
  const demandIndex = energyClassIndex(fromDemand);
  if (statedIndex < 0) return fromDemand;
  if (demandIndex < 0) return stated.trim().toUpperCase();
  return ENERGY_CLASS_ORDER[Math.max(statedIndex, demandIndex)];
}

/** Whole heating-oil terms. Substrings such as Rollläden, Solar and Holz do not match. */
const OIL_HEATING = /(?<![\p{L}\p{N}])(?:heizöl|heizoel|ölheizung|oelheizung|heating oil|oil heating|öl|oel|oil)(?![\p{L}\p{N}])/iu;

export const LEASEHOLD_PENALTY = 1.5;
export const RENTED_OCCUPIER_PENALTY = 0.8;

export type ScoreAdjustment = { id: 'leasehold' | 'rented'; points: number };

const UNKNOWN = /not stated|unknown/i;
const clamp = (value: number, minimum = 0, maximum = 10) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, places = 2) => Number(value.toFixed(places));
const known = (value?: string) => Boolean(value && !UNKNOWN.test(value));

function band(value: number, points: Array<[number, number]>, fallback: number) {
  for (const [limit, score] of points) if (value <= limit) return score;
  return fallback;
}

/**
 * Official local delta, before yield and buyer-cost adjustments.
 * ≤ −15 → 8.5; −15 < d ≤ −5 → 7.5; −5 < d < 5 → 6; 5 ≤ d < 15 → 4.5; ≥ 15 → 3.
 * A thin sales sample is pulled halfway toward 6.
 */
export function scorePriceFromDelta(deltaPct: number, confidence: 'normal' | 'low' = 'normal') {
  const bandScore = deltaPct <= -15 ? 8.5
    : deltaPct <= -5 ? 7.5
      : deltaPct < 5 ? 6
        : deltaPct < 15 ? 4.5
          : 3;
  return confidence === 'low' ? (bandScore + 6) / 2 : bandScore;
}

/**
 * Citywide tables do not know the location class, so only clear outliers score.
 * Not central and d ≥ +25 → 4.5 (low confidence). d ≤ −25 → 7.25.
 * Asking at or above €14,770/m² scores 4.5 in every district, including the centre.
 */
export function cityTierPriceScore(check: PriceCheck): number | null {
  if (check.askingPerSqm >= MUNICH_SCORE_CEILING) return 4.5;
  if (check.central || check.ceiling) return null;
  if (check.deltaPct >= 25) return 4.5;
  if (check.deltaPct <= -25) return 7.25;
  return null;
}

function priceScore(report: Report): number | null {
  const check = localPriceCheck(report);
  if (!check) return null;
  const cityScore = check.tier === 'city' ? cityTierPriceScore(check) : undefined;
  if (check.tier === 'city' && cityScore == null) return null;
  let score = check.tier === 'city' ? cityScore! : scorePriceFromDelta(check.deltaPct, check.confidence);
  const { price, totalCost, advertisedYield } = report.facts;
  if (price && totalCost && totalCost / price > 1.13) score -= 0.4;
  if (advertisedYield && advertisedYield >= 5) score += 0.4;
  return clamp(score);
}

function proximityScore(minutes: number | undefined, mentioned: boolean | undefined, kind: 'transit' | 'park' | 'daily') {
  if (!minutes) return mentioned ? 6.5 : 5;
  const limits: Record<typeof kind, Array<[number, number]>> = {
    transit: [[4, 10], [7, 9], [10, 8], [15, 6.5], [20, 5]],
    park: [[5, 10], [10, 8.5], [15, 7], [20, 5.5]],
    daily: [[5, 10], [8, 8.5], [12, 7], [18, 5.5]],
  };
  return band(minutes, limits[kind], 3.5);
}

function neighborhoodScore(report: Report) {
  const evidence = report.facts.neighborhood;
  const base = report.facts.district ? 6 : report.facts.city || report.location ? 5.3 : 3.5;
  if (!evidence) return base;
  const transit = proximityScore(evidence.transitMinutes, evidence.transitMentioned, 'transit');
  const park = proximityScore(evidence.parkMinutes, evidence.parkMentioned, 'park');
  const daily = proximityScore(evidence.dailyNeedsMinutes, evidence.dailyNeedsMentioned, 'daily');
  const evidenceScore = transit * 0.5 + park * 0.25 + daily * 0.25;
  return clamp(evidenceScore * 0.8 + base * 0.2);
}

function roomCount(value: string) {
  if (!known(value)) return 0;
  return Number(value.replace(',', '.').match(/\d+(?:\.\d+)?/)?.[0] || 0);
}

function spaceScore(report: Report) {
  const { area, rooms } = report.facts;
  if (!area) return 3.5;
  const areaScore = report.propertyType === 'house'
    ? band(area, [[70, 4], [100, 6.3], [160, 9], [220, 8.7]], 8.2)
    : band(area, [[30, 4], [45, 6], [65, 7.8], [95, 9.2], [130, 8.8]], 8.2);
  const count = roomCount(rooms);
  if (!count) return areaScore;
  const areaPerRoom = area / count;
  const layoutScore = band(areaPerRoom, [[14, 3.5], [17, 5.5], [22, 7.7], [32, 9.3], [40, 8]], 6.5);
  return clamp(layoutScore * 0.7 + areaScore * 0.3);
}

function yearScore(value: string) {
  const year = Number(value.match(/\b(18|19|20)\d{2}\b/)?.[0]);
  if (!year) return 5;
  if (year >= 2015) return 9;
  if (year >= 2000) return 8;
  if (year >= 1978) return 6.8;
  if (year >= 1950) return 5.7;
  return 6.2;
}

/**
 * Listing condition, on the same 0–10 scale as the other parts.
 * Canonical English labels and the German words they come from share a score.
 * A condition we do not recognise is left out, so it is not silently 5.5.
 */
const CONDITION_POINTS: Array<[RegExp, number]> = [
  [/\b(?:abbruchreif|abrissreif|bauf[aä]llig|unbewohnbar|zum\s+abriss|demolition)\b/i, 1],
  [/\b(?:renovierungsbed[uü]rftig|sanierungsbed[uü]rftig|needs\s+renovation|renovation\s+required)\b/i, 3],
  [/\b(?:modernisierungsbed[uü]rftig|verbesserungsbed[uü]rftig|needs\s+moderni[sz]ation)\b/i, 4],
  [/\b(?:erstbezug\s+nach|kernsaniert|vollst[aä]ndig\s+saniert|fully\s+renovated)\b/i, 8.5],
  [/\b(?:neuwertig|like\s+new|as-new|neubau|new\s+build|erstbezug|first\s+occupancy)\b/i, 9.3],
  [/\b(?:renoviert|renovated|modernisiert|saniert)\b/i, 8],
  [/\b(?:gepflegt|well\s+maintained)\b/i, 7],
  [/\b(?:sehr\s+gut|excellent)\b/i, 7.5],
  [/\b(?:gut|good)\b/i, 6.5],
  [/\b(?:teilsaniert|teilmodernisiert|altersgerecht)\b/i, 6],
  [/\b(?:im\s+bau|under\s+construction|projektiert|rohbau)\b/i, 6],
  [/\b(?:durchschnittlich|normalzustand|normal|gebraucht|average)\b/i, 5.5],
];

export function conditionPoints(condition: string) {
  for (const [pattern, points] of CONDITION_POINTS) {
    if (pattern.test(condition)) return points;
  }
  return undefined;
}

function buildingScore(report: Report) {
  const condition = report.facts.condition || '';
  const age = yearScore(report.facts.year);
  if (!known(condition)) return age;
  const points = conditionPoints(condition);
  if (points === undefined) return age;
  return clamp(points * 0.7 + age * 0.3);
}

function energyScore(report: Report) {
  const { energy, energyDemand, energySource, heating } = report.facts;
  const classes: Record<string, number> = { 'A+': 10, A: 9.4, B: 8.4, C: 7.3, D: 6.1, E: 4.7, F: 3.3, G: 2.1, H: 1 };
  const gap = energyClassGap(report);
  const scoredClass = known(energy) && energyDemand && gap !== null && gap >= 1
    ? lowerEnergyClass(energy, energyDemand)
    : known(energy) ? energy.toUpperCase() : '';
  let score = scoredClass ? classes[scoredClass] ?? 5 : 0;
  if (!score && energyDemand) score = band(energyDemand, [[30, 9.8], [50, 9], [75, 8], [100, 6.8], [130, 5.5], [160, 4], [200, 2.5]], 1.5);
  const system = `${energySource || ''} ${heating || ''}`;
  const efficientSystem = /w[aä]rmepumpe|umweltw[aä]rme|erdw[aä]rme|geotherm|solartherm|solar/i.test(system);
  const recentYear = Number(report.facts.year.match(/\b20\d{2}\b/)?.[0] || 0);
  const newConstruction = recentYear >= 2020
    && /erstbezug|neubau|new build|new construction|under construction/i.test(report.facts.condition || '');
  const hasMeasuredPerformance = score > 0;

  // A missing class or demand figure is uncertainty, not evidence of mediocre
  // performance. Use the stated building and heating facts as a conservative
  // fallback, while keeping the result below a verified A/A+ certificate.
  if (!score) score = newConstruction && efficientSystem ? 9
    : newConstruction ? 7.8
      : efficientSystem ? 7
        : 4.5;
  if (hasMeasuredPerformance && /w[aä]rmepumpe|fernw[aä]rme|solartherm|(?<![\p{L}\p{N}])solar(?![\p{L}\p{N}])/iu.test(system)) score += 0.4;
  if (OIL_HEATING.test(system) || /(?<![\p{L}\p{N}])(?:coal|kohle)(?![\p{L}\p{N}])/iu.test(system)) score -= 0.7;
  return clamp(score);
}

function lightScore(report: Report) {
  let score = 5;
  const orientation = report.sunOrientation || '';
  if (/s[uü]d|south|s[uü]dwest|south.?west/i.test(orientation)) score += 2.2;
  else if (/west|ost|east/i.test(orientation)) score += 1.2;
  else if (/nord|north/i.test(orientation)) score -= 1.2;
  if (report.daylight) score += 1.1;
  if (report.facts.features?.some(feature => /balkon|terrasse|garten|loggia|dachterrasse/i.test(feature))) score += 0.8;
  if (report.propertyType === 'flat') {
    if (/souterrain|keller/i.test(report.facts.floor)) score -= 1.8;
    else if (/erdgeschoss|\bEG\b/i.test(report.facts.floor)) score -= 0.5;
    else if (/dachgeschoss/i.test(report.facts.floor)) score += 0.4;
    else if (known(report.facts.floor)) score += 0.7;
  }
  return clamp(score);
}

function costsScore(report: Report) {
  const { housegeld, area, tenancy, buyerCosts, price } = report.facts;
  let score = 5.5;
  if (housegeld && area) score = band(housegeld / area, [[3.5, 9], [5, 7.5], [7, 5.5], [9, 3.8]], 2.5);
  else if (report.propertyType === 'house') score = 6;
  if (['Not rented', 'Available to move in', 'Vacant', 'Owner-occupied'].includes(tenancy || '')) score += 0.4;
  if (tenancy === 'Rented') score -= 0.3;
  if (buyerCosts && price && buyerCosts / price > 0.13) score -= 0.5;
  return clamp(score);
}

function sourceScore(report: Report) {
  const { facts } = report;
  const checks: Array<[boolean, number]> = [
    [Boolean(facts.price), 1.7],
    [Boolean(facts.area), 1.7],
    [known(facts.rooms), 1],
    [known(facts.year), 1],
    [known(facts.floor) || report.propertyType === 'house', 0.9],
    [known(facts.energy) || Boolean(facts.energyDemand), 1.1],
    [known(facts.heating), 0.8],
    [Boolean(facts.city || report.location), 1.1],
    [Boolean(report.address && !/not stated/i.test(report.address)), 0.7],
  ];
  return clamp(checks.reduce((sum, [present, weight]) => sum + (present ? weight : 0), 0));
}

export const SCORE_WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  price: 0.25,
  neighborhood: 0.2,
  space: 0.15,
  building: 0.12,
  energy: 0.1,
  light: 0.08,
  costs: 0.05,
  source: 0.05,
};

/** Drop a null price part and scale the rest so the weights still sum to 1. */
export function activeScoreWeights(breakdown: ScoreBreakdown) {
  const entries = (Object.keys(SCORE_WEIGHTS) as Array<keyof ScoreBreakdown>)
    .filter((key) => breakdown[key] !== null)
    .map((key) => [key, SCORE_WEIGHTS[key]] as const);
  const sum = entries.reduce((total, [, weight]) => total + weight, 0);
  return Object.fromEntries(entries.map(([key, weight]) => [key, weight / sum])) as Partial<Record<keyof ScoreBreakdown, number>>;
}

const KEY_FACTS = ['price', 'area', 'rooms', 'year', 'floor', 'energy', 'hausgeld', 'location'] as const;
type KeyFact = typeof KEY_FACTS[number];

/** F02 caution flags that make a key fact unusable for confidence. */
const CAUTION_ON_FIELD: Record<KeyFact, readonly string[]> = {
  price: [],
  area: [],
  rooms: [],
  year: [],
  floor: ['basement'],
  energy: ['noEnergyData'],
  hausgeld: ['noHausgeld'],
  location: [],
};

export type ScoreConfidence = {
  present: number;
  total: 8;
  level: 'high' | 'medium' | 'low';
};

function keyFactStated(report: Report, fact: KeyFact) {
  const facts = report.facts;
  const house = report.propertyType === 'house';
  switch (fact) {
    case 'price': return facts.price > 0;
    case 'area': return facts.area > 0;
    case 'rooms': return known(facts.rooms);
    case 'year': return known(facts.year);
    case 'floor': return house || known(facts.floor);
    case 'energy': return known(facts.energy) || Boolean(facts.energyDemand);
    case 'hausgeld': return house || Boolean(facts.housegeld);
    case 'location': return facts.locationPrecision === 'address' || facts.locationPrecision === 'street';
    default: return false;
  }
}

function keyFactBlocked(report: Report, fact: KeyFact) {
  const ids = CAUTION_ON_FIELD[fact];
  if (!ids.length) return false;
  return (report.redFlags || []).some((flag) => flag.severity === 'caution' && ids.includes(flag.id));
}

function hasLeasehold(report: Pick<Report, 'facts' | 'redFlags'>) {
  if (report.facts.groundLease) return true;
  return (report.redFlags || []).some((flag) => flag.id === 'leasehold' || flag.id === 'pacht');
}

function isTenanted(report: Pick<Report, 'facts' | 'propertyType'>) {
  return report.facts.tenancy === 'Rented' && report.propertyType !== 'land';
}

/** Outside a covered city there is no official sales table, so price is not a checked fact. */
export function lacksLocalPriceReference(report: Pick<Report, 'country' | 'address' | 'location' | 'facts'>) {
  if (report.country === 'AM') return false;
  return coveredPriceCity(report) == null;
}

export function scoreAdjustments(report: Report): ScoreAdjustment[] {
  const adjustments: ScoreAdjustment[] = [];
  if (hasLeasehold(report)) adjustments.push({ id: 'leasehold', points: -LEASEHOLD_PENALTY });
  if (isTenanted(report)) adjustments.push({ id: 'rented', points: -RENTED_OCCUPIER_PENALTY });
  return adjustments;
}

function capConfidence(level: ScoreConfidence['level'], cap: ScoreConfidence['level']) {
  const rank = { low: 0, medium: 1, high: 2 };
  return rank[level] <= rank[cap] ? level : cap;
}

function dropConfidence(level: ScoreConfidence['level']): ScoreConfidence['level'] {
  if (level === 'high') return 'medium';
  return 'low';
}

/** Eight key facts. Houses count floor and Hausgeld as present. A caution on a field keeps it out. */
export function scoreConfidence(report: Report): ScoreConfidence {
  const present = KEY_FACTS.filter((fact) => keyFactStated(report, fact) && !keyFactBlocked(report, fact)).length;
  let level: ScoreConfidence['level'] = present >= 7 ? 'high' : present >= 5 ? 'medium' : 'low';
  // Leasehold, a sitting tenant, or no local price table: Medium at best. They do not stack.
  if (hasLeasehold(report) || isTenanted(report) || lacksLocalPriceReference(report)) level = capConfidence(level, 'medium');
  // One energy class off the stated demand lowers confidence by one further step.
  if (energyClassGap(report) === 1) level = dropConfidence(level);
  return { present, total: 8, level };
}

/** Key facts that do not count. Walking time and sun orientation are not in this list. */
export function missingKeyFacts(report: Report): KeyFact[] {
  return KEY_FACTS.filter((fact) => !keyFactStated(report, fact) || keyFactBlocked(report, fact));
}

export function formatScore(value: number, locale: Locale) {
  return formatLocaleScore(value, locale);
}

export function scoreConfidenceLabel(confidence: ScoreConfidence, locale: Locale) {
  const name = copy[locale].report.confidenceLevel[confidence.level];
  return copy[locale].report.confidenceLine
    .replace('{level}', name)
    .replace('{present}', String(confidence.present))
    .replace('{total}', String(confidence.total));
}

export function scoreAdjustmentLine(adjustment: ScoreAdjustment, locale: Locale) {
  const points = formatLocaleScore(Math.abs(adjustment.points), locale);
  return copy[locale].report.scoreAdjustment[adjustment.id].replace('{points}', points);
}

export function priceNotCheckedLine(report: Report, locale: Locale) {
  return lacksLocalPriceReference(report) ? copy[locale].report.priceNotChecked : '';
}

/** Citywide data that did not clear the outlier rule uses its own unscored label. */
export function priceUnscoredLabel(report: Report, locale: Locale) {
  const check = localPriceCheck(report);
  if (check?.tier === 'city' && cityTierPriceScore(check) == null) return copy[locale].report.priceNotScoredCitywide;
  return copy[locale].report.priceNotScored;
}

/**
 * Read-time rubric over facts already on the report. Viewing a page does not
 * re-parse the listing. Leasehold and a sitting tenant are subtracted after
 * the weighted total so the penalty stays visible at the weights above.
 */
export function calculatePropertyScore(report: Report) {
  const price = priceScore(report);
  const breakdown: ScoreBreakdown = {
    price: price === null ? null : round(price, 1),
    neighborhood: round(neighborhoodScore(report), 1),
    space: round(spaceScore(report), 1),
    building: round(buildingScore(report), 1),
    energy: round(energyScore(report), 1),
    light: round(lightScore(report), 1),
    costs: round(costsScore(report), 1),
    source: round(sourceScore(report), 1),
  };
  const weights = activeScoreWeights(breakdown);
  const weighted = (Object.keys(weights) as Array<keyof ScoreBreakdown>).reduce((sum, key) => {
    const value = breakdown[key];
    return sum + (value ?? 0) * (weights[key] ?? 0);
  }, 0);
  const adjustments = scoreAdjustments(report);
  const penalty = adjustments.reduce((sum, item) => sum + item.points, 0);
  const total = round(clamp(weighted + penalty));
  return { total, breakdown, adjustments };
}
