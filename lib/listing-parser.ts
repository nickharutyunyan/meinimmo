import type { Report } from './types';
import { calculatePropertyScore } from './property-score.ts';
import { factualLocation, reportTitle } from './display.ts';
import { extractAvailabilityDate, formatAvailabilityDate } from './availability.ts';
import { canonicalCondition, isNewOrFirstOccupancy } from './property-condition.ts';
import { detectRedFlags, findGroundLease, findHeatingInstallYear, findSoldAsIs, findTenancyConflict, findTimberFrame, groundLeaseSentence, tenancyConflictSentence } from './red-flags.ts';
import { EXTRACTION_VERSION, evidenceForFacts, reportConflicts, scoreAvailable } from './report-integrity.ts';
import { listingContent } from './listing-content.ts';
import { cleanAddressPlaceholders, cleanReportAddress, hasHouseNumber, validStreet } from './location-validation.ts';
import { extractTaxonomyEvidence } from './property-taxonomy.ts';

const UNKNOWN = 'not stated';

const entityMap: Record<string, string> = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', euro: '€',
  auml: 'ä', Auml: 'Ä', ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü', szlig: 'ß',
  sup2: '²', ndash: '–', mdash: '—', hellip: '…',
};

export function decodeHtml(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const hex = code[1]?.toLowerCase() === 'x';
      const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }
    return entityMap[code] ?? entityMap[code.toLowerCase()] ?? entity;
  });
}

const tidy = (value: string) => decodeHtml(value).replace(/\s+/g, ' ').trim();
export function parseListingNumber(value?: string) {
  const clean = ((value || '').match(/\d[\d.,\s]*/)?.[0] || '').replace(/\s/g, '').replace(/[.,]+$/, '');
  if (!clean) return 0;
  const dot = clean.lastIndexOf('.');
  const comma = clean.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) {
    const decimal = dot > comma ? '.' : ',';
    const grouping = decimal === '.' ? ',' : '.';
    return Number(clean.replaceAll(grouping, '').replace(decimal, '.')) || 0;
  }
  // A complete sequence of three-digit groups denotes thousands in either
  // locale; one- or two-digit suffixes denote decimals.
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(clean)) return Number(clean.replace(/[.,]/g, ''));
  return Number(clean.replace(',', '.')) || 0;
}

const number = parseListingNumber;

export type CharacteristicKind = 'heating' | 'energySource' | 'energyCertificate' | 'condition' | 'tenancy' | 'orientation';

const characteristicRules: Record<CharacteristicKind, { prefix: RegExp; expected: RegExp }> = {
  heating: {
    // "sart:" is the exact residue produced when the shorter label
    // "Heizung" was previously matched inside "Heizungsart".
    prefix: /^(?:heizungsart|heizung|heating\s+type|sart)\s*[:\-]\s*/i,
    expected: /(?:heiz|w[aä]rmepumpe|fernw[aä]rme|gas|[oö]l|pellet|solartherm|geotherm|erdw[aä]rme|blockheiz|nachtspeicher|elektr|ofen|kamin|district\s+heat|central\s+heat|underfloor\s+heat|heat\s+pump|boiler|furnace)/i,
  },
  energySource: {
    prefix: /^(?:wesentliche[rs]?\s+energietr[aä]ger|energietr[aä]ger|main\s+energy\s+source)\s*[:\-]\s*/i,
    expected: /(?:umweltw[aä]rme|fernw[aä]rme|erdw[aä]rme|wasserw[aä]rme|luftw[aä]rme|luft\s*[-/]?\s*wasser|w[aä]rmepumpe|gas|[oö]l|strom|elektr|solar|pellet|holz|biomasse|kohle|district\s+heat|electric|heat\s+pump|air(?:\s*[-/]\s*|\s+to\s+)water)/i,
  },
  energyCertificate: {
    prefix: /^(?:energie\s*ausweistyp|energieausweis|energy\s+certificate)\s*[:\-]\s*/i,
    expected: /(?:ausweis|verbrauch|bedarf|certificate|consumption|requirement)/i,
  },
  condition: {
    prefix: /^(?:objektzustand|bauzustand|zustand|condition)\s*[:\-]\s*/i,
    expected: /(?:erstbezug|neubau|saniert|renoviert|gepflegt|neuwertig|modernisierungsbed[uü]rftig|renovierungsbed[uü]rftig|sanierungsbed[uü]rftig|im\s+bau|first\s+occupancy|new\s+build|renovated|maintained|like\s+new|construction)/i,
  },
  tenancy: {
    prefix: /^(?:aktuelle\s+nutzung|nutzung|verf[uü]gbarkeit|occupancy|availability)\s*[:\-]\s*/i,
    expected: /(?:vermietet|bezugsfrei|beziehbar|verf[uü]gbar|leerstehend|eigengenutzt|selbst\s+genutzt|rented|tenant|vacant|available|owner[- ]occupied)/i,
  },
  orientation: {
    prefix: /^(?:balkon\/terrasse\s+ausrichtung|ausrichtung|himmelsrichtung|orientation)\s*[:\-]\s*/i,
    expected: /(?:nord|s[uü]d|ost|west|sonn|hof|stra[sß]e|north|south|east|west|sun|courtyard|street)/i,
  },
};

/**
 * Fast, deterministic guard for human-readable characteristics. It repairs a
 * known leaked field-label prefix, then rejects headings, prompts, URLs and
 * values whose vocabulary does not fit the requested characteristic.
 */
export function checkedCharacteristic(value: string | undefined, kind: CharacteristicKind) {
  if (!value) return '';
  const rule = characteristicRules[kind];
  const clean = tidy(value)
    .replace(/^[\s*•★☆\-–—]+|[\s*•★☆\-–—]+$/g, '')
    .replace(rule.prefix, '')
    .trim();
  if (clean.length < 2 || clean.length > 100) return '';
  if (/[:?]|https?:\/\/|www\.|@|★|☆/iu.test(clean)) return '';
  if (/^(?:wichtiges\s+auf\s+einen\s+blick|auf\s+einen\s+blick|ausstattung|objektdetails|services?\s+f[uü]r\s+dich|jetzt\s+\w+)/iu.test(clean)) return '';
  return rule.expected.test(clean) ? clean : '';
}


const MAX_PARSED_LINES = 800;
const MAX_LINE_CHARS = 1_500;
const BLOCK_CLOSE = /^(?:address|article|aside|blockquote|dd|div|dl|dt|figcaption|figure|h[1-6]|header|li|main|p|section|span|table|tbody|td|tfoot|th|thead|tr)$/i;

/** One forward pass. A missing `>` is not a tag, and later `<` reuse the scan. */
function stripTags(value: string) {
  const parts: string[] = [];
  let plainStart = 0;
  let proven = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 60) continue;
    const limit = Math.min(value.length, index + 400);
    let end = -1;
    for (let cursor = Math.max(index + 1, proven); cursor < limit; cursor += 1) {
      if (value.charCodeAt(cursor) === 62) { end = cursor; break; }
    }
    if (end < 0) { proven = Math.max(proven, limit); continue; }
    parts.push(value.slice(plainStart, index));
    const tag = value.slice(index + 1, end).trim();
    const name = tag.replace(/^\//, '').split(/[\s/>]/)[0] || '';
    if (/^br$/i.test(name)) parts.push('\n');
    else if (tag.startsWith('/') && BLOCK_CLOSE.test(name)) parts.push('\n');
    else parts.push(' ');
    plainStart = end + 1;
    index = end;
  }
  parts.push(value.slice(plainStart));
  return parts.join('');
}

type HtmlLineLimits = { maxRawChars?: number; maxLines?: number; maxLineChars?: number; maxTotalChars?: number };

/** Parser callers use the defaults. A verifier can raise them so a long source is rejected instead of silently shortened. */
export function htmlToLines(raw: string, limits: HtmlLineLimits = {}) {
  const maxRawChars = limits.maxRawChars ?? 1_500_000;
  const maxLines = limits.maxLines ?? MAX_PARSED_LINES;
  const maxLineChars = limits.maxLineChars ?? MAX_LINE_CHARS;
  const maxTotalChars = limits.maxTotalChars ?? Number.POSITIVE_INFINITY;
  const source = raw.length > maxRawChars ? raw.slice(0, maxRawChars) : raw;
  const lines = decodeHtml(stripTags(listingContent(source))).split(/\r?\n/).map(tidy).filter(Boolean);
  const bounded: string[] = [];
  let total = 0;
  for (const line of lines) {
    if (bounded.length >= maxLines || total > maxTotalChars) break;
    const piece = line.length > maxLineChars ? line.slice(0, maxLineChars) : line;
    bounded.push(piece);
    total += piece.length + 1;
  }
  return bounded;
}

function elementText(raw: string, tag: string) {
  const lower = raw.toLowerCase();
  const open = `<${tag}`;
  let from = 0;
  while (from < raw.length) {
    const start = lower.indexOf(open, from);
    if (start < 0) return '';
    const next = lower.charCodeAt(start + open.length);
    if (next >= 97 && next <= 122) { from = start + open.length; continue; }
    const limit = Math.min(raw.length, start + 300);
    let tagEnd = -1;
    for (let cursor = start + open.length; cursor < limit; cursor += 1) {
      if (raw.charCodeAt(cursor) === 62) { tagEnd = cursor; break; }
    }
    if (tagEnd < 0) { from = start + open.length; continue; }
    const close = lower.indexOf(`</${tag}>`, tagEnd);
    if (close < 0) return '';
    return raw.slice(tagEnd + 1, Math.min(close, tagEnd + 1 + 500));
  }
  return '';
}

