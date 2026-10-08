import type { Locale } from './i18n.ts';
import { reportNeighborhood } from './display.ts';
import { berlinPriceSource, localPriceAvailability, type PriceCheck } from './price-check.ts';
import { colognePriceRef, munichPriceRef } from './price-ref.ts';
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

function shownMean(check: PriceCheck) {
  if (!check.approximate) return check.mean;
  return Math.round(check.mean / 50) * 50;
}

function meanPhrase(check: PriceCheck, locale: Locale) {
  const formatted = formatPerSqm(shownMean(check), locale);
  if (!check.approximate) return formatted;
  return locale === 'de' ? `rund ${formatted}` : `about ${formatted}`;
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

function berlinStyle(check: PriceCheck) {
  return check.rangeKind !== 'minmax' && check.tier !== 'city' && check.city !== 'Köln' && check.city !== 'München';
}

export function formatSignedAreaDelta(deltaPct: number, locale: Locale) {
  const sign = deltaPct > 0 ? '+' : deltaPct < 0 ? '-' : '';
  const abs = Math.abs(deltaPct).toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB');
  return locale === 'de' ? `${sign}${abs} %` : `${sign}${abs}%`;
}

function bandLabel(check: PriceCheck, locale: Locale) {
  const band = check.buildYearBand;
  if (!band) return '';
  if (band.from == null && band.to === 1940) return locale === 'de' ? 'vor 1941' : 'before 1941';
  if (band.from === 1941 && band.to === 1990) return '1941–1990';
  if (band.from === 1991 && band.to == null) return locale === 'de' ? 'ab 1991' : 'from 1991';
  if (band.from != null && band.to != null) return `${band.from}–${band.to}`;
  return '';
}

function relationPhrase(check: PriceCheck, locale: Locale) {
  const close = Math.abs(check.deltaPct) <= 2;
  if (locale === 'de') {
    if (close) return 'etwa auf dem Niveau';
    return `${Math.abs(check.deltaPct).toLocaleString('de-DE')} % ${check.deltaPct > 0 ? 'über' : 'unter'}`;
  }
  if (close) return 'about the same as';
  return `${Math.abs(check.deltaPct).toLocaleString('en-GB')}% ${check.deltaPct > 0 ? 'above' : 'below'}`;
}

function cologneLead(check: PriceCheck, locale: Locale) {
  const asking = formatPerSqm(check.askingPerSqm, locale);
  const mean = formatPerSqm(check.mean, locale);
  const range = formatRange(check.low, check.high, locale);
  const sales = check.n.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB');
  const label = bandLabel(check, locale);
  const close = Math.abs(check.deltaPct) <= 2;
  if (locale === 'de') {
    const subject = check.segment === 'newBuild'
      ? `neue Eigentumswohnungen (Erstverkauf) in ${check.area}`
      : `Eigentumswohnungen${label ? ` mit Baujahr ${label}` : ''} in ${check.area}`;
    const relation = close
      ? 'etwa auf dem Niveau des durchschnittlichen Kaufpreises'
      : `${Math.abs(check.deltaPct).toLocaleString('de-DE')} % ${check.deltaPct > 0 ? 'über' : 'unter'} dem durchschnittlichen Kaufpreis`;
    return `Der Angebotspreis von ${asking} liegt ${relation} ${check.year} für ${subject} (${mean}, ${sales} Verkäufe; niedrigster–höchster ${range}).`;
  }
  const subject = check.segment === 'newBuild'
    ? `average price for new flats (first sales) in ${check.area}`
    : `average sales price for flats${label ? ` built ${label}` : ''} in ${check.area}`;
  const relation = close ? 'about the same as' : `${Math.abs(check.deltaPct).toLocaleString('en-GB')}% ${check.deltaPct > 0 ? 'above' : 'below'}`;
  const article = close || check.segment === 'newBuild' ? 'the' : 'the';
  return `Asking ${asking} is ${relation} ${article} ${check.year} ${subject} (${mean}, ${sales} sales; lowest–highest ${range}).`;
}

function munichLead(check: PriceCheck, locale: Locale) {
  const asking = formatPerSqm(check.askingPerSqm, locale);
  const mean = meanPhrase(check, locale);
  const rough = locale === 'de'
    ? 'Amtliche Werte je Stadtbezirk gibt es nicht; nimm das nur als grobe Orientierung.'
    : 'No official figures exist per district, so treat this as a rough guide.';
  if (check.ceiling) {
    return locale === 'de'
      ? `Der Angebotspreis von ${asking} liegt ${Math.abs(check.deltaPct).toLocaleString('de-DE')} % über dem höchsten münchenweiten Mittel, das der Gutachterausschuss veröffentlicht (Neubau in guter Lage, ${mean}).`
      : `Asking ${asking} is ${Math.abs(check.deltaPct).toLocaleString('en-GB')}% above the highest Munich-wide average the valuation board publishes (new flats in good locations, ${mean}).`;
  }
  if (check.segment === 'newBuild') {
    const other = meanPhrase({ ...check, mean: check.alternateMean || check.mean }, locale);
    const close = Math.abs(check.deltaPct) <= 2;
    if (locale === 'de') {
      const relation = close
        ? 'etwa auf dem Niveau des münchenweiten Mittels'
        : `${Math.abs(check.deltaPct).toLocaleString('de-DE')} % ${check.deltaPct > 0 ? 'über' : 'unter'} dem münchenweiten Mittel`;
      return `Der Angebotspreis von ${asking} liegt ${relation} für Neubauwohnungen in guter Lage, 1. Halbjahr 2026 (${mean}; durchschnittliche Lagen ${other}). ${rough}`;
    }
    const relation = relationPhrase(check, locale);
    return `Asking ${asking} is ${relation} the Munich-wide average for new flats in good locations, first half of 2026 (${mean}; average locations ${other}). ${rough}`;
  }
  const label = bandLabel(check, locale);
  const close = Math.abs(check.deltaPct) <= 2;
  if (locale === 'de') {
    const relation = close
      ? 'etwa auf dem Niveau des münchenweiten durchschnittlichen Wiederverkaufspreises'
      : `${Math.abs(check.deltaPct).toLocaleString('de-DE')} % ${check.deltaPct > 0 ? 'über' : 'unter'} dem münchenweiten durchschnittlichen Wiederverkaufspreis`;
    return `Der Angebotspreis von ${asking} liegt ${relation} ${check.year} für Wohnungen mit Baujahr ${label} (${mean}, durchschnittliche und gute Lagen). ${rough}`;
  }
  const relation = relationPhrase(check, locale);
  return `Asking ${asking} is ${relation} the Munich-wide ${check.year} average resale price for flats built ${label} (${mean}, average and good locations). ${rough}`;
}

export function priceCheckLead(check: PriceCheck, locale: Locale, listedArea?: string) {
  if (check.city === 'München' || check.tier === 'city') return munichLead(check, locale);
  if (check.city === 'Köln' || check.rangeKind === 'minmax') return cologneLead(check, locale);
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
  if (check.rangeKind === 'none' || check.tier === 'city') return '';
  const minmax = check.rangeKind === 'minmax' || check.city === 'Köln';
  if (check.position === 'above') {
    return minmax
      ? (locale === 'de' ? 'Das liegt über dem höchsten erfassten Verkauf.' : 'That is above the highest recorded sale.')
      : (locale === 'de' ? 'Das liegt über der üblichen Spanne.' : 'That is above the typical range.');
  }
  if (check.position === 'below') {
    return minmax
      ? (locale === 'de'
        ? 'Das liegt unter dem niedrigsten erfassten Verkauf; prüfe, warum (Zustand, Vermietung, Erbbaurecht).'
        : 'That is below the lowest recorded sale; check why (condition, tenancy, leasehold).')
      : (locale === 'de'
        ? 'Das liegt unter der üblichen Spanne; prüfe, warum (Zustand, Vermietung, Erbbaurecht).'
        : 'That is below the typical range; check why (condition, tenancy, leasehold).');
  }
  return '';
}

function placeName(place: string, locale: Locale) {
  if (place === 'Cologne') return locale === 'de' ? 'Köln' : 'Cologne';
  return place;
}

function caveatNotes(check: PriceCheck, locale: Locale) {
  const mixesAges = berlinStyle(check) || (check.segment !== 'newBuild' && !check.buildYearBand && check.tier !== 'city');
  const notes = [
    locale === 'de'
      ? `Kaufpreise aus notariellen Verträgen; Angebotspreise liegen meist darüber. ${mixesAges ? 'Der Durchschnitt mischt alle Baujahre und Zustände.' : 'Der Durchschnitt mischt alle Zustände.'}`
      : `Sales prices from notarised contracts; asking prices are usually higher. ${mixesAges ? 'The average mixes all building ages and conditions.' : 'The average mixes all conditions.'}`,
  ];
  if (berlinStyle(check) && check.newBuildCaveat) {
    notes.push(locale === 'de'
      ? `Neubauwohnungen sind meist teurer: Erstverkäufe neuer Wohnungen kosteten 2025 in Berlin im Mittel ${formatPerSqm(berlinPriceSource.newBuildFirstSaleMean, 'de')}.`
      : `New flats usually sell higher: the 2025 Berlin average for first sales of new flats was ${formatPerSqm(berlinPriceSource.newBuildFirstSaleMean, 'en')}.`);
  } else if (check.newBuildCaveat && check.newBuildNote) {
    const place = placeName(check.newBuildNote.place, locale);
    const mean = formatPerSqm(check.newBuildNote.mean, locale);
    const calculated = check.newBuildNote.calculated
      ? (locale === 'de' ? ' (unsere Berechnung aus der amtlichen Tabelle)' : ' (our calculation from the official table)')
      : '';
    notes.push(locale === 'de'
      ? `Neubauwohnungen sind meist teurer: Erstverkäufe neuer Wohnungen kosteten ${check.newBuildNote.year} in ${place} im Mittel ${mean}${calculated}.`
      : `New flats usually sell higher: first sales of new flats in ${place} averaged ${mean} in ${check.newBuildNote.year}${calculated}.`);
  }
  if (check.confidence === 'low' && check.tier !== 'city') {
    notes.push(locale === 'de'
      ? 'Wenige Verkäufe in diesem Gebiet; nur als grobe Orientierung.'
      : 'Few sales in this area; treat as a rough guide.');
  }
  if (check.central) {
    notes.push(locale === 'de'
      ? 'In zentralen Stadtbezirken liegen die Kaufpreise meist deutlich über dem Stadtmittel.'
      : 'Central districts usually sell well above the citywide average.');
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
  | { kind: 'unmatched'; eyebrow: string; message: string; compareLabel: string }
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

const sourceFor = {
  Berlin: {
    en: 'Source: Gutachterausschuss Berlin, Immobilienmarktbericht 2025/2026 (dl-de/zero-2.0)',
    de: 'Quelle: Gutachterausschuss Berlin, Immobilienmarktbericht 2025/2026 (dl-de/zero-2.0)',
    url: berlinPriceSource.url,
  },
  Köln: {
    en: 'Source: Gutachterausschuss Köln, Grundstücksmarktbericht 2026 (dl-de/zero-2.0)',
    de: 'Quelle: Gutachterausschuss Köln, Grundstücksmarktbericht 2026 (dl-de/zero-2.0)',
    url: colognePriceRef.source.url,
  },
  München: {
    en: 'Source: Gutachterausschuss München, Halbjahresreport 2026 (values read from chart, rounded)',
    de: 'Quelle: Gutachterausschuss München, Halbjahresreport 2026 (Werte aus Grafik abgelesen, gerundet)',
    url: munichPriceRef.source.url,
  },
} as const;

function glanceLabel(check: PriceCheck, locale: Locale) {
  if (check.tier === 'city') return locale === 'de' ? 'ggü. Münchner Mittel' : 'vs. Munich-wide average';
  return locale === 'de' ? 'ggü. Gebietsmittel' : 'vs. area average';
}

function compareLabel(check: PriceCheck | undefined, locale: Locale, year = check?.year || 2025) {
  if (check?.tier === 'city') return locale === 'de' ? `ggü. Münchner Mittel (${year})` : `vs. Munich-wide average (${year})`;
  return locale === 'de' ? `ggü. Gebietsmittel (${year})` : `vs. area average (${year})`;
}

function unmatchedMessage(report: Report, locale: Locale) {
  const availability = localPriceAvailability(report);
  if (availability.status !== 'unmatched') return { message: '', compare: compareLabel(undefined, locale) };
  const year = availability.year || 2025;
  const area = availability.area || '';
  const citywide = availability.reason === 'noBuildYearBand';
  const compare = citywide
    ? (locale === 'de' ? `ggü. Münchner Mittel (${year})` : `vs. Munich-wide average (${year})`)
    : compareLabel(undefined, locale, year);
  if (availability.reason === 'tooFewSales') {
    return {
      compare,
      message: locale === 'de'
        ? `Kein Gebietsvergleich: zu wenige erfasste Verkäufe ${year} in ${area}.`
        : `No area comparison: too few recorded sales in ${area} in ${year}.`,
    };
  }
  if (availability.reason === 'noBuildYearBand') {
    return {
      compare,
      message: locale === 'de'
        ? 'Kein Vergleich: München veröffentlicht nur stadtweite Preise nach Baujahr, und keiner passt zu dieser Wohnung.'
        : 'No comparison: Munich only publishes citywide prices by building age, and none fits this flat.',
    };
  }
  if (availability.reason === 'areaUnclear') {
    return {
      compare,
      message: locale === 'de'
        ? 'Kein Preisvergleich: Die Wohnfläche im Angebot ist unklar (siehe Datenhinweise).'
        : 'No price comparison: the living area in the listing is unclear (see data notes).',
    };
  }
  return {
    compare,
    message: locale === 'de'
      ? 'Kein Gebietsvergleich: Die Lage im Angebot ist zu ungenau für ein amtliches Preisgebiet.'
      : "No area comparison: the listing's location is too broad to match an official price area.",
  };
}

export function priceCheckPresentation(report: Report, locale: Locale): PriceCheckPresentation {
  const availability = localPriceAvailability(report);
  const eyebrow = locale === 'de' ? 'PREISCHECK' : 'PRICE CHECK';
  if (availability.status === 'hidden') return { kind: 'hidden' };
  if (availability.status === 'unmatched') {
    const unmatched = unmatchedMessage(report, locale);
    return { kind: 'unmatched', eyebrow, message: unmatched.message, compareLabel: unmatched.compare };
  }
  const check = availability.check;
  const source = sourceFor[check.city || 'Berlin'];
  return {
    kind: 'matched',
    eyebrow,
    glanceLabel: glanceLabel(check, locale),
    glanceValue: formatSignedAreaDelta(check.deltaPct, locale),
    lead: priceCheckLead(check, locale, reportNeighborhood(report)),
    positionNote: positionNote(check, locale),
    notes: caveatNotes(check, locale),
    sourceLabel: source[locale],
    sourceUrl: source.url,
    compareLabel: compareLabel(check, locale),
    compareValue: formatSignedAreaDelta(check.deltaPct, locale),
  };
}

export function priceCheckCompare(report: Report, locale: Locale) {
  const view = priceCheckPresentation(report, locale);
  if (view.kind === 'hidden') {
    return {
      label: locale === 'de' ? 'ggü. Gebietsmittel (2025)' : 'vs. area average (2025)',
      value: '—',
    };
  }
  return {
    label: view.compareLabel,
    value: view.kind === 'matched' ? view.compareValue : '—',
  };
}
