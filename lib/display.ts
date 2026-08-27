import type { Locale } from './i18n';
import type { Report } from './types';

const UNKNOWN = /not stated|unknown|not disclosed|could(?:n't| not) find|address not stated/i;
const known = (value?: string) => Boolean(value && !UNKNOWN.test(value));
const PLACE_NOISE = /^(?:0|deutschland|germany|immobilie|wohnung|haus|provisionsfrei|courtagefrei)$/i;

function safePlace(value?: string) {
  const compact = (value || '').replace(/\s+/g, ' ').trim();
  const words = compact.split(' ').filter(Boolean);
  for (let size = Math.floor(words.length / 2); size >= 1; size -= 1) {
    for (let start = 0; start + size * 2 <= words.length; start += 1) {
      const first = words.slice(start, start + size).join(' ').toLocaleLowerCase('de-DE');
      const second = words.slice(start + size, start + size * 2).join(' ').toLocaleLowerCase('de-DE');
      if (first === second) words.splice(start + size, size);
    }
  }
  const clean = words.join(' ');
  return clean && clean.length <= 80 && /\p{L}/u.test(clean) && !PLACE_NOISE.test(clean) ? clean : '';
}

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

function preciseArea(value: string, city: string) {
  const place = safePlace(value.replace(/\b\d{5}\b/g, ' ').replace(/^[\s,;|–—-]+|[\s,;|–—-]+$/g, ' '));
  if (!place) return '';
  const withoutCity = city
    ? place
      .replace(new RegExp(`^${escapeExpression(city)}\s*[-–—,/]\s*`, 'i'), '')
      .replace(new RegExp(`\s*[-–—,/]\s*${escapeExpression(city)}$`, 'i'), '')
      .trim()
    : place;
  const precise = safePlace(withoutCity);
  return precise.toLocaleLowerCase('de-DE') === city.toLocaleLowerCase('de-DE') ? '' : precise;
}

export type LocationResolution = {
  exact: boolean;
  city: string;
  titleLocation: string;
  mapQuery: string;
  mapLabel: string;
  basis: 'address' | 'street' | 'postal code' | 'neighborhood' | 'transit stop' | 'city' | 'none';
};

export function reportNeighborhood(report: Pick<Report, 'address' | 'location' | 'source' | 'facts'>) {
  const city = safePlace(cleanCity(report.facts.city));
  return preciseArea(known(report.facts.district)
    ? report.facts.district!.trim()
    : known(report.location) && report.location !== city ? report.location!.trim() : '', city);
}

export function resolveLocation(report: Pick<Report, 'address' | 'location' | 'source' | 'facts'>): LocationResolution {
  const city = safePlace(cleanCity(report.facts.city));
  const cleanAddress = displayAddress(report.address || '');
  const addressKnown = known(cleanAddress) && cleanAddress !== '0';
  const addressStreet = addressKnown ? streetOnly(cleanAddress, city) : '';
  const statedStreet = safePlace(report.facts.street);
  const street = safePlace(addressStreet || statedStreet);
  const exact = Boolean(street && (report.facts.locationPrecision === 'address' || /\b\d{1,4}[a-z]?\s*$/iu.test(street)));
  const district = reportNeighborhood(report);
  const stop = safePlace(known(report.facts.transitStop) ? report.facts.transitStop!.trim() : '');
  const postal = report.facts.postalCode?.match(/\b\d{5}\b/)?.[0] || cleanAddress.match(/\b\d{5}\b/)?.[0] || '';
  const fallbackLocation = district || stop || city;
  const titleLocation = exact && street ? appendCity(street, city) : appendCity(fallbackLocation, city);

  if (exact && cleanAddress) return { exact: true, city, titleLocation, mapQuery: `${cleanAddress}, Germany`, mapLabel: titleLocation, basis: 'address' };
  if (street) {
    const streetArea = `${street}${postal ? `, ${postal}` : ''}${city ? ` ${city}` : ''}`;
    return { exact: false, city, titleLocation: appendCity(street, city), mapQuery: `${streetArea}, Germany`, mapLabel: streetArea, basis: 'street' };
  }
  if (district) return { exact: false, city, titleLocation, mapQuery: `${district}${postal ? `, ${postal}` : ''}${city ? ` ${city}` : ''}, Germany`, mapLabel: appendCity(district, city), basis: 'neighborhood' };
  if (postal) {
    const postalArea = `${postal}${city ? ` ${city}` : ''}`;
    return { exact: false, city, titleLocation: city, mapQuery: `${postalArea}, Germany`, mapLabel: postalArea, basis: 'postal code' };
  }
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
  return locale === 'de' ? type : type[0].toUpperCase() + type.slice(1);
}

export function reportTitle(report: Pick<Report, 'title' | 'address' | 'location' | 'source' | 'propertyType' | 'facts'>, locale: Locale = 'en') {
  const base = descriptor(report, locale);
  const resolved = resolveLocation(report);
  const cleanAddress = displayAddress(report.address || '');
  const street = resolved.basis === 'address' || resolved.basis === 'street'
    ? safePlace((known(cleanAddress) ? streetOnly(cleanAddress, resolved.city) : '') || report.facts.street)
    : '';
  const district = reportNeighborhood(report);
  const stop = known(report.facts.transitStop) ? report.facts.transitStop!.trim() : '';
  const streetLocation = street;
  const location = streetLocation || district || (stop ? `${locale === 'de' ? 'bei' : 'near'} ${stop}` : '') || resolved.city;
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
