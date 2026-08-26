import type { Report, ScoreBreakdown } from './types';
import type { Locale } from './i18n';

const UNKNOWN = /not stated|unknown/i;
const clamp = (value: number, minimum = 0, maximum = 10) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, places = 2) => Number(value.toFixed(places));
const known = (value?: string) => Boolean(value && !UNKNOWN.test(value));

function band(value: number, points: Array<[number, number]>, fallback: number) {
  for (const [limit, score] of points) if (value <= limit) return score;
  return fallback;
}

function priceScore(report: Report) {
  const { price, area, totalCost, advertisedYield } = report.facts;
  if (!price || !area) return 4;
  const perSquareMetre = price / area;
  let score = band(perSquareMetre, [
    [3_000, 9.4],
    [4_500, 8.1],
    [6_000, 6.7],
    [7_500, 5.3],
    [9_000, 4],
    [12_000, 2.7],
  ], 1.8);
  if (totalCost && totalCost / price > 1.13) score -= 0.4;
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

function buildingScore(report: Report) {
  const condition = report.facts.condition || '';
  const age = yearScore(report.facts.year);
  if (!known(condition)) return age;
  const conditionScore = /neubau|erstbezug|new|kernsaniert|vollst[aä]ndig saniert|excellent/i.test(condition) ? 9.3
    : /renoviert|modernisiert|saniert|gepflegt|good/i.test(condition) ? 7.8
      : /renovierungsbed[uü]rftig|sanierungsbed[uü]rftig|fixer|poor/i.test(condition) ? 2.8
        : 5.5;
  return clamp(conditionScore * 0.7 + age * 0.3);
}

function energyScore(report: Report) {
  const { energy, energyDemand, energySource, heating } = report.facts;
  const classes: Record<string, number> = { 'A+': 10, A: 9.4, B: 8.4, C: 7.3, D: 6.1, E: 4.7, F: 3.3, G: 2.1, H: 1 };
  let score = known(energy) ? classes[energy.toUpperCase()] ?? 5 : 0;
  if (!score && energyDemand) score = band(energyDemand, [[30, 9.8], [50, 9], [75, 8], [100, 6.8], [130, 5.5], [160, 4], [200, 2.5]], 1.5);
  if (!score) score = 4.5;
  const system = `${energySource || ''} ${heating || ''}`;
  if (/w[aä]rmepumpe|fernw[aä]rme|solar/i.test(system)) score += 0.4;
  if (/[oö]l|coal|kohle/i.test(system)) score -= 0.7;
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

export function propertyScoreTitle(total: number, locale: Locale = 'en') {
  if (locale === 'de') {
    if (total >= 8.5) return 'Außergewöhnlich starke Grundlagen';
    if (total >= 7.5) return 'Insgesamt ein starkes Angebot';
    if (total >= 6.5) return 'Solide, mit wichtigen Abwägungen';
    if (total >= 5.5) return 'Gemischtes Bild – genauer hinschauen';
    if (total >= 4.5) return 'Mehrere Punkte brauchen Vorsicht';
    return 'Die genannten Grundlagen sind schwach';
  }
  if (total >= 8.5) return 'Exceptional on the stated fundamentals';
  if (total >= 7.5) return 'A strong overall proposition';
  if (total >= 6.5) return 'Solid, with meaningful trade-offs';
  if (total >= 5.5) return 'A mixed proposition worth examining';
  if (total >= 4.5) return 'Several fundamentals need caution';
  return 'The stated fundamentals are weak';
}

export function calculatePropertyScore(report: Report) {
  const breakdown: ScoreBreakdown = {
    price: round(priceScore(report), 1),
    neighborhood: round(neighborhoodScore(report), 1),
    space: round(spaceScore(report), 1),
    building: round(buildingScore(report), 1),
    energy: round(energyScore(report), 1),
    light: round(lightScore(report), 1),
    costs: round(costsScore(report), 1),
    source: round(sourceScore(report), 1),
  };
  const total = round(
    breakdown.price * 0.25 +
    breakdown.neighborhood * 0.2 +
    breakdown.space * 0.15 +
    breakdown.building * 0.12 +
    breakdown.energy * 0.1 +
    breakdown.light * 0.08 +
    breakdown.costs * 0.05 +
    breakdown.source * 0.05,
  );
  return { total, title: propertyScoreTitle(total), breakdown };
}
