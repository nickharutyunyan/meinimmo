import type { NextRequest } from 'next/server';
import { requireSameOrigin } from '@/lib/auth';
import { clientIp } from '@/lib/identity/client-ip';
import { constantTimeEqual, sha256Hex } from '@/lib/security';
import { deleteEmailCode, getListing, saveEmailCode, saveListing, takeEmailCodeAttempt } from '@/lib/market/store';
import { authorizedEditor, json } from '@/lib/market/http';
import { newEmailCode } from '@/lib/market/moderation';
import { sendListingCode } from '@/lib/market/email';
import { displayTitle, validEmail } from '@/lib/market/validate';

export const runtime = 'nodejs';

const CODE_TTL_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Context = { params: Promise<{ id: string }> };

async function codeHash(listingId: string, email: string, code: string) {
  return sha256Hex(`listing-code:${listingId}:${email}:${code}`);
}

/**
 * Proves the seller can read the contact email before a listing goes live.
 * { action: 'send' } mails a six-digit code; { action: 'check', code } confirms it.
 */
export async function POST(request: NextRequest, { params }: Context) {
  if (!requireSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const { id } = await params;
  if (!await authorizedEditor(request, id)) return json({ error: 'Not found.' }, 404);
  const listing = await getListing(id);
  if (!listing || listing.status === 'archived') return json({ error: 'Not found.' }, 404);
  const de = listing.locale === 'de';
  const body = await request.json().catch(() => null) as { action?: unknown; code?: unknown } | null;
  const email = listing.contact.email.trim().toLowerCase();
  if (!validEmail(email)) return json({ error: de ? 'Bitte zuerst eine gültige E-Mail-Adresse eingeben.' : 'Enter a valid email address first.' }, 422);
  if (listing.verifiedEmail === email) return json({ verified: true, email });

  if (body?.action === 'send') {
    const code = newEmailCode();
    const now = new Date();
    await saveEmailCode(id, email, await codeHash(id, email, code), new Date(now.getTime() + CODE_TTL_MS).toISOString(), now.toISOString());
    const delivery = await sendListingCode({
      to: email,
      code,
      title: displayTitle(listing, listing.locale),
      locale: listing.locale,
      ip: clientIp(request.headers),
      idempotencyKey: (await sha256Hex(`${id}:${code}`)).slice(0, 40),
    }).catch(() => 'unavailable' as const);
    if (delivery === 'limited') return json({ error: de ? 'Zu viele Codes in kurzer Zeit. Bitte in einer Stunde erneut versuchen.' : 'Too many codes requested. Try again in an hour.' }, 429);
    if (delivery === 'unavailable') return json({ error: de ? 'Die E-Mail konnte gerade nicht gesendet werden. Bitte später erneut versuchen.' : 'The email could not be sent right now. Please try again later.' }, 503);
    return json({ sent: true, email });
  }

  if (body?.action === 'check') {
    const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
    const stored = await takeEmailCodeAttempt(id);
    const wrong = de ? 'Der Code stimmt nicht. Bitte prüfe die E-Mail oder fordere einen neuen an.' : 'That code does not match. Check the email or request a new one.';
    if (!stored || stored.email !== email || Date.parse(stored.expires_at) < Date.now()) return json({ error: de ? 'Der Code ist abgelaufen. Bitte fordere einen neuen an.' : 'The code has expired. Request a new one.' }, 410);
    if (stored.attempts > MAX_ATTEMPTS) return json({ error: de ? 'Zu viele Versuche. Bitte fordere einen neuen Code an.' : 'Too many attempts. Request a new code.' }, 429);
    if (code.length !== 6 || !constantTimeEqual(stored.code_hash, await codeHash(id, email, code))) return json({ error: wrong }, 422);
    const latest = await getListing(id) || listing;
    await saveListing({ ...latest, verifiedEmail: email, updatedAt: new Date().toISOString() });
    await deleteEmailCode(id);
    return json({ verified: true, email });
  }

  return json({ error: 'Invalid request.' }, 400);
}
