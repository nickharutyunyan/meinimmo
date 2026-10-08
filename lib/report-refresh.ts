import { createBoundedMap } from './bounded-cache.ts';
import { EXTRACTION_VERSION } from './report-integrity.ts';
import type { Report } from './types.ts';

/** Caller-side budget for one archived re-parse. It does not preempt a running parse. */
export const REFRESH_TIME_BUDGET_MS = 1_500;
/** Further starts are dropped. They are not queued. */
export const REFRESH_IN_FLIGHT_MAX = 2;
/** Distinct report ids remembered for this isolate. A full set drops new ids. */
export const REFRESH_ATTEMPTED_MAX = 512;

const inFlight = createBoundedMap<string, true>(REFRESH_IN_FLIGHT_MAX);
const attempted = createBoundedMap<string, true>(REFRESH_ATTEMPTED_MAX);

export type RefreshStart = 'started' | 'already' | 'dropped';

export type RefreshOutcome<T> =
  | { status: 'already' | 'dropped' }
  | { status: 'started'; ok: true; value: T }
  | { status: 'started'; ok: false; error: unknown };

export function refreshInFlight() {
  return inFlight.size;
}

export function refreshAttemptedCount() {
  return attempted.size;
}

export function resetReportRefreshState() {
  inFlight.clear();
  attempted.clear();
}

/**
 * A saved failure marker stops another re-parse even when the extraction
 * version is still old. Current reports and Armenian reports are skipped.
 */
export function needsArchivedRefresh(item: Pick<Report, 'country' | 'extractionVersion' | 'sourceUnavailable' | 'sourceReviewAttemptedAt'>) {
  if (item.country === 'AM') return false;
  if (item.sourceUnavailable && item.sourceReviewAttemptedAt) return false;
  if (item.extractionVersion === EXTRACTION_VERSION) return false;
  return true;
}

/** Persist this when a re-parse cannot finish. The marker, not the old version, is what the next read checks. */
export function refreshFailureMarker(item: Report, attemptedAt: string): Report {
  return {
    ...item,
    sourceUnavailable: true,
    sourceReviewAttemptedAt: attemptedAt,
    aiFactChecked: false,
    aiLocationChecked: false,
    facts: { ...item.facts },
  };
}

export function beginReportRefresh(id: string): RefreshStart {
  if (attempted.has(id)) return 'already';
  if (inFlight.size >= inFlight.max || attempted.size >= attempted.max) return 'dropped';
  if (!attempted.set(id, true)) return 'dropped';
  if (!inFlight.set(id, true)) {
    attempted.delete(id);
    return 'dropped';
  }
  return 'started';
}

export function finishReportRefresh(id: string) {
  inFlight.delete(id);
}

export async function runBoundedRefresh<T>(id: string, task: () => Promise<T>, budgetMs = REFRESH_TIME_BUDGET_MS): Promise<RefreshOutcome<T>> {
  const status = beginReportRefresh(id);
  if (status !== 'started') return { status };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('refresh_budget')), budgetMs);
      task().then(resolve, reject);
    });
    return { status: 'started', ok: true, value };
  } catch (error) {
    return { status: 'started', ok: false, error };
  } finally {
    if (timer) clearTimeout(timer);
    finishReportRefresh(id);
  }
}
