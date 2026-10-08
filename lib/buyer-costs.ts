import type { Locale } from './i18n.ts';
import { money, moneyEuros, percent } from './format.ts';
import { buyerCommissionPercent } from './red-flags.ts';

/**
 * Grunderwerbsteuer by federal state, as a percentage of the consideration
 * (§ 8, § 11 Grunderwerbsteuergesetz). The federal rate in § 11 GrEStG is
 * 3.5%. The Länder set their own rates (Art. 105 Abs. 2a GG).
 *
 * Checked 2026-10-08 against the state rate statutes and the rates published
 * by the state finance authorities. The Bundesfinanzministerium treats the
 * tax as a Länder tax and does not publish a single rate table; the federal
 * statute is https://www.gesetze-im-internet.de/grestg_1983/__11.html
 *
 * Last changes in force on that date: Bremen 5.5% since 1 July 2025;
 * Thüringen 5.0% since 1 January 2024. Schleswig-Holstein remains 6.5%
 * (since 1 January 2014). Bayern remains at the 3.5% federal rate.
 *
 * `since` is the date the current rate took effect. `checked` is when this
 * table was confirmed.
 */
export const GRUNDERWERBSTEUER_CHECKED = '2026-10-08';

export const STATE_CODES = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'] as const;
export type StateCode = typeof STATE_CODES[number];

export const GRUNDERWERBSTEUER: ReadonlyArray<{ state: StateCode; rate: number; since: string }> = [
  { state: 'BW', rate: 5.0, since: '2011-11-05' },
  { state: 'BY', rate: 3.5, since: '1997-01-01' },
  { state: 'BE', rate: 6.0, since: '2014-01-01' },
  { state: 'BB', rate: 6.5, since: '2015-07-01' },
  { state: 'HB', rate: 5.5, since: '2025-07-01' },
  { state: 'HH', rate: 5.5, since: '2023-01-01' },
  { state: 'HE', rate: 6.0, since: '2014-08-01' },
  { state: 'MV', rate: 6.0, since: '2019-07-01' },
  { state: 'NI', rate: 5.0, since: '2014-01-01' },
  { state: 'NW', rate: 6.5, since: '2015-01-01' },
  { state: 'RP', rate: 5.0, since: '2012-03-01' },
  { state: 'SL', rate: 6.5, since: '2015-01-01' },
  { state: 'SN', rate: 5.5, since: '2023-01-01' },
  { state: 'ST', rate: 5.0, since: '2012-03-01' },
  { state: 'SH', rate: 6.5, since: '2014-01-01' },
  { state: 'TH', rate: 5.0, since: '2024-01-01' },
];

const STATE_NAMES: Record<StateCode, { en: string; de: string }> = {
  BW: { en: 'Baden-Württemberg', de: 'Baden-Württemberg' },
  BY: { en: 'Bavaria', de: 'Bayern' },
  BE: { en: 'Berlin', de: 'Berlin' },
  BB: { en: 'Brandenburg', de: 'Brandenburg' },
  HB: { en: 'Bremen', de: 'Bremen' },
  HH: { en: 'Hamburg', de: 'Hamburg' },
  HE: { en: 'Hesse', de: 'Hessen' },
  MV: { en: 'Mecklenburg-Western Pomerania', de: 'Mecklenburg-Vorpommern' },
  NI: { en: 'Lower Saxony', de: 'Niedersachsen' },
  NW: { en: 'North Rhine-Westphalia', de: 'Nordrhein-Westfalen' },
  RP: { en: 'Rhineland-Palatinate', de: 'Rheinland-Pfalz' },
  SL: { en: 'Saarland', de: 'Saarland' },
  SN: { en: 'Saxony', de: 'Sachsen' },
  ST: { en: 'Saxony-Anhalt', de: 'Sachsen-Anhalt' },
  SH: { en: 'Schleswig-Holstein', de: 'Schleswig-Holstein' },
  TH: { en: 'Thuringia', de: 'Thüringen' },
};

/** Notary and land registry, modelled at 2% of the price. The legal scale (GNotKG) is typically 1.5–2.5%. */
export const NOTARY_RATE = 2;

/**
 * Postcodes that sit wholly inside one state. Other German postcode areas
 * cross state borders, so they are not used.
 */
