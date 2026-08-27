import type { Locale } from './i18n';
import type { Report } from './types';
import { reportTitleLocation } from './display.ts';

export function printDocumentTitle(report: Pick<Report, 'address' | 'location' | 'source' | 'facts'>, locale: Locale) {
  const label = locale === 'de' ? 'Immobilien-Bericht' : 'Property report';
  const location = reportTitleLocation(report, locale);
  return [label, location, 'ReviewAHouse'].filter(Boolean).join(' · ');
}
