import type { ListingAddress, ListingFacts, ListingType } from './types.ts';

/**
 * Reads the facts a seller writes in plain sentences, in English or German:
 * "82 m² living space, price 545.000 €, 4th floor, built 1908".
 * The Exposé parser handles labelled documents; this fills what it leaves empty.
 */
export type ExtractedFacts = Partial<Pick<ListingFacts, 'price' | 'area' | 'rooms' | 'floor' | 'year' | 'plotArea' | 'condition' | 'energyClass' | 'heating' | 'housegeld'>>
  & { address?: Partial<Pick<ListingAddress, 'street' | 'postalCode' | 'city'>>; propertyType?: ListingType };

function amount(raw: string) {
  const cleaned = raw.replace(/\s/g, '');
  // "545.000" and "545,000" are thousands; "82,5" and "82.5" are decimals.
  if (/^\d{1,3}([.,]\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/[.,]/g, ''));
  return Number(cleaned.replace(',', '.'));
}

function money(raw: string, unit?: string) {
  const value = amount(raw);
  if (!Number.isFinite(value)) return 0;
  if (unit && /^(mio|million|m)\b/i.test(unit)) return Math.round(value * 1_000_000);
  if (unit && /^(k|tsd|tausend)\b/i.test(unit)) return Math.round(value * 1000);
  return Math.round(value);
}

const NUMBER = String.raw`(\d{1,3}(?:[.,\s]\d{3})+|\d+(?:[.,]\d+)?)`;