const POSTAL_RANGES: ReadonlyArray<{ from: number; to: number; state: StateCode }> = [
  { from: 10115, to: 14199, state: 'BE' },
  { from: 20095, to: 20999, state: 'HH' },
  { from: 28195, to: 28779, state: 'HB' },
  { from: 80331, to: 81929, state: 'BY' },
];

/**
 * Municipalities we already recognise on a listing, plus the state name when
 * the address states it. Longer names are preferred so "Saxony-Anhalt" is
 * not read as Saxony. Halle is Halle (Saale). Oldenburg is Oldenburg
 * (Oldenburg) unless the name says Oldenburg in Holstein.
 */
const PLACES: ReadonlyArray<readonly [string, StateCode]> = [
  ['frankfurt am main', 'HE'],
  ['oldenburg in holstein', 'SH'],
  ['mecklenburg western pomerania', 'MV'],
  ['mecklenburg-vorpommern', 'MV'],
  ['north rhine-westphalia', 'NW'],
  ['nordrhein-westfalen', 'NW'],
  ['rhineland-palatinate', 'RP'],
  ['rheinland-pfalz', 'RP'],
  ['baden-württemberg', 'BW'],
  ['schleswig-holstein', 'SH'],
  ['sachsen-anhalt', 'ST'],
  ['saxony-anhalt', 'ST'],
  ['mönchengladbach', 'NW'],
  ['gelsenkirchen', 'NW'],
  ['halle (westfalen)', 'NW'],
  ['braunschweig', 'NI'],
  ['saarbrücken', 'SL'],
  ['monchengladbach', 'NW'],
  ['lower saxony', 'NI'],
  ['niedersachsen', 'NI'],
  ['düsseldorf', 'NW'],
  ['nürnberg', 'BY'],
  ['regensburg', 'BY'],
  ['ingolstadt', 'BY'],
  ['würzburg', 'BY'],
  ['heidelberg', 'BW'],
  ['darmstadt', 'HE'],
  ['wiesbaden', 'HE'],
  ['augsburg', 'BY'],
  ['karlsruhe', 'BW'],
  ['mannheim', 'BW'],
  ['stuttgart', 'BW'],
  ['wolfsburg', 'NI'],
  ['göttingen', 'NI'],
  ['osnabrück', 'NI'],
  ['oldenburg', 'NI'],
  ['magdeburg', 'ST'],
  ['chemnitz', 'SN'],
  ['bielefeld', 'NW'],
  ['wuppertal', 'NW'],
  ['oberhausen', 'NW'],
  ['duisburg', 'NW'],
  ['dortmund', 'NW'],
  ['bochum', 'NW'],
  ['hannover', 'NI'],
  ['potsdam', 'BB'],
  ['dresden', 'SN'],
  ['leipzig', 'SN'],
  ['freiburg', 'BW'],
  ['krefeld', 'NW'],
  ['rostock', 'MV'],
  ['erfurt', 'TH'],
  ['koblenz', 'RP'],
  ['reinbek', 'SH'],
  ['münchen', 'BY'],
  ['munich', 'BY'],
  ['bavaria', 'BY'],
  ['bayern', 'BY'],
  ['bremen', 'HB'],
  ['hamburg', 'HH'],
  ['berlin', 'BE'],
  ['kassel', 'HE'],
  ['mainz', 'RP'],
  ['bonn', 'NW'],
  ['köln', 'NW'],
  ['essen', 'NW'],
  ['halle', 'ST'],
  ['kiel', 'SH'],
  ['lübeck', 'SH'],
  ['aachen', 'NW'],
  ['münster', 'NW'],
  ['trier', 'RP'],
  ['coburg', 'BY'],
  ['jena', 'TH'],
  ['ulm', 'BW'],
  ['erfde', 'SH'],
  ['thüringen', 'TH'],
  ['thuringia', 'TH'],
  ['brandenburg', 'BB'],
  ['saarland', 'SL'],
  ['sachsen', 'SN'],
  ['saxony', 'SN'],
  ['hessen', 'HE'],
  ['hesse', 'HE'],
];

export type StateBasis = 'city' | 'postal' | 'unknown';

export type StateResolution = { state?: StateCode; basis: StateBasis };