function pageTitle(raw: string) {
  const tagged = elementText(raw, 'h1') || elementText(raw, 'title');
  if (tagged) return tidy(tagged);
  if (/<[a-z]/i.test(raw)) return '';
  return htmlToLines(raw).find(line => line.length >= 12 && /\p{L}/u.test(line)) || '';
}

function aroundLabel(lines: string[], label: RegExp, value: RegExp, before = 2, after = 3) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!label.test(lines[index])) continue;
    const candidates = [...lines.slice(Math.max(0, index - before), index).reverse(), ...lines.slice(index + 1, index + after + 1)];
    for (const candidate of candidates) {
      const found = candidate.match(value)?.[1];
      if (found) return tidy(found);
    }
  }
  return '';
}

function firstMatch(lines: string[], expression: RegExp) {
  for (const line of lines) {
    const found = line.match(expression)?.[1];
    if (found) return tidy(found);
  }
  return '';
}

function totalCostAroundLabel(lines: string[], purchasePrice: number) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^Gesamtkosten(?:\s+ca\.)?$/i.test(lines[index])) continue;
    for (let distance = 1; distance <= 3; distance += 1) {
      for (const candidate of [lines[index - distance], lines[index + distance]]) {
        if (!candidate || /\/(?:m²|qm)|\bmtl\.?\b/i.test(candidate)) continue;
        const rawAmount = candidate.match(/(\d[\d.,]*)\s*(?:€|EUR)/i)?.[1];
        const amount = rawAmount ? number(rawAmount) : 0;
        if (amount >= purchasePrice) return amount;
      }
    }
  }
  return 0;
}

function statedBuyerCommission(lines: string[], title: string) {
  const relevant = [title, ...lines.slice(0, 800)];
  const commissionFree = /\b(?:provisionsfrei(?:e[snrm]?)?|courtagefrei(?:e[snrm]?)?|ohne\s+(?:K[aä]uferprovision|Maklerprovision|Courtage)|keine\s+(?:zus[aä]tzliche\s+)?(?:K[aä]uferprovision|Maklerprovision|Courtage)|keine\s+Provision\s+f[uü]r\s+(?:den\s+)?K[aä]ufer)\b/i;
  if (relevant.some(line => commissionFree.test(line))) return 'Commission-free';

  const label = /^(?:K[aä]uferprovision|Maklerprovision|Provision|Courtage|External commission)(?:\s+f[uü]r\s+(?:den\s+)?K[aä]ufer)?\s*:?$/i;
  const statedValue = /^((?:\d{1,3}(?:[.,]\d{1,4})?\s*%|\d[\d.\s]*(?:,\d{1,2})?\s*(?:€|EUR))(?:\s*.{0,55})?)$/i;
  for (let index = 0; index < lines.length; index += 1) {
    if (!label.test(lines[index])) continue;
    for (const candidate of [lines[index + 1], lines[index - 1]]) {
      const value = candidate?.match(statedValue)?.[1];
      if (!value) continue;
      return number(value) === 0 ? 'Commission-free' : tidy(value);
    }
  }

  const externalLines = relevant
    .map((line, index) => /\bExternal commission\b/i.test(line) ? `${line} ${relevant[index + 1] || ''}` : '')
    .filter(Boolean);
  const externalInline = firstMatch(externalLines, /\bExternal commission\s*[:\-]?\s*((?:\d{1,3}(?:[.,]\d{1,4})?\s*%)(?:\s*.{0,85})?)/i);
  if (externalInline) return externalInline;

  const commissionLines = relevant;
  const inline = firstMatch(commissionLines, /\b(?:K[aä]uferprovision|Maklerprovision|Courtage|External commission)(?:\s+f[uü]r\s+(?:den\s+)?K[aä]ufer)?\s*[:\-]?\s*((?:\d{1,3}(?:[.,]\d{1,4})?\s*%|\d[\d.\s]*(?:,\d{1,2})?\s*(?:€|EUR))(?:\s*.{0,85})?)/i);
  if (!inline) return '';
  return number(inline) === 0 ? 'Commission-free' : inline;
}

function plausiblePurchasePrice(value: string) {
  const amount = number(value);
  return amount >= 20_000 && amount <= 100_000_000 ? amount : 0;
}

function purchasePrice(lines: string[]) {
  const labeled = [
    /\b(?:Kaufpreis|Purchase price|Asking price)\s*[:\-]?\s*(\d[\d.,]*)\s*(?:€|EUR|e(?=\s|$))(?!\s*\/\s*(?:m²|qm|sqm))/i,
    /\b(\d[\d.,]*)\s*(?:€|EUR|e(?=\s))\s*(?:Kaufpreis|purchase\s+price|asking\s+price)\b(?!\s*\/)/i,
  ];
  for (const expression of labeled) {
    for (const line of lines) {
      const match = line.match(expression)?.[1];
      const amount = match ? plausiblePurchasePrice(match) : 0;
      if (amount) return amount;
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^(?:Kaufpreis|Purchase price|Asking price)\s*:?$/i.test(lines[index])) continue;
    for (const candidate of [...lines.slice(Math.max(0, index - 2), index).reverse(), ...lines.slice(index + 1, index + 4)]) {
      if (/\/(?:m²|qm)|\b(?:mtl\.?|monat|hausgeld|nebenkosten|gesamtkosten|eigenkapital)\b/i.test(candidate)) continue;
      const rawAmount = candidate.match(/(\d[\d.,]*)\s*(?:€|EUR)/i)?.[1];
      const amount = rawAmount ? plausiblePurchasePrice(rawAmount) : 0;
      if (amount) return amount;
    }
  }

  for (const line of lines.slice(0, 100)) {
    if (/\/(?:m²|qm)|\b(?:mtl\.?|monat|hausgeld|nebenkosten|gesamtkosten|eigenkapital|stellplatz|garage)\b/i.test(line)) continue;
    const rawAmount = line.match(/\b([\d]{2,3}(?:[.\s]\d{3})+)\s*(?:€|EUR)/i)?.[1];
    const amount = rawAmount ? plausiblePurchasePrice(rawAmount) : 0;
    if (amount) return amount;
  }
  return 0;
}

type JsonObject = Record<string, unknown>;

function jsonLdObjects(raw: string) {
  const objects: JsonObject[] = [];
  const lower = raw.toLowerCase();
  let from = 0;
  while (objects.length < 400 && from < raw.length) {
    const marker = lower.indexOf('application/ld+json', from);
    if (marker < 0) break;
    const start = lower.lastIndexOf('<script', marker);
    const tagEnd = raw.indexOf('>', marker);
    if (start < 0 || tagEnd < 0 || marker - start > 500 || tagEnd - start > 500) {
      from = marker + 20;
      continue;
    }
    const close = lower.indexOf('</script>', tagEnd);
    if (close < 0) break;
    const body = raw.slice(tagEnd + 1, close);
    from = close + 9;
    if (body.length > 200_000) continue;
    try {
      const parsed = JSON.parse(decodeHtml(body)) as unknown;
      const visit = (value: unknown, depth: number) => {
        if (depth > 8 || objects.length >= 400) return;
        if (Array.isArray(value)) return value.forEach(item => visit(item, depth + 1));
        if (!value || typeof value !== 'object') return;
        const object = value as JsonObject;
        objects.push(object);
        Object.values(object).forEach(item => visit(item, depth + 1));
      };
      visit(parsed, 0);
    } catch {
      // Invalid third-party JSON-LD must not break a listing import.
    }
  }
  return objects;
}

function propertyJsonLd(raw: string) {
  const propertyType = /(apartment|house|residence|accommodation|singlefamily|realestatelisting)/i;
  return jsonLdObjects(raw).find(object => {
    const types = Array.isArray(object['@type']) ? object['@type'] : [object['@type']];
    return types.some(type => typeof type === 'string' && propertyType.test(type));
  });
}

function jsonAddress(raw: string) {
  const property = propertyJsonLd(raw);
  const address = property?.address;
  if (!address || typeof address !== 'object') return {};
  const item = address as JsonObject;
  return {
    street: typeof item.streetAddress === 'string' && validStreet(item.streetAddress) ? cleanAddressPlaceholders(item.streetAddress) : '',
    postalCode: typeof item.postalCode === 'string' ? tidy(item.postalCode) : '',
    city: typeof item.addressLocality === 'string' ? tidy(item.addressLocality) : '',
    district: typeof item.neighborhood === 'string' ? tidy(item.neighborhood) : '',
  };
}

