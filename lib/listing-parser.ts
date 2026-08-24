import type { Report } from './types';
import { calculatePropertyScore } from './property-score.ts';
import { reportTitle } from './display.ts';

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
  return tidy(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
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
  const labeledDistrict = text.match(/\b(?:Stadtteil|Ortsteil|Bezirk|Kiez|Mikrolage)\s*[:\-]?\s*([A-ZÄÖÜ][\p{L}äöüß-]{2,}(?:\s+[A-ZÄÖÜ][\p{L}äöüß-]{2,})?)/u)?.[1];
  const city = namedCity || tidy(postal?.[2] || '').match(/^([A-ZÄÖÜ][\p{L}äöüß.-]+)/u)?.[1] || '';
  const titleArea = city ? title.match(new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–]\\s*([\\p{L}ÄÖÜäöüß][\\p{L}ÄÖÜäöüß -]{1,45}?)(?:\\s*[|·–—]|$)`, 'iu')) : undefined;
  return {
    postalCode: postal?.[1] || '',
    city: tidy(city),
    district: tidy(postal?.[3] || labeledDistrict || titleArea?.[1] || ''),
  };
}

function visibleAddress(lines: string[]) {
  const top = lines.slice(0, 500).join(' \n ');
  return tidy(top.match(/\b([A-ZÄÖÜ][\p{L}äöüß.' -]{1,55}(?:straße|str\.|allee|weg|platz|gasse)\s+\d{1,4}[a-z]?)\s*,?\s+(\d{5})\s+([A-ZÄÖÜ][\p{L}äöüß.-]+)/iu)?.[0] || '');
}

function namedTransitStop(lines: string[]) {
  const relevant = lines.filter((line) => /\b(?:U-?Bahnhof|S-?Bahnhof|Bahnhof|Tramhaltestelle|Straßenbahnhaltestelle|Haltestelle)\b/i.test(line)).slice(0, 40);
  const patterns = [
    /\b(?:U-?Bahnhof|S-?Bahnhof|Bahnhof|Tramhaltestelle|Straßenbahnhaltestelle|Haltestelle)\s+[„"']?([A-ZÄÖÜ][\p{L}äöüß.-]+(?:[ -][A-ZÄÖÜ][\p{L}äöüß.-]+){0,3})/u,
    /\b([A-ZÄÖÜ][\p{L}äöüß.-]+(?:[ -][A-ZÄÖÜ][\p{L}äöüß.-]+){0,3})\s+(?:U-?Bahnhof|S-?Bahnhof|Bahnhof|Haltestelle)\b/u,
  ];
  for (const line of relevant) {
    for (const pattern of patterns) {
      const candidate = tidy(line.match(pattern)?.[1] || '').replace(/[„“"']+/g, '');
      if (candidate && !/^(?:der|die|das|ein|eine|nächste|nahe|fußläufig|wenige)$/i.test(candidate)) return candidate;
    }
  }
  return '';
}

function normalizedTenancy(value: string, text: string) {
  const evidence = `${value} ${text}`;
  if (/vermietet|tenant(?:ed)?|rented/i.test(evidence)) return 'Rented';
  if (/leerstehend|bezugsfrei|vacant/i.test(evidence)) return 'Vacant';
  if (/eigennutzung|selbst genutzt|owner.?occupied/i.test(evidence)) return 'Owner-occupied';
  return UNKNOWN;
}

function inferredBuyerCosts(price: number, city: string, brokerFee: number | undefined) {
  if (!price) return 0;
  const transferTax = /berlin/i.test(city) ? 0.06 : 0.05;
  return Math.round(price * (transferTax + 0.02) + (brokerFee || 0));
}

function summaryFor(report: Pick<Report, 'propertyType' | 'location' | 'facts' | 'daylight'>) {
  const { facts } = report;
  const identity = `${facts.rooms !== UNKNOWN ? `${facts.rooms.replace(',', '.')}-room ` : ''}${report.propertyType}${report.location ? ` in ${report.location}` : ''}`;
  const price = facts.price ? `The asking price is €${facts.price.toLocaleString('de-DE')}${facts.area ? ` (€${Math.round(facts.price / facts.area).toLocaleString('de-DE')}/m²)` : ''}.` : '';
  const building = [
    facts.year !== UNKNOWN ? `built in ${facts.year}` : '',
    facts.condition && facts.condition !== UNKNOWN ? `described as ${facts.condition.toLowerCase()}` : '',
    facts.energy !== UNKNOWN ? `energy class ${facts.energy}` : '',
    facts.energySource ? `heated via ${facts.energySource}` : '',
  ].filter(Boolean).join(', ');
  const space = facts.area ? ` has ${facts.area} m² of living area${facts.usableArea ? ` and ${facts.usableArea} m² of usable area` : ''}` : ' has no confirmed living-area figure';
  const first = `This ${identity}${space}. ${price}${building ? ` It is ${building}.` : ''}`.trim();

  const investment = facts.tenancy === 'Rented'
    ? `It is sold rented${facts.advertisedYield ? ` and advertised at a ${facts.advertisedYield.toLocaleString('en-GB', { maximumFractionDigits: 2 })}% return` : ''}; verify the current net cold rent, lease terms and the seller's yield calculation before relying on that figure.`
    : 'Confirm occupancy, legal status and handover terms before committing.';
  const costs = facts.housegeld ? ` Monthly Hausgeld is stated at €${facts.housegeld.toLocaleString('de-DE')}; separate recoverable tenant costs from the owner-only share.` : '';
  return `${first}\n\n${investment}${costs}`;
}