type CostFacts = {
  price?: number;
  buyerCosts?: number;
  totalCost?: number;
  buyerCommission?: string;
  city?: string;
  postalCode?: string;
  parkingPrice?: number;
};

export type CostSource = CostFacts | { facts?: CostFacts; address?: string; location?: string };

export type BuyerCostLine = {
  key: 'tax' | 'notary' | 'broker';
  included: boolean;
  low: number;
  high: number;
};

export type BuyerCostBreakdown = {
  price: number;
  state?: StateCode;
  basis: StateBasis;
  lines: BuyerCostLine[];
  estimateLow: number;
  estimateHigh: number;
  estimateIsRange: boolean;
  /** Buyer costs used for financing. A range only when nothing was stated and the state is unknown. */
  financingLow: number;
  financingHigh: number;
  financingIsRange: boolean;
  financingIsEstimated: boolean;
  totalLow: number;
  totalHigh: number;
  /** Ancillary figure stated by the listing. It is not part of the total. */
  statedAncillary?: number;
};

const rateByState = new Map(GRUNDERWERBSTEUER.map(row => [row.state, row]));
const LOWEST_RATE = Math.min(...GRUNDERWERBSTEUER.map(row => row.rate));
const HIGHEST_RATE = Math.max(...GRUNDERWERBSTEUER.map(row => row.rate));

function fold(value: string) {
  return value
    .toLocaleLowerCase('de-DE')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchPlace(text: string): StateCode | undefined {
  const folded = ` ${fold(text)} `;
  if (folded === '  ') return undefined;
  const hits = PLACES.filter(([name]) => folded.includes(` ${fold(name)} `));
  if (!hits.length) return undefined;
  const longest = Math.max(...hits.map(([name]) => fold(name).length));
  const states = new Set(hits.filter(([name]) => fold(name).length === longest).map(([, state]) => state));
  return states.size === 1 ? [...states][0] : undefined;
}

function stateFromPostal(code?: string): StateCode | undefined {
  const match = code?.match(/\b(\d{5})\b/);
  if (!match) return undefined;
  const postal = Number(match[1]);
  return POSTAL_RANGES.find(range => postal >= range.from && postal <= range.to)?.state;
}

function sourceParts(input: CostSource) {
  if (input && typeof input === 'object' && 'facts' in input && input.facts && typeof input.facts === 'object') {
    return { facts: input.facts, address: input.address || '', location: input.location || '' };
  }
  const facts = (input || {}) as CostFacts;
  return { facts, address: '', location: '' };
}

export function stateName(state: StateCode, locale: Locale) {
  return STATE_NAMES[state][locale];
}

export function transferTaxRate(state: StateCode) {
  return rateByState.get(state)?.rate ?? HIGHEST_RATE;
}

/** State from the city or postcode already stored on the report. No network lookup. */
export function stateForReport(input: CostSource): StateResolution {
  const { facts, address, location } = sourceParts(input);
  const fromCity = matchPlace(facts.city || '') || matchPlace(address) || matchPlace(location);
  if (fromCity) return { state: fromCity, basis: 'city' };
  const fromPostal = stateFromPostal(facts.postalCode) || stateFromPostal(address);
  if (fromPostal) return { state: fromPostal, basis: 'postal' };
  return { basis: 'unknown' };
}

function finiteNonNegative(value: number | undefined) {
  return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : 0;
}

function euroAmount(value: string) {
  const clean = (value.match(/\d[\d.,\s]*/)?.[0] || '').replace(/\s/g, '').replace(/[.,]+$/, '');
  if (!clean) return 0;
  const dot = clean.lastIndexOf('.');
  const comma = clean.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) {
    const decimal = dot > comma ? '.' : ',';
    const grouping = decimal === '.' ? ',' : '.';
    return Number(clean.replaceAll(grouping, '').replace(decimal, '.')) || 0;
  }
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(clean)) return Number(clean.replace(/[.,]/g, '')) || 0;
  return Number(clean.replace(',', '.')) || 0;
}

function exclusiveVat(value: string) {
  return /(?:zzgl|plus|\+|excl|exkl|ohne)\.?\s*(?:gesetzl\.?\s*)?(?:MwSt|USt|VAT|Umsatzsteuer)/i.test(value);
}

