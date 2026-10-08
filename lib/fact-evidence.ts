import type { FactEvidence, FactKey, Facts, Report } from './types.ts';

export const FACT_KEYS = [
  'price', 'area', 'usableArea', 'rooms', 'year', 'floor', 'energy', 'energyDemand',
  'heating', 'housegeld', 'buyerCommission', 'buyerCosts', 'tenancy', 'availabilityDate',
  'address', 'advertisedYield',
] as const satisfies readonly FactKey[];

const EXCERPT_MAX = 220;
/** Same pattern the privacy test uses. A quote that matches is never stored. */
const PRIVATE_CONTACT = /@|\+49|\b0\d{3,4}[ /]?\d{5,}/;
const CONTACT_LINE = /\b(?:Kontakt|Impressum|Anbieterinformationen|Ansprechpartner(?:in)?|Telefon|Phone|Mobile|E-Mail|Email|Makler|Immobilienb(?:ü|u)ro|Contact details)\b/i;
const SECTION_END = /^(?:Weitere Angebote|Ähnliche Immobilien|Weitere Immobilien|Kontakt|Impressum|Anbieterinformationen|Contact details)\b/i;

const STATED = /^(?:not stated|unknown|n\/a|not disclosed)$/i;

export function isContactLine(line: string) {
  return CONTACT_LINE.test(line) || PRIVATE_CONTACT.test(line);
}

/**
 * Listing lines a quote may come from. Stops before the contact block and
 * drops agent, phone and e-mail lines. Navigation is already removed by
 * `listingContent` before these lines exist.
 */
export function propertyTextLines(lines: string[]) {
  const end = lines.findIndex(line => SECTION_END.test(line));
  return lines.slice(0, end >= 0 ? end : lines.length).filter(line => line && !isContactLine(line));
}

function tidy(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stated(value: unknown) {
  if (typeof value !== 'string') return '';
  const clean = value.trim();
  return clean && !STATED.test(clean) ? clean : '';
}

function looseNumber(value: string) {
  const cleaned = value.trim().replace(/\s/g, '');
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(cleaned)) return Number(cleaned.replace(/\./g, '').replace(',', '.'));
  if (cleaned.includes(',') && !cleaned.includes('.')) return Number(cleaned.replace(',', '.'));
  return Number(cleaned);
}

/** True when `value` appears as its own number, in `172.000` or `172000` form. */
export function numberPresent(text: string, value: number) {
  if (!Number.isFinite(value)) return false;
  const negative = value < 0;
  const abs = Math.abs(value);
  const tokens = new Set<string>();
  const integer = Math.abs(abs - Math.round(abs)) < 1e-6;
  if (integer) {
    const whole = String(Math.round(abs));
    tokens.add(whole);
    tokens.add(whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
    tokens.add(whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' '));
  } else {
    const fixed = abs.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    const [whole, frac = ''] = fixed.split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (frac) {
      tokens.add(`${grouped},${frac}`);
      tokens.add(`${whole},${frac}`);
      tokens.add(`${whole}.${frac}`);
    } else {
      tokens.add(grouped);
      tokens.add(whole);
    }
  }
  return [...tokens].some(token => {
    const body = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s');
    const sign = negative ? '[-−]\\s*' : '';
    return new RegExp(`(?<![\\d])${sign}${body}(?![\\d])`).test(text);
  });
}

function roomCountSource(rooms: string) {
  const normalized = rooms.trim().replace('.', ',');
  if (/^\d+$/.test(normalized)) return `(?<![\\d])${normalized}(?![\\d,.])`;
  const [whole, frac] = normalized.split(',');
  if (!whole || !frac || !/^\d+$/.test(whole) || !/^\d+$/.test(frac)) return '';
  return `(?<![\\d])${whole}[,.]${frac}(?![\\d])`;
}

function roomsMatch(snippet: string, rooms: string) {
  const count = roomCountSource(rooms);
  if (!count) return false;
  const roomWord = '(?:Zimmer|Zi\\.|rooms?)';
  return new RegExp(`${count}\\s*[-–]?\\s*${roomWord}\\b`, 'i').test(snippet)
    || new RegExp(`\\b${roomWord}\\s*[-–:]?\\s*${count}`, 'i').test(snippet);
}

