import type { Report } from './types';

/** Remove undisclosed house-number tokens, never manufacture a replacement.
 * Match only the end of a street segment, preserving names, dates and real suffixes.
 * Partly masked numbers (12XX) are wholly unknown, not house number 12. */
export function cleanAddressPlaceholders(value: string) {
  return value.replace(/\s+(?:(?:\d*[*?x×_•]+\d*)|0+|[–—-]+|\.{2,}|n\.?\s*n\.?|n\/?a|k\.?\s*a\.?|ohne\s+(?:Hausnummer|Nummer)|Hausnummer\s+(?:unbekannt|nicht\s+angegeben))(?=\s*(?:[,;]|\b\d{5}\b|$))/giu, '')
    .replace(/[^\S\r\n]+([,;])/g, '$1').replace(/[^\S\r\n]+/g, ' ').trim();
}

export function hasHouseNumber(street: string) {
  return /\s+[1-9]\d{0,3}\s?[a-z]?(?:\s*[-–/]\s*[1-9]\d{0,3}\s?[a-z]?)?\s*$/iu.test(cleanAddressPlaceholders(street));
}

export function cleanReportAddress(report: Report): Report {
  if (report.country === 'AM') return report;
  const address = cleanAddressPlaceholders(report.address || '');
  const street = report.facts.street ? cleanAddressPlaceholders(report.facts.street) : report.facts.street;
  const changed = address !== report.address || street !== report.facts.street;
  if (!changed) return report;
  const locationPrecision = street ? (hasHouseNumber(street) ? 'address' : 'street') : report.facts.locationPrecision === 'address' ? 'street' : report.facts.locationPrecision;
  return { ...report, address, facts: { ...report.facts, street, locationPrecision } };
}

/** Common UI/contact copy must never masquerade as a street (Verkäufer ends in ufer). */
export function validStreet(value: string) {
  const clean = value.trim();
  return Boolean(clean && clean.length <= 100 && /\p{L}/u.test(clean)
    && !/verkäufer|verkaufer|käufer|anbieter|kontakt|nachricht|anfrage|telefon|e-?mail|https?:|@|not stated|unknown|nähe|nahe|unweit|Einkaufsmeile|beliebte|Anliegerstraße/iu.test(clean)
    && !/^(?:den|dem|der|die|das|zum|zur)\s+(?:anbieter|makler|eigentümer|seller|owner)/iu.test(clean));
}
