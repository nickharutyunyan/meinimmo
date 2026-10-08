import { NextRequest, NextResponse } from 'next/server';
import { requireSameOrigin } from '@/lib/auth';
import { feedbackErrorMessage, feedbackIsLimited, feedbackLocale, feedbackSubjectKey, isMissingFeedbackTable, validateFactFeedback } from '@/lib/fact-feedback';
import { factFeedbackReady, insertFactFeedback, recordFactFeedbackAttempt, reportExtractionVersion } from '@/lib/fact-feedback-store';
import { validReportId } from '@/lib/report-note-validation';

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const acceptLanguage = request.headers.get('accept-language') || '';
  const locale = feedbackLocale(undefined, acceptLanguage);
  if (!requireSameOrigin(request)) return json({ error: feedbackErrorMessage('origin', locale) }, 403);
  const { id } = await context.params;
  if (!validReportId(id)) return json({ error: feedbackErrorMessage('notFound', locale) }, 404);
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 4_000) return json({ error: feedbackErrorMessage('body', locale) }, 400);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: feedbackErrorMessage('body', locale) }, 400);
  }
  const parsed = validateFactFeedback(payload, acceptLanguage);
  if (!parsed.ok) return json({ error: feedbackErrorMessage(parsed.error, parsed.locale) }, 400);

  const saved = await reportExtractionVersion(id);
  if (!saved) return json({ error: feedbackErrorMessage('notFound', parsed.value.locale) }, 404);

  try {
    if (!await factFeedbackReady()) return json({ error: feedbackErrorMessage('unavailable', parsed.value.locale) }, 503);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const attempts = await recordFactFeedbackAttempt(await feedbackSubjectKey(ip, id));
    if (feedbackIsLimited(attempts)) return json({ error: feedbackErrorMessage('tooMany', parsed.value.locale) }, 429);

    await insertFactFeedback({
      id: crypto.randomUUID(),
      reportId: id,
      field: parsed.value.field,
      reportedValue: parsed.value.reportedValue,
      suggestedValue: parsed.value.suggestedValue,
      comment: parsed.value.comment,
      extractionVersion: saved.extractionVersion,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    if (isMissingFeedbackTable(error)) return json({ error: feedbackErrorMessage('unavailable', parsed.value.locale) }, 503);
    throw error;
  }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
