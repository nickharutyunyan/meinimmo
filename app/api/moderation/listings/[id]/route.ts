import type { NextRequest } from 'next/server';
import { requireSameOrigin } from '@/lib/auth';
import { json } from '@/lib/market/http';
import { moderatorUser } from '@/lib/market/moderator';
import { clearReports, getListing, saveListing } from '@/lib/market/store';
import { decide, type ModerationDecision } from '@/lib/market/moderation';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

const DECISIONS: ModerationDecision[] = ['approve', 'reject', 'hide'];

/** Approve, reject or hide a listing. Approving or rejecting closes its open reports. */
export async function POST(request: NextRequest, { params }: Context) {
  if (!requireSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const moderator = await moderatorUser(request);
  if (!moderator) return json({ error: 'Not found.' }, 404);
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return json({ error: 'Not found.' }, 404);
  const body = await request.json().catch(() => null) as { decision?: unknown; note?: unknown } | null;
  const decision = DECISIONS.find(value => value === body?.decision);
  if (!decision) return json({ error: 'Choose approve, reject or hide.' }, 400);
  const note = typeof body?.note === 'string' ? body.note : '';
  const next = decide(listing, decision, note, new Date().toISOString());
  await saveListing(next);
  if (decision !== 'hide') await clearReports(id);
  console.info(JSON.stringify({ tag: 'listing_moderation', listing: id, decision, moderator: moderator.id }));
  return json({ listing: next });
}
