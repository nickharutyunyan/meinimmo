import type { NextRequest } from 'next/server';
import { appEnvironment } from '@/lib/auth-db';
import { backfillAuthorized } from '@/lib/report-backfill';
import { importPortalListing } from '@/lib/market/pipeline';
import { ListingFetchError } from '@/lib/listing-fetch';
import { json } from '@/lib/market/http';

export const runtime = 'nodejs';

/**
 * Operator import of one public portal listing into the market. Takes the
 * LISTING_IMPORT_TOKEN secret (or the backfill secret), so it is not reachable from the site. One listing per call keeps each
 * request well inside the Worker CPU limit.
 */
export async function POST(request: NextRequest) {
  const env = await appEnvironment() as Awaited<ReturnType<typeof appEnvironment>> & { LISTING_IMPORT_TOKEN?: string };
  const authorization = request.headers.get('authorization');
  if (!backfillAuthorized(authorization, env.LISTING_IMPORT_TOKEN) && !backfillAuthorized(authorization, env.BACKFILL_TOKEN)) return json({ error: 'Unauthorized.' }, 401);
  const body = await request.json().catch(() => null) as { url?: unknown; district?: unknown; refresh?: unknown; listedAt?: unknown } | null;
  if (!body || typeof body.url !== 'string') return json({ error: 'Send {"url": "..."}.' }, 400);
  try {
    const outcome = await importPortalListing({
      url: body.url,
      district: typeof body.district === 'string' ? body.district.slice(0, 60) : undefined,
      refresh: body.refresh === true,
      listedAt: typeof body.listedAt === 'string' && !Number.isNaN(Date.parse(body.listedAt)) && Date.parse(body.listedAt) <= Date.now() ? new Date(body.listedAt).toISOString() : undefined,
    });
    if (!outcome.ok) return json({ error: outcome.reason }, 422);
    const { listing, created } = outcome;
    return json({ id: listing.id, created, market: listing.market, price: listing.facts.price, photos: listing.photos.length, reportId: listing.reportId, geo: Boolean(listing.geo) }, created ? 201 : 200);
  } catch (error) {
    if (error instanceof ListingFetchError) return json({ error: error.code }, 502);
    throw error;
  }
}
