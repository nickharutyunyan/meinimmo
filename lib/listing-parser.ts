import type { Report } from './types';
import { energyClassFromDemand, energyClassGap, isHeatPumpPhrase } from './property-score.ts';
export { energyClassFromDemand };
import { reportTitle } from './display.ts';
import { extractAvailabilityDate } from './availability.ts';
import { canonicalCondition } from './property-condition.ts';
import { detectRedFlags, findGroundLease, findHeatingInstallYear, findSoldAsIs, findTenancyConflict, findTimberFrame, splitSentences } from './red-flags.ts';
import { money } from './format.ts';
import { localizedConsiderations, localizedSummary } from './report-copy.ts';
import { EXTRACTION_VERSION, attachCalculatedScore, evidenceForFacts, reportConflicts } from './report-integrity.ts';
import { listingContent } from './listing-content.ts';
import { cleanAddressPlaceholders, cleanReportAddress, hasHouseNumber, validStreet } from './location-validation.ts';
import { extractTaxonomyEvidence } from './property-taxonomy.ts';
import { extractListingPhotoUrls, isRemoteListingSource, listingPhotosExpireAt, stagedPhotoMarks } from './listing-photos.ts';

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
    expected: /(?:heiz|w[aä]rmepumpe|luft\s*[-/]\s*wasser|wasserw[aä]rme|l\s*\/\s*w\s*-?\s*wp|fernw[aä]rme|nahw[aä]rme|(?<![\p{L}\p{N}])gas(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])(?:öl|oel|heizöl|heizoel)(?![\p{L}\p{N}])|pellet|solartherm|geotherm|erdw[aä]rme|umweltw[aä]rme|blockheiz|nachtspeicher|elektr|ofen|kamin|district\s+heat|central\s+heat|underfloor|heat\s+pump|boiler|furnace)/iu,
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
  const phrase = kind === 'heating' ? heatingPhrase(clean) : clean;
  if (!phrase) return '';
  return rule.expected.test(phrase) ? phrase : '';
}

/** Drop shutters and other fittings that share a line with the heating system. */
function heatingPhrase(value: string) {
  const stripped = value
    .replace(/\s*(?:,|&|\+|und|mit|sowie|plus|inkl\.?|including)\s+(?:rolll[aä]den|rolladen|rollos?|fensterl[aä]den|fenster|markisen?|jalousien|einbauk[uü]che)\b.*$/i, '')
    .replace(/^(?:und|mit|sowie|plus)\s+/i, '')
    .trim();
  if (/^(?:rolll[aä]den|rolladen|rollos?|fenster|markisen?)$/i.test(stripped)) return '';
  return stripped;
}

const COMPASS = String.raw`(?:Nord|Süd|Sued|Ost|West)`;
const SUN_ORIENTATION = new RegExp(
  String.raw`\b(?:${COMPASS}\s*-\s*und\s+${COMPASS}\s*-?\s*Ausrichtung|${COMPASS}-/${COMPASS}(?:west|ost)?|${COMPASS}-${COMPASS}|nach\s+(?:Norden|Süden|Sueden|Osten|Westen|Südwesten|Nordwesten|Südosten|Nordosten)\s+ausgerichtet(?:e[nrms]?)?|(?:${COMPASS})(?:west|ost)?\s*-?\s*(?=balkon|terrasse))`,
  'iu',
);

/** Compound balcony directions such as "Süd-/Südwestbalkone". One linear pass, capped lines. */
export function findSunOrientation(lines: string[]) {
  const limit = Math.min(lines.length, 160);
  for (let index = 0; index < limit; index += 1) {
    const sample = lines[index].length > 400 ? lines[index].slice(0, 400) : lines[index];
    const match = SUN_ORIENTATION.exec(sample);
    if (!match || match.index === undefined) continue;
    const before = sample.slice(Math.max(0, match.index - 24), match.index);
    if (/(?:kein(?:e[nmrs]?)?|ohne|nicht)\s*$/i.test(before)) continue;
    return match[0].replace(/\s+/g, ' ').trim();
  }
  return '';
}

