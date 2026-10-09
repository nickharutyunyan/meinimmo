import type { NextRequest } from 'next/server';
import { requireSameOrigin } from '@/lib/auth';
import { addReport, getListing, saveListing, takeDailySlot, type ReportReason } from '@/lib/market/store';
import { clientSubject, json } from '@/lib/market/http';
import { isPublic, moderationOf, REPORTS_TO_HIDE } from '@/lib/market/moderation';

export const runtime = 'nodejs';

const REASONS: ReportReason[] = ['spam', 'scam', 'wrong', 'unavailable', 'other'];
const REPORTS_PER_DAY = 20;

type Context = { params: Promise<{ id: string }> };

/** A buyer flags a listing. Enough distinct reporters take it down until a moderator decides. */
export async function POST(request: NextRequest, { params }: Context) {
  if (!requireSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing || !isPublic(listing)) return json({ error: 'Not found.' }, 404);
  const body = await request.json().catch(() => null) as { reason?: unknown; note?: unknown } | null;
  const reason = REASONS.find(value => value === body?.reason);
  if (!reason) return json({ error: 'Choose a reason.' }, 400);
  const note = typeof body?.note === 'string' ? body.note.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 500) : '';
  const subject = await clientSubject(request);
  if (!await takeDailySlot(subject, 'report', REPORTS_PER_DAY)) return json({ error: 'Too many reports from this connection today.' }, 429);
  const now = new Date().toISOString();
  const reporters = await addReport(id, subject, reason, note, now);
  if (reporters >= REPORTS_TO_HIDE && moderationOf(listing).state !== 'hidden') {
    const current = moderationOf(listing);
    await saveListing({ ...listing, moderation: { ...current, state: 'hidden', flags: [...new Set([...current.flags, 'reports' as const])] }, updatedAt: now });
  }
  return json({ received: true }, 201);
}