const STREET_NAME = String.raw`[A-ZÄÖÜ][\p{L}äöüß.' -]{1,55}(?:straße|str\.|allee|weg|platz|gasse|damm|ufer|chaussee|ring|steig)(?![\p{L}])`;
const STREET_SUFFIX = String.raw`(?:straße|str\.|allee|weg|platz|gasse|damm|ufer|chaussee|ring|steig)(?![\p{L}])`;
const HEADER_WORD = String.raw`[A-ZÄÖÜ][\p{L}äöüß.'-]{1,40}`;
const HEADER_MINOR = String.raw`(?:der|die|den|dem|des|am|an|auf|im|zum|zur|von|van|und|de|la|le)`;
const HEADER_HEAD = String.raw`(?:Am|An|Auf|Im|Zum|Zur|Unter|Über|Ueber|Vor|Hinter|Bei|Ober|Nieder|${HEADER_WORD})`;
const HEADER_STREET = String.raw`${HEADER_HEAD}(?:\s+(?:${HEADER_MINOR}|${HEADER_WORD})){0,5}`;
const HOUSE_NO = String.raw`\d{1,4}[a-z]?(?:\s*[-–/]\s*\d{1,4}[a-z]?)?`;
const HEADER_AREA = String.raw`[A-ZÄÖÜ][\p{L}äöüß.'-]{1,40}(?:\s+[A-ZÄÖÜ][\p{L}äöüß.'-]{1,40}){0,2}`;
const HEADER_CITY = String.raw`[A-ZÄÖÜ][\p{L}äöüß.-]+(?:\s+(?:am|an|im|auf)\s+[A-ZÄÖÜ][\p{L}äöüß.-]+)?`;
const BUNDESLAND = String.raw`Schleswig-Holstein|Niedersachsen|Nordrhein-Westfalen|Bayern|Baden-W[uü]rttemberg|Hessen|Rheinland-Pfalz|Sachsen-Anhalt|Sachsen|Th[uü]ringen|Brandenburg|Mecklenburg-Vorpommern|Saarland|Berlin|Hamburg|Bremen`;
const BUNDESLAND_EXPRESSION = new RegExp(`^(?:${BUNDESLAND})$`, 'iu');
const STREET_SUFFIX_EXPRESSION = new RegExp(STREET_SUFFIX, 'iu');
const HEADER_STREET_EXPRESSION = new RegExp(
  `^(?:(?:Adresse|Anschrift|Straße|Lage)\\s*[:\\-]\\s*)?(${HEADER_STREET})(?:\\s+(${HOUSE_NO}))?\\s*,?\\s+(?:(${HEADER_AREA})\\s*,\\s*)?(\\d{5})\\s+(${HEADER_CITY})(?:\\s*\\(([^)]{2,50})\\))?(?:\\s*[–—-]\\s*(?:${BUNDESLAND}))?(?![\\p{L}\\d])`,
  'u',
);
const HEADER_TOWN_EXPRESSION = new RegExp(
  `^(?:(\\d{3,5})\\s+)?(${HEADER_CITY})(?:\\s*\\(([^)]{2,50})\\))?(?:\\s*[–—-]\\s*(${BUNDESLAND}))?(?![\\p{L}\\d])`,
  'u',
);
const STREET_AREA_EXPRESSION = new RegExp(`\\b(${STREET_NAME})(?:\\s+\\d{1,4}[a-z]?)?\\s*(?:-\\s*)?,\\s*([A-ZÄÖÜ][\\p{L}äöüß -]{1,45})\\s*,\\s*(\\d{5})\\s+([A-ZÄÖÜ][\\p{L}äöüß.-]+)`, 'iu');
const VISIBLE_ADDRESS_EXPRESSION = new RegExp(`\\b(${STREET_NAME}(?:\\s+\\d{1,4}[a-z]?(?:\\s*[-–/]\\s*\\d{1,4}[a-z]?)?)?)\\s*,?\\s+(?:[A-ZÄÖÜ][\\p{L}äöüß -]{1,45},\\s*)?(\\d{5})\\s+([A-ZÄÖÜ][\\p{L}äöüß.-]+)`, 'iu');
const LABELED_STREET_EXPRESSION = new RegExp(`^\\s*(?:Adresse|Anschrift|Straße|Lage)\\s*[:\\-]\\s*(${STREET_NAME}(?:\\s+\\d{1,4}[a-z]?)?)\\s*[.,]?$`, 'iu');
const PROPERTY_STREET_EXPRESSION = new RegExp(`\\b(?:Wohnung|Haus|Immobilie|Objekt)\\s+(?:liegt|befindet\\s+sich)\\s+(?:direkt\\s+)?(?:in\\s+der|an\\s+der)\\s+(${STREET_NAME}(?:\\s+\\d{1,4}[a-z]?)?)`, 'iu');
const LOCATION_LINE_EXPRESSION = new RegExp(`^\\s*(${STREET_NAME})(?:\\s+\\d{1,4}[a-z]?)?\\s*(?:-\\s*)?,\\s*(?:[^,]{2,50},\\s*)?\\d{5}\\s+[A-ZÄÖÜ]`, 'iu');
const STREET_SUFFIX_TOKENS = ['straße', 'str.', 'allee', 'weg', 'platz', 'gasse', 'damm', 'ufer', 'chaussee', 'ring', 'steig'];

/**
 * Street patterns are polynomial when the name class can swallow the suffix.
 * Run them on the whole line when it is short, otherwise only on a few short
 * windows around a real suffix. That stays linear in the length of the line.
 */
function matchStreetPattern(value: string, expression: RegExp) {
  if (value.length <= 180) return value.match(expression);
  const lower = value.toLocaleLowerCase('de-DE');
  let windows = 0;
  for (const suffix of STREET_SUFFIX_TOKENS) {
    let from = 0;
    while (windows < 8 && from < lower.length) {
      const at = lower.indexOf(suffix, from);
      if (at < 0) break;
      const window = value.slice(Math.max(0, at - 70), Math.min(value.length, at + suffix.length + 90));
      const match = window.match(expression);
      if (match) return match;
      windows += 1;
      from = at + suffix.length;
    }
  }
  return null;
}

type AddressHeader = {
  street?: string;
  postalCode?: string;
  malformedPostal?: string;
  city?: string;
  district?: string;
  found: boolean;
};

function headerFragment(line: string) {
  if (!line || line.length > 90 || /^\d{1,2}$/.test(line)) return false;
  if (/[€%]|\bm²\b|\b(?:Zimmer|Wohnfläche|Kaufpreis|Objektart|Objekttyp|Grundstück)\b/i.test(line)) return false;
  return true;
}

function acceptTown(postal: string, city: string, district: string, state: string) {
  if (!city || /^(?:deutschland|germany)$/i.test(city)) return false;
  if (BUNDESLAND_EXPRESSION.test(city)) return false;
  if (state) return true;
  if (/^\d{5}$/.test(postal)) return true;
  return /^\d{3,4}$/.test(postal) && Boolean(district);
}

/** Portal address header, not seller prose. A street without a suffix still counts when it has a house number. */
function matchAddressHeader(value: string): AddressHeader | undefined {
  if (!value || value.length > 240) return undefined;
  const streetMatch = value.match(HEADER_STREET_EXPRESSION);
  if (streetMatch) {
    const name = tidy(streetMatch[1]);
    const number = tidy(streetMatch[2] || '');
    const area = tidy(streetMatch[3] || '');
    const postalCode = streetMatch[4];
    const city = tidy(streetMatch[5]);
    const parenthetical = tidy(streetMatch[6] || '');
    const hasSuffix = STREET_SUFFIX_EXPRESSION.test(name);
    const street = tidy(number ? `${name} ${number}` : name);
    const barePreposition = /^(?:Am|An|Auf|Im|Zum|Zur|Unter|Über|Ueber|Vor|Hinter|Bei|Ober|Nieder)$/iu.test(name);
    if ((number || hasSuffix) && !barePreposition && validStreet(street) && city) {
      return { street, postalCode, city, district: parenthetical || area, found: true };
    }
  }
  const townMatch = value.match(HEADER_TOWN_EXPRESSION);
  if (!townMatch) return undefined;
  const postal = townMatch[1] || '';
  const city = tidy(townMatch[2]);
  const district = tidy(townMatch[3] || '');
  const state = townMatch[4] || '';
  if (!acceptTown(postal, city, district, state)) return undefined;
  const validPostal = /^\d{5}$/.test(postal);
  return {
    postalCode: validPostal ? postal : undefined,
    malformedPostal: postal && !validPostal ? postal : undefined,
    city,
    district,
    found: true,
  };
}

function parseAddressHeader(lines: string[]): AddressHeader {
  const limit = Math.min(lines.length, 80);
  let town: AddressHeader | undefined;
  for (let index = 0; index < limit; index += 1) {
    if (!headerFragment(lines[index]) || agencyContext(lines, index)) continue;
    const parts = [lines[index]];
    for (let extra = 1; extra < 4 && index + extra < limit && headerFragment(lines[index + extra]); extra += 1) parts.push(lines[index + extra]);
    for (let size = parts.length; size >= 1; size -= 1) {
      const joined = cleanAddressPlaceholders(tidy(parts.slice(0, size).join(' ')));
      const hit = matchAddressHeader(joined);
      if (!hit) continue;
      if (hit.street) return hit;
      if (!town) town = hit;
    }
  }
  return town || { found: false };
}

