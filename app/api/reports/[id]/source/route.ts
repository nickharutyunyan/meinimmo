import { report as findReport } from '@/lib/store';
import { pdfContentDisposition } from '@/lib/pdf-source';
import { validReportId } from '@/lib/report-note-validation';
import { sourcePdf } from '@/lib/source-storage';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validReportId(id)) return new Response('Not found', { status: 404 });
  const report = await findReport(id);
  if (!report?.sourceFile) return new Response('Source PDF not found', { status: 404 });
  const object = await sourcePdf(id);
  if (!object) return new Response('Source PDF not found', { status: 404 });
  return new Response(object.body, {
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Disposition': pdfContentDisposition(report.sourceFile.displayName),
      'Content-Length': String(object.size),
      'Content-Type': 'application/pdf',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