function considerationsFor(report: Pick<Report, 'facts' | 'sunOrientation' | 'daylight'>) {
  const { facts } = report;
  const items: string[] = [];
  if (facts.tenancy === 'Rented') items.push(`Rebuild the advertised ${facts.advertisedYield ? `${facts.advertisedYield.toLocaleString('en-GB')}% ` : ''}return from the signed lease, annual net cold rent, payment history and non-recoverable costs.`);
  if (facts.housegeld) items.push(`Break down the €${facts.housegeld.toLocaleString('de-DE')} monthly Hausgeld, WEG reserve, planned works and any Sonderumlagen.`);
  if (facts.floor === UNKNOWN) items.push('The exact floor is not disclosed: confirm the unit position, barrier-free route, lift access, street/courtyard exposure and noise.');
  if (facts.energy !== UNKNOWN) items.push(`Check the ${facts.energyCertificate || 'energy certificate'}, actual annual energy bills and ${facts.energySource || facts.heating} tariff rather than relying on class ${facts.energy} alone.`);
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

  const price = number(aroundLabel(lines, /^Kaufpreis$/i, currency, 0, 3) || firstMatch(lines, /\b([\d]{2,3}(?:[.\s]\d{3})+)\s*€/));
  const area = number(aroundLabel(lines, /^Wohnfl[aä]che$/i, areaValue, 3, 3) || firstMatch(lines, /\b([\d.,]+)\s*(?:m²|qm)\s+Wohnfl[aä]che/i));
  const usableArea = number(aroundLabel(lines, /^Nutzfl[aä]che$/i, areaValue, 1, 3));
  const roomsValue = firstMatch([title, ...lines.slice(0, 250)], /\b(\d+(?:[,.]\d+)?)[\s-]*(?:Zimmer|Zi\.)/i);
  const rooms = roomsValue || UNKNOWN;
  const yearValue = aroundLabel(lines, /^Baujahr$/i, /\b(19\d{2}|20\d{2})\b/, 0, 3) || firstMatch([title, ...lines], /\b(19\d{2}|20\d{2})\s+(?:errichtet|erbaut)/i);
  const year = yearValue || UNKNOWN;
  const floor = aroundLabel(lines, /^(?:Etage|Geschoss|Stockwerk)$/i, /\b((?:\d{1,2}\.?\s*(?:OG|Obergeschoss)|EG|Erdgeschoss|Dachgeschoss|Souterrain))\b/i, 0, 3) || firstMatch(lines, /\b((?:\d{1,2}\.?\s*OG|Erdgeschoss|Dachgeschoss|Souterrain))\b/i) || UNKNOWN;
  const energy = aroundLabel(lines, /^Energieeffizienzklasse$/i, /^([A-H](?:\+)?)$/i, 0, 3) || UNKNOWN;
  const heating = aroundLabel(lines, /^(?:Heizung|Heizungsart)$/i, /^(.{3,45})$/, 0, 2) || UNKNOWN;
  const energySource = aroundLabel(lines, /^(?:Wesentlicher Energietr[aä]ger|Energietr[aä]ger)$/i, /^(.{3,45})$/, 0, 2) || undefined;
  const energyDemand = number(aroundLabel(lines, /^Endenergie(?:bedarf|verbrauch)$/i, /([\d.,]+)\s*kWh/i, 0, 2));
  const energyCertificate = aroundLabel(lines, /^Energieausweistyp$/i, /^(.{3,45})$/, 0, 2) || undefined;
  const condition = aroundLabel(lines, /^Zustand$/i, /^(.{3,45})$/, 0, 2) || undefined;
  const tenancyRaw = aroundLabel(lines, /^Aktuelle Nutzung$/i, /^(.{3,35})$/, 0, 2);
  const tenancy = normalizedTenancy(tenancyRaw, `${title} ${text.slice(0, 18000)}`);
  const advertisedYield = number(firstMatch([title, ...lines], /([\d,.]+)\s*%\s*(?:Rendite|return)/i) || firstMatch(lines, /(?:Rendite|return)\s*(?:von|:)?\s*([\d,.]+)\s*%/i));
  const housegeld = number(aroundLabel(lines, /^Hausgeld(?:\s+mtl\.)?$/i, currency, 0, 3));
  const buyerCosts = number(aroundLabel(lines, /^Kaufnebenkosten(?:\s+ca\.)?$/i, currency, 0, 3));
  const explicitTotal = number(aroundLabel(lines, /^Gesamtkosten(?:\s+ca\.)?$/i, currency, 0, 3));
  const brokerFeeValue = aroundLabel(lines, /^Maklerprovision$/i, currency, 0, 3);
  const brokerFee = brokerFeeValue ? number(brokerFeeValue) : undefined;

  const jsonLocation = jsonAddress(raw);
  const shownLocation = visibleLocation(lines, title);
  const postalCode = jsonLocation.postalCode || shownLocation.postalCode;
  const city = jsonLocation.city || shownLocation.city;
  const district = jsonLocation.district || shownLocation.district;
  const location = district || city;
  const statedAddress = jsonLocation.street
    ? tidy(`${jsonLocation.street}${postalCode ? `, ${postalCode}` : ''}${city ? ` ${city}` : ''}`)
    : visibleAddress(lines);
  const address = statedAddress || 'Address not stated';

  const propertyType: Report['propertyType'] = /(?:einfamilienhaus|reihenhaus|doppelhaush[aä]lfte|haus\s+(?:zum\s+kauf|in)|single.family|\bhouse\b)/i.test(title) ? 'house' : 'flat';
  const featuresText = aroundLabel(lines, /^Ausstattung$/i, /^(.{3,180})$/, 0, 2);
  const features = featuresText ? featuresText.split(/,|·/).map(tidy).filter(Boolean).slice(0, 12) : [];
  if (/\b(?:komplett\s+)?möbliert(?:e[nsr]?)?\b/i.test(text) && !features.some(feature => /möbliert/i.test(feature))) features.unshift('Möbliert');
  const sunOrientation = aroundLabel(lines, /^(?:Ausrichtung|Balkon\/Terrasse Ausrichtung|Himmelsrichtung)$/i, /^(.{2,40})$/, 0, 2) || UNKNOWN;
  const daylight = /bodentiefe Fenster[^.]{0,100}(?:viel|reichlich)\s+Tageslicht/i.test(text)
    ? 'Floor-to-ceiling windows; abundant daylight claimed'
    : firstMatch(lines, /((?:viel|reichlich)\s+Tageslicht[^.]{0,80})/i) || undefined;
  const transit = proximityEvidence(lines, /\b(?:U-?Bahn|S-?Bahn|Bahnhof|Straßenbahn|Tram|ÖPNV|public transport)\b/i);
  const transitStop = namedTransitStop(lines);
  const park = proximityEvidence(lines, /\b(?:Park|Grünanlage|Volkspark|Stadtpark|green space)\b/i);
  const dailyNeeds = proximityEvidence(lines, /\b(?:Supermarkt|Einkauf|Nahversorgung|Bäcker|Apotheke|Schule|Kita|daily needs|grocer)\b/i);

  const calculatedBuyerCosts = buyerCosts || inferredBuyerCosts(price, city, brokerFee);
  const totalCost = explicitTotal || (price ? price + calculatedBuyerCosts : 0);
  const facts = {
    price, area, usableArea: usableArea || undefined, rooms, year, floor, energy, heating,
    energySource, energyDemand: energyDemand || undefined, energyCertificate, totalCost,
    buyerCosts: calculatedBuyerCosts || undefined, brokerFee, housegeld: housegeld || undefined,
    tenancy, advertisedYield: advertisedYield || undefined, condition, features,
    postalCode: postalCode || undefined, city: city || undefined, district: district || undefined,
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
    !explicitTotal ? 'Buyer costs are estimated because the listing does not provide a complete total.' : '',
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
