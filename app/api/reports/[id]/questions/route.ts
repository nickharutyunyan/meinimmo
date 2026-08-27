import { NextRequest, NextResponse } from 'next/server';
import { defaultOfferQuestions, enrichOnlyWhenNeeded } from '@/lib/assessment';
import { requireSameOrigin } from '@/lib/auth';
import { replaceReport, report as findReport } from '@/lib/store';
import { questionsAreConcise } from '@/lib/report-copy';
import { validReportId } from '@/lib/report-note-validation';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const { id } = await context.params;
  if (!validReportId(id)) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  const current = await findReport(id);

  if (!current) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  if (current.aiEnriched && questionsAreConcise(current.offerQuestions) && questionsAreConcise(current.offerQuestionsDe)) {
    return NextResponse.json({
      offerQuestions: current.offerQuestions,
      offerQuestionsDe: current.offerQuestionsDe,
      sunOrientation: current.sunOrientation,
      aiEnriched: true,
    });
  }

  const withFallback = {
    ...current,
    offerQuestions: questionsAreConcise(current.offerQuestions) ? current.offerQuestions : defaultOfferQuestions(current),
    offerQuestionsDe: questionsAreConcise(current.offerQuestionsDe) ? current.offerQuestionsDe : defaultOfferQuestions(current, 'de'),
  };
  const enriched = await enrichOnlyWhenNeeded(withFallback, JSON.stringify(withFallback), false);
  const latest = await findReport(id);
  await replaceReport({
    ...(latest || enriched),
    offerQuestions: enriched.offerQuestions,
    offerQuestionsDe: enriched.offerQuestionsDe,
    aiEnriched: enriched.aiEnriched,
  });

  return NextResponse.json({
    offerQuestions: enriched.offerQuestions,
    offerQuestionsDe: enriched.offerQuestionsDe,
    sunOrientation: enriched.sunOrientation,
    aiEnriched: enriched.aiEnriched,
  });
}
