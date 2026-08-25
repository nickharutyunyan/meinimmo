import { NextRequest, NextResponse } from 'next/server';
import { requireSameOrigin, sessionUser } from '@/lib/auth';
import { privateReportNote, savePrivateReportNote } from '@/lib/report-notes';
import { MAX_REPORT_NOTE_LENGTH, normalizeReportNote, validReportId } from '@/lib/report-note-validation';
import { report as findReport } from '@/lib/store';

const privateJson = (body: unknown, init?: ResponseInit) => {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
};

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await sessionUser(request);
  if (!user) return privateJson({ error: 'Sign in required.' }, { status: 401 });
  const { id } = await context.params;
  if (!validReportId(id)) return privateJson({ error: 'Report not found.' }, { status: 404 });
  const saved = await privateReportNote(user.id, id);
  return privateJson({ note: saved?.note || '', updatedAt: saved?.updated_at || null });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return privateJson({ error: 'Invalid request origin.' }, { status: 403 });
  const user = await sessionUser(request);
  if (!user) return privateJson({ error: 'Sign in required.' }, { status: 401 });
  const { id } = await context.params;
  if (!validReportId(id) || !await findReport(id)) return privateJson({ error: 'Report not found.' }, { status: 404 });
  try {
    const input = await request.json() as { note?: unknown };
    const note = normalizeReportNote(input.note);
    return privateJson(await savePrivateReportNote(user.id, id, note));
  } catch (error) {
    const tooLong = error instanceof Error && error.message === 'note_too_long';
    return privateJson({ error: tooLong ? `Notes can be up to ${MAX_REPORT_NOTE_LENGTH.toLocaleString('en-GB')} characters.` : 'Enter a valid note.' }, { status: 400 });
  }
}
