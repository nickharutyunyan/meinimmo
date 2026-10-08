import type { Locale } from './i18n.ts';
import { reportNeighborhood } from './display.ts';
import { berlinPriceAvailability, berlinPriceSource, type PriceCheck } from './price-check.ts';
import type { Report } from './types.ts';

const dash = '–';

function formatEuro(amount: number, locale: Locale) {
  const rounded = Math.round(amount).toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB');
  return locale === 'de' ? `${rounded} €` : `€${rounded}`;
}

function formatPerSqm(amount: number, locale: Locale) {
  return `${formatEuro(amount, locale)}/m²`;
}

function formatRange(low: number, high: number, locale: Locale) {
  const left = Math.round(low).toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB');
  const right = Math.round(high).toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB');
  return locale === 'de' ? `${left}${dash}${right} €/m²` : `€${left}${dash}€${right}/m²`;
}

function foldPlace(value: string) {
  return value.trim().toLocaleLowerCase('de-DE').replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
}

function describedArea(official: string, listed: string | undefined, locale: Locale) {
  const name = (listed || '').trim();
  if (!name || foldPlace(name) === foldPlace(official)) return official;
  return locale === 'de'
    ? `${official} (amtliches Preisgebiet, umfasst ${name})`
    : `${official} (official price area, includes ${name})`;
}

export function formatSignedAreaDelta(deltaPct: number, locale: Locale) {
  const sign = deltaPct > 0 ? '+' : deltaPct < 0 ? '-' : '';
  const abs = Math.abs(deltaPct).toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB');
  return locale === 'de' ? `${sign}${abs} %` : `${sign}${abs}%`;
}

export function priceCheckLead(check: PriceCheck, locale: Locale, listedArea?: string) {
  const asking = formatPerSqm(check.askingPerSqm, locale);
  const mean = formatPerSqm(check.mean, locale);
  const range = formatRange(check.low, check.high, locale);
  const area = describedArea(check.area, listedArea, locale);
  const sales = check.n.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB');
  const close = Math.abs(check.deltaPct) <= 2;
  if (locale === 'de') {
    const relation = close
      ? 'etwa auf dem Niveau des durchschnittlichen Kaufpreises'
      : `${Math.abs(check.deltaPct).toLocaleString('de-DE')} % ${check.deltaPct > 0 ? 'über' : 'unter'} dem durchschnittlichen Kaufpreis`;
    return `Der Angebotspreis von ${asking} liegt ${relation} 2025 für Eigentumswohnungen in ${area}: ${mean}, ${sales} Verkäufe; übliche Spanne ${range}.`;
  }
  const relation = close
    ? 'about the same as'
    : `${Math.abs(check.deltaPct).toLocaleString('en-GB')}% ${check.deltaPct > 0 ? 'above' : 'below'}`;
  return `Asking ${asking} is ${relation} the 2025 average sales price for flats in ${area}: ${mean}, ${sales} sales; typical range ${range}.`;
}

function positionNote(check: PriceCheck, locale: Locale) {
  if (check.position === 'above') return locale === 'de' ? 'Das liegt über der üblichen Spanne.' : 'That is above the typical range.';
  if (check.position === 'below') {
    return locale === 'de'
      ? 'Das liegt unter der üblichen Spanne; prüfe, warum (Zustand, Vermietung, Erbbaurecht).'
      : 'That is below the typical range; check why (condition, tenancy, leasehold).';
  }
  return '';
}

function caveatNotes(check: PriceCheck, locale: Locale) {
  const notes = [
    locale === 'de'
      ? 'Kaufpreise aus notariellen Verträgen; Angebotspreise liegen meist darüber. Der Durchschnitt mischt alle Baujahre und Zustände.'
      : 'Sales prices from notarised contracts; asking prices are usually higher. The average mixes all building ages and conditions.',
  ];
  if (check.newBuildCaveat) {
    notes.push(locale === 'de'
      ? `Neubauwohnungen sind meist teurer: Erstverkäufe neuer Wohnungen kosteten 2025 in Berlin im Mittel ${formatPerSqm(berlinPriceSource.newBuildFirstSaleMean, 'de')}.`
      : `New flats usually sell higher: the 2025 Berlin average for first sales of new flats was ${formatPerSqm(berlinPriceSource.newBuildFirstSaleMean, 'en')}.`);
  }
  if (check.confidence === 'low') {
    notes.push(locale === 'de'
      ? 'Wenige Verkäufe in diesem Gebiet; nur als grobe Orientierung.'
      : 'Few sales in this area; treat as a rough guide.');
  }
  if (check.note === 'microApartmentsExcluded') {
    notes.push(locale === 'de'
      ? 'Durchschnitt ohne Mikroapartments bis 30 m².'
      : 'Average excludes micro-apartments up to 30 m².');
  }
  return notes;
}

export type PriceCheckPresentation =
  | { kind: 'hidden' }
  | { kind: 'unmatched'; eyebrow: string; message: string }
  | {
    kind: 'matched';
    eyebrow: string;
    glanceLabel: string;
    glanceValue: string;
    lead: string;
    positionNote: string;
    notes: string[];
    sourceLabel: string;
    sourceUrl: string;
    compareLabel: string;
    compareValue: string;
  };

const sourceLabel = {
  en: 'Source: Gutachterausschuss Berlin, Immobilienmarktbericht 2025/2026 (dl-de/zero-2.0)',
  de: 'Quelle: Gutachterausschuss Berlin, Immobilienmarktbericht 2025/2026 (dl-de/zero-2.0)',
} as const;

const unmatchedMessage = {
  en: "No area comparison: the listing's location is too broad to match an official price area.",
  de: 'Kein Gebietsvergleich: Die Lage im Angebot ist zu ungenau für ein amtliches Preisgebiet.',
} as const;

export function priceCheckPresentation(report: Report, locale: Locale): PriceCheckPresentation {
  const availability = berlinPriceAvailability(report);
  const eyebrow = locale === 'de' ? 'PREISCHECK' : 'PRICE CHECK';
  if (availability.status === 'hidden') return { kind: 'hidden' };
  if (availability.status === 'unmatched') return { kind: 'unmatched', eyebrow, message: unmatchedMessage[locale] };
  const check = availability.check;
  return {
    kind: 'matched',
    eyebrow,
    glanceLabel: locale === 'de' ? 'ggü. Gebietsmittel' : 'vs. area average',
    glanceValue: formatSignedAreaDelta(check.deltaPct, locale),
    lead: priceCheckLead(check, locale, reportNeighborhood(report)),
    positionNote: positionNote(check, locale),
    notes: caveatNotes(check, locale),
    sourceLabel: sourceLabel[locale],
    sourceUrl: berlinPriceSource.url,
    compareLabel: locale === 'de' ? 'ggü. Gebietsmittel (2025)' : 'vs. area average (2025)',
    compareValue: formatSignedAreaDelta(check.deltaPct, locale),
  };
}

export function priceCheckCompare(report: Report, locale: Locale) {
  const view = priceCheckPresentation(report, locale);
  return {
    label: locale === 'de' ? 'ggü. Gebietsmittel (2025)' : 'vs. area average (2025)',
    value: view.kind === 'matched' ? view.compareValue : '—',
  };
}