function visibleLocation(lines: string[], title: string) {
  const text = lines.slice(0, 200).join(' \n ').slice(0, 12_000);
  const cityNames = [
    'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt am Main', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen',
    'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster',
    'Mannheim', 'Karlsruhe', 'Augsburg', 'Wiesbaden', 'Gelsenkirchen', 'Mönchengladbach', 'Braunschweig', 'Kiel', 'Aachen',
    'Chemnitz', 'Halle', 'Magdeburg', 'Freiburg', 'Krefeld', 'Lübeck', 'Mainz', 'Erfurt', 'Oberhausen', 'Rostock',
    'Kassel', 'Potsdam', 'Saarbrücken', 'Oldenburg', 'Osnabrück', 'Heidelberg', 'Darmstadt', 'Regensburg', 'Würzburg',
    'Ingolstadt', 'Ulm', 'Wolfsburg', 'Göttingen', 'Koblenz', 'Jena', 'Trier', 'Coburg', 'Reinbek',
  ];
  const cityEvidence = `${title} ${lines.slice(0, 80).join(' ')}`.slice(0, 8_000);
  const namedCity = cityNames.find((cityName) => new RegExp(`\\b${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(cityEvidence)) || '';
  const postal = lines.slice(0, 500).map((line, index) => `${line} ${/^\([^)]+\)$/.test(lines[index + 1] || '') ? lines[index + 1] : ''}`.match(/\b(\d{5})\s+([^(),|·]{2,65})(?:\s*\(([^)\n]{2,50})\))?/u)).find(Boolean);
  const streetArea = lines.slice(0, 500).map((line) => matchStreetPattern(line, STREET_AREA_EXPRESSION)).find(Boolean);
  const labeledDistrict = text.match(/\b(?:Stadtteil|Ortsteil|Bezirk|Kiez|Mikrolage)\s*[:\-]?\s*([A-ZÄÖÜ][\p{L}äöüß-]{2,}(?:\s+[A-ZÄÖÜ][\p{L}äöüß-]{2,})?)/u)?.[1];
  const kiezSource = lines.slice(0, 100).filter(line => !/zwischen|unweit|nähe|near|between/i.test(line)).join(' ').slice(0, 8_000);
  const kiezStem = kiezSource.match(/(?:im|inmitten\s+des|gelegen\s+im)\s+([A-ZÄÖÜ][\p{L}äöüß-]{2,})(?:[\s-]+Kiez|kiez)\b/u)?.[1];
  const microNeighborhood = kiezStem ? `${kiezStem.replace(/-$/u, '')}kiez` : '';
  const city = namedCity || tidy(postal?.[2] || '').match(/^([A-ZÄÖÜ][\p{L}äöüß.-]+)/u)?.[1] || '';
  const titleArea = city ? title.match(new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–]\\s*([\\p{L}ÄÖÜäöüß][\\p{L}ÄÖÜäöüß -]{1,45}?)(?:\\s*[|·–—]|$)`, 'iu')) : undefined;
  const statedCityArea = city ? text.match(new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–]\\s*([A-ZÄÖÜ][\\p{L}äöüß-]{2,35})\\b`, 'iu'))?.[1] : '';
  return {
    postalCode: postal?.[1] || '',
    city: tidy(city),
    district: tidy(streetArea?.[2] || postal?.[3] || labeledDistrict || microNeighborhood || titleArea?.[1] || statedCityArea || ''),
  };
}

function agencyContext(lines: string[], index: number) {
  return lines.slice(Math.max(0, index - 2), index + 2).some(line => /\b(?:Makler|Anbieter|Anbietende|Gewerblich|Impressum|Immobilienb(?:ü|u)ro|Scout-ID|Objekt-ID|Kontakt|Ansprechpartner(?:in)?|Phone|Mobile|Email)\b/i.test(line));
}

function visibleAddress(lines: string[], expectedCity: string, expectedPostal: string) {
  for (let index = 0; index < Math.min(lines.length, 500); index += 1) {
    const candidate = cleanAddressPlaceholders(`${lines[index]}\n${lines[index + 1] || ''}`);
    const match = matchStreetPattern(candidate, VISIBLE_ADDRESS_EXPRESSION);
    if (!match || !validStreet(match[1]) || agencyContext(lines, index)) continue;
    if (expectedPostal && match[2] !== expectedPostal) continue;
    if (expectedCity && match[3].localeCompare(expectedCity, 'de', { sensitivity: 'base' }) !== 0) continue;
    return tidy(`${match[1]}, ${match[2]} ${match[3]}`);
  }
  return '';
}

function visiblePropertyStreet(lines: string[]) {
  for (let index = 0; index < Math.min(lines.length, 500); index += 1) {
    const line = cleanAddressPlaceholders(lines[index]);
    if (line.length > 240 || agencyContext(lines, index)) continue;
    const candidate = tidy(line.match(LABELED_STREET_EXPRESSION)?.[1] || matchStreetPattern(line, PROPERTY_STREET_EXPRESSION)?.[1] || line.match(LOCATION_LINE_EXPRESSION)?.[1] || '');
    if (candidate && validStreet(candidate)) return candidate;
  }
  return '';
}

function streetFromAddress(value: string) {
  return tidy(value
    .replace(/,?\s*\b\d{5}\b[\s\S]*$/u, '')
    .replace(/\s+0\s*$/u, ''));
}

function namedTransitStop(lines: string[]) {
  const relevant = lines.filter((line) => /\b(?:U-?Bahnhof|S-?Bahnhof|Bahnhof|Tramhaltestelle|Straßenbahnhaltestelle|Haltestelle)\b/i.test(line)).slice(0, 40);
  const patterns = [
    /\b(?:U-?Bahnhof|S-?Bahnhof|Bahnhof|Tramhaltestelle|Straßenbahnhaltestelle|Haltestelle)\s+[„"']?([A-ZÄÖÜ][\p{L}äöüß.-]+(?:[ -][A-ZÄÖÜ][\p{L}äöüß.-]+){0,3})/u,
    /\b([A-ZÄÖÜ][\p{L}äöüß.-]+(?:[ -][A-ZÄÖÜ][\p{L}äöüß.-]+){0,3})\s+(?:U-?Bahnhof|S-?Bahnhof|Bahnhof|Haltestelle)\b/u,
  ];
  for (const line of relevant) {
    for (const pattern of patterns) {
      const candidate = tidy(line.match(pattern)?.[1] || '').replace(/[„“"']+/g, '').replace(/[.;,|].*$/u, '').trim();
      if (candidate && !/^(?:der|die|das|ein|eine|nächste|nahe|fußläufig|wenige)$/i.test(candidate)) return candidate;
    }
  }
  return '';
}

export function normalizedTenancy(value: string, text = '') {
  const explicit = tidy(value);
  // A future handover does not establish current rental status.
  const evidence = `${explicit} ${text}`.replace(/(?:bezugsfrei|beziehbar|verf[uü]gbar|frei)\s+ab\s*:?\s*([^\n]{0,100})/gi, (all, when: string) => /^sofort\b/i.test(when.trim()) ? all : '');
  const propertyRented = /(?:vermietete[rsn]?|aktuell\s+vermietet|derzeit\s+vermietet|wird\s+vermietet\s+verkauft|ist\s+vermietet|tenant[- ]occupied|sold\s+with\s+tenant|currently\s+rented)/i;
  if (/^(?:vermietet|rented|tenant[- ]occupied)$/i.test(explicit) || (propertyRented.test(evidence) && !/(?:nicht|un)vermietet|keine[rsn]?\s+mietverh[aä]ltnis/i.test(evidence))) return 'Rented';
  if (/\b(?:bezugsfrei(?:e[snrm]?)?|sofort\s+beziehbar|sofort\s+verf[uü]gbar|unvermietet|nicht\s+vermietet|leerstehend|frei\s+ab|vacant|ready\s+to\s+move\s+in|available\s+immediately|eigengenutzt|eigennutzung|selbst\s+genutzt|vom\s+eigent[uü]mer\s+bewohnt|owner[- ]occupied)\b/i.test(evidence)) return 'Not rented';
  return undefined;
}

const LABELLED_CONDITIONS = new Set(['Needs renovation', 'Needs modernization', 'Under construction', 'Renovated', 'Like new', 'New build', 'Well maintained']);

export function normalizedCondition(value: string, context = '') {
  const explicit = tidy(value);
  if (/^(?:Erstbezug|First occupancy)$/i.test(explicit)) return explicit;
  const labelled = canonicalCondition(explicit);
  if (labelled && LABELLED_CONDITIONS.has(labelled)) return labelled;
  const evidence = context.slice(0, 12_000);
  if (/\b(?:renovierungsbed[uü]rftig|sanierungsbed[uü]rftig|renovation\s+required|needs\s+renovation)\b/i.test(evidence)) return 'Needs renovation';
  if (/\b(?:modernisierungsbed[uü]rftig|verbesserungsbed[uü]rftig(?:e[snrm]?)?|needs\s+moderni[sz]ation)\b/i.test(evidence)) return 'Needs modernization';
  if (/\b(?:im\s+bau|bauprojekt|projektiert|fertigstellung\s+(?:voraussichtlich|geplant)|under\s+construction)\b/i.test(evidence)) return 'Under construction';
  if (/\b(?:erstbezug\s+nach\s+(?:komplett)?sanierung|kernsaniert|vollst[aä]ndig\s+saniert|saniert|renoviert|fully\s+renovated)\b/i.test(evidence)) return 'Renovated';
  if (/\b(?:neuwertig|like\s+new|as-new\s+condition)\b/i.test(evidence)) return 'Like new';
  if (/\b(?:neubau(?:wohnung|haus)?|new\s+(?:build|construction)|first\s+occupancy\s+after\s+new\s+construction)\b/i.test(evidence)) return 'New build';
  if (/\b(?:gepflegt(?:e[snrm]?)?|well\s+maintained)\b/i.test(evidence)) return 'Well maintained';
  return explicit && explicit.length <= 60 && !/^(?:-|0|n\/a|keine\s+angabe)$/i.test(explicit) ? explicit : undefined;
}

export function normalizedFloor(value: string) {
  const clean = tidy(value);
  if (/^Hochparterre$/i.test(clean)) return 'Hochparterre';
  if (/^(?:EG|Erdgeschoss)$/i.test(clean)) return 'EG';
  if (/^(?:DG|Dachgeschoss)$/i.test(clean)) return 'Dachgeschoss';
  if (/^Souterrain$/i.test(clean)) return 'Souterrain';
  const numbered = clean.match(/^(\d{1,2})(?:\.|\s)*(?:OG|Obergeschoss|Etage|Geschoss)?$/i)?.[1];
  if (!numbered) return '';
  return Number(numbered) === 0 ? 'EG' : `${Number(numbered)}. OG`;
}

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

function summaryFor(report: Report) {
  const { facts } = report;
  const location = factualLocation(report);
  const identity = `${facts.rooms !== UNKNOWN ? `${facts.rooms.replace(',', '.')}-room ` : ''}${report.propertyType}${location ? ` in ${location}` : ''}`;
  const price = facts.price ? `The asking price is €${facts.price.toLocaleString('de-DE')}${facts.area ? ` (€${Math.round(facts.price / facts.area).toLocaleString('de-DE')}/m²)` : ''}.` : '';
  const building = [
    facts.year !== UNKNOWN ? `built in ${facts.year}` : '',
    facts.construction === 'Timber frame' ? 'timber-frame construction' : '',
    facts.condition && facts.condition !== UNKNOWN ? `described as ${facts.condition.toLowerCase()}` : '',
    facts.energy !== UNKNOWN ? `energy class ${facts.energy}` : '',
    facts.energySource ? `heated via ${facts.energySource}` : '',
  ].filter(Boolean).join(', ');
  const plot = facts.plotArea && report.propertyType === 'house' ? ` on a ${facts.plotArea.toLocaleString('en-GB')} m² plot` : '';
  const space = facts.area ? ` has ${facts.area} m² of living area${facts.usableArea ? ` and ${facts.usableArea} m² of usable area` : ''}${plot}` : '';
  const first = `This ${identity}${space}. ${price}${building ? ` Listing details: ${building}.` : ''}`.trim();

  const availableFrom = formatAvailabilityDate(facts.availabilityDate, 'en');
  const investment = facts.tenancyConflict
    ? tenancyConflictSentence(facts, 'en')
    : availableFrom && facts.tenancy !== 'Rented'
    ? `The listing states that the property will be available from ${availableFrom}; confirm vacant handover on that date in the purchase contract.`
    : facts.tenancy === 'Rented'
    ? `It is sold rented${facts.rentedUntilText ? ` until ${facts.rentedUntilText}` : ''}${facts.advertisedYield ? ` and advertised at a ${facts.advertisedYield.toLocaleString('en-GB', { maximumFractionDigits: 2 })}% return` : ''}; verify the current net cold rent, lease terms and the seller's yield calculation before relying on that figure.`
    : ['Not rented', 'Available to move in', 'Vacant', 'Owner-occupied'].includes(facts.tenancy || '')
      ? 'The listing states that it is not rented; confirm the handover date and vacant possession in the purchase contract.'
      : '';
  const occupancyWarning = facts.tenancy === 'Occupancy unclear' ? 'The portal says not rented, but the description says occupants remain. Current occupancy and vacant handover need clarification.' : '';
  const costs = facts.housegeld && report.propertyType !== 'house' ? ` Monthly Hausgeld${facts.housegeldYear ? ` for ${facts.housegeldYear}` : ''} is stated at €${facts.housegeld.toLocaleString('de-DE')}; separate recoverable tenant costs from the owner-only share.` : '';
  const asIs = facts.soldAsIs
    ? (report.propertyType === 'house' ? 'The house is sold as-is (Ist-Zustand).' : 'The unit is sold as-is (Ist-Zustand).')
    : '';
  const honest = [asIs, groundLeaseSentence(facts, 'en')].filter(Boolean).join(' ');
  const second = `${occupancyWarning || investment}${honest ? ` ${honest}` : ''}${costs}`.trim();
  return second ? `${first}\n\n${second}` : first;
}

