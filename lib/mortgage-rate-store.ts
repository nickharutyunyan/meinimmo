import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  FMH_MORTGAGE_RATE_SOURCE_NAME,
  FMH_MORTGAGE_RATE_SOURCE_URL,
  type MortgageRateSnapshot,
} from './fmh-mortgage-rate';

type RateRow = {
  rate: number;
  observed_at: string;
  fetched_at: string;
};

async function database() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) throw new Error('The Cloudflare D1 binding "DB" is not configured.');
  return env.DB;
}

function snapshot(row: RateRow, stale: boolean): MortgageRateSnapshot {
  return {
    rate: row.rate,
    observedAt: row.observed_at,
    fetchedAt: row.fetched_at,
    sourceName: FMH_MORTGAGE_RATE_SOURCE_NAME,
    sourceUrl: FMH_MORTGAGE_RATE_SOURCE_URL,
    fixationYears: 10,
    stale,
  };
}

export async function storedMortgageRate() {
  const db = await database();
  const row = await db.prepare(`
    SELECT rate, observed_at, fetched_at
    FROM mortgage_rate_snapshots
    WHERE source = ?1
  `).bind(FMH_MORTGAGE_RATE_SOURCE_NAME).first<RateRow>();
  return row ? snapshot(row, false) : undefined;
}

export async function saveMortgageRate(rate: number, observedAt: string) {
  const fetchedAt = new Date().toISOString();
  const db = await database();
  await db.prepare(`
    INSERT INTO mortgage_rate_snapshots (source, rate, observed_at, fetched_at)
    VALUES (?1, ?2, ?3, ?4)
    ON CONFLICT(source) DO UPDATE SET
      rate = excluded.rate,
      observed_at = excluded.observed_at,
      fetched_at = excluded.fetched_at
  `).bind(FMH_MORTGAGE_RATE_SOURCE_NAME, rate, observedAt, fetchedAt).run();
  return snapshot({ rate, observed_at: observedAt, fetched_at: fetchedAt }, false);
}

export function markMortgageRateStale(rate: MortgageRateSnapshot) {
  return { ...rate, stale: true };
}
