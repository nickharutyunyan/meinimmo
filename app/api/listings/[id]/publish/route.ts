import type { NextRequest } from 'next/server';
import { requireSameOrigin } from '@/lib/auth';
import { missingForPublish } from '@/lib/market/validate';
import { getListing, recentListingsForEmail, saveListing, takeDailySlot } from '@/lib/market/store';
import { moderationOnPublish, spamFlags } from '@/lib/market/moderation';
import { reviewSellerListing } from '@/lib/market/pipeline';
import { authorizedEditor, clientSubject, json } from '@/lib/market/http';
import type { Listing } from '@/lib/market/types';

export const runtime = 'nodejs';

const PUBLISHES_PER_DAY = 6;

type Context = { params: Promise<{ id: string }> };

/** Publishes a complete draft, reviews it and pins it on the map. */
export async function POST(request: NextRequest, { params }: Context) {
  if (!requireSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const { id } = await params;
  if (!await authorizedEditor(request, id)) return json({ error: 'Not found.' }, 404);
  const listing = await getListing(id);
  if (!listing || listing.status === 'archived') return json({ error: 'Not found.' }, 404);
  const missing = missingForPublish(listing);
  if (missing.length) return json({ error: 'Some details are still missing.', missing }, 422);
  if (listing.status !== 'published' && !await takeDailySlot(await clientSubject(request), 'publish', PUBLISHES_PER_DAY)) {
    return json({ error: listing.locale === 'de' ? 'Heute wurden von diesem Anschluss schon viele Angebote veröffentlicht.' : 'Too many listings published from this connection today.' }, 429);
  }
  // The contact email must be the one the seller proved with a code.
  if (listing.verifiedEmail !== listing.contact.email.trim().toLowerCase()) {
    return json({ error: listing.locale === 'de' ? 'Bitte bestätige zuerst deine E-Mail-Adresse.' : 'Confirm your email address first.', code: 'verify_email' }, 409);
  }
  const flags = spamFlags(listing, { recentListingsForEmail: await recentListingsForEmail(listing.contact.email, listing.id) });
  const reviewed = await reviewSellerListing(listing);
  const now = new Date().toISOString();
  const next: Listing = {
    ...reviewed,
    status: 'published',
    moderation: moderationOnPublish(listing, flags),
    publishedAt: listing.publishedAt || now,
    updatedAt: now,
  };
  await saveListing(next);
  return json({ listing: next, missing: [] });
}

/** Takes a listing offline again. It keeps its link and can be republished. */
export async function DELETE(request: NextRequest, { params }: Context) {
  if (!requireSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const { id } = await params;
  if (!await authorizedEditor(request, id)) return json({ error: 'Not found.' }, 404);
  const listing = await getListing(id);
  if (!listing || listing.status === 'archived') return json({ error: 'Not found.' }, 404);
  const next: Listing = { ...listing, status: 'draft', updatedAt: new Date().toISOString() };
  await saveListing(next);
  return json({ listing: next, missing: missingForPublish(next) });
}
