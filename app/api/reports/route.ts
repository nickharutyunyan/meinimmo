import { NextResponse } from 'next/server';
import { report } from '@/lib/store';
import { validReportId } from '@/lib/report-note-validation';

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('ids')?.split(',').filter(validReportId).slice(0, 30) || [];
  if (!requested.length) return NextResponse.json([]);
  const items = await Promise.all([...new Set(requested)].map(report));
  return NextResponse.json(items.filter(Boolean));
}