function considerationsFor(report: Pick<Report, 'facts' | 'sunOrientation' | 'daylight' | 'propertyType'>) {
  const { facts } = report;
  const house = report.propertyType === 'house';
  const items: string[] = [];
  if (facts.tenancy === 'Occupancy unclear') items.push('Confirm the occupants’ legal status and a binding vacant-handover agreement.');
  if (facts.tenancy === 'Rented') items.push('Check the signed lease, net cold rent and payment history.');
  if (facts.housegeld && !house) {
    items.push(isNewOrFirstOccupancy(facts.condition)
      ? `Check how the €${facts.housegeld.toLocaleString('de-DE')} Hausgeld is split between shared running costs and owner-only costs.`
      : `Check how the €${facts.housegeld.toLocaleString('de-DE')} Hausgeld is split and ask for the current WEG reserve balance.`);
  }
  if (!house && facts.floor === UNKNOWN) items.push('Confirm the floor, lift access and whether the unit faces the street or courtyard.');
  if (facts.energy !== UNKNOWN) items.push(`Compare the ${facts.energyCertificate || 'Energieausweis'} with actual energy bills.`);
  if (!house && facts.features?.some(feature => /terrasse|garten/i.test(feature))) items.push('Confirm that terrace and garden rights are recorded in the Teilungserklärung and clarify maintenance responsibility.');
  if (!items.length) items.push(house
    ? 'Request the complete Exposé, Energieausweis and an itemized list of running costs before making an offer.'
    : 'Request the complete Exposé, Energieausweis, WEG records and itemized running costs before making an offer.');
  return items.slice(0, 4);
}

function proximityEvidence(lines: string[], subject: RegExp) {
  const candidates = lines
    .flatMap(line => line.split(/[,;|•]|\.\s+/))
    .filter(fragment => subject.test(fragment))
    .slice(0, 20);
  const minutes = candidates.flatMap(line => {
    const subjectIndex = line.match(subject)?.index ?? 0;
    const values = [...line.matchAll(/\b(\d{1,2})\s*(?:gehmin(?:uten)?|min(?:\.|uten)?|minutes?)\b/gi)].map(match => ({ value: Number(match[1]), index: match.index }));
    const metres = [...line.matchAll(/\b(\d{2,4})\s*(?:m|meter)\b/gi)].map(match => ({ value: Math.max(1, Math.round(Number(match[1]) / 80)), index: match.index }));
    return [...values, ...metres].sort((a, b) => Math.abs(a.index - subjectIndex) - Math.abs(b.index - subjectIndex)).slice(0, 1).map(item => item.value);
  }).filter(value => value > 0 && value <= 90);
  return {
    mentioned: candidates.length > 0,
    minutes: minutes.length ? Math.min(...minutes) : undefined,
  };
}

function roomNumber(value: string) {
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) && number > 0 && number < 40 ? number : undefined;
}

/** Ranges and sentences about other units are not this home's room count. */
function ignoresRoomLine(line: string) {
  if (/\b(?:die meisten|viele von ihnen|viele davon|nachbarwohnungen|übrigen)\b/i.test(line) && /zimmer/i.test(line)) return true;
  if (/\d+(?:[,.]\d+)?\s{0,3}-?\s{0,3}zimmer[\s-]{0,3}wohnungen\b/i.test(line)) return true;
  if (/\d+(?:[,.]\d+)?\s{0,3}(?:-|–|bis)\s{0,3}(?:bis\s{1,3}|hin\s{1,3}zu\s{1,3})?\d+/i.test(line) && /zimmer/i.test(line)) return true;
  if (/\beinheiten\b/i.test(line) && /\d+(?:[,.]\d+)?\s{0,3}-?\s{0,3}zimmer/i.test(line)) return true;
  return false;
}

function unitRoomTokens(line: string) {
  if (ignoresRoomLine(line)) return [];
  return [...line.matchAll(/\b(\d+(?:[,.]\d+)?)[\s-]{0,3}(?:Zimmer|Zi\.|rooms?)\b/gi)].map(match => match[1]);
}

function labelledRoomTokens(lines: string[]) {
  const found: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (ignoresRoomLine(line)) continue;
    const exact = line.match(/^(\d+(?:[,.]\d+)?)\s*(?:Zimmer|Zi\.|rooms?)$/i)?.[1]
      || line.match(/^(?:Anzahl\s+)?(?:Zimmer|Rooms?)\s*[:\-]\s*(\d+(?:[,.]\d+)?)(?!\s*%)/i)?.[1];
    if (exact) found.push(exact);
    const shortLabel = !/wohnzimmer|schlafzimmer|kinderzimmer|badezimmer|arbeitszimmer|esszimmer|gästezimmer|gaestezimmer/i.test(line)
      && line.length < 40
      ? line.match(/^(?:Anzahl\s+)?(?:Zimmer|Rooms?)\s+(\d+(?:[,.]\d+)?)(?!\s*%)/i)?.[1]
      : undefined;
    if (shortLabel) found.push(shortLabel);
    if (/^(?:Anzahl\s+)?(?:Zimmer|Rooms?)$/i.test(line)) {
      const neighbors = [...lines.slice(Math.max(0, index - 2), index).reverse(), ...lines.slice(index + 1, index + 3)];
      const adjacent = neighbors.map(item => item.match(/^(\d+(?:[,.]\d+)?)$/)?.[1]).find(Boolean);
      if (adjacent) found.push(adjacent);
    }
  }
  return found;
}

