import type { Report } from './types';
import { calculatePropertyScore } from './property-score.ts';
import { factualLocation, reportTitle } from './display.ts';

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
const number = (value?: string) => value ? Number(value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')) : 0;

function contentHtml(raw: string) {
  const beforeFooter = raw.split(/<footer\b/i)[0];
  return beforeFooter
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ');
}

export function htmlToLines(raw: string) {
  return decodeHtml(contentHtml(raw)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:address|article|aside|blockquote|dd|div|dl|dt|figcaption|figure|h[1-6]|header|li|main|p|section|span|table|tbody|td|tfoot|th|thead|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .split(/\r?\n/)
    .map(tidy)
    .filter(Boolean);
}

function pageTitle(raw: string) {
  const tagged = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (tagged) return tidy(tagged);
  if (/<[a-z][\s\S]*>/i.test(raw)) return '';
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
        const rawAmount = candidate.match(/([\d.]+(?:,\d+)?)\s*(?:€|EUR)/i)?.[1];
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

  const label = /^(?:K[aä]uferprovision|Maklerprovision|Provision|Courtage)(?:\s+f[uü]r\s+(?:den\s+)?K[aä]ufer)?\s*:?$/i;
  const statedValue = /^((?:\d{1,3}(?:[.,]\d{1,4})?\s*%|\d[\d.\s]*(?:,\d{1,2})?\s*(?:€|EUR))(?:\s*.{0,55})?)$/i;
  for (let index = 0; index < lines.length; index += 1) {
    if (!label.test(lines[index])) continue;
    for (const candidate of [lines[index + 1], lines[index - 1]]) {
      const value = candidate?.match(statedValue)?.[1];
      if (!value) continue;
      return number(value) === 0 ? 'Commission-free' : tidy(value);
    }
  }

  const inline = firstMatch(relevant, /\b(?:K[aä]uferprovision|Maklerprovision|Courtage)(?:\s+f[uü]r\s+(?:den\s+)?K[aä]ufer)?\s*[:\-]?\s*((?:\d{1,3}(?:[.,]\d{1,4})?\s*%|\d[\d.\s]*(?:,\d{1,2})?\s*(?:€|EUR))(?:\s*.{0,55})?)/i);
  if (!inline) return '';
  return number(inline) === 0 ? 'Commission-free' : inline;
}

function plausiblePurchasePrice(value: string) {
  const amount = number(value);
  return amount >= 20_000 && amount <= 100_000_000 ? amount : 0;
}

function purchasePrice(lines: string[]) {
  const labeled = [
    /\bKaufpreis\s*[:\-]?\s*([\d.]+(?:,\d+)?)\s*(?:€|EUR)(?!\s*\/\s*(?:m²|qm))/i,
    /\b([\d.]+(?:,\d+)?)\s*(?:€|EUR)\s*(?:Kaufpreis|asking\s+price)\b(?!\s*\/)/i,
  ];
  for (const expression of labeled) {
    for (const line of lines) {
      const match = line.match(expression)?.[1];
      const amount = match ? plausiblePurchasePrice(match) : 0;
      if (amount) return amount;
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^Kaufpreis\s*:?$/i.test(lines[index])) continue;
    for (const candidate of [...lines.slice(Math.max(0, index - 2), index).reverse(), ...lines.slice(index + 1, index + 4)]) {
      if (/\/(?:m²|qm)|\b(?:mtl\.?|monat|hausgeld|nebenkosten|gesamtkosten|eigenkapital)\b/i.test(candidate)) continue;
      const rawAmount = candidate.match(/([\d.]+(?:,\d+)?)\s*(?:€|EUR)/i)?.[1];
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
  for (const match of raw.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1])) as unknown;
      const visit = (value: unknown) => {
        if (Array.isArray(value)) return value.forEach(visit);
        if (!value || typeof value !== 'object') return;
        const object = value as JsonObject;
        objects.push(object);
        Object.values(object).forEach(visit);
      };
      visit(parsed);
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
    street: typeof item.streetAddress === 'string' ? tidy(item.streetAddress) : '',
    postalCode: typeof item.postalCode === 'string' ? tidy(item.postalCode) : '',
    city: typeof item.addressLocality === 'string' ? tidy(item.addressLocality) : '',
    district: typeof item.neighborhood === 'string' ? tidy(item.neighborhood) : '',
  };
}

const STREET_NAME = String.raw`[A-ZÄÖÜ][\p{L}äöüß.' -]{1,55}(?:straße|str\.|allee|weg|platz|gasse|damm|ufer|chaussee|ring|steig)`;

function visibleLocation(lines: string[], title: string) {
  const text = lines.slice(0, 500).join(' \n ');
  const cityNames = [
    'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt am Main', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen',
    'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster',
    'Mannheim', 'Karlsruhe', 'Augsburg', 'Wiesbaden', 'Gelsenkirchen', 'Mönchengladbach', 'Braunschweig', 'Kiel', 'Aachen',
    'Chemnitz', 'Halle', 'Magdeburg', 'Freiburg', 'Krefeld', 'Lübeck', 'Mainz', 'Erfurt', 'Oberhausen', 'Rostock',
    'Kassel', 'Potsdam', 'Saarbrücken', 'Oldenburg', 'Osnabrück', 'Heidelberg', 'Darmstadt', 'Regensburg', 'Würzburg',
    'Ingolstadt', 'Ulm', 'Wolfsburg', 'Göttingen', 'Koblenz', 'Jena', 'Trier', 'Coburg', 'Reinbek',
  ];
  const cityEvidence = `${title} ${lines.slice(0, 80).join(' ')}`;
  const namedCity = cityNames.find((cityName) => new RegExp(`\\b${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(cityEvidence)) || '';
  const postal = lines.slice(0, 500).map((line) => line.match(/\b(\d{5})\s+([^(),|·]{2,65})(?:\s*\(([^)\n]{2,50})\))?/u)).find(Boolean);
  const streetAreaExpression = new RegExp(`\\b(${STREET_NAME})\\s*(?:-\\s*)?,\\s*([A-ZÄÖÜ][\\p{L}äöüß -]{1,45})\\s*,\\s*(\\d{5})\\s+([A-ZÄÖÜ][\\p{L}äöüß.-]+)`, 'iu');
  const streetArea = lines.slice(0, 500).map((line) => line.match(streetAreaExpression)).find(Boolean);
  const labeledDistrict = text.match(/\b(?:Stadtteil|Ortsteil|Bezirk|Kiez|Mikrolage)\s*[:\-]?\s*([A-ZÄÖÜ][\p{L}äöüß-]{2,}(?:\s+[A-ZÄÖÜ][\p{L}äöüß-]{2,})?)/u)?.[1];
  const kiezStem = text.match(/\b([A-ZÄÖÜ][\p{L}äöüß-]{2,})(?:[\s-]+Kiez|kiez)\b/u)?.[1];
  const microNeighborhood = kiezStem ? `${kiezStem.replace(/-$/u, '')}kiez` : '';
  const city = namedCity || tidy(postal?.[2] || '').match(/^([A-ZÄÖÜ][\p{L}äöüß.-]+)/u)?.[1] || '';
  const titleArea = city ? title.match(new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–]\\s*([\\p{L}ÄÖÜäöüß][\\p{L}ÄÖÜäöüß -]{1,45}?)(?:\\s*[|·–—]|$)`, 'iu')) : undefined;
  return {
    postalCode: postal?.[1] || '',
    city: tidy(city),
    district: tidy(microNeighborhood || postal?.[3] || streetArea?.[2] || labeledDistrict || titleArea?.[1] || ''),
  };
}

function agencyContext(lines: string[], index: number) {
  return lines.slice(Math.max(0, index - 2), index + 2).some(line => /\b(?:Makler|Anbieter|Anbietende|Gewerblich|Impressum|Immobilienb(?:ü|u)ro|Scout-ID|Objekt-ID|Kontakt)\b/i.test(line));
}

function visibleAddress(lines: string[], expectedCity: string, expectedPostal: string) {
  const expression = new RegExp(`\\b(${STREET_NAME}\\s+\\d{1,4}[a-z]?)\\s*,?\\s+(\\d{5})\\s+([A-ZÄÖÜ][\\p{L}äöüß.-]+)`, 'iu');
  for (let index = 0; index < Math.min(lines.length, 500); index += 1) {
    const match = lines[index].match(expression);
    if (!match || agencyContext(lines, index)) continue;
    if (expectedPostal && match[2] !== expectedPostal) continue;
    if (expectedCity && match[3].localeCompare(expectedCity, 'de', { sensitivity: 'base' }) !== 0) continue;
    return tidy(match[0]);
  }
  return '';
}

function visiblePropertyStreet(lines: string[]) {
  const labeled = new RegExp(`\\b(?:Adresse|Anschrift|Straße|Lage)\\s*[:\\-]\\s*(?:[^.;]{0,45}?\\b(?:nahe|Nähe|unweit|bei)\\s+(?:der\\s+)?)?(${STREET_NAME}(?:\\s+\\d{1,4}[a-z]?)?)`, 'iu');
  const nearby = new RegExp(`\\b(?:nahe|Nähe|unweit|bei|direkt\\s+(?:an|bei)|gelegen\\s+(?:an|bei)|in\\s+der)\\s+(?:der\\s+)?(${STREET_NAME}(?:\\s+\\d{1,4}[a-z]?)?)`, 'iu');
  const locationLine = new RegExp(`^\\s*(${STREET_NAME})(?:\\s+\\d{1,4}[a-z]?)?\\s*(?:-\\s*)?,\\s*(?:[^,]{2,50},\\s*)?\\d{5}\\s+[A-ZÄÖÜ]`, 'iu');
  for (let index = 0; index < Math.min(lines.length, 500); index += 1) {
    const line = lines[index];
    if (agencyContext(lines, index)) continue;
    const candidate = tidy(line.match(labeled)?.[1] || line.match(nearby)?.[1] || line.match(locationLine)?.[1] || '');
    if (candidate) return candidate;
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
  const evidence = `${explicit} ${text}`;
  const propertyRented = /(?:vermietete[rsn]?|aktuell\s+vermietet|derzeit\s+vermietet|wird\s+vermietet\s+verkauft|ist\s+vermietet|tenant[- ]occupied|sold\s+with\s+tenant|currently\s+rented)/i;
  if (/^(?:vermietet|rented|tenant[- ]occupied)$/i.test(explicit) || (propertyRented.test(evidence) && !/(?:nicht|un)vermietet|keine[rsn]?\s+mietverh[aä]ltnis/i.test(evidence))) return 'Rented';
  if (/\b(?:bezugsfrei|sofort\s+beziehbar|sofort\s+verf[uü]gbar|unvermietet|nicht\s+vermietet|leerstehend|frei\s+ab|vacant|ready\s+to\s+move\s+in|available\s+immediately|eigengenutzt|eigennutzung|selbst\s+genutzt|vom\s+eigent[uü]mer\s+bewohnt|owner[- ]occupied)\b/i.test(evidence)) return 'Not rented';
  return undefined;
}

export function normalizedCondition(value: string, context = '') {
  const explicit = tidy(value);
  const evidence = `${explicit} ${context}`;
  if (/\b(?:renovierungsbed[uü]rftig|sanierungsbed[uü]rftig|renovation\s+required|needs\s+renovation)\b/i.test(evidence)) return 'Needs renovation';
  if (/\b(?:modernisierungsbed[uü]rftig|needs\s+moderni[sz]ation)\b/i.test(evidence)) return 'Needs modernization';
  if (/\b(?:im\s+bau|bauprojekt|projektiert|fertigstellung\s+(?:voraussichtlich|geplant)|under\s+construction)\b/i.test(evidence)) return 'Under construction';
  if (/\b(?:erstbezug\s+nach\s+(?:komplett)?sanierung|kernsaniert|vollst[aä]ndig\s+saniert|saniert|renoviert|fully\s+renovated)\b/i.test(evidence)) return 'Renovated';
  if (/\b(?:neubau(?:wohnung|haus)?|new\s+build)\b/i.test(evidence)) return 'New build';
  if (/\b(?:gepflegt|well\s+maintained)\b/i.test(evidence)) return 'Well maintained';
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
    facts.condition && facts.condition !== UNKNOWN ? `described as ${facts.condition.toLowerCase()}` : '',
    facts.energy !== UNKNOWN ? `energy class ${facts.energy}` : '',
    facts.energySource ? `heated via ${facts.energySource}` : '',
  ].filter(Boolean).join(', ');
  const space = facts.area ? ` has ${facts.area} m² of living area${facts.usableArea ? ` and ${facts.usableArea} m² of usable area` : ''}` : '';
  const first = `This ${identity}${space}. ${price}${building ? ` It is ${building}.` : ''}`.trim();

  const investment = facts.tenancy === 'Rented'
    ? `It is sold rented${facts.advertisedYield ? ` and advertised at a ${facts.advertisedYield.toLocaleString('en-GB', { maximumFractionDigits: 2 })}% return` : ''}; verify the current net cold rent, lease terms and the seller's yield calculation before relying on that figure.`
    : ['Not rented', 'Available to move in', 'Vacant', 'Owner-occupied'].includes(facts.tenancy || '')
      ? 'The listing states that it is not rented; confirm the handover date and vacant possession in the purchase contract.'
      : '';
  const costs = facts.housegeld ? ` Monthly Hausgeld is stated at €${facts.housegeld.toLocaleString('de-DE')}; separate recoverable tenant costs from the owner-only share.` : '';
  const second = `${investment}${costs}`.trim();
  return second ? `${first}\n\n${second}` : first;
}

function considerationsFor(report: Pick<Report, 'facts' | 'sunOrientation' | 'daylight'>) {
  const { facts } = report;
  const items: string[] = [];
  if (facts.tenancy === 'Rented') items.push('Check the signed lease, net cold rent and payment history.');
  if (facts.housegeld) items.push(`Check how the €${facts.housegeld.toLocaleString('de-DE')} Hausgeld is split and whether the WEG reserve is adequate.`);
  if (facts.floor === UNKNOWN) items.push('Confirm the floor, lift access and whether the unit faces the street or courtyard.');
  if (facts.energy !== UNKNOWN) items.push(`Compare the ${facts.energyCertificate || 'Energieausweis'} with actual energy bills.`);
  if (facts.features?.some(feature => /terrasse|garten/i.test(feature))) items.push('Confirm that terrace and garden rights are recorded in the Teilungserklärung and clarify maintenance responsibility.');
  if (!items.length) items.push('Request the complete Exposé, Energieausweis, WEG records and itemized running costs before making an offer.');
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

export function parseListing(raw: string, source: string): Report {
  const lines = htmlToLines(raw);
  const text = lines.join(' \n ');
  const title = pageTitle(raw);
  const currency = /([\d.]+(?:,\d+)?)\s*(?:€|EUR)/i;
  const areaValue = /([\d.]+(?:,\d+)?)\s*(?:m²|qm)/i;

  const price = purchasePrice(lines);
  const area = number(firstMatch(lines, /\bWohnfl[aä]che(?:\s+ca\.?)?\s*[:\-]?\s*([\d.,]+)\s*(?:m²|qm)/i)
    || aroundLabel(lines, /^Wohnfl[aä]che(?:\s+ca\.?)?$/i, areaValue, 3, 3)
    || firstMatch(lines, /\b([\d.,]+)\s*(?:m²|qm)\s+Wohnfl[aä]che/i));
  const usableArea = number(firstMatch(lines, /\bNutzfl[aä]che(?:\s+ca\.?)?\s*[:\-]?\s*([\d.,]+)\s*(?:m²|qm)/i)
    || aroundLabel(lines, /^Nutzfl[aä]che(?:\s+ca\.?)?$/i, areaValue, 1, 3));
  const roomsValue = firstMatch(lines, /\b(?:Zimmer|Anzahl Zimmer)\s*[:\-]\s*(\d+(?:[,.]\d+)?)(?!\s*%)/i)
    || aroundLabel(lines, /^(?:Zimmer|Anzahl Zimmer)$/i, /^(\d+(?:[,.]\d+)?)$/, 2, 2)
    || firstMatch([title, ...lines.slice(0, 250)], /\b(\d+(?:[,.]\d+)?)[\s-]*(?:Zimmer|Zi\.|Raum(?:wohnung)?)/i);
  const rooms = roomsValue || UNKNOWN;
  const yearValue = aroundLabel(lines, /^Baujahr$/i, /\b(18\d{2}|19\d{2}|20\d{2})\b/, 0, 3)
    || firstMatch(lines, /\bBaujahr\s*[:\-]?\s*(18\d{2}|19\d{2}|20\d{2})\b/i)
    || firstMatch([title, ...lines], /\b(18\d{2}|19\d{2}|20\d{2})\s+(?:errichtet|erbaut)/i);
  const year = yearValue || UNKNOWN;
  const floorRaw = firstMatch(lines, /\bTyp\s*[:\-]\s*(Hochparterre)\b/i)
    || firstMatch(lines, /\b(?:Etage|Geschoss|Stockwerk)\s*[:\-]\s*((?:\d{1,2}\.?\s*(?:OG|Obergeschoss|Etage|Geschoss)?|EG|Erdgeschoss|DG|Dachgeschoss|Souterrain))/i)
    || aroundLabel(lines, /^(?:Etage|Geschoss|Stockwerk)$/i, /^((?:\d{1,2}\.?\s*(?:OG|Obergeschoss|Etage|Geschoss)?|EG|Erdgeschoss|DG|Dachgeschoss|Souterrain))$/i, 0, 3)
    || firstMatch(lines, /\b((?:\d{1,2}\.?\s*OG|Erdgeschoss|Dachgeschoss|Souterrain))\b/i);
  const floor = normalizedFloor(floorRaw) || UNKNOWN;
  const heating = firstMatch(lines, /\b(?:Heizung|Heizungsart)\s*[:\-]\s*([^|;]{3,45})$/i)
    || aroundLabel(lines, /^(?:Heizung|Heizungsart)$/i, /^(.{3,45})$/, 0, 2) || UNKNOWN;
  const energySource = firstMatch(lines, /\b(?:Wesentliche(?:r)?\s+Energietr[aä]ger|Energietr[aä]ger)\s*[:\-]\s*([^|;]{3,45})$/i)
    || aroundLabel(lines, /^(?:Wesentliche(?:r)?\s+Energietr[aä]ger|Energietr[aä]ger)$/i, /^(.{3,45})$/, 0, 2) || undefined;
  const energyDemand = number(firstMatch(lines, /\bEndenergie(?:bedarf|verbrauch)\s*[:\-]\s*([\d.,]+)\s*kWh/i)
    || aroundLabel(lines, /^Endenergie(?:bedarf|verbrauch)$/i, /([\d.,]+)\s*kWh/i, 0, 2));
  const energy = aroundLabel(lines, /^Energieeffizienzklasse$/i, /^([A-H](?:\+)?)$/i, 0, 3)
    || firstMatch(lines, /\bEnergieeffizienzklasse\s*[:\-]?\s*([A-H](?:\+)?)(?![\p{L}\p{N}+])/iu)
    || energyClassFromDemand(energyDemand)
    || UNKNOWN;
  const energyCertificate = firstMatch(lines, /\bEnergie\s*ausweistyp\s*[:\-]\s*([^|;]{3,45})$/i)
    || aroundLabel(lines, /^Energieausweistyp$/i, /^(.{3,45})$/, 0, 2) || undefined;
  const conditionRaw = firstMatch(lines, /\b(?:Zustand|Objektzustand|Bauzustand)\s*[:\-]\s*([^|;]{3,60})$/i)
    || aroundLabel(lines, /^(?:Zustand|Objektzustand|Bauzustand)$/i, /^(.{3,60})$/, 0, 2);
  const condition = normalizedCondition(conditionRaw, `${title} ${lines.slice(0, 120).join(' ')}`);
  const tenancyRaw = aroundLabel(lines, /^(?:Aktuelle Nutzung|Nutzung|Verf[uü]gbarkeit)$/i, /^(.{3,45})$/, 0, 2);
  const availabilityPhrase = firstMatch(lines, /((?:bezugsfrei|sofort\s+beziehbar|sofort\s+verf[uü]gbar|unvermietet|leerstehend|eigengenutzt|selbst\s+genutzt)[^.]{0,45})/i);
  const tenancyEvidence = lines
    .filter(line => /(?:wohnung|haus|immobilie|objekt|einheit).{0,100}(?:vermietet|bezugsfrei|beziehbar|unvermietet|leerstehend|eigengenutzt|selbst genutzt)|(?:vermietete|bezugsfreie|unvermietete|leerstehende)\s+(?:wohnung|immobilie|einheit)/i.test(line))
    .slice(0, 12)
    .join(' ');
  const tenancy = normalizedTenancy(tenancyRaw, `${title} ${availabilityPhrase} ${tenancyEvidence}`);
  const advertisedYield = number(firstMatch([title, ...lines], /([\d,.]+)\s*%\s*(?:Rendite|return)/i) || firstMatch(lines, /(?:Rendite|return)\s*(?:von|:)?\s*([\d,.]+)\s*%/i));
  const housegeld = number(aroundLabel(lines, /^Hausgeld(?:\s+mtl\.)?$/i, currency, 0, 3)
    || firstMatch(lines, /\bHausgeld\s*[:\-]?\s*([\d.]+(?:,\d+)?)\s*(?:€|EUR)/i));
  const buyerCosts = number(firstMatch(lines, /\b(?:Kaufnebenkosten|Nebenkosten)(?:\s+ca\.)?\s*[:\-]?\s*([\d.]+(?:,\d+)?)\s*(?:€|EUR)/i)
    || aroundLabel(lines, /^(?:Kaufnebenkosten|Nebenkosten)(?:\s+ca\.)?$/i, currency, 2, 3));
  const explicitTotalCandidate = number(firstMatch(lines, /\bGesamtkosten(?:\s+ca\.)?\s*[:\-]?\s*([\d.]+(?:,\d+)?)\s*(?:€|EUR)/i)
    || String(totalCostAroundLabel(lines, price)));
  const explicitTotal = explicitTotalCandidate >= price ? explicitTotalCandidate : 0;
  const buyerCommission = statedBuyerCommission(lines, title);
  const brokerFee = buyerCommission && buyerCommission !== 'Commission-free' && /(?:€|EUR)/i.test(buyerCommission)
    ? number(buyerCommission)
    : buyerCommission === 'Commission-free' ? 0 : undefined;

  const jsonLocation = jsonAddress(raw);
  const shownLocation = visibleLocation(lines, title);
  const postalCode = jsonLocation.postalCode || shownLocation.postalCode;
  const city = jsonLocation.city || shownLocation.city;
  const district = jsonLocation.district || shownLocation.district;
  const location = district || city;
  const visibleStreet = visiblePropertyStreet(lines);
  const statedAddress = jsonLocation.street
    ? tidy(`${jsonLocation.street}${postalCode ? `, ${postalCode}` : ''}${city ? ` ${city}` : ''}`)
    : visibleAddress(lines, city, postalCode)
      || (/\b\d{1,4}[a-z]?\s*$/iu.test(visibleStreet) ? tidy(`${visibleStreet}${postalCode ? `, ${postalCode}` : ''}${city ? ` ${city}` : ''}`) : '');
  const address = statedAddress || 'Address not stated';
  const street = jsonLocation.street || (statedAddress ? streetFromAddress(statedAddress) : visibleStreet);
  const hasHouseNumber = /\b\d{1,4}[a-z]?\s*$/iu.test(street);

  const propertyType: Report['propertyType'] = /(?:einfamilienhaus|reihenhaus|doppelhaush[aä]lfte|haus\s+(?:zum\s+kauf|in)|single.family|\bhouse\b)/i.test(title) ? 'house' : 'flat';
  const featuresText = aroundLabel(lines, /^Ausstattung$/i, /^(.{3,180})$/, 0, 2);
  const features = featuresText ? featuresText.split(/,|·/).map(tidy)
    .filter(feature => feature.length >= 3 && !/^[-–•]?\s*\d|\b(?:m²|qm|Wohnfl[aä]che|Zimmer)\b/i.test(feature)).slice(0, 12) : [];
  const statedFeatures = [
    ['Balkon', /\bBalkon\b/i], ['Terrasse', /\bTerrasse\b/i], ['Einbauküche', /\bEinbauküche\b/i],
    ['Keller', /\b(?:Keller|Kellerabteil)\b/i], ['Aufzug', /\b(?:Aufzug|Fahrstuhl|Lift)\b/i],
  ] as const;
  for (const [label, expression] of statedFeatures) {
    if (expression.test(text) && !features.some(feature => expression.test(feature))) features.push(label);
  }
  if (/\b(?:komplett\s+)?möbliert(?:e[nsr]?)?\b/i.test(text) && !features.some(feature => /möbliert/i.test(feature))) features.unshift('Möbliert');
  const sunOrientation = aroundLabel(lines, /^(?:Ausrichtung|Balkon\/Terrasse Ausrichtung|Himmelsrichtung)$/i, /^(.{2,40})$/, 0, 2) || UNKNOWN;
  const daylight = /bodentiefe Fenster[^.]{0,100}(?:viel|reichlich)\s+Tageslicht/i.test(text)
    ? 'Floor-to-ceiling windows; abundant daylight claimed'
    : firstMatch(lines, /((?:viel|reichlich)\s+Tageslicht[^.]{0,80})/i) || undefined;
  const transit = proximityEvidence(lines, /\b(?:U-?Bahn|S-?Bahn|Bahnhof|Straßenbahn|Tram|ÖPNV|Nahverkehr|öffentliche[nr]?\s+Verkehrsmittel|public transport)\b/i);
  const transitStop = namedTransitStop(lines);
  const park = proximityEvidence(lines, /\b(?:Park|Grünanlage|Grünfläche|Spielfläche|Spielplatz|Volkspark|Stadtpark|green space)\w*/i);
  const dailyNeeds = proximityEvidence(lines, /\b(?:Supermarkt|Einkauf|Nahversorgung|Bäcker|Apotheke|Schule|Grundschule|Kita|Kindertagesstätte|daily needs|grocer)\w*/i);

  const totalCost = explicitTotal || (price && buyerCosts ? price + buyerCosts : 0);
  const facts = {
    price, area, usableArea: usableArea || undefined, rooms, year, floor, energy, heating,
    energySource, energyDemand: energyDemand || undefined, energyCertificate, totalCost,
    buyerCosts: buyerCosts || undefined, brokerFee, buyerCommission: buyerCommission || undefined, housegeld: housegeld || undefined,
    tenancy, advertisedYield: advertisedYield || undefined, condition, features,
    postalCode: postalCode || undefined, city: city || undefined, district: district || undefined,
    street: street || undefined,
    locationPrecision: street ? (hasHouseNumber ? 'address' as const : 'street' as const) : district ? 'neighborhood' as const : postalCode ? 'postal' as const : city ? 'city' as const : undefined,
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
    !statedAddress ? 'Exact street address is not disclosed in the listing.' : '',
    floor === UNKNOWN ? 'The listing does not disclose an exact floor.' : '',
    !explicitTotal ? 'The listing does not provide a complete acquisition total; the financing card uses a rough buyer-cost estimate.' : '',
    tenancy === 'Rented' && !advertisedYield ? 'The unit is rented but no verified yield was extracted.' : '',
  ].filter(Boolean);

  const report: Report = {
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
    title: '',
    address,
    location,
    propertyType,
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
  };
  report.title = reportTitle(report);
  report.summary = summaryFor(report);
  report.considerations = considerationsFor(report);
  const calculation = calculatePropertyScore(report);
  report.score = calculation.total;
  report.scoreTitle = calculation.title;
  report.scoreBreakdown = calculation.breakdown;
  return report;
}

export function refreshDerivedReport(report: Report) {
  report.title = reportTitle(report);
  report.summary = summaryFor(report);
  report.considerations = considerationsFor(report);
  const calculation = calculatePropertyScore(report);
  report.score = calculation.total;
  report.scoreTitle = calculation.title;
  report.scoreBreakdown = calculation.breakdown;
  return report;
}

export function looksLikePropertyListing(raw: string) {
  const lines = htmlToLines(raw);
  const text = lines.join(' ');
  const unavailable = /seite\s+nicht\s+gefunden|page\s+not\s+found|nicht\s+(mehr\s+)?verf[uü]gbar/i.test(text);
  const signals = [
    /(?:kaufpreis|mietpreis|preis)\s*[:\-]?\s*[\d.]+(?:,\d+)?\s*(?:€|eur)/i,
    /\b\d{2,3}(?:[.\s]\d{3})+\s*€/i,
    /(?:wohnfl[aä]che|fl[aä]che)\s*(?:ca\.)?\s*[:\-]?\s*[\d.,]+\s*(?:m²|qm)/i,
    /\b\d{1,4}\s*(?:m²|qm)\b/i,
    /\b[\d,]+\s*(?:zimmer|zi\.)/i,
    /\b\d{5}\s+[A-ZÄÖÜ]/,
    /(?:baujahr|energieausweis|heizungsart|etage|geschoss)/i,
    /(?:expos[eé]|eigentumswohnung|wohnung\s+zum\s+kauf|haus\s+zum\s+kauf|provision)/i,
  ];
  return !unavailable && signals.filter(expression => expression.test(text)).length >= 3;
}
