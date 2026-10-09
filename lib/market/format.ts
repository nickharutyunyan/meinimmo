import type { ListingType } from './types.ts';

type Locale = 'en' | 'de';

const euro = (locale: Locale, digits = 0) => new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: digits,
  minimumFractionDigits: 0,
});

export function priceLabel(value: number, locale: Locale) {
  return value > 0 ? euro(locale).format(Math.round(value)) : '';
}

/** "€749k" / "1,2 Mio. €" for map pins, where width matters more than precision. */
export function priceShort(value: number, locale: Locale) {
  if (!(value > 0)) return '';
  if (value >= 1_000_000) {
    const millions = new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: value >= 10_000_000 ? 0 : 2 }).format(value / 1_000_000);
    return locale === 'de' ? `${millions} Mio. €` : `€${millions}m`;
  }
  const thousands = Math.round(value / 1000);
  return locale === 'de' ? `${thousands}T €` : `€${thousands}k`;
}

export function areaLabel(value: number | null | undefined, locale: Locale) {
  if (!value || !(value > 0)) return '';
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: digits }).format(value)} m²`;
}

export function pricePerSqmLabel(price: number, area: number, locale: Locale) {
  if (!(price > 0) || !(area > 0)) return '';
  return `${euro(locale).format(Math.round(price / area))}/m²`;
}

export function roomsLabel(rooms: number | null | undefined, locale: Locale) {
  if (!rooms || !(rooms > 0)) return '';
  const value = new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 1 }).format(rooms);
  if (locale === 'de') return `${value} Zi.`;
  return `${value} ${rooms === 1 ? 'room' : 'rooms'}`;
}

/** Parses "2,5", "2.5 Zimmer" or "3" into a number. */
export function parseRooms(value: unknown): number | null {
  if (typeof value === 'number') return value > 0 && value < 100 ? Math.round(value * 2) / 2 : null;
  const match = String(value ?? '').match(/\d+(?:[.,]5)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(',', '.'));
  return parsed > 0 && parsed < 100 ? parsed : null;
}

function ordinal(value: number) {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  return `${value}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] || 'th'}`;
}

/**
 * The floor as a buyer reads it. Accepts what sellers and portals write:
 * "EG", "Erdgeschoss", "3. OG", "3. Etage", "DG", "4th floor", "3".
 */
export function floorLabel(value: string | null | undefined, locale: Locale) {
  const raw = (value || '').trim();
  if (!raw || /^not stated$/i.test(raw)) return '';
  if (/^(?:eg|erdgeschoss|ground(?: floor)?|hochparterre|hp)\b/i.test(raw)) {
    if (/hochparterre|^hp\b/i.test(raw)) return locale === 'de' ? 'Hochparterre' : 'Raised ground floor';
    return locale === 'de' ? 'Erdgeschoss' : 'Ground floor';
  }
  if (/^(?:dg|dachgeschoss|attic|top floor)\b/i.test(raw)) return locale === 'de' ? 'Dachgeschoss' : 'Top floor';
  if (/^(?:ug|souterrain|basement)\b/i.test(raw)) return locale === 'de' ? 'Souterrain' : 'Lower ground floor';
  const number = Number(raw.match(/-?\d+/)?.[0]);
  if (Number.isInteger(number) && number > 0 && number < 100) return locale === 'de' ? `${number}. OG` : `${ordinal(number)} floor`;
  return raw.slice(0, 40);
}

const CONDITIONS: Record<string, { en: string; de: string }> = {
  'renovated': { en: 'Renovated', de: 'Saniert' },
  'well maintained': { en: 'Well kept', de: 'Gepflegt' },
  'like new': { en: 'Like new', de: 'Neuwertig' },
  'erstbezug': { en: 'First occupancy', de: 'Erstbezug' },
  'new build': { en: 'New build', de: 'Neubau' },
  'needs modernisation': { en: 'Needs modernisation', de: 'Modernisierungsbedürftig' },
  'needs renovation': { en: 'Needs renovation', de: 'Renovierungsbedürftig' },
};

export const CONDITION_OPTIONS = Object.keys(CONDITIONS);

export function conditionLabel(value: string | null | undefined, locale: Locale) {
  const key = (value || '').trim().toLowerCase();
  if (!key || key === 'not stated') return '';
  return CONDITIONS[key]?.[locale] || (value || '').trim();
}

export function typeLabel(type: ListingType, locale: Locale) {
  return ({
    flat: { en: 'Flat', de: 'Wohnung' },
    house: { en: 'House', de: 'Haus' },
    land: { en: 'Plot', de: 'Grundstück' },
  })[type][locale];
}

/** "Not stated" and empty placeholders from the parser are not values. */
export function statedText(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  return !text || /^(?:not stated|nicht angegeben|unknown|—|-)$/i.test(text) ? '' : text;
}
