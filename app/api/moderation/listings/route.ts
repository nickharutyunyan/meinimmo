import type { NextRequest } from 'next/server';
import { json } from '@/lib/market/http';
import { moderatorUser } from '@/lib/market/moderator';
import { moderationQueue } from '@/lib/market/store';

export const runtime = 'nodejs';

/** The review queue: held, hidden and reported listings, with their reports. Moderators only. */
export async function GET(request: NextRequest) {
  if (!await moderatorUser(request)) return json({ error: 'Not found.' }, 404);
  return json({ items: await moderationQueue() });
}
