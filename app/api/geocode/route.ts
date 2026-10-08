import { NextRequest, NextResponse } from 'next/server';
import { requireSameOrigin } from '@/lib/auth';
import { rejectGeocodeRequest } from '@/lib/geocode';
import { viewGeocode } from '@/lib/geocode-runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers: noStore });
  const decision = rejectGeocodeRequest(request.url, request.headers.get('origin'));
  if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: decision.status, headers: noStore });
  try {
    const result = await viewGeocode(decision);
    if (!result.place) return NextResponse.json({ error: 'Location not found.' }, { status: 404, headers: noStore });
    return NextResponse.json({ lat: result.place.lat, lon: result.place.lon, label: result.place.label }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: 'Map location is temporarily unavailable.' }, { status: 502, headers: noStore });
  }
}