function yearMatch(snippet: string, year: string) {
  if (!/^(?:18|19|20)\d{2}$/.test(year)) return false;
  if (!new RegExp(`(?<![\\d])${year}(?![\\d])`).test(snippet)) return false;
  return /Baujahr|Year of construction|errichtet|erbaut|\bbuilt\b|Fertigstellung/i.test(snippet);
}

function floorMatch(snippet: string, floor: string) {
  if (/^Hochparterre$/i.test(floor)) return /Hochparterre/i.test(snippet);
  if (/^(?:EG|Erdgeschoss)$/i.test(floor)) return /\b(?:EG|Erdgeschoss|ground floor)\b/i.test(snippet);
  if (/^Dachgeschoss$/i.test(floor)) return /\b(?:DG|Dachgeschoss|attic)\b/i.test(snippet);
  if (/^Souterrain$/i.test(floor)) return /\bSouterrain\b|\bbasement\b/i.test(snippet);
  const level = floor.match(/^(\d{1,2})/)?.[1];
  if (!level) return false;
  return new RegExp(`(?:^|[^\\d])${level}\\.?\\s*(?:OG|Obergeschoss|Etage|Geschoss|Stockwerk|floor)\\b`, 'i').test(snippet)
    || new RegExp(`(?:Etage|Geschoss|Stockwerk|Floor)\\s*[:\\-]?\\s*${level}(?![\\d])`, 'i').test(snippet);
}

function energyMatch(snippet: string, energy: string) {
  const token = energy.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!token) return false;
  return new RegExp(`(?:Energieeffizienzklasse|Energieklasse|Energy efficiency class)\\s*[:\\-]?\\s*${token}(?![A-H\\d+])`, 'i').test(snippet);
}

function heatingMatch(snippet: string, heating: string) {
  if (!/Heizungsart|Heizung|Heating|Fernwärme|Wärmepumpe|Zentralheizung|Etagenheizung|Fußbodenheizung|district heating|heat pump/i.test(snippet)) return false;
  const tokens = heating.split(/[^\p{L}\p{N}+]+/u).filter(token => token.length >= 3);
  const lower = snippet.toLocaleLowerCase('de-DE');
  return tokens.some(token => lower.includes(token.toLocaleLowerCase('de-DE')));
}

function commissionMatch(snippet: string, value: string) {
  const labelled = /K[aä]uferprovision|Maklerprovision|\bProvision\b|Courtage|commission/i.test(snippet)
    || /provisionsfrei|courtagefrei|commission-free/i.test(snippet);
  if (!labelled) return false;
  if (/commission-free/i.test(value)) {
    return /provisionsfrei|courtagefrei|commission-free|keine\s+(?:zus[aä]tzliche\s+)?(?:K[aä]uferprovision|Maklerprovision|Courtage)|ohne\s+(?:K[aä]uferprovision|Maklerprovision|Courtage)/i.test(snippet);
  }
  const amount = value.match(/[\d][\d.,]*/)?.[0];
  if (!amount) return snippet.toLocaleLowerCase('de-DE').includes(value.toLocaleLowerCase('de-DE'));
  const parsed = looseNumber(amount);
  return Number.isFinite(parsed) && numberPresent(snippet, parsed);
}

function tenancyMatch(snippet: string, tenancy: string) {
  if (tenancy === 'Rented') return /\b(?:vermietet|rented)\b/i.test(snippet) && !/(?:nicht|un)\s*vermietet/i.test(snippet);
  if (tenancy === 'Occupancy unclear') return /bewohnt|vermietet|occup/i.test(snippet);
  if (['Not rented', 'Vacant', 'Available to move in', 'Owner-occupied'].includes(tenancy)) {
    return /bezugsfrei|unvermietet|nicht\s+vermietet|leerstehend|eigengenutzt|selbst\s+genutzt|eigennutzung|vacant|owner[- ]occupied|available\s+immediately/i.test(snippet);
  }
  const clean = stated(tenancy);
  return Boolean(clean) && snippet.toLocaleLowerCase('de-DE').includes(clean.toLocaleLowerCase('de-DE'));
}

