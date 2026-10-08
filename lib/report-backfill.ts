import { constantTimeEqual } from './security.ts';

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
