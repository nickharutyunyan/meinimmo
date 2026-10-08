import { NextResponse } from 'next/server';
import { geocodeGermanLocation } from '@/lib/geocode';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim();
  if (!query || query.length > 160 || /not stated/i.test(query)) {
    return NextResponse.json({ error: 'No usable location supplied.' }, { status: 400 });
  }

  try {
    const country = new URL(request.url).searchParams.get('country') === 'AM' ? 'am' : 'de';
    const place = await geocodeGermanLocation(query, '', country);
    if (!place) return NextResponse.json({ error: 'Location not found.' }, { status: 404 });
    return NextResponse.json(place);
  } catch {
    return NextResponse.json({ error: 'Map location is temporarily unavailable.' }, { status: 502 });
  }
}