function addressMatch(snippet: string, facts: Facts) {
  const street = stated(facts.street);
  const streetName = street.replace(/,?\s*\d[\w\s/–-]*$/, '').trim();
  const postal = stated(facts.postalCode);
  const city = stated(facts.city);
  const lower = snippet.toLocaleLowerCase('de-DE');
  const hasStreet = streetName.length >= 4 && lower.includes(streetName.toLocaleLowerCase('de-DE'));
  const hasPostal = Boolean(postal) && snippet.includes(postal);
  const hasCity = Boolean(city) && lower.includes(city.toLocaleLowerCase('de-DE'));
  if (hasStreet && (hasPostal || hasCity)) return true;
  if (!street && hasPostal && hasCity) return true;
  return false;
}

function availabilityMatch(snippet: string, value: string) {
  if (!/bezugsfrei|beziehbar|verf[uü]gbar|available|Bezug/i.test(snippet)) return false;
  if (snippet.toLocaleLowerCase('de-DE').includes(value.toLocaleLowerCase('de-DE'))) return true;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!iso) return false;
  const day = String(Number(iso[3]));
  const month = String(Number(iso[2]));
  return snippet.includes(`${day}.${month}.${iso[1]}`) || snippet.includes(`${iso[3]}.${iso[2]}.${iso[1]}`);
}

function supports(key: FactKey, snippet: string, facts: Facts) {
  if (key === 'price') return /Kaufpreis|purchase price|asking price/i.test(snippet) && numberPresent(snippet, facts.price);
  if (key === 'area') return /Wohnfl[aä]che|living area/i.test(snippet) && facts.area > 0 && numberPresent(snippet, facts.area);
  if (key === 'usableArea') return /Nutzfl[aä]che|usable area/i.test(snippet) && Boolean(facts.usableArea) && numberPresent(snippet, facts.usableArea || 0);
  if (key === 'rooms') return roomsMatch(snippet, stated(facts.rooms));
  if (key === 'year') return yearMatch(snippet, stated(facts.year));
  if (key === 'floor') return floorMatch(snippet, stated(facts.floor));
  if (key === 'energy') return energyMatch(snippet, stated(facts.energy));
  if (key === 'energyDemand') return /Endenergie|Energieverbrauch|energy demand|kWh/i.test(snippet) && Boolean(facts.energyDemand) && numberPresent(snippet, facts.energyDemand || 0);
  if (key === 'heating') return heatingMatch(snippet, stated(facts.heating));
  if (key === 'housegeld') return /Hausgeld|Community fees/i.test(snippet) && Boolean(facts.housegeld) && numberPresent(snippet, facts.housegeld || 0);
  if (key === 'buyerCommission') return commissionMatch(snippet, stated(facts.buyerCommission));
  if (key === 'buyerCosts') {
    const labelled = /Kaufnebenkosten|buyer costs/i.test(snippet) || (/Nebenkosten/i.test(snippet) && !/Hausgeld|monatlich|\bmtl\b/i.test(snippet));
    return labelled && Boolean(facts.buyerCosts) && numberPresent(snippet, facts.buyerCosts || 0);
  }
  if (key === 'tenancy') return tenancyMatch(snippet, stated(facts.tenancy));
  if (key === 'availabilityDate') return availabilityMatch(snippet, stated(facts.availabilityDate));
  if (key === 'address') return addressMatch(snippet, facts);
  if (key === 'advertisedYield') return /Rendite|\breturn\b|yield/i.test(snippet) && Boolean(facts.advertisedYield) && numberPresent(snippet, facts.advertisedYield || 0);
  return false;
}

function preference(key: FactKey, text: string) {
  let score = 0;
  if (text.length <= 90) score += 4;
  else if (text.length <= 180) score += 2;
  if (key === 'rooms' && /\d\s*-\s*(?:Zimmer|Zi\.)|(?:Zimmer|Zi\.)\s+\d/i.test(text)) score += 8;
  if (key === 'price' && /Kaufpreis/i.test(text)) score += 2;
  return score * 1000 - text.length;
}