const HOUSE_TYPE = /bungalows?\b|\b(?:einfamilienhaus|reihen(?:end|mittel)?haus|doppelhaush[aä]lfte|stadthaus|holzhaus|zweifamilienhaus|mehrfamilienhaus|villa)\b|\bDHH\b|\bHaus(?!geld|nummer|wirtschaft|flur|ordnung|meister|verwaltung)(?:es|en|er)?\b/iu;
const FLAT_TYPE = /\b(?:eigentumswohnung|etagenwohnung|erdgeschosswohnung|dachgeschosswohnung|souterrainwohnung|maisonette|penthouse|apartment|loft|wohnung)\b/i;

function classifyTypeLabel(value: string): Report['propertyType'] | undefined {
  const flat = FLAT_TYPE.test(value);
  const house = HOUSE_TYPE.test(value);
  if (flat && house) {
    if (/\b(?:einfamilienhaus|reihen(?:end|mittel)?haus|doppelhaush[aä]lfte|stadthaus|holzhaus|zweifamilienhaus|bungalow|villa)\b|\bDHH\b|bungalows?\b/iu.test(value)) return 'house';
    if (/\b(?:wohnung|apartment|maisonette|penthouse)\b/i.test(value)) return 'flat';
  }
  if (house) return 'house';
  if (flat) return 'flat';
  return undefined;
}

function typeFromJsonLd(raw: string): Report['propertyType'] | undefined {
  const property = propertyJsonLd(raw);
  if (!property) return undefined;
  const types = (Array.isArray(property['@type']) ? property['@type'] : [property['@type']]).filter((type): type is string => typeof type === 'string');
  const blob = types.join(' ');
  if (/apartment/i.test(blob)) return 'flat';
  if (/house|singlefamily/i.test(blob)) return 'house';
  return undefined;
}

function resolvePropertyType(raw: string, lines: string[], title: string, propertyLines: string[]): { propertyType: Report['propertyType']; typeSource: NonNullable<Report['typeSource']> } {
  for (const label of [/^Objektart\b/i, /^Objekttyp\b/i]) {
    const row = lines.find(line => label.test(line));
    const value = row?.replace(/^(?:Objektart|Objekttyp)\s*[:\-]?\s*/i, '') || '';
    const structured = value ? classifyTypeLabel(value) : undefined;
    if (structured) return { propertyType: structured, typeSource: 'structured' };
  }
  const jsonType = typeFromJsonLd(raw);
  if (jsonType) return { propertyType: jsonType, typeSource: 'structured' };
  const fromTitle = classifyTypeLabel(title);
  if (fromTitle) return { propertyType: fromTitle, typeSource: 'keyword' };
  const fromBody = classifyTypeLabel(propertyLines.join(' ').slice(0, 12_000));
  if (fromBody) return { propertyType: fromBody, typeSource: 'keyword' };
  return { propertyType: 'flat', typeSource: 'fallback' };
}

function formatStreetAddress(street: string, postalCode: string, city: string) {
  const place = [postalCode, city].filter(Boolean).join(' ');
  return tidy(place ? `${street}, ${place}` : street);
}

function publishScore(report: Report) {
  const calculation = calculatePropertyScore(report);
  delete report.scoreTitle;
  if (!scoreAvailable(report)) {
    report.score = null;
    report.scoreBreakdown = undefined;
    return report;
  }
  report.score = calculation.total;
  report.scoreBreakdown = calculation.breakdown;
  return report;
}

