import type { Locale } from './i18n.ts';
import { factSourceCopy } from './fact-source-copy.ts';
import { isFeedbackField, type FeedbackField } from './fact-provenance.ts';
import { sha256Hex } from './security.ts';

export const SUGGESTED_VALUE_MAX = 80;
export const COMMENT_MAX = 300;
export const REPORTED_VALUE_MAX = 120;
export const FEEDBACK_HOURLY_LIMIT = 10;

/** Not a secret. Stops the raw IP being stored or matched by eye. */
const IP_HASH_SALT = 'reviewahouse-fact-feedback-v1';

export type FeedbackError = 'field' | 'suggested' | 'comment' | 'reported' | 'body';

export type ValidFactFeedback = {
  field: FeedbackField;
  reportedValue: string | null;
  suggestedValue: string | null;
  comment: string | null;
  locale: Locale;
};

function cleanText(value: unknown) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') return undefined;
  return value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
}

export function feedbackLocale(value: unknown, acceptLanguage = ''): Locale {
  if (value === 'de' || value === 'en') return value;
  return /\bde\b/i.test(acceptLanguage) ? 'de' : 'en';
}

export function validateFactFeedback(input: unknown, acceptLanguage = ''): { ok: true; value: ValidFactFeedback } | { ok: false; error: FeedbackError; locale: Locale } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'body', locale: feedbackLocale(undefined, acceptLanguage) };
  }
  const body = input as { field?: unknown; reportedValue?: unknown; suggestedValue?: unknown; comment?: unknown; locale?: unknown };
  const locale = feedbackLocale(body.locale, acceptLanguage);
  if (typeof body.field !== 'string' || !isFeedbackField(body.field)) return { ok: false, error: 'field', locale };
  const reported = cleanText(body.reportedValue);
  const suggested = cleanText(body.suggestedValue);
  const comment = cleanText(body.comment);
  if (reported === undefined || suggested === undefined || comment === undefined) return { ok: false, error: 'body', locale };
  if (reported.length > REPORTED_VALUE_MAX) return { ok: false, error: 'reported', locale };
  if (suggested.length > SUGGESTED_VALUE_MAX) return { ok: false, error: 'suggested', locale };
  if (comment.length > COMMENT_MAX) return { ok: false, error: 'comment', locale };
  return {
    ok: true,
    value: {
      field: body.field,
      reportedValue: reported || null,
      suggestedValue: suggested || null,
      comment: comment || null,
      locale,
    },
  };
}

export function feedbackErrorMessage(error: FeedbackError | 'notFound' | 'tooMany' | 'origin' | 'sendFailed', locale: Locale) {
  const text = factSourceCopy[locale];
  if (error === 'field') return text.badField;
  if (error === 'suggested') return text.suggestedTooLong;
  if (error === 'comment') return text.commentTooLong;
  if (error === 'reported') return text.reportedTooLong;
  if (error === 'notFound') return text.notFound;
  if (error === 'tooMany') return text.tooMany;
  if (error === 'origin') return text.origin;
  if (error === 'sendFailed') return text.sendFailed;
  return text.invalid;
}

export function feedbackWindowStart(now: Date) {
  return new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000).toISOString();
}

export function feedbackIsLimited(attemptCount: number) {
  return attemptCount > FEEDBACK_HOURLY_LIMIT;
}

/** Salted hash of IP and report. The IP itself is not returned or stored. */
export async function feedbackSubjectKey(ip: string, reportId: string) {
  return sha256Hex(`${IP_HASH_SALT}\n${reportId}\n${ip}`);
}
