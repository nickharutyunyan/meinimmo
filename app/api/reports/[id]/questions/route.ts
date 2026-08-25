import { NextResponse } from 'next/server';
import { defaultOfferQuestions, enrichOnlyWhenNeeded } from '@/lib/assessment';
import { replaceReport, report as findReport } from '@/lib/store';
import { questionsAreConcise } from '@/lib/report-copy';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
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
  await replaceReport(enriched);

  return NextResponse.json({
    offerQuestions: enriched.offerQuestions,
    offerQuestionsDe: enriched.offerQuestionsDe,
    sunOrientation: enriched.sunOrientation,
    aiEnriched: enriched.aiEnriched,
  });
}
