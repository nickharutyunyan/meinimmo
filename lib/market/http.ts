import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { clientIp } from '../identity/client-ip.ts';
import { sha256Hex } from '../security.ts';
import { canEditListing } from './store.ts';
import { LISTING_TOKEN_HEADER_NAME } from './client-constants.ts';

export { LISTING_TOKEN_HEADER_NAME as LISTING_TOKEN_HEADER } from './client-constants.ts';

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** A hashed client key for daily limits. The raw IP is never stored. */
export async function clientSubject(request: NextRequest) {
  return `ip:${(await sha256Hex(`listing-rate:${clientIp(request.headers)}`)).slice(0, 32)}`;
}

export async function authorizedEditor(request: NextRequest, id: string) {
  return canEditListing(id, request.headers.get(LISTING_TOKEN_HEADER_NAME));
}
