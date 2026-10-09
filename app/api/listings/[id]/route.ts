import { after, type NextRequest } from 'next/server';
import { requireSameOrigin } from '@/lib/auth';
import { applyPatch, missingForPublish, type ListingPatch } from '@/lib/market/validate';
import { getListing, saveListing } from '@/lib/market/store';
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
  const next = applyPatch(listing, patch, new Date().toISOString());
  const missing = missingForPublish(next);
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
