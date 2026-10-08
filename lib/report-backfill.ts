import { attachCalculatedScore } from './report-integrity.ts';
import { constantTimeEqual } from './security.ts';
import type { Report } from './types.ts';

/**
 * Reports still on an older extraction version. A newer version is left alone
 * so a rollback does not re-parse it. A missing sourceUnavailable is 0, so a
 * row that only has sourceReviewAttemptedAt stays eligible. A row already
 * marked unavailable, with an attempt timestamp, stays out.
 */
export const STALE_REPORT_BACKFILL_SQL = `
  SELECT data FROM reports
  WHERE COALESCE(json_extract(data, '$.country'), '') != 'AM'
    AND COALESCE(json_extract(data, '$.extractionVersion'), -1) < ?1
    AND NOT (
      COALESCE(json_extract(data, '$.sourceUnavailable'), 0) = 1
      AND typeof(json_extract(data, '$.sourceReviewAttemptedAt')) = 'text'
    )
  ORDER BY created_at ASC
  LIMIT ?2
`;

/**
 * Re-extraction replaces parser output and keeps everything the parser does
 * not produce. Private notes live in report_notes and are not part of this row.
 * New photo URLs bring their own photosExpireAt. When the new parse has no
 * photos, the previous photo list and expiry stay.
 */
export function mergedBackfillReport(previous: Report, parsed: Report, attemptedAt: string): Report {
  const facts: Report['facts'] = { ...parsed.facts };
  if (!facts.photoUrls?.length && previous.facts.photoUrls?.length) {
    facts.photoUrls = previous.facts.photoUrls;
    if (previous.facts.photosExpireAt) facts.photosExpireAt = previous.facts.photosExpireAt;
    if (previous.facts.photoStaging) facts.photoStaging = previous.facts.photoStaging;
  }
  return attachCalculatedScore({
    ...parsed,
    facts,
    id: previous.id,
    createdAt: previous.createdAt,
    source: previous.source || parsed.source,
    sourceFile: previous.sourceFile,
    sourceReviewAttemptedAt: attemptedAt,
    sourceUnavailable: undefined,
    aiEnriched: Boolean(previous.aiEnriched),
    aiFactChecked: previous.aiFactChecked,
    aiLocationChecked: previous.aiLocationChecked,
    verificationAttempted: previous.verificationAttempted,
    jevCategorized: previous.jevCategorized,
    categories: previous.categories,
    taxonomy: previous.taxonomy,
    locationEvidence: previous.locationEvidence,
    offerQuestions: previous.aiEnriched ? previous.offerQuestions : parsed.offerQuestions,
    offerQuestionsDe: previous.aiEnriched ? previous.offerQuestionsDe : parsed.offerQuestionsDe,
  });
}

/** One call re-extracts at most this many saved reports. */
export const BACKFILL_BATCH_SIZE = 5;
/** Stop before starting another report once this wall-clock budget is spent. */
export const BACKFILL_TIME_BUDGET_MS = 8_000;
const MINIMUM_TOKEN_LENGTH = 24;

export type BackfillStatus = 'refreshed' | 'unavailable' | 'error';

export function backfillAuthorized(authorization: string | null, token: string | undefined) {
  if (!token || token.length < MINIMUM_TOKEN_LENGTH) return false;
  const prefix = 'Bearer ';
  if (!authorization?.startsWith(prefix)) return false;
  const presented = authorization.slice(prefix.length);
  if (presented.length !== token.length) return false;
  return constantTimeEqual(presented, token);
}

/**
 * Runs the supplied refresh for a small batch. The caller loads archived HTML
 * inside `refresh` and must not retain it after the promise resolves.
 */
export async function runBackfillBatch<T extends { id: string }>(options: {
  candidates: T[];
  budgetMs?: number;
  now?: () => number;
  refresh: (item: T) => Promise<BackfillStatus>;
}) {
  const budgetMs = options.budgetMs ?? BACKFILL_TIME_BUDGET_MS;
  const now = options.now ?? Date.now;
  const started = now();
  const processed: Array<{ id: string; status: BackfillStatus }> = [];
  let stoppedEarly = false;
  for (const item of options.candidates.slice(0, BACKFILL_BATCH_SIZE)) {
    if (now() - started >= budgetMs) {
      stoppedEarly = true;
      break;
    }
    try {
      processed.push({ id: item.id, status: await options.refresh(item) });
    } catch {
      processed.push({ id: item.id, status: 'error' });
    }
  }
  return {
    processed,
    stoppedEarly,
    remainingBudgetMs: Math.max(0, budgetMs - (now() - started)),
  };
}