function inclusiveVat(value: string) {
  return /(?:inkl|incl|including|einschl)\.?\s*(?:gesetzl\.?\s*)?(?:MwSt|USt|VAT|Umsatzsteuer)/i.test(value);
}

function rawPercent(value: string) {
  const match = value.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
  if (!match) return undefined;
  const percentValue = Number(match[1].replace(',', '.'));
  return Number.isFinite(percentValue) ? percentValue : undefined;
}

type Commission =
  | { kind: 'free' }
  | { kind: 'percent'; stated: number; applied: number; vatAdded: boolean; vatIncluded: boolean }
  | { kind: 'euro'; amount: number }
  | { kind: 'unstated' };

function commissionOf(price: number, text?: string): Commission {
  if (!text?.trim()) return { kind: 'unstated' };
  if (/commission-free|provisionsfrei|courtagefrei/i.test(text)) return { kind: 'free' };
  const applied = buyerCommissionPercent(text);
  const stated = rawPercent(text);
  if (applied !== undefined && stated !== undefined) {
    return { kind: 'percent', stated, applied, vatAdded: exclusiveVat(text), vatIncluded: inclusiveVat(text) };
  }
  const amount = euroAmount(text);
  if (amount > 0) return { kind: 'euro', amount: Math.round(amount) };
  if (applied === 0) return { kind: 'free' };
  return { kind: 'unstated' };
}

function centsFromPercent(price: number, rate: number) {
  return Math.round(price * rate);
}

function euros(cents: number) {
  return cents / 100;
}

function sumEuros(values: number[]) {
  return values.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
}

export function buyerCostBreakdown(input: CostSource): BuyerCostBreakdown {
  const { facts } = sourceParts(input);
  const price = finiteNonNegative(facts.price);
  const costsProvided = typeof facts.buyerCosts === 'number' && Number.isFinite(facts.buyerCosts) && facts.buyerCosts >= 0;
  const statedTotal = finiteNonNegative(facts.totalCost);
  const statedFromTotal = price > 0 && statedTotal >= price ? statedTotal - price : undefined;
  const statedAncillary = costsProvided ? finiteNonNegative(facts.buyerCosts) : statedFromTotal;
  const resolution = stateForReport(input);
  const commission = commissionOf(price, facts.buyerCommission);
  const notary = euros(centsFromPercent(price, NOTARY_RATE));
  const taxLow = resolution.state ? euros(centsFromPercent(price, transferTaxRate(resolution.state))) : euros(centsFromPercent(price, LOWEST_RATE));
  const taxHigh = resolution.state ? taxLow : euros(centsFromPercent(price, HIGHEST_RATE));
  const brokerLow = commission.kind === 'free' ? 0
    : commission.kind === 'percent' ? euros(centsFromPercent(price, commission.applied))
    : commission.kind === 'euro' ? commission.amount
    : 0;
  const brokerIncluded = commission.kind !== 'unstated';
  const lines: BuyerCostLine[] = [
    { key: 'tax', included: true, low: taxLow, high: taxHigh },
    { key: 'notary', included: true, low: notary, high: notary },
    { key: 'broker', included: brokerIncluded, low: brokerLow, high: brokerLow },
  ];
  const included = lines.filter(line => line.included);
  const estimateLow = sumEuros(included.map(line => line.low));
  const estimateHigh = sumEuros(included.map(line => line.high));
  const estimateIsRange = estimateLow !== estimateHigh;
  return {
    price,
    state: resolution.state,
    basis: resolution.basis,
    lines,
    estimateLow,
    estimateHigh,
    estimateIsRange,
    financingLow: estimateLow,
    financingHigh: estimateHigh,
    financingIsRange: estimateIsRange,
    financingIsEstimated: true,
    totalLow: sumEuros([price, estimateLow]),
    totalHigh: sumEuros([price, estimateHigh]),
    ...(statedAncillary !== undefined ? { statedAncillary } : {}),
  };
}

function moneyLine(amount: number, locale: Locale) {
  return Math.round(amount * 100) % 100 === 0 ? moneyEuros(amount, locale) : money(amount, locale);
}

function moneySpan(low: number, high: number, locale: Locale) {
  const start = money(low, locale);
  const end = money(high, locale);
  return start === end ? start : `${start}–${end}`;
}

