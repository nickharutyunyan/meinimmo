import { NextRequest, NextResponse } from 'next/server';
import { appEnvironment } from '@/lib/auth-db';
import { backfillAuthorized, configuredBackfillBatchSize, mergedBackfillReport, runBackfillBatch, type BackfillStatus } from '@/lib/report-backfill';
import type { Report } from '@/lib/types';

export async function POST(request: NextRequest) {
  const env = await appEnvironment();
  if (!backfillAuthorized(request.headers.get('authorization'), env.BACKFILL_TOKEN)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const [{ defaultOfferQuestions }, { archivedListingAccepted, htmlToLines, parseListing }, { refreshFailureMarker }, { archivedListingSource, replaceReport, staleReportCount, staleReportsForBackfill }] = await Promise.all([
    import('@/lib/assessment'),
    import('@/lib/listing-parser'),
    import('@/lib/report-refresh'),
    import('@/lib/store'),
  ]);

  async function refreshArchivedReport(item: Report): Promise<BackfillStatus> {
    const attempted = new Date().toISOString();
    const markUnavailable = () => replaceReport(refreshFailureMarker({ ...item, facts: { ...item.facts } }, attempted));
    try {
      const source = await archivedListingSource(item.id);
      const lines = source ? htmlToLines(source) : [];
      const accepted = Boolean(source) && archivedListingAccepted(source, lines);
      const parsed = accepted ? parseListing(source, item.source || item.id, lines) : undefined;
      if (!parsed || (!parsed.facts.city && !parsed.location)) {
        await markUnavailable();
        return 'unavailable';
      }
      const refreshed = item.aiEnriched ? parsed : {
        ...parsed,
        offerQuestions: defaultOfferQuestions(parsed),
        offerQuestionsDe: defaultOfferQuestions(parsed, 'de'),
      };
      await replaceReport(mergedBackfillReport(item, refreshed, attempted));
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

  const batchSize = configuredBackfillBatchSize(env.BACKFILL_BATCH_SIZE);
  const [pending, candidates] = await Promise.all([
    staleReportCount(),
    staleReportsForBackfill(batchSize),
  ]);
  const result = await runBackfillBatch({ candidates, batchSize, refresh: refreshArchivedReport });
  const remaining = Math.max(0, pending - result.processed.length);
  return NextResponse.json({ ...result, remaining }, { headers: { 'Cache-Control': 'no-store' } });
}
