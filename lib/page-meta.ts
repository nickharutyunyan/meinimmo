import type { Metadata } from 'next';
import type { Locale } from './i18n.ts';
import type { Report } from './types';
import { reportTitle } from './display.ts';
import { localizedSummary } from './report-copy.ts';

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function socialMetadata(locale: Locale, title: string, description: string, path: string): Metadata {
  const text = clean(description).slice(0, 180);
  return {
    title,
    description: text,
    openGraph: {
      type: 'website',
      url: path,
      siteName: 'ReviewAHouse',
      title,
      description: text,
      locale: locale === 'de' ? 'de_DE' : 'en_GB',
    },
    twitter: { card: 'summary', title, description: text },
  };
}

export function reportPageMetadata(report: Report, locale: Locale): Metadata {
  const title = `${reportTitle(report, locale)} | Review a House`;
  const summary = clean(localizedSummary(report, locale).split('\n')[0] || '');
  const description = summary || (locale === 'de'
    ? 'Immobilienbericht mit den Angaben aus dem Angebot, den Kosten und den Fragen an den Verkäufer.'
    : 'Property report with the listing facts, the costs and the questions for the seller.');
  const path = `${locale === 'de' ? '/de' : ''}/r/${report.id}`;
  return {
    ...socialMetadata(locale, title, description, path),
    alternates: { canonical: path, languages: { en: `/r/${report.id}`, de: `/de/r/${report.id}` } },
  };
}

export function comparisonPageMetadata(first: Report, second: Report, id: string, locale: Locale): Metadata {
  const left = reportTitle(first, locale);
  const right = reportTitle(second, locale);
  const title = locale === 'de'
    ? `Vergleich: ${left} und ${right} | Review a House`
    : `Comparison: ${left} and ${right} | Review a House`;
  const description = locale === 'de'
    ? 'Zwei Immobilienangebote im direkten Vergleich: Preis, Fläche, Energie und Score.'
    : 'Two property listings side by side: price, space, energy and score.';
  const path = `${locale === 'de' ? '/de' : ''}/c/${id}`;
  return {
    ...socialMetadata(locale, title, description, path),
    alternates: { canonical: path, languages: { en: `/c/${id}`, de: `/de/c/${id}` } },
  };
}
