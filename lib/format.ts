import type { Locale } from './i18n.ts';

/**
 * Locale number formats for German reports.
 * EN (en-GB): €172,000 · 3.5%
 * DE (de-DE): 172.000 € · 3,5 %
 * Amounts of €100 or more are whole euros; smaller amounts keep cents.
 */
export function money(value: number, locale: Locale) {
  const abs = Math.abs(value);
  const digits = abs >= 100 || abs === 0 ? 0 : 2;
  return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** `value` is a percent already, so 3.5 formats as 3.5% / 3,5 %. */
export function percent(value: number, locale: Locale, digits = 2) {
  return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value / 100);
}

export function moneyRange(low: number, high: number, locale: Locale) {
  if (Math.round(low) === Math.round(high)) return money(low, locale);
  return `${money(low, locale)}–${money(high, locale)}`;
}