export function parseListing(raw: string, source: string): Report {
  const lines = htmlToLines(raw);
  const text = lines.join(' \n ').slice(0, 30_000);
  const title = pageTitle(raw);
  const currency = /(\d[\d.,]*)\s*(?:€|EUR|e(?=\s|$))/i;
  const areaValue = /(\d[\d.,]*)\s*(?:m²|qm|sqm|sq\.?\s*m)/i;

  const price = purchasePrice(lines);
  const area = number(firstMatch(lines, /\b(?:Wohnfl[aä]che|Living area)(?:\s+(?:ca\.?|approx\.?))?\s*[:\-]?\s*(\d[\d.,]*)\s*(?:m²|qm|sqm|sq\.?\s*m)/i)
    || aroundLabel(lines, /^(?:Wohnfl[aä]che|Living area)(?:\s+(?:ca\.?|approx\.?))?$/i, areaValue, 3, 3)
    || firstMatch(lines, /\b(\d[\d.,]*)\s*(?:m²|qm|sqm|sq\.?\s*m)\s+(?:Wohnfl[aä]che|Living area)/i));
  const usableArea = number(firstMatch(lines, /\b(?:Nutzfl[aä]che|Usable area)(?:\s+(?:ca\.?|approx\.?))?\s*[:\-]?\s*(\d[\d.,]*)\s*(?:m²|qm|sqm|sq\.?\s*m)/i)
    || aroundLabel(lines, /^(?:Nutzfl[aä]che|Usable area)(?:\s+(?:ca\.?|approx\.?))?$/i, areaValue, 1, 3));
  const plotArea = number(firstMatch(lines, /\bGrundst[uü]cksfl[aä]che(?:\s+(?:ca\.?|approx\.?))?\s*[:\-]?\s*(\d[\d.,]*)\s*(?:m²|qm|sqm)/i)
    || aroundLabel(lines, /^Grundst[uü]cksfl[aä]che(?:\s+(?:ca\.?|approx\.?))?$/i, /(\d[\d.,]*)\s*(?:m²|qm|sqm)/i, 4, 2));
  const labelledRooms = labelledRoomTokens(lines);
  const unitRooms = [title, ...lines].flatMap(unitRoomTokens);
  const roomCounts = new Set([...labelledRooms, ...unitRooms].map(roomNumber).filter((value): value is number => value !== undefined));
  const roomsConflict = roomCounts.size > 1;
  const roomsValue = labelledRooms[0] || unitRooms[0] || '';
  const rooms = roomsConflict ? UNKNOWN : roomsValue || UNKNOWN;
  const yearValue = aroundLabel(lines, /^(?:Baujahr|Year of construction)$/i, /\b(18\d{2}|19\d{2}|20\d{2})\b/, 0, 3)
    || firstMatch(lines, /\b(?:Baujahr|Year of construction)\s*[:\-]?\s*(18\d{2}|19\d{2}|20\d{2})\b/i)
    || firstMatch([title, ...lines], /\b(18\d{2}|19\d{2}|20\d{2})\s+(?:errichtet|erbaut)/i);
  const year = yearValue || UNKNOWN;
  const labelledHochparterre = firstMatch(lines, /(?:Etage|Typ|Stockwerk)\s*[:\-]?\s*(Hochparterre)\b/i);
  const proseHochparterre = firstMatch(lines, /(?:Wohnung|Sie)\s+(?:selbst\s+)?(?:liegt|befindet sich)\s+im\s+(Hochparterre)\b/i)
    || firstMatch(lines, /(?:Wohnung|ETW|Wohneigentumseinheit)[^;!?]{0,90}\bim\s+(Hochparterre)\s+gelegen/i);
  const labelledFloorRaw = firstMatch(lines, /\b(?:Etage|Geschoss|Stockwerk)\s*[:\-]?\s+((?:\d{1,2}\.?\s*(?:OG|Obergeschoss|Etage|Geschoss)?|EG|Erdgeschoss|DG|Dachgeschoss|Souterrain))/i)
    || aroundLabel(lines, /^(?:Etage|Geschoss|Stockwerk)$/i, /^((?:\d{1,2}\.?\s*(?:OG|Obergeschoss|Etage|Geschoss)?|EG|Erdgeschoss|DG|Dachgeschoss|Souterrain))$/i, 0, 3);
  const proseFloorRaw = firstMatch(lines, /\b((?:\d{1,2}\.?\s*OG|Erdgeschoss|Dachgeschoss|Souterrain))\b/i);
  const heating = checkedCharacteristic(firstMatch(lines, /\b(?:Heizungsart|Heizung|Heating type)\b\s*[:\-]?\s*([^|;]{3,70})$/i)
    || aroundLabel(lines, /^(?:Heizungsart|Heizung|Heating type)$/i, /^(.{3,70})$/, 0, 2), 'heating') || UNKNOWN;
  const energySource = checkedCharacteristic(firstMatch(lines, /\b(?:Wesentliche(?:r)?\s+Energietr[aä]ger|Energietr[aä]ger|Main energy source)\b\s*[:\-]?\s*([^|;]{2,45})$/i)
    || aroundLabel(lines, /^(?:Wesentliche(?:r)?\s+Energietr[aä]ger|Energietr[aä]ger|Main energy source)$/i, /^(.{2,45})$/, 0, 2), 'energySource') || undefined;
  const energyDemand = number(firstMatch(lines, /\b(?:Endenergie(?:bedarf|verbrauch)|Energieverbrauchskennwert|Final energy demand)\s*[:\-]?\s*(\d[\d.,]*)\s*kWh/i)
    || aroundLabel(lines, /^(?:Endenergie(?:bedarf|verbrauch)|Energieverbrauchskennwert|Final energy demand)$/i, /(\d[\d.,]*)\s*kWh/i, 0, 2));
  const energy = aroundLabel(lines, /^(?:Energieeffizienzklasse|Energy efficiency class)$/i, /^([A-H](?:\+)?)$/i, 0, 3)
    || firstMatch(lines, /\b(?:Energieeffizienzklasse|Energy efficiency class)\s*[:\-]?\s*([A-H](?:\+)?)(?![\p{L}\p{N}+])/iu)
    || UNKNOWN;
  const energyCertificate = checkedCharacteristic(firstMatch(lines, /\b(?:Energie\s*ausweistyp|Energy certificate)\b\s*[:\-]?\s*([^|;]{3,60})$/i)
    || aroundLabel(lines, /^(?:Energieausweistyp|Energy certificate)$/i, /^(.{3,60})$/, 0, 2), 'energyCertificate') || undefined;
  const conditionRaw = checkedCharacteristic(firstMatch(lines, /\b(?:Objektzustand|Bauzustand|Zustand|Condition)\b\s*[:\-]?\s*([^|;]{3,60})$/i)
    || aroundLabel(lines, /^(?:Objektzustand|Bauzustand|Zustand|Condition)$/i, /^(.{3,60})$/, 0, 2), 'condition');
  const locationStart = lines.findIndex(line => /^(?:Lage|Lagebeschreibung|Location)$/i.test(line));
  const propertyLines = lines.slice(0, locationStart < 0 ? 120 : locationStart);
  const condition = normalizedCondition(conditionRaw, `${title} ${propertyLines.join(' ').slice(0, 12_000)}`);
  const tenancyRaw = checkedCharacteristic(firstMatch(lines, /^(?:Aktuelle Nutzung|Nutzung|Verf[uü]gbarkeit)\s*[:\-]?\s+(.{3,45})$/i) || aroundLabel(lines, /^(?:Aktuelle Nutzung|Nutzung|Verf[uü]gbarkeit)$/i, /^(.{3,45})$/, 0, 2), 'tenancy');
  const availabilityPhrase = firstMatch(lines, /((?:bezugsfrei(?:e[snrm]?)?|sofort\s+beziehbar|sofort\s+verf[uü]gbar|unvermietet|nicht\s+vermietet|leerstehend|eigengenutzt|selbst\s+genutzt)[^.]{0,45})/i);
  const tenancyEvidence = lines
    .filter(line => /(?:wohnung|haus|immobilie|objekt|einheit).{0,100}(?:vermietet|bezugsfrei|beziehbar|unvermietet|leerstehend|eigengenutzt|selbst genutzt)|(?:vermietete|bezugsfreie|unvermietete|leerstehende)\s+(?:wohnung|immobilie|einheit)/i.test(line))
    .slice(0, 12)
    .join(' ');
  let tenancy = normalizedTenancy(tenancyRaw, `${title} ${availabilityPhrase} ${tenancyEvidence}`);
  let availabilityDate = extractAvailabilityDate(lines);
  const rentalText = findTenancyConflict(lines);
  let tenancyConflict = false;
  if (rentalText && (tenancy === 'Not rented' || /(?:nicht|un)\s*vermietet/i.test(tenancyRaw))) {
    tenancy = 'Rented';
    tenancyConflict = true;
  } else if (rentalText && !tenancy) tenancy = 'Rented';
  if (rentalText?.availableFrom && !availabilityDate) availabilityDate = rentalText.availableFrom;
  const occupancyConflict = !tenancyConflict && tenancy === 'Not rented' && propertyLines.some(line => /derzeit.{0,60}bewohnt|bewohner.{0,70}weiterhin|wohnen.{0,40}weiterhin/i.test(line));
  if (occupancyConflict) tenancy = 'Occupancy unclear';
  const lease = findGroundLease(lines);
  const heatingInstall = findHeatingInstallYear(lines);
  const advertisedYield = number(firstMatch([title, ...lines], /([\d,.]+)\s*%\s*(?:Rendite|return)/i) || firstMatch(lines, /(?:Rendite|return)\s*(?:von|:)?\s*([\d,.]+)\s*%/i));
  const housegeldCandidates = lines.flatMap(line => {
    if (!/\b(?:Hausgeld(?:höhe)?|Community fees)\b/i.test(line)) return [];
    const rest = line.slice(line.search(/\b(?:Hausgeld(?:höhe)?|Community fees)\b/i));
    const amount = rest.match(/(?:€|EURO?|EUR)\s*(\d[\d.,]*)(?![\d.,])(?:\s*(?:pro\s+Monat|monatlich|mtl\.?|$|\())/i)?.[1]
      || rest.match(/(\d[\d.,]*)\s*(?:€|EURO?|EUR|e(?=\s|$))(?!\w|\s*\/\s*(?:m²|m2|qm))/i)?.[1];
    return amount ? [{ line, amount: number(amount) }] : [];
  });
  const housegeldCandidate = housegeldCandidates[0];
  const housegeld = housegeldCandidate?.amount || number(aroundLabel(lines, /^(?:Hausgeld(?:\s+mtl\.)?|Community fees)$/i, currency, 0, 3));
  const housegeldYear = housegeldCandidate?.line.match(/(?:Abrechnungsjahr|Wirtschaftsplan|für(?: das Jahr)?)\s+(20\d{2})/i)?.[1];
  const parkingPrice = number(firstMatch(lines, /\bKaufpreis\s+(?:Garage(?:\/Stellplatz)?|Stellplatz)\s*:?\s*(\d[\d.,]*)\s*(?:€|EUR)/i)) || undefined;
  const buyerCosts = number(firstMatch(lines, /\b(?:Kaufnebenkosten|Nebenkosten)(?:\s+ca\.)?\s*[:\-]?\s*(\d[\d.,]*)\s*(?:€|EUR)/i)
    || aroundLabel(lines, /^(?:Kaufnebenkosten|Nebenkosten)(?:\s+ca\.)?$/i, currency, 2, 3));
  const explicitTotalCandidate = number(firstMatch(lines, /\bGesamtkosten(?:\s+ca\.)?\s*[:\-]?\s*(\d[\d.,]*)\s*(?:€|EUR)/i)
    || String(totalCostAroundLabel(lines, price)));
  const explicitTotal = explicitTotalCandidate >= price ? explicitTotalCandidate : 0;
  const buyerCommission = statedBuyerCommission(lines, title);
  const brokerFee = buyerCommission && buyerCommission !== 'Commission-free' && /(?:€|EUR)/i.test(buyerCommission)
    ? number(buyerCommission)
    : buyerCommission === 'Commission-free' ? 0 : undefined;

  const jsonLocation = jsonAddress(raw);
  const shownLocation = visibleLocation(lines, title);
  const headerLocation = parseAddressHeader(lines);
  const postalCode = headerLocation.malformedPostal
    ? ''
    : (headerLocation.postalCode || jsonLocation.postalCode || shownLocation.postalCode);
  const city = headerLocation.city || jsonLocation.city || shownLocation.city;
  const district = headerLocation.district || jsonLocation.district || shownLocation.district;
  const location = district || city;
  const visibleStreet = headerLocation.street || visiblePropertyStreet(lines);
  const statedAddress = jsonLocation.street
    ? tidy(`${jsonLocation.street}${postalCode ? `, ${postalCode}` : ''}${city ? ` ${city}` : ''}`)
    : headerLocation.street
      ? formatStreetAddress(headerLocation.street, postalCode, city)
      : visibleAddress(lines, city, postalCode)
        || (/\b\d{1,4}[a-z]?\s*$/iu.test(visibleStreet) ? tidy(`${visibleStreet}${postalCode ? `, ${postalCode}` : ''}${city ? ` ${city}` : ''}`) : '');
  const placeOnly = tidy([postalCode, city].filter(Boolean).join(' '));
  const address = statedAddress || placeOnly || 'Address not stated';
  const street = jsonLocation.street || headerLocation.street || (statedAddress ? streetFromAddress(statedAddress) : visibleStreet);
  const exactStreet = hasHouseNumber(street);

  const { propertyType, typeSource } = resolvePropertyType(raw, lines, title, propertyLines);
  const floor = normalizedFloor(propertyType === 'house'
    ? (labelledHochparterre || labelledFloorRaw)
    : (labelledHochparterre || proseHochparterre || labelledFloorRaw || proseFloorRaw)) || UNKNOWN;
  // Never treat the next arbitrary line after an "Ausstattung" heading as a
  // characteristic. Exposes frequently put another heading there (for
  // example "★ Wichtiges auf einen Blick ★"), followed by costs or legal
  // metadata. Only explicit, recognized property features belong here.
  const features: string[] = [];
  const statedFeatures = [
    ['Balkon', /\b(?:Balkon|Balcony)\b/i], ['Terrasse', /\b(?:Terrasse|Terrace)\b/i], ['Einbauküche', /\b(?:Einbauküche|Fitted kitchen)\b/i],
    ['Keller', /\b(?:Keller|Kellerabteil|Cellar(?: compartment)?)\b/i], ['Aufzug', /\b(?:Aufzug|Fahrstuhl|Lift|Elevator)\b/i],
    ['Fußbodenheizung', /\b(?:Fußbodenheizung|Underfloor heating)\b/i], ['Garten', /\b(?:Garten|Garden)\b/i],
  ] as const;
  for (const [label, expression] of statedFeatures) {
    const mentioned = propertyLines.some(line => line.split(/(?<=[.!?])\s+/).some(sentence =>
      expression.test(sentence)
      && !/\b(?:die meisten|viele von ihnen|viele davon|nachbarwohnungen|andere wohnungen|übrigen wohnungen)\b/i.test(sentence)
      && !/nahe|nähe|umgebung|entfernt|Britzer Garten/i.test(sentence)
      && !/\b(?:kein(?:e[nmrs]?)?|ohne)\s+(?:einen?\s+)?(?:Balkon|Terrasse|Garten|Aufzug|Keller|Einbauküche)/i.test(sentence)));
    if (mentioned && !features.some(feature => expression.test(feature))) features.push(label);
  }
  if (propertyLines.some(line => /\b(?:komplett\s+)?möbliert(?:e[nsr]?)?\b/i.test(line)) && !/möblierte\s+Darstellung|Mobiliar.{0,40}nicht.{0,20}enthalten|unmöbliert|nicht\s+möbliert/i.test(text)) features.unshift('Möbliert');
  const sunOrientation = checkedCharacteristic(aroundLabel(lines, /^(?:Ausrichtung|Balkon\/Terrasse Ausrichtung|Himmelsrichtung|Orientation)$/i, /^(.{2,40})$/, 0, 2), 'orientation')
    || (/\bsunny\s+balcony\b/i.test(text) ? 'Sunny balcony stated' : UNKNOWN);
  const daylight = /bodentiefe Fenster[^.]{0,100}(?:viel|reichlich)\s+Tageslicht/i.test(text)
    ? 'Floor-to-ceiling windows; abundant daylight claimed'
    : firstMatch(lines, /((?:viel|reichlich)\s+Tageslicht[^.]{0,80})/i) || undefined;
  const transit = proximityEvidence(lines, /\b(?:U-?Bahn|S-?Bahn|Bahnhof|Straßenbahn|Tram|ÖPNV|Nahverkehr|öffentliche[nr]?\s+Verkehrsmittel|public transport)\b/i);
  const transitStop = namedTransitStop(lines);
  const park = proximityEvidence(lines, /\b(?:Park(?!ett|platz|möglichkeiten|en)|Grünanlage|Grünfläche|Spielfläche|Spielplatz|Volkspark|Stadtpark|green space)\w*/i);
  const dailyNeeds = proximityEvidence(lines, /\b(?:Supermarkt|Einkauf|Nahversorgung|Bäcker|Apotheke|Schule|Grundschule|Kita|Kindertagesstätte|daily needs|grocer)\w*/i);

  const totalCost = explicitTotal || (price && buyerCosts ? price + buyerCosts : 0);
  const facts = {
    price, area, usableArea: usableArea || undefined, rooms, year, floor, energy, heating,
    energySource, energyDemand: energyDemand || undefined, energyCertificate, totalCost,
    buyerCosts: buyerCosts || undefined, brokerFee, buyerCommission: buyerCommission || undefined, housegeld: housegeld || undefined, housegeldYear, parkingPrice,
    tenancy, tenancyConflict: tenancyConflict || undefined, rentedUntilText: rentalText?.untilText, availabilityDate, advertisedYield: advertisedYield || undefined, condition, features,
    plotArea: plotArea >= 20 ? plotArea : undefined,
    soldAsIs: findSoldAsIs(lines) ? true : undefined,
    construction: findTimberFrame(title, lines) ? 'Timber frame' : undefined,
    groundLease: lease ? true : undefined,
    groundRentYear: lease?.year,
    groundRentMonth: lease?.month,
    groundRentInServiceCharge: lease?.inCharges || undefined,
    heatingYear: heatingInstall?.year,
    postalCode: postalCode || undefined, city: city || undefined, district: district || undefined,
    street: street || undefined,
    locationPrecision: street ? (exactStreet ? 'address' as const : 'street' as const) : district ? 'neighborhood' as const : postalCode ? 'postal' as const : city ? 'city' as const : undefined,
    transitStop: transitStop || undefined,
    neighborhood: {
      transitMinutes: transit.minutes,
      parkMinutes: park.minutes,
      dailyNeedsMinutes: dailyNeeds.minutes,
      transitMentioned: transit.mentioned,
      parkMentioned: park.mentioned,
      dailyNeedsMentioned: dailyNeeds.mentioned,
    },
  };

  const qualityWarnings = [
    parkingPrice ? `The listing separately quotes €${parkingPrice.toLocaleString('en-GB')} for parking. Confirm whether this is additional and required; it is not included in the stated total.` : '',
    housegeldYear ? `The Hausgeld amount refers to ${housegeldYear}; confirm the current economic plan before budgeting.` : '',
    roomsConflict ? 'The listing gives conflicting room counts. Confirm the floor plan; no room count is used in the title.' : '',
    energy !== UNKNOWN && energyDemand && energyClassFromDemand(energyDemand) !== energy ? 'The stated energy class and consumption figure differ from the standard class bands. Check the actual certificate.' : '',
    tenancyConflict ? tenancyConflictSentence({ rentedUntilText: rentalText?.untilText, availabilityDate }, 'en') : '',
    occupancyConflict ? 'The portal says not rented, but the description says occupants remain. Confirm their legal status and vacant handover before proceeding.' : '',
    headerLocation.malformedPostal ? `The listing prints "${headerLocation.malformedPostal}" as the postcode, which is not a valid 5-digit code. The town is still used.` : '',
    !street ? 'Exact street address is not disclosed in the listing.' : '',
    floor === UNKNOWN && propertyType !== 'house' ? 'The listing does not disclose an exact floor.' : '',
    !explicitTotal ? 'The listing does not provide a complete acquisition total; the financing card uses a rough buyer-cost estimate.' : '',
    tenancy === 'Rented' && !advertisedYield
      ? (propertyType === 'house' ? 'The house is rented but no verified yield was extracted.' : 'The unit is rented but no verified yield was extracted.')
      : '',
  ].filter(Boolean);

  const report: Report = {
    extractionVersion: EXTRACTION_VERSION,
    evidence: evidenceForFacts(lines, facts),
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
    title: '',
    address,
    location,
    propertyType,
    typeSource,
    source,
    createdAt: new Date().toISOString(),
    facts,
    score: 0,
    summary: '',
    considerations: [],
    sunOrientation,
    daylight,
    qualityWarnings,
    aiEnriched: false,
    taxonomyEvidence: extractTaxonomyEvidence(lines),
  };
  report.qualityWarnings = [...new Set([...(report.qualityWarnings || []), ...reportConflicts(report)])];
  report.title = reportTitle(report);
  report.redFlags = detectRedFlags(lines, report);
  report.summary = summaryFor(report);
  report.considerations = considerationsFor(report);
  return publishScore(report);
}

export function refreshDerivedReport(report: Report) {
  report = cleanReportAddress(report);
  report.qualityWarnings = [...new Set([...(report.qualityWarnings || []), ...reportConflicts(report)])];
  report.title = reportTitle(report);
  report.summary = summaryFor(report);
  report.considerations = considerationsFor(report);
  return publishScore(report);
}

export function unsupportedListingReason(raw: string) {
  const lines = htmlToLines(raw);
  const title = pageTitle(raw);
  if (/\b(?:Autohaus|Gewerbezentrum|Ladenlokal|Bürofläche|Einzelhandel|Gewerbegrundstück)\b/i.test(title) || lines.some(line => /^Objektart\s+(?:Einzelhandel|Büro|Gewerbe|Grundstück)/i.test(line))) return 'Only residential apartments and houses for purchase are supported in Germany.';
  if (!lines.some(line => /Kaufpreis|purchase price|asking price/i.test(line)) && lines.some(line => /Kaltmiete|zur Vermietung|zur Miete|for rent/i.test(line))) return 'This is a rental listing. Use a residential property for purchase.';
  return undefined;
}

export function looksLikePropertyListing(raw: string) {
  if (unsupportedListingReason(raw)) return false;
  const lines = htmlToLines(raw);
  const text = lines.join(' ').slice(0, 40_000);
  const unavailable = /seite\s+nicht\s+gefunden|page\s+not\s+found|nicht\s+(mehr\s+)?verf[uü]gbar/i.test(text);
  const signals = [
    /(?:kaufpreis|mietpreis|preis|purchase\s+price|asking\s+price)\s*[:\-]?\s*\d[\d.,]*\s*(?:€|eur|e(?=\s|$))/i,
    /\b\d{2,3}(?:[.\s]\d{3})+\s*€/i,
    /(?:wohnfl[aä]che|fl[aä]che|living\s+area)\s*(?:(?:ca\.?|approx\.?)\s*)?[:\-]?\s*\d[\d.,]*\s*(?:m²|qm|sqm|sq\.?\s*m)/i,
    /\b\d{1,4}\s*(?:m²|qm|sqm|sq\.?\s*m)\b/i,
    /(?:\b[\d,]+\s*(?:zimmer|zi\.|rooms?)\b|\brooms?\s*[:\-]?\s*\d)/i,
    /\b\d{5}\s+[A-ZÄÖÜ]/,
    /(?:baujahr|energieausweis|heizungsart|etage|geschoss|year\s+of\s+construction|energy\s+certificate|energy\s+efficiency\s+class|heating\s+type)/i,
    /(?:expos[eé]|eigentumswohnung|wohnung\s+zum\s+kauf|haus\s+zum\s+kauf|provision|property\s+description|duplex\s+apartment|type\s+of\s+property|external\s+commission)/i,
  ];
  return !unavailable && signals.filter(expression => expression.test(text)).length >= 3;
}
