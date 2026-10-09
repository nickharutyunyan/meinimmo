import type { NextRequest } from 'next/server';
import { requireSameOrigin } from '@/lib/auth';
import { createSellerDraft } from '@/lib/market/pipeline';
import { takeDailySlot } from '@/lib/market/store';
import { clientSubject, json } from '@/lib/market/http';

export const runtime = 'nodejs';

const MAX_TEXT = 400_000;
const DRAFTS_PER_DAY = 12;

/** Creates a private draft from the seller's documents. Photos follow in separate uploads. */
export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  if (Number(request.headers.get('content-length') || 0) > MAX_TEXT * 2) return json({ error: 'The documents contain too much text.' }, 413);
  const body = await request.json().catch(() => null) as { text?: unknown; locale?: unknown; propertyType?: unknown } | null;
  if (!body || typeof body !== 'object') return json({ error: 'Invalid request.' }, 400);
  const locale = body.locale === 'de' ? 'de' : 'en';
  const propertyType = body.propertyType === 'house' || body.propertyType === 'land' ? body.propertyType : 'flat';
  const text = typeof body.text === 'string' ? body.text.slice(0, MAX_TEXT) : '';
  if (!await takeDailySlot(await clientSubject(request), 'draft', DRAFTS_PER_DAY)) {
    return json({ error: locale === 'de' ? 'Heute wurden von diesem Anschluss schon viele Entwürfe angelegt. Versuche es morgen wieder.' : 'Too many drafts from this connection today. Try again tomorrow.' }, 429);
  }
  const { listing, token } = await createSellerDraft({ text, locale, propertyType });
  return json({ listing, token }, 201);
}
