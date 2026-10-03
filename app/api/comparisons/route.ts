import { NextRequest, NextResponse } from 'next/server';
import { requireSameOrigin } from '@/lib/auth';
import { report, saveComparison } from '@/lib/store';
import { validReportId } from '@/lib/report-note-validation';

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const { reportIds } = await request.json() as { reportIds: string[] };
  if (!Array.isArray(reportIds) || reportIds.length !== 2 || new Set(reportIds).size !== 2 || !reportIds.every(validReportId)) {
    return NextResponse.json({ error: 'Select two properties.' }, { status: 400 });
  }
  const [first, second] = await Promise.all(reportIds.map(report));
  if (!first || !second) return NextResponse.json({ error: 'Property not found.' }, { status: 404 });
  if ((first.country || 'DE') !== (second.country || 'DE')) return NextResponse.json({ error: 'Choose two properties in the same country. Prices and financing assumptions differ across countries.' }, { status: 400 });
  const item = { id: crypto.randomUUID().replace(/-/g, '').slice(0, 16), reportIds: reportIds as [string, string], createdAt: new Date().toISOString() };
  await saveComparison(item);
  return NextResponse.json(item, { status: 201 });
}
