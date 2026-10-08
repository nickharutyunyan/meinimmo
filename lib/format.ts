import type { Locale } from './i18n.ts';

const intlTag = (locale: Locale) => (locale === 'de' ? 'de-DE' : 'en-GB');

function finite(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function currencyDigits(amount: number) {
  const abs = Math.abs(amount);
  const whole = Math.round(abs * 100) % 100 === 0;
  // Whole euros from €10 up, including a monthly €83. Smaller amounts keep the cents.
  if (whole && abs >= 10) return 0;
  return 2;
}

function currency(amount: number, locale: Locale, digits: number) {
  const formatted = new Intl.NumberFormat(intlTag(locale), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(amount));
  return amount < 0 ? `−${formatted}` : formatted;
}

/** EN `€172,000` / `€142.59`. DE `172.000 €` / `142,59 €`. Empty when the value is unknown. */
export function money(value: unknown, locale: Locale) {
  const amount = finite(value);
  if (amount === undefined) return '';
  return currency(amount, locale, currencyDigits(amount));
}

/** EN `€5,733/m²`. DE `5.733 €/m²`. */
export function moneyPerSqm(value: unknown, locale: Locale) {
  const amount = finite(value);
  if (amount === undefined) return '';
  return `${currency(Math.round(amount), locale, 0)}/m²`;
}

/** At most two decimals: EN `32.2 m²`, DE `32,2 m²`. */
export function area(value: unknown, locale: Locale) {
  const formatted = plainNumber(value, locale, 2);
  return formatted ? `${formatted} m²` : '';
}

/** EN `4.52%`. DE `4,52 %` (no-break space). `value` is already a percent, not a fraction. */
export function percent(value: unknown, locale: Locale, digits = 2) {
  const amount = finite(value);
  if (amount === undefined) return '';
  return new Intl.NumberFormat(intlTag(locale), {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount / 100);
}

/** EN `7.0`. DE `7,0`. */
export function score(value: unknown, locale: Locale) {
  const amount = finite(value);
  if (amount === undefined) return '';
  return new Intl.NumberFormat(intlTag(locale), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(amount);
}

/**
 * `{n} / {total}` for both locales. Pass the locale template so the separator
 * stays with the copy. Unknown numbers stay blank rather than becoming zero.
 */
export function photoCount(index: unknown, total: unknown, locale: Locale, template = '{n} / {total}') {
  const current = plainNumber(index, locale);
  const count = plainNumber(total, locale);
  if (!current || !count) return '';
  return template.replaceAll('{n}', current).replaceAll('{total}', count);
}

/** Grouped number. `digits` is the maximum fraction digits; trailing zeros are omitted. */
export function plainNumber(value: unknown, locale: Locale, digits = 0) {
  const amount = finite(value);
  if (amount === undefined) return '';
  const places = Math.max(0, digits);
  return new Intl.NumberFormat(intlTag(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: places,
  }).format(amount);
}