export function statesPrivateGarden(lines: string[]) {
  return lines.some(line => {
    const sample = line.length > 500 ? line.slice(0, 500) : line;
    if (!/Garten/i.test(sample) || !/Sondernutzungsrecht/i.test(sample)) return false;
    return !/kein(?:e[nmrs]?)?\s+Sondernutzungsrecht|ohne\s+Sondernutzungsrecht/i.test(sample);
  });
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

const STREET_NAME = String.raw`[A-ZÄÖÜ][\p{L}äöüß.' -]{1,55}(?:straße|strasse|str\.|allee|weg|platz|gasse|damm|ufer|chaussee|ring|steig)(?![\p{L}])`;
const STREET_SUFFIX = String.raw`(?:straße|strasse|str\.|allee|weg|platz|gasse|damm|ufer|chaussee|ring|steig)(?![\p{L}])`;
const HEADER_WORD = String.raw`[A-ZÄÖÜ][\p{L}äöüß.'-]{1,40}`;
const HEADER_MINOR = String.raw`(?:der|die|den|dem|des|am|an|auf|im|zum|zur|von|van|und|de|la|le)`;
const HEADER_HEAD = String.raw`(?:Am|An|Auf|Im|Zum|Zur|Unter|Über|Ueber|Vor|Hinter|Bei|Ober|Nieder|${HEADER_WORD})`;
const HEADER_STREET = String.raw`${HEADER_HEAD}(?:\s+(?:${HEADER_MINOR}|${HEADER_WORD})){0,5}`;
const HOUSE_NO = String.raw`\d{1,4}(?:\s{0,2}[a-z](?![a-z]))?(?:\s*[-–/]\s*\d{1,4}(?:\s{0,2}[a-z](?![a-z]))?)?`;
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
const STREET_AREA_EXPRESSION = new RegExp(`\\b(${STREET_NAME})(?:\\s+${HOUSE_NO})?\\s*(?:-\\s*)?,\\s*([A-ZÄÖÜ][\\p{L}äöüß -]{1,45})\\s*,\\s*(\\d{5})\\s+([A-ZÄÖÜ][\\p{L}äöüß.-]+)`, 'iu');
const VISIBLE_ADDRESS_EXPRESSION = new RegExp(`\\b(${STREET_NAME}(?:\\s+${HOUSE_NO})?)\\s*,?\\s+(?:[A-ZÄÖÜ][\\p{L}äöüß -]{1,45},\\s*)?(\\d{5})\\s+([A-ZÄÖÜ][\\p{L}äöüß.-]+)`, 'iu');
const LABELED_STREET_EXPRESSION = new RegExp(`^\\s*(?:Adresse|Anschrift|Straße|Lage)\\s*[:\\-]\\s*(${STREET_NAME}(?:\\s+${HOUSE_NO})?)\\s*[.,]?$`, 'iu');
const PROPERTY_STREET_EXPRESSION = new RegExp(`\\b(?:Wohnung|Haus|Immobilie|Objekt)\\s+(?:liegt|befindet\\s+sich)\\s+(?:direkt\\s+)?(?:in\\s+der|an\\s+der)\\s+(${STREET_NAME}(?:\\s+${HOUSE_NO})?)`, 'iu');
const LOCATION_LINE_EXPRESSION = new RegExp(`^\\s*(${STREET_NAME})(?:\\s+${HOUSE_NO})?\\s*(?:-\\s*)?,\\s*(?:[^,]{2,50},\\s*)?\\d{5}\\s+[A-ZÄÖÜ]`, 'iu');
const STREET_SUFFIX_TOKENS = ['straße', 'strasse', 'str.', 'allee', 'weg', 'platz', 'gasse', 'damm', 'ufer', 'chaussee', 'ring', 'steig'];

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
    const splitCity = splitHyphenCity(city, parenthetical || area);
    const hasSuffix = STREET_SUFFIX_EXPRESSION.test(name);
    const street = spellStreet(tidy(number ? `${name} ${number}` : name));
    const barePreposition = /^(?:Am|An|Auf|Im|Zum|Zur|Unter|Über|Ueber|Vor|Hinter|Bei|Ober|Nieder)$/iu.test(name);
    if ((number || hasSuffix) && !barePreposition && validStreet(street) && splitCity.city) {
      return { street, postalCode, city: splitCity.city, district: splitCity.district, found: true };
    }
  }
  const townMatch = value.match(HEADER_TOWN_EXPRESSION);
  if (!townMatch) return undefined;
  const postal = townMatch[1] || '';
  const city = tidy(townMatch[2]);
  const district = tidy(townMatch[3] || '');
  const state = townMatch[4] || '';
  const named = splitHyphenCity(city, district);
  if (!acceptTown(postal, named.city, named.district, state)) return undefined;
  const validPostal = /^\d{5}$/.test(postal);
  return {
    postalCode: validPostal ? postal : undefined,
    malformedPostal: postal && !validPostal ? postal : undefined,
    city: named.city,
    district: named.district,
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

/** "Strasse" and "Straße" are the same street. Keep the ß spelling. */
function spellStreet(value: string) {
  return value.replace(/Strasse/g, 'Straße').replace(/strasse/g, 'straße');
}

const HYPHEN_CITY = ['Frankfurt am Main', 'Berlin', 'Hamburg', 'München', 'Köln', 'Düsseldorf', 'Nürnberg', 'Bochum', 'Osnabrück', 'Saarbrücken'];

function splitHyphenCity(city: string, district: string) {
  if (district || !city.includes('-') && !city.includes('–')) return { city, district };
  for (const name of HYPHEN_CITY) {
    const rest = city.match(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–]\\s*(.+)$`, 'i'));
    if (rest?.[1]) return { city: name, district: tidy(rest[1]) };
  }
  return { city, district };
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

/** Adjective endings such as renovierte / gepflegten. The stem stays a whole word. */
const CONDITION_PATTERNS: Array<[string, RegExp]> = [
  ['Needs renovation', /\b(?:renovierungsbed[uü]rftig(?:e[nrms]?)?|sanierungsbed[uü]rftig(?:e[nrms]?)?|renovation\s+required|needs\s+renovation)\b/i],
  ['Needs modernization', /\b(?:modernisierungsbed[uü]rftig(?:e[nrms]?)?|verbesserungsbed[uü]rftig(?:e[nrms]?)?|needs\s+moderni[sz]ation)\b/i],
  ['Under construction', /\b(?:im\s+bau|bauprojekt|projektiert|fertigstellung\s+(?:voraussichtlich|geplant)|under\s+construction)\b/i],
  ['Renovated', /\b(?:erstbezug\s+nach\s+(?:komplett)?sanierung|kernsaniert(?:e[nrms]?)?|vollst[aä]ndig\s+saniert(?:e[nrms]?)?|saniert(?:e[nrms]?)?|renoviert(?:e[nrms]?)?|fully\s+renovated)\b/i],
  ['Like new', /\b(?:neuwertig(?:e[nrms]?)?|like\s+new|as-new\s+condition)\b/i],
  ['New build', /\b(?:neubau(?:wohnung|haus)?|new\s+(?:build|construction)|first\s+occupancy\s+after\s+new\s+construction)\b/i],
  ['Well maintained', /\b(?:gepflegt(?:e[nrms]?)?|well\s+maintained)\b/i],
];

function conditionLabel(text: string) {
  for (const [label, pattern] of CONDITION_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return '';
}

function conditionSentences(context: string) {
  return context
    .split(/\n+|(?<=[.!?])\s+(?!(?:Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b)/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length > 0);
}

/** Stairs, the shared estate, or the building, when the sentence is not about the unit. */
function commonPropertySentence(sentence: string) {
  if (/\b(?:Gemeinschaftseigentum|Treppenhaus)\b/i.test(sentence)) return true;
  return /\bHaus\b/i.test(sentence) && !/\b(?:Wohnung|Eigentumswohnung|Einheit|Apartment|Appartement)\b/i.test(sentence);
}

function unitConditionSentence(sentence: string) {
  return /\b(?:Wohnung|Eigentumswohnung|Einheit|Apartment|Appartement)\b/i.test(sentence) && Boolean(conditionLabel(sentence));
}

export function normalizedCondition(value: string, context = '') {
  const explicit = tidy(value);
  if (/^(?:Erstbezug|First occupancy)$/i.test(explicit)) return explicit;
  const labelled = canonicalCondition(explicit);
  if (labelled && LABELLED_CONDITIONS.has(labelled)) return labelled;
  const sentences = conditionSentences(context.slice(0, 12_000));
  const unitHits = sentences.filter(unitConditionSentence);
  // A line about the stairs or the shared estate must not outrank the flat itself.
  const usable = unitHits.length ? sentences.filter((sentence) => !commonPropertySentence(sentence)) : sentences;
  const fromProse = conditionLabel(usable.join(' '));
  if (fromProse) return fromProse;
  return explicit && explicit.length <= 60 && !/^(?:-|0|n\/a|keine\s+angaben?)$/i.test(explicit) ? explicit : undefined;
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

function completionYearNote(year: string, lines: string[]) {
  const built = Number(year.match(/\b(18|19|20)\d{2}\b/)?.[0]);
  if (!built) return '';
  let completion = 0;
  for (const line of lines.slice(0, 240)) {
    const match = line.match(/Fertigstellung(?:[^0-9]{0,30}(?:\d{1,2}\s*[./]\s*)?)(20\d{2})/i);
    if (!match) continue;
    completion = Number(match[1]);
    break;
  }
  if (!completion || Math.abs(completion - built) < 2) return '';
  return `The year built is ${built}, but the listing also says completion in ${completion}. Check which date applies.`;
}

function summaryFor(report: Report) {
  return localizedSummary(report, 'en');
}

function considerationsFor(report: Report) {
  return localizedConsiderations(report, 'en');
}

const WALK_WORDS: Record<string, number> = {
  ein: 1, eine: 1, einer: 1, zwei: 2, drei: 3, vier: 4, funf: 5, fünf: 5,
  sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
};

function walkingFragments(line: string) {
  const protectedLine = line
    .replace(/\b(ca|bzw|ggf|usw|z|nr|str)\.\s+/gi, '$1 ')
    .replace(/(\d),(\d)/g, '$1\u0001$2');
  return protectedLine.split(/[,;|•]|\.\s+/).map((part) => part.replaceAll('\u0001', ','));
}

function walkingMinutesIn(fragment: string) {
  if (/\b(?:auto|fahrrad|rad|bus|pkw|bahn)minuten\b/i.test(fragment) && !/\bgehminuten\b/i.test(fragment)) {
    // A car or cycle time in the same fragment is not a walk, unless a walking time is also written.
  }
  const values: number[] = [];
  const numeric = /(?:(?:ca|rund|etwa|gut|circa|approx)\s+)?(\d{1,2})\s*(?:gehminuten|gehmin|minuten|min|minutes)(?![\p{L}])/giu;
  for (const match of fragment.matchAll(numeric)) {
    const before = fragment.slice(Math.max(0, (match.index ?? 0) - 16), match.index ?? 0);
    if (/\b(?:auto|fahrrad|rad|bus|pkw)\s*$/i.test(before)) continue;
    if (/autominuten|fahrradminuten|busminuten/i.test(match[0])) continue;
    const value = Number(match[1]);
    if (value > 0 && value <= 90) values.push(value);
  }
  const words = /(?:(?:ca|rund|etwa|gut)\s+)?(ein(?:e|er)?|zwei|drei|vier|f[uü]nf|sechs|sieben|acht|neun|zehn)\s+(?:gehminuten|gehmin|minuten)(?![\p{L}])/giu;
  for (const match of fragment.matchAll(words)) {
    const before = fragment.slice(Math.max(0, (match.index ?? 0) - 16), match.index ?? 0);
    if (/\b(?:auto|fahrrad|rad|bus|pkw)\s*$/i.test(before)) continue;
    const key = match[1].toLocaleLowerCase('de-DE').replace('ü', 'u').replace(/^eine?r?$/, 'ein');
    const normalized = match[1].toLocaleLowerCase('de-DE');
    const value = WALK_WORDS[normalized] ?? WALK_WORDS[key];
    if (value) values.push(value);
  }
  return values;
}

/** Metres and kilometres, when the listing gives a distance instead of a walking time. About 80 m is one minute. */
function distanceMinutes(fragment: string) {
  const values: number[] = [];
  for (const match of fragment.matchAll(/\b(\d{2,4})\s*(?:m|meter)\b/gi)) {
    const value = Math.max(1, Math.round(Number(match[1]) / 80));
    if (value <= 90) values.push(value);
  }
  for (const match of fragment.matchAll(/(\d+(?:[.,]\d+)?)\s*km\b/gi)) {
    const km = Number(match[1].replace(',', '.'));
    if (!(km > 0) || km > 8) continue;
    const value = Math.max(1, Math.round((km * 1000) / 80));
    if (value <= 90) values.push(value);
  }
  return values;
}

const BARE_DISTANCE = /^\d+(?:[.,]\d+)?\s?k?m$/i;

/** Label/value rows under the Lage-Check heading. The chart axis after them is bare numbers, not distances. */
function lageCheckBounds(lines: string[]) {
  const start = lines.findIndex((line) => /^Lage-Check$/i.test(line));
  if (start < 0) return undefined;
  let end = start + 1;
  for (let index = start + 1; index < lines.length && index < start + 48; index += 1) {
    const line = lines[index].trim();
    const label = /^(?:ÖPNV|Einkaufen|Gastronomie|Kultur|Sport|Nachtleben|Gesundheit|Kinderfreundlich|Natur|Energie|Nahversorgung)$/i.test(line);
    if (BARE_DISTANCE.test(line) || label || line === '≥450' || /^\d{1,4}$/.test(line)) {
      end = index + 1;
      continue;
    }
    break;
  }
  return { start, end };
}

function proximityEvidence(lines: string[], subject: RegExp) {
  const bounds = lageCheckBounds(lines);
  const windows: string[] = [];
  for (let index = 0; index < lines.length && windows.length < 20; index += 1) {
    const parts = walkingFragments(lines[index]);
    for (let part = 0; part < parts.length && windows.length < 20; part += 1) {
      if (!subject.test(parts[part])) continue;
      if (walkingMinutesIn(parts[part]).length) {
        windows.push(parts[part]);
        continue;
      }
      // The Lage-Check puts the category on one line and a bare distance on the next.
      const following = (lines[index + 1] || '').trim();
      if (bounds && index > bounds.start && index < bounds.end && parts.length === 1 && BARE_DISTANCE.test(following)) {
        windows.push(`${parts[part]} ${following}`);
        continue;
      }
      // A line break in the middle of a sentence can separate the stop from its
      // walking time. A finished sentence does not lend its minutes to the next line.
      const sameLine = parts[part + 1] || '';
      const unfinished = !/[.!?]\s*$/.test(lines[index].trim()) && lines[index].trim().length >= 40;
      const nextLine = unfinished ? (walkingFragments(lines[index + 1] || '')[0] || '') : '';
      const nextPart = sameLine || nextLine;
      windows.push(nextPart && !subject.test(nextPart) ? `${parts[part]} ${nextPart}` : parts[part]);
    }
  }
  const walked = windows.flatMap(walkingMinutesIn).filter(value => value > 0 && value <= 90);
  const distances = walked.length ? [] : windows.flatMap(distanceMinutes).filter(value => value > 0 && value <= 90);
  const minutes = walked.length ? walked : distances;
  return {
    mentioned: windows.length > 0,
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

const LIVING_AREA_UNIT = String.raw`(?:m²|m2|qm|sqm|sq\.?\s*m)`;
const NON_LIVING_AREA = /Nutzfl[aä]che|Dachboden|Spitzboden|Ausbaureserve|Hobbyraum|Keller/i;

function plainSquareMetres(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function figuresBeside(line: string, keyword: RegExp) {
  const unit = new RegExp(String.raw`(\d[\d.,]*)\s*${LIVING_AREA_UNIT}`, 'gi');
  const found: number[] = [];
  if (!keyword.test(line)) return found;
  for (const match of line.matchAll(unit)) {
    const value = parseListingNumber(match[1]);
    if (value > 0) found.push(value);
  }
  return found;
}

function statedLivingFigures(line: string) {
  const expression = new RegExp(
    String.raw`(?<![\p{L}])(?:Wohnfl[aä]che|Living area)(?![\p{L}])[^.\n]{0,48}?(\d[\d.,]*)\s*${LIVING_AREA_UNIT}|(\d[\d.,]*)\s*${LIVING_AREA_UNIT}[^.\n]{0,32}?(?<![\p{L}])(?:Wohnfl[aä]che|Living area)(?![\p{L}])`,
    'giu',
  );
  const found: number[] = [];
  for (const match of line.matchAll(expression)) {
    const value = parseListingNumber(match[1] || match[2]);
    if (value > 0) found.push(value);
  }
  return found;
}

function nonLivingKind(text: string) {
  if (/Spitzboden|Dachboden|unausgebaut|Ausbaureserve/i.test(text)) return 'unfinished loft';
  if (/Hobbyraum/i.test(text)) return 'hobby room';
  if (/Keller/i.test(text)) return 'cellar';
  if (/Nutzfl[aä]che/i.test(text)) return 'usable space';
  return 'non-living space';
}

/**
 * Prefer a smaller Wohnfläche when the header total includes non-living space.
 * The swap always comes with a data note. Two unexplained figures stay on the header and are marked unclear.
 */
export function preferStatedLivingArea(lines: string[], headerArea: number) {
  if (!(headerArea > 0)) return undefined;
  const prose = lines
    .filter((line) => line.length > 24)
    .flatMap(statedLivingFigures)
    .filter((value) => headerArea - value >= 2);
  const extras = lines.flatMap((line) => (NON_LIVING_AREA.test(line) ? figuresBeside(line, NON_LIVING_AREA).filter((value) => Math.abs(value - headerArea) >= 1) : []));
  const living = prose.length ? Math.min(...prose) : 0;
  const explains = living > 0 && extras.some((extra) => Math.abs(headerArea - (living + extra)) <= 1);
  const sameSentence = living > 0 && lines.some((line) => statedLivingFigures(line).some((value) => Math.abs(value - living) < 0.05) && NON_LIVING_AREA.test(line));
  if (living > 0 && (explains || sameSentence)) {
    const extra = extras.find((value) => Math.abs(headerArea - (living + value)) <= 1) ?? extras[0];
    const kind = nonLivingKind(lines.join('\n'));
    const header = plainSquareMetres(headerArea);
    const stated = plainSquareMetres(living);
    const plus = extra ? ` plus ${plainSquareMetres(extra)} m² of non-living space (${kind})` : '';
    return {
      area: living,
      usable: extra,
      warning: `The header states ${header} m², but the description gives ${stated} m² of living space${plus}. The price comparison uses the stated living area of ${stated} m².`,
    };
  }
  if (living > 0 && headerArea - living >= 5) {
    return {
      area: headerArea,
      warning: `The living area in the listing is unclear: the header states ${plainSquareMetres(headerArea)} m² and the description states ${plainSquareMetres(living)} m².`,
    };
  }
  return undefined;
}

function publishScore(report: Report) {
  delete report.scoreTitle;
  const scored = attachCalculatedScore(report);
  report.score = scored.score;
  report.scoreBreakdown = scored.scoreBreakdown;
  return report;
}

function amountOnLine(line: string) {
  const match = line.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:,\d{2})?)\s*(?:€|EUR)/i);
  const amount = match ? number(match[1]) : 0;
  return amount > 0 && amount < 10_000_000 ? amount : 0;
}

/** Nettokaltmiete × 12, or Jahresnettokaltmiete when the listing states the year. */
function annualColdRent(lines: string[]) {
  let annual = 0;
  let monthly = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1] || '';
    if (/Jahresnettokaltmiete/i.test(line)) annual = annual || amountOnLine(line) || amountOnLine(next);
    else if (/(?<!Jahres)Nettokaltmiete/i.test(line)) monthly = monthly || amountOnLine(line) || amountOnLine(next);
  }
  if (annual > 0) return annual;
  return monthly > 0 ? Math.round(monthly * 12 * 100) / 100 : 0;
}

const TENANCY_CONTEXT = /\b(?:Mieter\w*|vermietet\w*|Mietverhältnis|Mietverhaeltnis)\b/i;
const BAN_MONTHS: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};

function utcDay(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return date;
}

function monthIndex(name: string) {
  return BAN_MONTHS[name.toLocaleLowerCase('de-DE').replace('ä', 'ae')];
}

/** A Sperrfrist end written as a date, a month, or a year. Year-only means 31 December. */
function banEndDates(sentence: string) {
  const dates: Date[] = [];
  for (const match of sentence.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g)) {
    const date = utcDay(Number(match[3]), Number(match[2]), Number(match[1]));
    if (date) dates.push(date);
  }
  for (const match of sentence.matchAll(/\b(\d{1,2})\.?\s+(Januar|Februar|M[aä]rz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})\b/gi)) {
    const month = monthIndex(match[2]);
    const date = month ? utcDay(Number(match[3]), month, Number(match[1])) : undefined;
    if (date) dates.push(date);
  }
  for (const match of sentence.matchAll(/\b(Januar|Februar|M[aä]rz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})\b/gi)) {
    const month = monthIndex(match[1]);
    if (!month) continue;
    const year = Number(match[2]);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const date = utcDay(year, month, last);
    if (date) dates.push(date);
  }
  for (const match of sentence.matchAll(/\b(?:bis|endet|läuft|laeuft|Ablauf)\s+(?:Ende\s+|zum\s+(?:Jahr\s+)?)?(20\d{2})\b/gi)) {
    const date = utcDay(Number(match[1]), 12, 31);
    if (date) dates.push(date);
  }
  return dates;
}

function banStillAhead(sentence: string, asOf: Date) {
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  return banEndDates(sentence).some((date) => date.getTime() >= today);
}

/**
 * Tenure counts only when the same sentence is about the tenancy.
 * "seit 2019 saniert" and "Familienbesitz seit 1985" are not a sitting tenant.
 */
export function findTenancySinceYear(lines: string[], asOfYear: number) {
  for (const line of lines.slice(0, 250)) {
    for (const sentence of splitSentences(line)) {
      if (!TENANCY_CONTEXT.test(sentence)) continue;
      const since = sentence.match(/\bseit\s+(?:dem\s+Jahr\s+|dem\s+)?(19\d{2}|20\d{2})\b/i);
      if (since) {
        const year = Number(since[1]);
        if (year >= 1950 && year <= asOfYear) return year;
      }
      const duration = sentence.match(/\b(?:seit|vor)\s+(\d{1,2})\s+Jahren\b/i);
      if (duration) {
        const years = Number(duration[1]);
        if (years >= 1 && years <= 80) return asOfYear - years;
      }
    }
  }
  return undefined;
}

/**
 * A Sperrfrist counts only with an end date that is still ahead.
 * A bare mention, or one that has already ended, is not an active ban.
 */
export function findEvictionBan(lines: string[], asOf = new Date()) {
  for (const line of lines.slice(0, 300)) {
    for (const sentence of splitSentences(line)) {
      const sperrfrist = /Sperrfrist|§\s*577a/i.test(sentence);
      const explicitBan = /\b(?:Kündigungsverbot|Räumungsverbot)\b/i.test(sentence);
      if (!sperrfrist && !explicitBan) continue;
      if (/nicht mehr|abgelaufen|entf[aä]llt|entfallen/i.test(sentence) || /keine[^\n]{0,40}Sperrfrist/i.test(sentence)) continue;
      if (sperrfrist) {
        if (banStillAhead(sentence, asOf)) return true;
        continue;
      }
      if (TENANCY_CONTEXT.test(sentence)) return true;
    }
  }
  return false;
}

const WHOLE_BUILDING = /\b(?:Mehrfamilienh(?:aus|äuser)|Zinsh(?:aus|äuser)|Wohn-?\s*und\s*Gesch[aä]ftshaus)\b/i;

/**
 * A whole building sold as an investment. A flat or a single house marketed
 * as a Kapitalanlage is still a home someone might move into.
 */
export function findInvestmentUse(title: string, lines: string[]) {
  if (/\bapartment\b/i.test(title) || /\b\p{L}*wohnung\b/iu.test(title)) return false;
  if (WHOLE_BUILDING.test(title)) return true;
  const head = lines.slice(0, 40);
  for (let index = 0; index < head.length; index += 1) {
    if (!/^(?:Objektart|Objekttyp)\b/i.test(head[index])) continue;
    const same = head[index].replace(/^(?:Objektart|Objekttyp)\s*[:\-]?\s*/i, '');
    if (WHOLE_BUILDING.test(same) || WHOLE_BUILDING.test(head[index + 1] || '')) return true;
  }
  const several = /\b(?:[2-9]|[1-9]\d|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf)\s+Wohn(?:einheiten|ungen)\b/i;
  return several.test(`${title}\n${head.join('\n')}`);
}

export function parseListing(raw: string, source: string): Report {
  const lines = htmlToLines(raw);
  const text = lines.join(' \n ').slice(0, 30_000);
  const title = pageTitle(raw);
  const currency = /(\d[\d.,]*)\s*(?:€|EUR|e(?=\s|$))/i;
  const areaValue = /(\d[\d.,]*)\s*(?:m²|qm|sqm|sq\.?\s*m)/i;

  const price = purchasePrice(lines);
  const headerArea = number(firstMatch(lines, /\b(?:Wohnfl[aä]che|Living area)(?:\s+(?:ca\.?|approx\.?))?\s*[:\-]?\s*(\d[\d.,]*)\s*(?:m²|qm|sqm|sq\.?\s*m)/i)
    || aroundLabel(lines, /^(?:Wohnfl[aä]che|Living area)(?:\s+(?:ca\.?|approx\.?))?$/i, areaValue, 3, 3)
    || firstMatch(lines, /\b(\d[\d.,]*)\s*(?:m²|qm|sqm|sq\.?\s*m)\s+(?:Wohnfl[aä]che|Living area)/i));
  const livingPreference = preferStatedLivingArea(lines, headerArea);
  const area = livingPreference?.area || headerArea;
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
  const heatingLabel = checkedCharacteristic(firstMatch(lines, /\b(?:Heizungsart|Heizung|Heating type)\b\s*[:\-]?\s*([^|;]{3,70})$/i)
    || aroundLabel(lines, /^(?:Heizungsart|Heizung|Heating type)$/i, /^(.{3,70})$/, 0, 2), 'heating') || UNKNOWN;
  const energySource = checkedCharacteristic(firstMatch(lines, /\b(?:Wesentliche(?:r)?\s+Energietr[aä]ger|Energietr[aä]ger|Main energy source)\b\s*[:\-]?\s*([^|;]{2,45})$/i)
    || aroundLabel(lines, /^(?:Wesentliche(?:r)?\s+Energietr[aä]ger|Energietr[aä]ger|Main energy source)$/i, /^(.{2,45})$/, 0, 2), 'energySource') || undefined;
  const heating = heatingLabel !== UNKNOWN ? heatingLabel : (energySource && isHeatPumpPhrase(energySource) ? energySource : UNKNOWN);
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
  const condition = normalizedCondition(conditionRaw, `${title}\n${propertyLines.join('\n')}`.slice(0, 12_000));
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
  const annualRent = annualColdRent(lines);
  const grossYield = price > 0 && annualRent > 0 ? Math.round((annualRent / price) * 10000) / 100 : undefined;
  const investmentUse = findInvestmentUse(title, lines) || undefined;
  const tenancySinceYear = findTenancySinceYear(lines, new Date().getUTCFullYear());
  const evictionBan = findEvictionBan(lines) || undefined;
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
  const address = spellStreet(statedAddress || placeOnly || 'Address not stated');
  const street = spellStreet(jsonLocation.street || headerLocation.street || (statedAddress ? streetFromAddress(statedAddress) : visibleStreet));
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
    const mentioned = propertyLines.some(line => splitSentences(line).some(sentence =>
      expression.test(sentence)
      && !/\b(?:die meisten|viele von ihnen|viele davon|nachbarwohnungen|andere wohnungen|übrigen wohnungen)\b/i.test(sentence)
      && !/nahe|nähe|umgebung|entfernt|Britzer Garten/i.test(sentence)
      && !/\b(?:kein(?:e[nmrs]?)?|ohne)\s+(?:einen?\s+)?(?:Balkon|Terrasse|Garten|Aufzug|Keller|Einbauküche)/i.test(sentence)));
    if (mentioned && !features.some(feature => expression.test(feature))) features.push(label);
  }
  if (propertyLines.some(line => /\b(?:komplett\s+)?möbliert(?:e[nsr]?)?\b/i.test(line)) && !/möblierte\s+Darstellung|Mobiliar.{0,40}nicht.{0,20}enthalten|unmöbliert|nicht\s+möbliert/i.test(text)) features.unshift('Möbliert');
  const sunOrientation = checkedCharacteristic(aroundLabel(lines, /^(?:Ausrichtung|Balkon\/Terrasse Ausrichtung|Himmelsrichtung|Orientation)$/i, /^(.{2,40})$/, 0, 2), 'orientation')
    || findSunOrientation(propertyLines)
    || (/\bsunny\s+balcony\b/i.test(text) ? 'Sunny balcony stated' : UNKNOWN);
  const daylight = /bodentiefe Fenster[^.]{0,100}(?:viel|reichlich)\s+Tageslicht/i.test(text)
    ? 'Floor-to-ceiling windows; abundant daylight claimed'
    : firstMatch(lines, /((?:viel|reichlich)\s+Tageslicht[^.]{0,80})/i) || undefined;
  const transit = proximityEvidence(lines, /(?<![\p{L}\p{N}])(?:U-?Bahn|S-?Bahn|Bahnhof|Straßenbahn|Tram|ÖPNV|Nahverkehr|öffentliche[nr]?\s+Verkehrsmittel|Bushaltestelle|Haltestelle|Bus|public transport)(?![\p{L}\p{N}])/iu);
  const transitStop = namedTransitStop(lines);
  const park = proximityEvidence(lines, /\b(?:Park(?!ett|platz|möglichkeiten|en)|Grünanlage|Grünfläche|Spielfläche|Spielplatz|Volkspark|Stadtpark|green space)\w*/i);
  const dailyNeeds = proximityEvidence(lines, /\b(?:Supermarkt|Einkauf|Nahversorgung|Bäcker|Apotheke|Schule|Grundschule|Kita|Kindertagesstätte|daily needs|grocer)\w*/i);

  const totalCost = explicitTotal || (price && buyerCosts ? price + buyerCosts : 0);
  const photoUrls = isRemoteListingSource(source) ? extractListingPhotoUrls(raw) : [];
  const photosExpireAt = listingPhotosExpireAt(photoUrls);
  const photoStaging = isRemoteListingSource(source) ? stagedPhotoMarks(raw, photoUrls) : undefined;
  const stagedPhotos = photoStaging && (photoStaging.indexes.length > 0 || photoStaging.listingWide) ? photoStaging : undefined;
  const facts = {
    price, area, usableArea: usableArea || livingPreference?.usable || undefined, rooms, year, floor, energy, heating,
    energySource, energyDemand: energyDemand || undefined, energyCertificate, totalCost,
    buyerCosts: buyerCosts || undefined, brokerFee, buyerCommission: buyerCommission || undefined, housegeld: housegeld || undefined, housegeldYear, parkingPrice,
    tenancy, tenancyConflict: tenancyConflict || undefined, rentedUntilText: rentalText?.untilText, availabilityDate, advertisedYield: advertisedYield || undefined,
    grossYield, investmentUse, tenancySinceYear, evictionBan, condition, features,
    privateGarden: statesPrivateGarden(propertyLines) || undefined,
    plotArea: plotArea >= 20 ? plotArea : undefined,
    soldAsIs: findSoldAsIs(lines) ? true : undefined,
    construction: findTimberFrame(title, lines) ? 'Timber frame' : undefined,
    groundLease: lease ? true : undefined,
    groundLeaseKind: lease?.kind,
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
    ...(photoUrls.length ? { photoUrls, ...(photosExpireAt ? { photosExpireAt } : {}) } : {}),
    ...(stagedPhotos ? { photoStaging: stagedPhotos } : {}),
  };

  const qualityWarnings = [
    livingPreference?.warning || '',
    parkingPrice ? `The listing separately quotes ${money(parkingPrice, 'en')} for parking. Confirm whether this is additional and required; it is not included in the stated total.` : '',
    housegeldYear ? `The Hausgeld amount refers to ${housegeldYear}; confirm the current economic plan before budgeting.` : '',
    roomsConflict ? 'The listing gives conflicting room counts. Confirm the floor plan; no room count is used in the title.' : '',
    energy !== UNKNOWN && energyDemand && energyClassFromDemand(energyDemand) !== energy
      ? (energyClassGap({ facts: { energy, energyDemand } }) === 1
        ? 'The stated energy class is one step off the stated demand. The score uses the lower class.'
        : 'The stated energy class and consumption figure differ from the standard class bands. Check the actual certificate.')
      : '',
    completionYearNote(year, lines),
    occupancyConflict ? 'The portal says not rented, but the description says occupants remain. Confirm their legal status and vacant handover before proceeding.' : '',
    headerLocation.malformedPostal ? `The listing prints "${headerLocation.malformedPostal}" as the postcode, which is not a valid 5-digit code. The town is still used.` : '',
    !street ? 'Exact street address is not disclosed in the listing.' : '',
    floor === UNKNOWN && propertyType !== 'house' ? 'The listing does not disclose an exact floor.' : '',
    !explicitTotal ? 'The listing does not provide a complete acquisition total; the financing card uses a rough buyer-cost estimate.' : '',
    tenancy === 'Rented' && !advertisedYield && !grossYield
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