function rateDigits(rate: number) {
  if (!rate) return 0;
  return Math.round(rate * 100) % 10 === 0 ? 1 : 2;
}

function formatRate(rate: number, locale: Locale) {
  return percent(rate, locale, rateDigits(rate));
}

function formatChecked(locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${GRUNDERWERBSTEUER_CHECKED}T00:00:00Z`));
}

function formatSince(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

function shareText(low: number, high: number, price: number, locale: Locale) {
  if (!price) return '';
  const lowShare = (low / price) * 100;
  const highShare = (high / price) * 100;
  const ofPrice = locale === 'de' ? 'des Kaufpreises' : 'of the price';
  const rates = lowShare === highShare
    ? formatRate(lowShare, locale)
    : `${formatRate(lowShare, locale)}–${formatRate(highShare, locale)}`;
  return `${rates} ${ofPrice}`;
}

export type BuyerCostRowView = {
  key: string;
  label: string;
  amount: string;
  share: string;
  basis: string;
};

export type BuyerCostView = {
  title: string;
  summaryAmount: string;
  estimated: boolean;
  estimatedMark: string;
  rows: BuyerCostRowView[];
  footnote: string;
  statedNote?: string;
  totalAmount: string;
};

const FOOTNOTE = {
  en: 'Estimates. Notary and land registry fees are set by law (GNotKG) and depend on the contract and the mortgage.',
  de: 'Schätzwerte. Notar- und Grundbuchkosten sind gesetzlich geregelt (GNotKG) und hängen von Vertrag und Grundschuld ab.',
} as const;

export function buyerCostView(input: CostSource, locale: Locale): BuyerCostView {
  const breakdown = buyerCostBreakdown(input);
  const { facts } = sourceParts(input);
  const commission = commissionOf(breakdown.price, facts.buyerCommission);
  const checked = formatChecked(locale);
  const rows: BuyerCostRowView[] = breakdown.lines.map(line => lineCopy(line, breakdown, commission, locale, checked));
  const summaryAmount = moneySpan(breakdown.financingLow, breakdown.financingHigh, locale);
  const view: BuyerCostView = {
    title: locale === 'de' ? 'Kaufnebenkosten' : 'Buyer costs (Kaufnebenkosten)',
    summaryAmount,
    estimated: breakdown.financingIsEstimated,
    estimatedMark: locale === 'de' ? '(geschätzt)' : '(est.)',
    rows,
    footnote: FOOTNOTE[locale],
    totalAmount: moneySpan(breakdown.totalLow, breakdown.totalHigh, locale),
  };
  if (breakdown.statedAncillary !== undefined) {
    const stated = money(breakdown.statedAncillary, locale);
    const estimate = moneySpan(breakdown.estimateLow, breakdown.estimateHigh, locale);
    view.statedNote = locale === 'de'
      ? `Das Angebot nennt ${stated} Kaufnebenkosten; unsere Schätzung liegt bei ${estimate}.`
      : `The listing states ${stated} in ancillary costs; our estimate is ${estimate}.`;
  }
  return view;
}

function lineCopy(line: BuyerCostLine, breakdown: BuyerCostBreakdown, commission: Commission, locale: Locale, checked: string): BuyerCostRowView {
  if (line.key === 'tax') return taxCopy(line, breakdown, locale, checked);
  if (line.key === 'notary') return notaryCopy(line, breakdown.price, locale);
  return brokerCopy(line, breakdown.price, commission, locale);
}

function taxCopy(line: BuyerCostLine, breakdown: BuyerCostBreakdown, locale: Locale, checked: string): BuyerCostRowView {
  if (breakdown.state) {
    const row = rateByState.get(breakdown.state)!;
    const name = stateName(breakdown.state, locale);
    const rate = formatRate(row.rate, locale);
    const since = formatSince(row.since, locale);
    return {
      key: 'tax',
      label: locale === 'de' ? `Grunderwerbsteuer ${name} ${rate}` : `Transfer tax, ${name} ${rate}`,
      amount: money(line.low, locale),
      share: shareText(line.low, line.high, breakdown.price, locale),
      basis: locale === 'de'
        ? `Gesetzlicher Satz für ${name}, ${rate} seit ${since}. Geprüft am ${checked}.`
        : `Statutory rate for ${name}, ${rate} since ${since}. Checked ${checked}.`,
    };
  }
  const lowRate = formatRate(LOWEST_RATE, locale);
  const highRate = formatRate(HIGHEST_RATE, locale);
  const lowName = stateName('BY', locale);
  return {
    key: 'tax',
    label: locale === 'de'
      ? `Grunderwerbsteuer, Bundesland unklar (${lowRate}–${highRate})`
      : `Transfer tax, state not identified (${lowRate}–${highRate})`,
    amount: moneySpan(line.low, line.high, locale),
    share: shareText(line.low, line.high, breakdown.price, locale),
    basis: locale === 'de'
      ? `Das Angebot nennt kein Bundesland. Der Betrag ist die Spanne vom niedrigsten Satz (${lowRate}, ${lowName}) bis zum höchsten (${highRate}). Geprüft am ${checked}.`
      : `The listing does not identify the federal state. The amount is the range from the lowest state rate (${lowRate}, ${lowName}) to the highest (${highRate}). Checked ${checked}.`,
  };
}

function notaryCopy(line: BuyerCostLine, price: number, locale: Locale): BuyerCostRowView {
  const band = `${formatRate(1.5, locale)}–${formatRate(2.5, locale)}`;
  const shown = formatRate(NOTARY_RATE, locale);
  return {
    key: 'notary',
    label: locale === 'de'
      ? `Notar und Grundbuch (Schätzung, ca. ${formatRate(NOTARY_RATE, locale)})`
      : `Notary and land registry (estimate, ≈${formatRate(NOTARY_RATE, locale)})`,
    amount: money(line.low, locale),
    share: shareText(line.low, line.high, price, locale),
    basis: locale === 'de'
      ? `üblicherweise ${band} des Kaufpreises, angesetzt mit ${shown}.`
      : `typically ${band} of the price, shown at ${shown}.`,
  };
}

function brokerCopy(line: BuyerCostLine, price: number, commission: Commission, locale: Locale): BuyerCostRowView {
  const label = locale === 'de' ? 'Maklerprovision' : 'Agent commission';
  if (commission.kind === 'unstated') {
    const often = formatRate(3.57, locale);
    return {
      key: 'broker',
      label,
      amount: '',
      share: '',
      basis: locale === 'de'
        ? `Nicht angegeben; frage, ob eine Maklerprovision anfällt (oft ${often} inkl. MwSt.).`
        : `Not stated; ask whether an agent fee applies (often ${often} incl. VAT).`,
    };
  }
  if (commission.kind === 'free') {
    return {
      key: 'broker',
      label,
      amount: moneyEuros(0, locale),
      share: shareText(0, 0, price, locale),
      basis: locale === 'de' ? 'Keine (provisionsfrei).' : 'None (commission-free).',
    };
  }
  if (commission.kind === 'euro') {
    return {
      key: 'broker',
      label,
    amount: moneyLine(line.low, locale),
    share: shareText(line.low, line.high, price, locale),
    basis: locale === 'de' ? 'Laut Angebot.' : 'Stated in the listing.',
    };
  }
  const stated = formatRate(commission.stated, locale);
  const applied = formatRate(commission.applied, locale);
  const basis = commission.vatAdded
    ? (locale === 'de'
      ? `Im Angebot ${stated} zzgl. MwSt., daher ${applied} des Kaufpreises.`
      : `Stated as ${stated} plus VAT, so ${applied} of the price.`)
    : commission.vatIncluded
      ? (locale === 'de' ? `Laut Angebot (${applied} inkl. MwSt.).` : `Stated in the listing (${applied} incl. VAT).`)
      : (locale === 'de' ? `Laut Angebot: ${applied} des Kaufpreises.` : `Stated in the listing: ${applied} of the price.`);
  return {
    key: 'broker',
    label,
    amount: moneyLine(line.low, locale),
    share: shareText(line.low, line.high, price, locale),
    basis,
  };
}

export function buyerCostComparisonValue(input: CostSource, locale: Locale) {
  const breakdown = buyerCostBreakdown(input);
  if (!breakdown.price && breakdown.statedAncillary === undefined) return '—';
  const amount = moneySpan(breakdown.financingLow, breakdown.financingHigh, locale);
  return `${amount} ${locale === 'de' ? '(geschätzt)' : '(est.)'}`;
}
