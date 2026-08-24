import type { Locale } from './i18n';
import type { Report } from './types';

const UNKNOWN = /not stated|unknown|not disclosed|could(?:n't| not) find|address not stated/i;
const known = (value?: string) => Boolean(value && !UNKNOWN.test(value));

export function displayAddress(address: string) {
  return address
    .replace(/\b(?:provisionsfrei|courtagefrei|von\s+privat|privatverkauf)\b/gi, ' ')
    .replace(/^0(?=\s*(?:,|\b\d{5}\b|$))/g, '')
    .replace(/\s+0(?=\s*(?:,|\b\d{5}\b|$))/g, '')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/[.;,]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCity(value?: string) {
  return (value || '').replace(/^kreisfreie\s+stadt\s+/i, '').trim();
}

function escapeExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function streetOnly(address: string, city: string) {
  return displayAddress(address)
    .replace(new RegExp(`,?\\s*\\b\\d{5}\\b\\s*${city ? escapeExpression(city) : '[\\p{L}äöüß.-]+'}\\s*$`, 'iu'), '')
    .replace(/,?\s*\b\d{5}\b\s*$/u, '')
    .trim();
}

function appendCity(place: string, city: string) {
  if (!city) return place;
  if (!place) return city;
  return new RegExp(`\\b${escapeExpression(city)}\\b`, 'i').test(place) ? place : `${place}, ${city}`;
}

export type LocationResolution = {
  exact: boolean;
  city: string;
  titleLocation: string;
  mapQuery: string;
  mapLabel: string;
  basis: 'address' | 'postal code' | 'neighborhood' | 'transit stop' | 'city' | 'none';
};

export function resolveLocation(report: Pick<Report, 'address' | 'location' | 'source' | 'facts'>): LocationResolution {
  const city = cleanCity(report.facts.city);
  const cleanAddress = displayAddress(report.address || '');
  const exact = known(cleanAddress) && cleanAddress !== '0';
  const street = exact ? streetOnly(cleanAddress, city) : '';
  const district = known(report.facts.district)
    ? report.facts.district!.trim()
    : known(report.location) && report.location !== city ? report.location!.trim() : '';
  const stop = known(report.facts.transitStop) ? report.facts.transitStop!.trim() : '';
  const postal = report.facts.postalCode?.match(/\b\d{5}\b/)?.[0] || '';
  const fallbackLocation = district || stop || (postal ? `${postal}${city ? ` ${city}` : ''}` : '') || city;
  const titleLocation = exact && street ? appendCity(street, city) : appendCity(fallbackLocation, city);

  if (exact && cleanAddress) return { exact: true, city, titleLocation, mapQuery: `${cleanAddress}, Germany`, mapLabel: titleLocation, basis: 'address' };
  if (district) return { exact: false, city, titleLocation, mapQuery: `${district}${postal ? `, ${postal}` : ''}${city ? ` ${city}` : ''}, Germany`, mapLabel: appendCity(district, city), basis: 'neighborhood' };
  if (postal && city) return { exact: false, city, titleLocation, mapQuery: `${postal} ${city}, Germany`, mapLabel: `${postal} ${city}`, basis: 'postal code' };
  if (stop) return { exact: false, city, titleLocation, mapQuery: `${stop}${city ? `, ${city}` : ''}, Germany`, mapLabel: appendCity(stop, city), basis: 'transit stop' };
  if (city) return { exact: false, city, titleLocation: city, mapQuery: `${city}, Germany`, mapLabel: city, basis: 'city' };
  return { exact: false, city: '', titleLocation: '', mapQuery: '', mapLabel: '', basis: 'none' };
}

export function factualLocation(report: Pick<Report, 'address' | 'location' | 'source' | 'facts'>) {
  return resolveLocation(report).titleLocation;
}

function descriptor(report: Pick<Report, 'propertyType' | 'facts'>, locale: Locale) {
  const rooms = report.facts.rooms;
  const type = locale === 'de' ? (report.propertyType === 'flat' ? 'Wohnung' : 'Haus') : report.propertyType;
  if (known(rooms)) return locale === 'de' ? `${rooms.replace('.', ',')}-Zimmer-${type}` : `${rooms.replace(',', '.')}-room ${type}`;
  if (report.facts.area) {
    const area = new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 1 }).format(report.facts.area);
    return `${area} m² ${type}`;
  }
  if (known(report.facts.year)) return locale === 'de' ? `${type} · Baujahr ${report.facts.year}` : `${report.facts.year}-built ${type}`;
  return locale === 'de' ? type : type[0].toUpperCase() + type.slice(1);
}

export function reportTitle(report: Pick<Report, 'title' | 'address' | 'location' | 'source' | 'propertyType' | 'facts'>, locale: Locale = 'en') {
  const base = descriptor(report, locale);
  const resolved = resolveLocation(report);
  const cleanAddress = displayAddress(report.address || '');
  const street = resolved.exact ? streetOnly(cleanAddress, resolved.city) : '';
  const district = known(report.facts.district)
    ? report.facts.district!.trim()
    : known(report.location) && report.location !== resolved.city ? report.location!.trim() : '';
  const stop = known(report.facts.transitStop) ? report.facts.transitStop!.trim() : '';
  const location = street || district || (stop ? `${locale === 'de' ? 'bei' : 'near'} ${stop}` : '');
  return location ? `${base} · ${location}` : base;
}

export function reportSubtitle(report: Pick<Report, 'address' | 'location' | 'source' | 'facts'>) {
  const resolved = resolveLocation(report);
  return resolved.exact ? displayAddress(report.address || '') : resolved.mapLabel;
}

export function canonicalSource(source: string) {
  if (!/^https?:/i.test(source)) return source.trim().toLowerCase();
  try {
    const url = new URL(source);
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch {
    return source.trim().toLowerCase();
  }
}
