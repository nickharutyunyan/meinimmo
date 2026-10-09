import type { NextRequest } from 'next/server';
import { requireSameOrigin } from '@/lib/auth';
import { MAX_PHOTOS } from '@/lib/market/validate';
import { getListing, insertPhoto, saveListing, takeDailySlot, type StoredPhoto } from '@/lib/market/store';
import { authorizedEditor, clientSubject, json } from '@/lib/market/http';
import type { Listing } from '@/lib/market/types';

export const runtime = 'nodejs';

const LIMITS = { full: 1_900_000, thumb: 320_000 };
const PHOTOS_PER_DAY = 240;

type Context = { params: Promise<{ id: string }> };

function imageType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

async function readVariant(form: FormData, name: 'full' | 'thumb'): Promise<StoredPhoto | null> {
  const file = form.get(name);
  const width = Number(form.get(`${name}Width`));
  const height = Number(form.get(`${name}Height`));
  if (!file || typeof file === 'string' || file.size < 100 || file.size > LIMITS[name]) return null;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 32 || height < 32 || width > 4096 || height > 4096) return null;
  const bytes = await file.arrayBuffer();
  const contentType = imageType(new Uint8Array(bytes, 0, 12));
  return contentType ? { contentType, bytes, width, height } : null;
}

/**
 * Stores one photo. The browser sends a resized full image and a thumbnail;
 * the server checks the bytes are an image and never decodes them.
 */
export async function POST(request: NextRequest, { params }: Context) {
  if (!requireSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const { id } = await params;
  if (!await authorizedEditor(request, id)) return json({ error: 'Not found.' }, 404);
  if (Number(request.headers.get('content-length') || 0) > LIMITS.full + LIMITS.thumb + 50_000) return json({ error: 'This photo is too large.' }, 413);
  const listing = await getListing(id);
  if (!listing || listing.status === 'archived') return json({ error: 'Not found.' }, 404);
  if (listing.photos.length >= MAX_PHOTOS) return json({ error: `A listing holds up to ${MAX_PHOTOS} photos.` }, 409);
  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: 'Invalid upload.' }, 400);
  const [full, thumb] = await Promise.all([readVariant(form, 'full'), readVariant(form, 'thumb')]);
  if (!full || !thumb) return json({ error: 'Upload a JPEG, PNG or WebP photo.' }, 400);
  if (!await takeDailySlot(await clientSubject(request), 'photo', PHOTOS_PER_DAY)) return json({ error: 'Too many photo uploads from this connection today.' }, 429);
  const photoId = [...crypto.getRandomValues(new Uint8Array(8))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const now = new Date().toISOString();
  await insertPhoto(id, photoId, { full, thumb }, now);
  // Read again after the insert, so a photo removed meanwhile is not restored.
  const latest = await getListing(id) || listing;
  const next: Listing = { ...latest, photos: [...latest.photos, { kind: 'stored', id: photoId, width: full.width, height: full.height }], updatedAt: now };
  await saveListing(next);
  return json({ listing: next }, 201);
}
