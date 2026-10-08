import 'server-only';
import { FMH_MORTGAGE_RATE_SOURCE_URL, parseFmhMortgageRate, type MortgageRateSnapshot } from './fmh-mortgage-rate';
import { markMortgageRateStale, saveMortgageRate, storedMortgageRate } from './mortgage-rate-store';
const REFRESH_AFTER_MS = 60 * 60 * 1_000;
/** D1 snapshot only. Report HTML must not wait on the live rate source. */
export async function cachedMortgageRate(): Promise<MortgageRateSnapshot | undefined> {
  try {
    const stored = await storedMortgageRate();
    if (!stored) return undefined;
    const fetchedAt = Date.parse(stored.fetchedAt);
    if (!Number.isFinite(fetchedAt)) return undefined;
    return Date.now() - fetchedAt < REFRESH_AFTER_MS ? stored : markMortgageRateStale(stored);
  } catch {
    return undefined;
  }
}

export async function currentMortgageRate(): Promise<MortgageRateSnapshot | undefined> {
  let stored;
  try {
    stored = await storedMortgageRate();
    if (stored && Date.now() - Date.parse(stored.fetchedAt) < REFRESH_AFTER_MS) {
      return stored;
    }
  } catch {
    // The live source can still provide the rate if the cache is temporarily unavailable.
  }

  try {
    const response = await fetch(FMH_MORTGAGE_RATE_SOURCE_URL, {
      cache: 'no-store',
      headers: { Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`FMH returned ${response.status}.`);
    const parsed = parseFmhMortgageRate(await response.text());
    try {
      return await saveMortgageRate(parsed.rate, parsed.observedAt);
    } catch {
      return {
        ...parsed,
        fetchedAt: new Date().toISOString(),
        sourceName: 'FMH Index',
        sourceUrl: FMH_MORTGAGE_RATE_SOURCE_URL,
        fixationYears: 10,
        stale: false,
      };
    }
  } catch {
    if (stored) return markMortgageRateStale(stored);
    return undefined;
  }
}
