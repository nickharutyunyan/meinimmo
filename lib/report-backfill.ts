import { attachCalculatedScore } from './report-integrity.ts';
import { constantTimeEqual } from './security.ts';
import type { Report } from './types.ts';

/**
 * Reports still on an older extraction version. A newer version is left alone
 * so a rollback does not re-parse it. A missing sourceUnavailable is 0, so a
 * row that only has sourceReviewAttemptedAt stays eligible. A row already
 * marked unavailable, with an attempt timestamp, stays out.
 */
const STALE_REPORT_WHERE = `
  COALESCE(json_extract(data, '$.country'), '') != 'AM'
    AND COALESCE(json_extract(data, '$.extractionVersion'), -1) < ?1
    AND NOT (
      COALESCE(json_extract(data, '$.sourceUnavailable'), 0) = 1
      AND typeof(json_extract(data, '$.sourceReviewAttemptedAt')) = 'text'
    )
`;

export const STALE_REPORT_BACKFILL_SQL = `
  SELECT data FROM reports
  WHERE ${STALE_REPORT_WHERE}
  ORDER BY created_at ASC
  LIMIT ?2
`;

export const STALE_REPORT_COUNT_SQL = `
  SELECT COUNT(*) AS remaining FROM reports
  WHERE ${STALE_REPORT_WHERE}
`;

/**
 * Re-extraction replaces parser output and keeps everything the parser does
 * not produce. Start from the stored row so a field this code does not know
 * about — a map pin, a legacy evidence quote, a country — survives. Private
 * notes live in report_notes and are not part of this row. New photo URLs
 * bring their own photosExpireAt. When the new parse has no photos, the
 * previous photo list and expiry stay.
 */
export function mergedBackfillReport(previous: Report, parsed: Report, attemptedAt: string): Report {
  const facts: Report['facts'] = { ...parsed.facts };
  if (!facts.photoUrls?.length && previous.facts.photoUrls?.length) {
    facts.photoUrls = previous.facts.photoUrls;
    if (previous.facts.photosExpireAt) facts.photosExpireAt = previous.facts.photosExpireAt;
  }
  return attachCalculatedScore({
    ...previous,
    extractionVersion: parsed.extractionVersion,
    factEvidence: parsed.factEvidence,
    title: parsed.title,
    address: parsed.address,
    location: parsed.location,
    propertyType: parsed.propertyType,
    typeSource: parsed.typeSource,
    facts,
    score: parsed.score,
    scoreBreakdown: parsed.scoreBreakdown,
    scoreTitle: parsed.scoreTitle,
    summary: parsed.summary,
    considerations: parsed.considerations,
    sunOrientation: parsed.sunOrientation,
    daylight: parsed.daylight,
    qualityWarnings: parsed.qualityWarnings,
    redFlags: parsed.redFlags,
    taxonomyEvidence: parsed.taxonomyEvidence,
    id: previous.id,
    createdAt: previous.createdAt,
    source: previous.source || parsed.source,
    sourceFile: previous.sourceFile,
    geocode: previous.geocode,
    country: previous.country,
    evidence: previous.evidence,
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

/** One call re-extracts at most this many saved reports, unless BACKFILL_BATCH_SIZE overrides it. */
export const BACKFILL_BATCH_SIZE = 2;
/** Stop before starting another report once this much synchronous work is recorded. */
export const BACKFILL_WORK_BUDGET_MS = 800;
/**
 * A report is not started unless at least this much of the budget remains.
 * One archived listing is about 30–70 ms of main-thread work locally and was
 * about 400 ms of Worker CPU in production, so 400 ms is the reserve.
 */
export const BACKFILL_REPORT_RESERVE_MS = 400;
const BACKFILL_BATCH_CAP = 5;
const MINIMUM_TOKEN_LENGTH = 24;

/** Env override. Blank, fractional, and out-of-range values stay at the default of 2. */
export function configuredBackfillBatchSize(value: string | undefined) {
  if (value == null || value.trim() === '') return BACKFILL_BATCH_SIZE;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > BACKFILL_BATCH_CAP) return BACKFILL_BATCH_SIZE;
  return parsed;
}

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
 * Runs the supplied refresh for a small batch. `account` records synchronous
 * work inside `refresh` (parsing). Time spent awaiting D1 is not work, so a
 * slow read does not by itself eat the CPU budget, and a fast parse cannot
 * hide behind it. The caller loads archived HTML inside `refresh` and must
 * not retain it after the promise resolves.
 * A report is started only when `reserveMs` of the budget is still free.
 */
export async function runBackfillBatch<T extends { id: string }>(options: {
  candidates: T[];
  batchSize?: number;
  budgetMs?: number;
  reserveMs?: number;
  refresh: (item: T, account: (elapsedMs: number) => void) => Promise<BackfillStatus>;
}) {
  const batchSize = options.batchSize ?? BACKFILL_BATCH_SIZE;
  const budgetMs = options.budgetMs ?? BACKFILL_WORK_BUDGET_MS;
  const reserveMs = options.reserveMs ?? BACKFILL_REPORT_RESERVE_MS;
  const processed: Array<{ id: string; status: BackfillStatus }> = [];
  let usedMs = 0;
  let stoppedEarly = false;
  const account = (elapsedMs: number) => {
    if (Number.isFinite(elapsedMs) && elapsedMs > 0) usedMs += elapsedMs;
  };
  for (const item of options.candidates.slice(0, batchSize)) {
    if (usedMs + reserveMs > budgetMs) {
      stoppedEarly = true;
      break;
    }
    try {
      processed.push({ id: item.id, status: await options.refresh(item, account) });
    } catch {
      processed.push({ id: item.id, status: 'error' });
    }
  }
  return {
    processed,
    stoppedEarly,
    usedMs,
    remainingBudgetMs: Math.max(0, budgetMs - usedMs),
  };
}
