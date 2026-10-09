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
    if (previous.facts.photoStaging) facts.photoStaging = previous.facts.photoStaging;
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

/**
 * One call re-extracts this many saved reports. `BACKFILL_BATCH_SIZE` may set
 * 1–5. This count is the guard. A Worker clock does not advance during
 * synchronous parse work, so a millisecond budget stays at 0 and never stops
 * the batch.
 */
export const BACKFILL_BATCH_SIZE = 1;
const BACKFILL_BATCH_CAP = 5;
const MINIMUM_TOKEN_LENGTH = 24;

/** Env override. Blank, fractional, and out-of-range values stay at the default of 1. */
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
 * Runs the supplied refresh for `batchSize` candidates (default
 * {@link BACKFILL_BATCH_SIZE}). The caller loads archived HTML inside
 * `refresh` and must not retain it after the promise resolves. An error on
 * one report is recorded and the rest of the batch still runs.
 */
export async function runBackfillBatch<T extends { id: string }>(options: {
  candidates: T[];
  batchSize?: number;
  refresh: (item: T) => Promise<BackfillStatus>;
}) {
  const batchSize = options.batchSize ?? BACKFILL_BATCH_SIZE;
  const processed: Array<{ id: string; status: BackfillStatus }> = [];
  for (const item of options.candidates.slice(0, batchSize)) {
    try {
      processed.push({ id: item.id, status: await options.refresh(item) });
    } catch {
      processed.push({ id: item.id, status: 'error' });
    }
  }
  return { processed };
}
