import type { Report } from './types';
import { copy, type Locale } from './i18n.ts';
import { displayedPropertyScore, scoreAvailable } from './report-integrity.ts';
import {
  formatScore,
  priceNotCheckedLine,
  scoreAdjustmentLine,
  scoreConfidence,
  scoreConfidenceLabel,
} from './property-score.ts';

export type ComparisonRow = readonly [label: string, first: string, second: string];

export function visibleComparisonRows<T extends ComparisonRow>(rows: readonly T[]) {
  return rows.filter(([, first, second]) => first !== '—' || second !== '—');
}

/** The total, plus the same confidence, deduction and price lines as the report header. */
export function comparisonScoreText(report: Report, locale: Locale) {
  if (!scoreAvailable(report)) return '—';
  const calculated = displayedPropertyScore(report);
  const parts = [
    `${formatScore(calculated.total, locale)} / 10`,
    scoreConfidenceLabel(scoreConfidence(report), locale),
    ...calculated.adjustments.map((item) => scoreAdjustmentLine(item, locale)),
  ];
  const price = priceNotCheckedLine(report, locale);
  if (price) parts.push(price);
  return parts.join(' · ');
}

/** One price note per option whose score left the price out, including when both are outside Berlin. */
export function comparisonPriceNotes(first: Report, second: Report, locale: Locale) {
  const text = copy[locale].compare;
  return [first, second].flatMap((item, index) => {
    const note = priceNotCheckedLine(item, locale);
    if (!note || displayedPropertyScore(item).breakdown.price !== null) return [];
    return [`${text.option} ${index === 0 ? 'A' : 'B'}: ${note}`];
  });
}
