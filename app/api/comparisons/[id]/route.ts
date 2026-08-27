import { NextResponse } from 'next/server';
import { comparison, report } from '@/lib/store';
import { validReportId } from '@/lib/report-note-validation';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validReportId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const item = await comparison(id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const results = await Promise.all(item.reportIds.map(report));
  return results.every(Boolean) ? NextResponse.json({ ...item, reports: results }) : NextResponse.json({ error: 'Missing property' }, { status: 404 });
}
