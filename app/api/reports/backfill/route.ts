import { NextRequest, NextResponse } from 'next/server';
import { appEnvironment } from '@/lib/auth-db';
import { defaultOfferQuestions } from '@/lib/assessment';
import { looksLikePropertyListing, parseListing } from '@/lib/listing-parser';
import { backfillAuthorized, runBackfillBatch, type BackfillStatus } from '@/lib/report-backfill';
import { refreshFailureMarker } from '@/lib/report-refresh';
import { archivedListingSource, replaceReport, staleReportsForBackfill } from '@/lib/store';
import type { Report } from '@/lib/types';

async function refreshArchivedReport(item: Report): Promise<BackfillStatus> {
  const attempted = new Date().toISOString();
  const markUnavailable = () => replaceReport(refreshFailureMarker({ ...item, facts: { ...item.facts } }, attempted));
  try {
    const source = await archivedListingSource(item.id);
    if (!source || !looksLikePropertyListing(source)) {
      await markUnavailable();
      return 'unavailable';
    }
    const parsed = parseListing(source, item.source || item.id);
    if (!parsed.facts.city && !parsed.location) {
      await markUnavailable();
      return 'unavailable';
    }
    await replaceReport({
      ...parsed,
      id: item.id,
      createdAt: item.createdAt,
      sourceFile: item.sourceFile,
      sourceReviewAttemptedAt: attempted,
      offerQuestions: defaultOfferQuestions(parsed),
      offerQuestionsDe: defaultOfferQuestions(parsed, 'de'),
    });
    return 'refreshed';
  } catch {
    try {
      await markUnavailable();
      return 'unavailable';
    } catch {
      return 'error';
    }
  }
}

export async function POST(request: NextRequest) {
  const env = await appEnvironment();
  if (!backfillAuthorized(request.headers.get('authorization'), env.BACKFILL_TOKEN)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const candidates = await staleReportsForBackfill();
  const result = await runBackfillBatch({ candidates, refresh: refreshArchivedReport });
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
