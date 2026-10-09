import type { NextRequest } from 'next/server';
import { requireSameOrigin } from '@/lib/auth';
import { deletePhoto, getListing, readPhoto, saveListing } from '@/lib/market/store';
import { authorizedEditor, json } from '@/lib/market/http';
import { missingForPublish } from '@/lib/market/validate';
import type { Listing } from '@/lib/market/types';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string; photoId: string }> };

const VALID = /^[0-9a-f]{16}$/;

/**
 * Serves a stored photo. Photo ids are random and never reused, so the bytes behind
 * one URL never change and browsers may cache them for a year.
 */
export async function GET(request: NextRequest, { params }: Context) {
  const { id, photoId } = await params;
  if (!/^[0-9a-f]{12}$/.test(id) || !VALID.test(photoId)) return new Response('Not found', { status: 404 });
  const variant = request.nextUrl.searchParams.get('v') === 'thumb' ? 'thumb' : 'full';
  const photo = await readPhoto(id, photoId, variant);
  if (!photo) return new Response('Not found', { status: 404 });
  return new Response(photo.bytes, {
    headers: {
      'Content-Type': photo.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!requireSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const { id, photoId } = await params;
  if (!VALID.test(photoId) || !await authorizedEditor(request, id)) return json({ error: 'Not found.' }, 404);
  const listing = await getListing(id);
  if (!listing) return json({ error: 'Not found.' }, 404);
  const photos = listing.photos.filter(photo => photo.kind !== 'stored' || photo.id !== photoId);
  if (listing.status === 'published' && !photos.length) return json({ error: 'A published listing keeps at least one photo.', missing: ['photos'], listing }, 422);
  const next: Listing = { ...listing, photos, updatedAt: new Date().toISOString() };
  await saveListing(next);
  await deletePhoto(id, photoId);
  return json({ listing: next, missing: missingForPublish(next) });
}