export function extractFreeText(input: string): ExtractedFacts {
  const text = input.replace(/ /g, ' ');
  const found: ExtractedFacts = {};

  const priced = text.match(new RegExp(String.raw`(?:kaufpreis|preis|price|asking|for)\D{0,20}?(?:€\s*)?${NUMBER}\s*(mio\.?|million|m\b|k\b|tsd\.?)?\s*(?:€|eur|euro)?`, 'i'))
    || text.match(new RegExp(String.raw`(?:€\s*)${NUMBER}\s*(mio\.?|million|k\b)?`, 'i'))
    || text.match(new RegExp(String.raw`${NUMBER}\s*(mio\.?|million|k\b|tsd\.?)?\s*(?:€|eur\b|euro)`, 'i'));
  if (priced) {
    const value = money(priced[1], priced[2]);
    if (value >= 10_000 && value <= 200_000_000) found.price = value;
  }

  const living = text.match(new RegExp(String.raw`${NUMBER}\s*(?:m²|m2|qm|sqm|square met(?:re|er)s?)\s*(?:of\s+)?(?:living|wohnfl|wohnfläche|wfl)`, 'i'))
    || text.match(new RegExp(String.raw`(?:wohnfläche|living (?:space|area)|size)\D{0,12}${NUMBER}\s*(?:m²|m2|qm|sqm)`, 'i'))
    || text.match(new RegExp(String.raw`${NUMBER}\s*(?:m²|m2|qm|sqm)`, 'i'));
  if (living) {
    const value = amount(living[1]);
    if (value >= 10 && value <= 2000) found.area = value;
  }

  const plot = text.match(new RegExp(String.raw`(?:grundstück(?:sfläche)?|plot(?: size| area)?|land)\D{0,12}${NUMBER}\s*(?:m²|m2|qm|sqm)`, 'i'))
    || text.match(new RegExp(String.raw`${NUMBER}\s*(?:m²|m2|qm|sqm)\s*(?:grundstück|plot|garden plot|land)`, 'i'));
  if (plot) {
    const value = amount(plot[1]);
    if (value >= 50) found.plotArea = value;
  }

  const rooms = text.match(/(\d+(?:[.,]5)?)\s*-?\s*(?:zimmer|zi\.|rooms?|room\b|bedroom)/i) || text.match(/(?:zimmer|rooms)\s*:?\s*(\d+(?:[.,]5)?)/i);
  if (rooms) {
    const value = Number(rooms[1].replace(',', '.'));
    if (value > 0 && value < 40) found.rooms = value;
  }

  if (/\b(?:ground floor|erdgeschoss|\beg\b)/i.test(text)) found.floor = 'EG';
  else {
    const floor = text.match(/(\d{1,2})(?:st|nd|rd|th)\s+floor/i) || text.match(/(\d{1,2})\.\s*(?:og|obergeschoss|etage|stock)/i) || text.match(/(?:floor|etage|stockwerk)\s*:?\s*(\d{1,2})\b/i);
    if (floor) found.floor = `${Number(floor[1])}. OG`;
    else if (/\b(?:top floor|attic|dachgeschoss|\bdg\b)/i.test(text)) found.floor = 'DG';
  }

  const year = text.match(/(?:built|baujahr|constructed|erbaut|year of construction)\D{0,10}((?:1[5-9]|20)\d\d)/i);
  if (year) found.year = year[1];

  const energy = text.match(/(?:energy (?:efficiency )?class|energieeffizienzklasse|energieklasse|effizienzklasse)\s*:?\s*([A-H]\+?)(?![a-z])/i);
  if (energy) found.energyClass = energy[1].toUpperCase();

  // No \b here: JavaScript word boundaries do not see umlauts, so "Ölheizung" would never match.
  const heating = text.match(/(?:^|[\s,.;:(])((?:gas|oil|öl|district|fern|floor|fußboden|pellet|wood|holz|electric|elektro|heat[- ]pump|wärmepumpen?)[a-zäöüß\s-]{0,24}?(?:heating|heizung)|zentralheizung|etagenheizung|fernwärme|wärmepumpe|heat pump)(?=$|[\s,.;:)])/i);
  if (heating) found.heating = heating[1].trim().replace(/^./, character => character.toUpperCase());

  const housegeld = text.match(new RegExp(String.raw`(?:hausgeld|service charge|wohngeld)\D{0,16}${NUMBER}\s*(?:€|eur)?`, 'i'));
  if (housegeld) {
    const value = amount(housegeld[1]);
    if (value > 0 && value < 5000) found.housegeld = Math.round(value);
  }

  if (/\b(?:renovated|refurbished|saniert|renoviert|kernsaniert)\b/i.test(text)) found.condition = 'renovated';
  else if (/\b(?:well[- ]kept|well maintained|gepflegt)\b/i.test(text)) found.condition = 'well maintained';
  else if (/\b(?:needs renovation|renovierungsbedürftig|sanierungsbedürftig)\b/i.test(text)) found.condition = 'needs renovation';
  else if (/\b(?:new build|neubau|erstbezug|first occupancy)\b/i.test(text)) found.condition = 'erstbezug';

  // Street names are one or two capitalised words ending in a street suffix, then a house number.
  const address = text.match(/(?:^|[\s,:;(])((?:[A-ZÄÖÜ][a-zäöüß]+[ -])?(?:[A-ZÄÖÜ][a-zäöüß]*-)*[A-ZÄÖÜ][a-zäöüß]*(?:straße|strasse|str\.|weg|allee|platz|damm|ring|ufer|gasse|chaussee|steig|pfad|markt|zeile|[ -](?:Straße|Allee|Platz|Damm|Ring|Weg|Ufer|Chaussee|Markt))\s*\d+\s?[a-z]?)\s*,?\s*(\d{5})\s+([A-ZÄÖÜ][\wäöüß-]+(?:\s(?:am|an der|im)\s[A-ZÄÖÜ][\wäöüß-]+)?)/);
  if (address) found.address = { street: address[1].trim(), postalCode: address[2], city: address[3] };
  else {
    const postal = text.match(/\b(\d{5})\s+([A-ZÄÖÜ][\wäöüß-]+)/);
    if (postal) found.address = { postalCode: postal[1], city: postal[2] };
  }

  if (/\b(?:house|haus|einfamilienhaus|doppelhaushälfte|reihenhaus|villa)\b/i.test(text) && !/\b(?:flat|apartment|wohnung)\b/i.test(text)) found.propertyType = 'house';
  return found;
}
