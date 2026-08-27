import { NextResponse } from 'next/server';
import { FMH_MORTGAGE_RATE_SOURCE_URL, parseFmhMortgageRate } from '@/lib/fmh-mortgage-rate';
import { markMortgageRateStale, saveMortgageRate, storedMortgageRate } from '@/lib/mortgage-rate-store';

export const dynamic = 'force-dynamic';

const REFRESH_AFTER_MS = 60 * 60 * 1_000;
const responseHeaders = {
  'Cache-Control': 'public, max-age=900, s-maxage=3600, stale-while-revalidate=86400',
};

export async function GET() {
  let stored;
  try {
    stored = await storedMortgageRate();
    if (stored && Date.now() - Date.parse(stored.fetchedAt) < REFRESH_AFTER_MS) {
      return NextResponse.json(stored, { headers: responseHeaders });
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
      return NextResponse.json(await saveMortgageRate(parsed.rate, parsed.observedAt), { headers: responseHeaders });
    } catch {
      return NextResponse.json({
        ...parsed,
        fetchedAt: new Date().toISOString(),
        sourceName: 'FMH Index',
        sourceUrl: FMH_MORTGAGE_RATE_SOURCE_URL,
        fixationYears: 10,
        stale: false,
      }, { headers: responseHeaders });
    }
  } catch {
    if (stored) return NextResponse.json(markMortgageRateStale(stored), { headers: responseHeaders });
    return NextResponse.json({ error: 'The current German mortgage-rate average is temporarily unavailable.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
