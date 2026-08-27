import { NextResponse } from 'next/server';
import { report } from '@/lib/store';
import { validReportId } from '@/lib/report-note-validation';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validReportId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const item = await report(id);
  return item ? NextResponse.json(item) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