function needleFor(key: FactKey, text: string, facts: Facts) {
  if (key === 'rooms') {
    const count = stated(facts.rooms).replace('.', ',');
    const hyphen = text.match(new RegExp(`${count.replace(',', '[,.]')}\\s*-\\s*Zimmer`, 'i'))?.[0];
    if (hyphen) return hyphen;
    const beside = text.match(new RegExp(`(?:Zimmer|Zi\\.|rooms?)\\s*${count.replace(',', '[,.]\s*')}`, 'i'))?.[0];
    return beside || 'Zimmer';
  }
  if (key === 'price' && facts.price) return germanGrouped(facts.price) || String(facts.price);
  if (key === 'area' && facts.area) return String(Math.round(facts.area));
  if (key === 'housegeld' && facts.housegeld) return String(Math.round(facts.housegeld));
  if (key === 'year') return stated(facts.year);
  return '';
}

function germanGrouped(value: number) {
  if (!Number.isInteger(value)) return '';
  return String(Math.abs(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function clip(text: string, needle: string) {
  const clean = tidy(text);
  if (clean.length <= EXCERPT_MAX) return clean;
  const at = needle ? clean.toLocaleLowerCase('de-DE').indexOf(needle.toLocaleLowerCase('de-DE')) : -1;
  const focus = at >= 0 ? at : 0;
  let start = Math.max(0, focus - 50);
  if (start > 0) {
    const space = clean.indexOf(' ', start);
    if (space !== -1 && space < focus) start = space + 1;
  }
  let end = Math.min(clean.length, start + EXCERPT_MAX - 1);
  if (end < clean.length) {
    const space = clean.lastIndexOf(' ', end);
    if (space > start + 40) end = space;
  }
  const slice = clean.slice(start, end).trim();
  return `${start > 0 ? '…' : ''}${slice}${end < clean.length ? '…' : ''}`;
}

function snippets(lines: string[]) {
  const found: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || isContactLine(line)) continue;
    const next = lines[index + 1] || '';
    const joined = line.length < 35 && next && !isContactLine(next) ? tidy(`${line} ${next}`) : line;
    if (!joined || PRIVATE_CONTACT.test(joined) || isContactLine(joined)) continue;
    found.push(joined.slice(0, 650));
  }
  return found;
}

/**
 * One listing sentence per fact, and only when that sentence contains the
 * extracted value. No match means the field is omitted — never a nearby line.
 */
export function factEvidence(lines: string[], facts: Facts, _address = ''): FactEvidence {
  const candidates = snippets(propertyTextLines(lines));
  const evidence: FactEvidence = {};
  for (const key of FACT_KEYS) {
    let best = '';
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      if (!supports(key, candidate, facts)) continue;
      const score = preference(key, candidate);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    if (!best || PRIVATE_CONTACT.test(best)) continue;
    evidence[key] = { excerpt: clip(best, needleFor(key, best, facts)), kind: 'stated' };
  }
  return evidence;
}

type VerifiedQuotes = Partial<Record<FactKey, string>>;

/** Fill gaps from AI excerpts that are still verbatim and contain the value. */
export function absorbVerifiedQuotes(existing: FactEvidence | undefined, quotes: VerifiedQuotes, facts: Facts, address = ''): FactEvidence {
  const next: FactEvidence = { ...(existing || {}) };
  for (const key of FACT_KEYS) {
    if (next[key]) continue;
    const quote = tidy(quotes[key] || '');
    if (!quote || PRIVATE_CONTACT.test(quote) || isContactLine(quote)) continue;
    if (!supports(key, quote, facts)) continue;
    next[key] = { excerpt: clip(quote, needleFor(key, quote, facts)), kind: 'stated' };
  }
  void address;
  return next;
}

export function verifiedQuotesFromAi(value: {
  price?: string;
  rooms?: string;
  area?: string;
  housegeld?: string;
  occupancy?: string;
  year?: string;
  floor?: string;
  energy?: string;
}): VerifiedQuotes {
  return {
    price: value.price,
    rooms: value.rooms,
    area: value.area,
    housegeld: value.housegeld,
    tenancy: value.occupancy,
    year: value.year,
    floor: value.floor,
    energy: value.energy,
  };
}

export function reportHasPrivateEvidence(report: Pick<Report, 'factEvidence'>) {
  return Object.values(report.factEvidence || {}).some(item => item && PRIVATE_CONTACT.test(item.excerpt));
}
