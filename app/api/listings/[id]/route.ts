import { after, type NextRequest } from 'next/server';
import { requireSameOrigin } from '@/lib/auth';
import { applyPatch, missingForPublish, type ListingPatch } from '@/lib/market/validate';
import { getListing, recentListingsForEmail, saveListing } from '@/lib/market/store';
import { moderationOnPublish, spamFlags } from '@/lib/market/moderation';
import { reviewSellerListing } from '@/lib/market/pipeline';
import { authorizedEditor, json } from '@/lib/market/http';
import type { Listing } from '@/lib/market/types';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

/** The full listing, contact details included, for the seller who holds the edit token. */
export async function GET(request: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!await authorizedEditor(request, id)) return json({ error: 'Not found.' }, 404);
  const listing = await getListing(id);
  if (!listing) return json({ error: 'Not found.' }, 404);
  return json({ listing, missing: missingForPublish(listing) });
}

/** Reviews a live listing again after its facts change, without overwriting edits made meanwhile. */
function refreshReviewLater(listing: Listing) {
  after(async () => {
    try {
      const reviewed = await reviewSellerListing(listing);
      const latest = await getListing(listing.id);
      if (!latest || latest.status !== 'published') return;
      await saveListing({ ...latest, reportId: reviewed.reportId, score: reviewed.score, geo: latest.geo || reviewed.geo });
    } catch (error) {
      console.warn('Listing review refresh failed', { message: error instanceof Error ? error.message : 'unknown error' });
    }
  });
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!requireSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const { id } = await params;
  if (!await authorizedEditor(request, id)) return json({ error: 'Not found.' }, 404);
  const listing = await getListing(id);
  if (!listing || listing.status === 'archived') return json({ error: 'Not found.' }, 404);
  const patch = await request.json().catch(() => null) as ListingPatch | null;
  if (!patch || typeof patch !== 'object') return json({ error: 'Invalid request.' }, 400);
  let next = applyPatch(listing, patch, new Date().toISOString());
  const missing = missingForPublish(next);
  const live = listing.status === 'published';
  // A verified address cannot be swapped on a live listing; the new one would reach buyers unchecked.
  if (live && next.contact.email.trim().toLowerCase() !== (listing.verifiedEmail || '')) {
    const message = listing.locale === 'de'
      ? 'Um die E-Mail eines Online-Inserats zu ändern, nimm es offline, ändere die Adresse und veröffentliche es erneut.'
      : 'To change the email of a live listing, take it offline, change the address and publish again.';
    return json({ error: message, code: 'email_locked', listing }, 422);
  }
  // Edits to a live listing go through the same checks as publishing.
  if (live) next = { ...next, moderation: moderationOnPublish(listing, spamFlags(next, { recentListingsForEmail: await recentListingsForEmail(next.contact.email, next.id) })) };
  // A live listing stays complete: an edit that would empty a required field is refused.
  if (listing.status === 'published' && missing.length) return json({ error: 'A published listing needs every required field.', missing, listing }, 422);
  await saveListing(next);
  const factsChanged = JSON.stringify([listing.facts, listing.address, listing.propertyType]) !== JSON.stringify([next.facts, next.address, next.propertyType]);
  if (next.status === 'published' && factsChanged) refreshReviewLater(next);
  return json({ listing: next, missing });
}

/** Withdraws a listing. The link then shows that the offer is no longer available. */
export async function DELETE(request: NextRequest, { params }: Context) {
  if (!requireSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const { id } = await params;
  if (!await authorizedEditor(request, id)) return json({ error: 'Not found.' }, 404);
  const listing = await getListing(id);
  if (!listing) return json({ error: 'Not found.' }, 404);
  const next: Listing = { ...listing, status: 'archived', updatedAt: new Date().toISOString() };
  await saveListing(next);
  return json({ listing: next });
}
