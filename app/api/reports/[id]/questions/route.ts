import { NextResponse } from 'next/server';
import { defaultOfferQuestions, enrichOnlyWhenNeeded } from '@/lib/assessment';
import { replaceReport, report as findReport } from '@/lib/store';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const current = await findReport(id);

  if (!current) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  if (current.aiEnriched && current.offerQuestions?.length) {
    return NextResponse.json({
      offerQuestions: current.offerQuestions,
      sunOrientation: current.sunOrientation,
      aiEnriched: true,
    });
  }

  const withFallback = {
    ...current,
    offerQuestions: current.offerQuestions?.length ? current.offerQuestions : defaultOfferQuestions(current),
  };
  const enriched = await enrichOnlyWhenNeeded(withFallback, JSON.stringify(withFallback));
  await replaceReport(enriched);

  return NextResponse.json({
    offerQuestions: enriched.offerQuestions,
    sunOrientation: enriched.sunOrientation,
    aiEnriched: enriched.aiEnriched,
  });
}
